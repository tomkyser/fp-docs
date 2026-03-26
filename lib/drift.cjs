'use strict';

/**
 * Drift -- Drift detection and staleness tracking for fp-docs.
 *
 * Maps changed source files to affected documentation via source_to_docs
 * config mapping, manages staleness signals (append, dedup, clear), and
 * provides nudge formatting for session start notifications.
 *
 * Features:
 * - Drift analysis: git diff -> source_to_docs mapping -> affected docs
 * - Staleness signals: append-only with dedup by doc_path (highest severity wins) (D-06)
 * - Staleness data in dedicated .fp-docs/staleness.json, separate from state.json (D-05)
 * - Pending merge: git hooks write drift-pending.json, session start merges into staleness (D-02)
 * - Nudge formatting: summary + top 3 docs + actionable command (D-09/D-10/D-11/D-12)
 *
 * CLI surface via `fp-tools drift <analyze|status|clear|add-signal|list>` (D-08).
 *
 * Zero external dependencies -- Node.js built-ins only (D-15).
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { output, error, safeReadFile, safeJsonParse } = require('./core.cjs');
const { getPluginRoot, getCodebaseRoot, getDocsRoot } = require('./paths.cjs');
const { loadConfig } = require('./config.cjs');

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_STALENESS = { version: 1, signals: [], last_updated: null };
const SEVERITY_ORDER = { high: 3, medium: 2, low: 1 };

// ── Module-level cache ────────────────────────────────────────────────────────

let _cachedStaleness = null;

// ── Internal Functions ────────────────────────────────────────────────────────

/**
 * Ensure a directory exists, creating it recursively if needed.
 *
 * @param {string} dirPath - Directory path to ensure
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Resolve the docs root path, returning null if unavailable.
 *
 * @returns {string|null} Absolute path to docs root, or null
 */
function resolveDocsRoot() {
  try {
    const codebaseRoot = getCodebaseRoot();
    const docsInfo = getDocsRoot(codebaseRoot);
    return (docsInfo.path && docsInfo.exists) ? docsInfo.path : null;
  } catch { return null; }
}

/**
 * Get the staleness.json path for a given docs root.
 *
 * @param {string} docsRoot - The docs root directory
 * @returns {string} Absolute path to staleness.json
 */
function getStalenessPath(docsRoot) {
  return path.join(docsRoot, '.fp-docs', 'staleness.json');
}

/**
 * Get the drift-pending.json path for a given docs root.
 *
 * @param {string} docsRoot - The docs root directory
 * @returns {string} Absolute path to drift-pending.json
 */
function getPendingPath(docsRoot) {
  return path.join(docsRoot, '.fp-docs', 'drift-pending.json');
}

/**
 * Write data to a file using atomic rename pattern.
 * Writes to .tmp file first, then renames for atomicity.
 *
 * @param {object} data - Data to write as JSON
 * @param {string} filePath - Target file path
 */
function writeAtomic(data, filePath) {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

// ── Exported Functions ────────────────────────────────────────────────────────

/**
 * Load staleness data from disk, with caching.
 *
 * If file is missing, returns a copy of DEFAULT_STALENESS.
 * Cache is bypassed when an explicit stalenessPath is provided.
 *
 * @param {string} [stalenessPath] - Optional explicit path to staleness.json
 * @returns {object} Staleness object with version, signals, last_updated
 */
function loadStaleness(stalenessPath) {
  // Return cache if available and no explicit path override
  if (_cachedStaleness && !stalenessPath) {
    return _cachedStaleness;
  }

  let resolvedPath = stalenessPath;

  // If no explicit path, resolve from docs root
  if (!resolvedPath) {
    const docsRoot = resolveDocsRoot();
    if (!docsRoot) {
      return { ...DEFAULT_STALENESS, signals: [] };
    }
    resolvedPath = getStalenessPath(docsRoot);
  }

  const raw = safeReadFile(resolvedPath);

  if (!raw) {
    return { ...DEFAULT_STALENESS, signals: [] };
  }

  const result = safeJsonParse(raw);
  if (!result.ok) {
    return { ...DEFAULT_STALENESS, signals: [] };
  }

  const data = result.data;
  if (!Array.isArray(data.signals)) data.signals = [];

  if (!stalenessPath) _cachedStaleness = data;
  return data;
}

/**
 * Save staleness data to disk via atomic write.
 * Updates last_updated to current timestamp. Clears module cache.
 *
 * @param {object} data - Staleness data to save
 * @param {string} [stalenessPath] - Optional explicit path to staleness.json
 */
function saveStaleness(data, stalenessPath) {
  let resolvedPath = stalenessPath;

  if (!resolvedPath) {
    const docsRoot = resolveDocsRoot();
    if (!docsRoot) return;
    resolvedPath = getStalenessPath(docsRoot);
  }

  data.last_updated = new Date().toISOString();
  writeAtomic(data, resolvedPath);

  // Clear cache
  _cachedStaleness = null;
}

/**
 * Add a staleness signal with dedup by doc_path.
 *
 * If a signal for the same doc_path already exists:
 * - Keep the one with higher severity (per SEVERITY_ORDER)
 * - If equal severity, keep the one with newer timestamp
 *
 * @param {object} signal - Signal to add { doc_path, source, reason, severity, timestamp, source_files_changed }
 * @param {string} [stalenessPath] - Optional explicit path to staleness.json
 * @returns {object} The final signal for that doc_path
 */
function addSignal(signal, stalenessPath) {
  const data = loadStaleness(stalenessPath);
  const existingIdx = data.signals.findIndex(s => s.doc_path === signal.doc_path);

  if (existingIdx !== -1) {
    const existing = data.signals[existingIdx];
    const existingSev = SEVERITY_ORDER[existing.severity] || 0;
    const newSev = SEVERITY_ORDER[signal.severity] || 0;

    if (newSev > existingSev) {
      // New signal has higher severity -- replace
      data.signals[existingIdx] = signal;
    } else if (newSev === existingSev) {
      // Same severity -- keep newer timestamp
      if (signal.timestamp > existing.timestamp) {
        data.signals[existingIdx] = signal;
      }
    }
    // else: existing has higher severity -- keep existing
  } else {
    data.signals.push(signal);
  }

  saveStaleness(data, stalenessPath);
  return data.signals[existingIdx !== -1 ? existingIdx : data.signals.length - 1];
}

/**
 * Clear staleness signals.
 *
 * If docPath is provided, clears only signals matching that doc_path.
 * If no docPath, clears all signals (empty array).
 *
 * @param {string} [docPath] - Optional doc_path to clear
 * @param {string} [stalenessPath] - Optional explicit path to staleness.json
 * @returns {{ cleared: number, remaining: number }}
 */
function clearSignals(docPath, stalenessPath) {
  const data = loadStaleness(stalenessPath);
  const before = data.signals.length;

  if (docPath) {
    data.signals = data.signals.filter(s => s.doc_path !== docPath);
  } else {
    data.signals = [];
  }

  const cleared = before - data.signals.length;
  saveStaleness(data, stalenessPath);

  return { cleared, remaining: data.signals.length };
}

/**
 * Analyze drift by mapping changed source files to affected docs.
 *
 * When mockChangedFiles is provided, uses that instead of running git.
 *
 * @param {string|null} codebaseRoot - Codebase root for git operations
 * @param {string|null} outputPath - Optional path to write signals JSON (for git hook use)
 * @param {string} [configPath] - Optional config.json path
 * @param {string[]} [mockChangedFiles] - Mock changed files for testing
 * @returns {{ affected_docs: number, signals: Array<object> }}
 */
function analyzeDrift(codebaseRoot, outputPath, configPath, mockChangedFiles) {
  // Get changed files
  const changedFiles = mockChangedFiles || getChangedFiles(codebaseRoot);

  // Load source_to_docs mapping from config
  const config = loadConfig(configPath);
  const sourceToDocsMap = (config.project && config.project.source_to_docs) || {};

  // Map changed files to affected docs
  const affected = {};

  for (const file of changedFiles) {
    for (const [sourcePattern, docTarget] of Object.entries(sourceToDocsMap)) {
      if (file === sourcePattern || file.startsWith(sourcePattern)) {
        if (!affected[docTarget]) {
          affected[docTarget] = [];
        }
        affected[docTarget].push(file);
        break; // First match wins per file
      }
    }
  }

  // Build signal entries
  const signals = Object.entries(affected).map(([docPath, sourceFiles]) => ({
    doc_path: docPath,
    source: 'post-merge',
    reason: 'Source files changed',
    severity: 'high',
    timestamp: new Date().toISOString(),
    source_files_changed: sourceFiles,
  }));

  // Write output file if requested (for git hook use per D-02)
  if (outputPath) {
    ensureDir(path.dirname(outputPath));
    fs.writeFileSync(outputPath, JSON.stringify(signals, null, 2), 'utf-8');
  }

  return { affected_docs: Object.keys(affected).length, signals };
}

/**
 * Get changed files from git diff-tree.
 *
 * Runs `git -C {codebaseRoot} diff-tree -r --name-only --no-commit-id ORIG_HEAD HEAD`.
 * When mockOutput is provided, parses that instead of running git.
 *
 * @param {string|null} codebaseRoot - Codebase root path
 * @param {string} [mockOutput] - Mock git output for testing
 * @returns {string[]} Array of changed file paths
 */
function getChangedFiles(codebaseRoot, mockOutput) {
  let gitOutput = mockOutput;

  if (gitOutput === undefined && codebaseRoot) {
    try {
      gitOutput = execFileSync('git', [
        '-C', codebaseRoot, 'diff-tree',
        '-r', '--name-only', '--no-commit-id',
        'ORIG_HEAD', 'HEAD',
      ], {
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 10000,
      }).trim();
    } catch {
      return [];
    }
  }

  if (!gitOutput) return [];

  return gitOutput.trim().split('\n').filter(Boolean);
}

/**
 * Merge pending drift signals into staleness.
 *
 * Reads drift-pending.json, adds each signal via addSignal (with dedup),
 * then deletes the pending file.
 *
 * @param {string} [stalenessPath] - Optional explicit path to staleness.json
 * @param {string} [pendingPath] - Optional explicit path to drift-pending.json
 * @returns {{ merged: number }}
 */
function mergePending(stalenessPath, pendingPath) {
  let resolvedPendingPath = pendingPath;

  if (!resolvedPendingPath) {
    const docsRoot = resolveDocsRoot();
    if (!docsRoot) return { merged: 0 };
    resolvedPendingPath = getPendingPath(docsRoot);
  }

  const raw = safeReadFile(resolvedPendingPath);
  if (!raw) return { merged: 0 };

  const result = safeJsonParse(raw);
  if (!result.ok || !Array.isArray(result.data)) return { merged: 0 };

  const pendingSignals = result.data;

  for (const signal of pendingSignals) {
    addSignal(signal, stalenessPath);
  }

  // Delete pending file after merge
  try {
    fs.unlinkSync(resolvedPendingPath);
  } catch {
    // Best-effort cleanup
  }

  return { merged: pendingSignals.length };
}

/**
 * Sort signals by priority.
 *
 * Sort order:
 * 1. Severity descending (high > medium > low)
 * 2. source_files_changed count descending (most changed first)
 * 3. Timestamp descending (newest first)
 *
 * @param {Array<object>} signals - Array of staleness signals
 * @returns {Array<object>} New sorted array
 */
function sortByPriority(signals) {
  return [...signals].sort((a, b) => {
    // Severity descending
    const sevDiff = (SEVERITY_ORDER[b.severity] || 0) - (SEVERITY_ORDER[a.severity] || 0);
    if (sevDiff !== 0) return sevDiff;

    // Source files changed count descending
    const aCount = (a.source_files_changed || []).length;
    const bCount = (b.source_files_changed || []).length;
    if (bCount !== aCount) return bCount - aCount;

    // Timestamp descending (newer first)
    return (b.timestamp || '').localeCompare(a.timestamp || '');
  });
}

/**
 * Format a nudge message from staleness signals.
 *
 * Per D-09: Summary + top 3 docs format.
 * Per D-10: Empty string when no signals.
 * Per D-11: Includes actionable command suggestion.
 * Per D-12: Always nudge if signals exist.
 *
 * @param {Array<object>} signals - Array of staleness signals
 * @returns {string} Formatted nudge message, or empty string if no signals
 */
function formatNudge(signals) {
  if (!signals || signals.length === 0) return '';

  const sorted = sortByPriority(signals);
  const total = sorted.length;
  const topCount = Math.min(3, total);
  const topItems = sorted.slice(0, topCount);

  const docLabel = total === 1 ? 'doc' : 'docs';
  const topDetails = topItems.map(s => {
    const changedCount = (s.source_files_changed || []).length;
    const detail = changedCount > 0
      ? `${changedCount} source file${changedCount === 1 ? '' : 's'} changed`
      : `${s.severity} severity`;
    // Extract a readable doc name from the path
    const docName = s.doc_path.replace(/^docs\//, '').replace(/\/$/, '');
    return `${docName} (${detail})`;
  }).join(', ');

  let msg = `${total} ${docLabel} may need attention.`;
  if (topCount > 0) {
    msg += ` Top ${topCount}: ${topDetails}.`;
  }
  msg += ` Run /fp-docs:auto-revise to update affected docs, or /fp-docs:drift status for details.`;

  return msg;
}

// ── Git Hook Installation ─────────────────────────────────────────────────────

/**
 * Install a git hook from a template with baked-in paths.
 *
 * Backs up any existing hook before overwriting (D-01).
 * Substitutes __FP_TOOLS_PATH__, __FP_DOCS_DIR__, __CODEBASE_ROOT__ (D-03).
 * Sets executable permissions (0o755) per Pitfall 7.
 *
 * @param {string} hookName - Hook name (e.g., 'post-merge', 'post-rewrite')
 * @param {string} codebaseRoot - Absolute path to codebase root
 * @param {string} fpToolsPath - Absolute path to fp-tools.cjs
 * @param {string} fpDocsDir - Absolute path to .fp-docs/ directory
 * @returns {{ installed: boolean, hook: string, path: string, backed_up: boolean }}
 */
function installGitHook(hookName, codebaseRoot, fpToolsPath, fpDocsDir) {
  const hookDir = path.join(codebaseRoot, '.git', 'hooks');
  const hookPath = path.join(hookDir, hookName);

  // Backup existing hook if present (D-01)
  let backedUp = false;
  if (fs.existsSync(hookPath)) {
    let backupPath = hookPath + '.backup-fp-docs';
    let counter = 1;
    while (fs.existsSync(backupPath)) {
      backupPath = hookPath + `.backup-fp-docs.${counter}`;
      counter++;
    }
    fs.copyFileSync(hookPath, backupPath);
    backedUp = true;
  }

  // Read template (throw on missing -- template must exist)
  const templatePath = path.join(getPluginRoot(), 'framework', 'templates', hookName + '.sh');
  let template = fs.readFileSync(templatePath, 'utf-8');

  // Substitute paths (D-03)
  template = template.replace(/__FP_TOOLS_PATH__/g, fpToolsPath);
  template = template.replace(/__FP_DOCS_DIR__/g, fpDocsDir);
  template = template.replace(/__CODEBASE_ROOT__/g, codebaseRoot);

  // Ensure hooks directory exists
  ensureDir(hookDir);

  // Write hook and set executable (Pitfall 7)
  fs.writeFileSync(hookPath, template, 'utf-8');
  fs.chmodSync(hookPath, 0o755);

  return { installed: true, hook: hookName, path: hookPath, backed_up: backedUp };
}

/**
 * Install all fp-docs git hooks into a codebase repository.
 *
 * Installs post-merge and post-rewrite hooks with baked paths.
 *
 * @param {string} codebaseRoot - Absolute path to codebase root
 * @returns {{ hooks_installed: string[], codebase_root: string }}
 */
function installAllHooks(codebaseRoot) {
  const fpToolsPath = path.join(getPluginRoot(), 'fp-tools.cjs');
  const docsInfo = getDocsRoot(codebaseRoot);
  const fpDocsDir = path.join(docsInfo.path, '.fp-docs');

  installGitHook('post-merge', codebaseRoot, fpToolsPath, fpDocsDir);
  installGitHook('post-rewrite', codebaseRoot, fpToolsPath, fpDocsDir);

  return { hooks_installed: ['post-merge', 'post-rewrite'], codebase_root: codebaseRoot };
}

// ── Shell Integration ─────────────────────────────────────────────────────────

/**
 * Install shell prompt integration for out-of-CC drift notifications.
 *
 * Reads the fp-docs-shell.zsh template, substitutes placeholder paths
 * with baked values (per D-03), and writes the result to the codebase root.
 * The user must manually add a source line to their .zshrc.
 *
 * @param {string} codebaseRoot - Absolute path to the codebase root
 * @returns {{ installed: boolean, path: string, source_line: string }}
 */
function installShellIntegration(codebaseRoot) {
  const docsInfo = getDocsRoot(codebaseRoot);
  const fpDocsDir = path.join(docsInfo.path, '.fp-docs');

  // Read template from plugin framework/templates/
  const templatePath = path.join(getPluginRoot(), 'framework', 'templates', 'fp-docs-shell.zsh');
  const template = fs.readFileSync(templatePath, 'utf-8');

  // Substitute placeholders with baked paths
  const content = template
    .replace(/__CODEBASE_ROOT__/g, codebaseRoot)
    .replace(/__FP_DOCS_DIR__/g, fpDocsDir);

  // Write to codebase root
  const outputPath = path.join(codebaseRoot, '.fp-docs-shell.zsh');
  fs.writeFileSync(outputPath, content, 'utf-8');

  return {
    installed: true,
    path: outputPath,
    source_line: `source "${outputPath}"`,
  };
}

// ── CLI Handler ───────────────────────────────────────────────────────────────

/**
 * CLI handler for `fp-tools drift <subcommand>`.
 *
 * Subcommands (per D-08):
 *   analyze       - Analyze git diff and map to affected docs
 *   status        - Show current staleness signals
 *   clear         - Clear staleness signals (all or by doc_path)
 *   add-signal    - Manually add a staleness signal
 *   list          - List signal summaries
 *   install       - Install git hooks in codebase repo
 *   shell-install - Generate shell integration script
 *
 * @param {string} subcommand - The drift subcommand
 * @param {string[]} args - Additional arguments
 * @param {boolean} raw - Whether to use raw output mode
 */
function cmdDrift(subcommand, args, raw) {
  if (!subcommand) {
    error('Usage: fp-tools drift <analyze|status|clear|add-signal|list|install|shell-install> [args]');
  }

  switch (subcommand) {
    case 'analyze': {
      // Parse flags
      let outputFilePath = null;
      let codebaseRootArg = null;
      let configPathArg = null;

      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--output' && args[i + 1]) { outputFilePath = args[++i]; }
        else if (arg === '--codebase-root' && args[i + 1]) { codebaseRootArg = args[++i]; }
        else if (arg === '--config-path' && args[i + 1]) { configPathArg = args[++i]; }
      }

      const codebaseRoot = codebaseRootArg || getCodebaseRoot();
      const result = analyzeDrift(codebaseRoot, outputFilePath, configPathArg);
      output(result, raw, JSON.stringify(result, null, 2));
      break;
    }

    case 'status': {
      const data = loadStaleness();
      output(data, raw, JSON.stringify(data, null, 2));
      break;
    }

    case 'clear': {
      const docPath = args[0] || undefined;
      const result = clearSignals(docPath);
      output(result, raw, JSON.stringify(result, null, 2));
      break;
    }

    case 'add-signal': {
      // Parse flags
      const signal = {};
      let sourceFiles = [];

      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--doc-path' && args[i + 1]) { signal.doc_path = args[++i]; }
        else if (arg === '--source' && args[i + 1]) { signal.source = args[++i]; }
        else if (arg === '--reason' && args[i + 1]) { signal.reason = args[++i]; }
        else if (arg === '--severity' && args[i + 1]) { signal.severity = args[++i]; }
        else if (arg === '--source-files' && args[i + 1]) {
          sourceFiles = args[++i].split(',').map(f => f.trim());
        }
      }

      if (!signal.doc_path) {
        error('Usage: fp-tools drift add-signal --doc-path <path> [--source <s>] [--reason <r>] [--severity <s>] [--source-files <f1,f2>]');
      }

      signal.timestamp = new Date().toISOString();
      signal.source_files_changed = sourceFiles;
      if (!signal.severity) signal.severity = 'medium';
      if (!signal.source) signal.source = 'manual';
      if (!signal.reason) signal.reason = 'Manual signal';

      const result = addSignal(signal);
      output(result, raw, JSON.stringify(result, null, 2));
      break;
    }

    case 'list': {
      const data = loadStaleness();
      const list = data.signals.map(s => ({
        doc_path: s.doc_path,
        severity: s.severity,
        source: s.source,
        timestamp: s.timestamp,
        changed_count: (s.source_files_changed || []).length,
      }));
      output(list, raw, JSON.stringify(list, null, 2));
      break;
    }

    case 'install': {
      const rootIdx = args.indexOf('--codebase-root');
      const codebaseRoot = rootIdx !== -1 ? args[rootIdx + 1] : getCodebaseRoot();
      if (!codebaseRoot) { error('Cannot determine codebase root. Use --codebase-root flag.'); }
      const result = installAllHooks(codebaseRoot);
      output(result, raw, JSON.stringify(result, null, 2));
      break;
    }

    case 'shell-install': {
      const rootIdx = args.indexOf('--codebase-root');
      const codebaseRoot = rootIdx !== -1 ? args[rootIdx + 1] : getCodebaseRoot();
      if (!codebaseRoot) { error('Cannot determine codebase root. Use --codebase-root flag.'); }
      const result = installShellIntegration(codebaseRoot);
      output(result, raw, JSON.stringify(result, null, 2));
      break;
    }

    default:
      error(`Unknown drift subcommand: ${subcommand}. Use: analyze, status, clear, add-signal, list, install, shell-install`);
  }
}

module.exports = { analyzeDrift, addSignal, clearSignals, loadStaleness, saveStaleness, mergePending, sortByPriority, formatNudge, getChangedFiles, installGitHook, installAllHooks, installShellIntegration, cmdDrift };
