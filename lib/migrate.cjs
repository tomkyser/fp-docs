'use strict';

/**
 * Migrate -- Data layout migration for fp-docs.
 *
 * Detects old-layout data and migrates to the new three-tier directory structure:
 * - Global state: {project-root}/.fp-docs/ (was {docs-root}/.fp-docs/)
 * - Branch data: {docs-root}/.fp-docs-branch/ (was docs root level)
 * - Docs reorg: About.md -> README.md, PROJECT-INDEX.md promoted to docs root
 *
 * CLI: fp-tools migrate <check|run|status>
 *
 * Zero external dependencies -- Node.js built-ins only.
 */

const fs = require('fs');
const path = require('path');
const { output, error, safeReadFile, safeJsonParse } = require('./core.cjs');
const { getGlobalStateRoot, getBranchDataRoot, getCodebaseRoot, getDocsRoot, getPluginRoot } = require('./paths.cjs');

// ── Constants ─────────────────────────────────────────────────────────────────

const MIGRATION_VERSION = 1;

// Files/dirs to migrate from {docs-root}/.fp-docs/ to {project-root}/.fp-docs/
const GLOBAL_STATE_ITEMS = [
  'state.json',
  'staleness.json',
  'drift-pending.json',
  'trackers',
  'remediation-plans',
  'plans',
  'analyses',
];

// ── Internal Helpers ──────────────────────────────────────────────────────────

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function isDirEmpty(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath);
    return entries.length === 0;
  } catch {
    return true;
  }
}

function getPluginVersion() {
  try {
    const pluginRoot = getPluginRoot();
    const manifestPath = path.join(pluginRoot, '.claude-plugin', 'plugin.json');
    const raw = safeReadFile(manifestPath);
    if (!raw) return '0.0.0';
    const parsed = safeJsonParse(raw);
    return parsed.ok ? (parsed.data.version || '0.0.0') : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

// ── Exported Functions ────────────────────────────────────────────────────────

/**
 * Check if the project needs migration from old layout to new.
 *
 * @param {string} docsRoot - Absolute path to docs root
 * @param {string} codebaseRoot - Absolute path to codebase root
 * @returns {{ needed: boolean, reasons: string[] }}
 */
function needsMigration(docsRoot, codebaseRoot) {
  const reasons = [];
  const globalRoot = path.join(codebaseRoot, '.fp-docs');

  // 1. Old global state at docs root
  const oldStatePath = path.join(docsRoot, '.fp-docs', 'state.json');
  const newStatePath = path.join(globalRoot, 'state.json');
  if (fs.existsSync(oldStatePath) && !fs.existsSync(newStatePath)) {
    reasons.push('global state at docs root');
  }

  // 2. Old branch data at docs root level
  if (fs.existsSync(path.join(docsRoot, 'diffs'))) {
    reasons.push('diffs/ at docs root');
  }
  if (fs.existsSync(path.join(docsRoot, 'FLAGGED CONCERNS'))) {
    reasons.push('FLAGGED CONCERNS/ at docs root');
  }

  // 3. Old watermark at docs root
  if (fs.existsSync(path.join(docsRoot, '.sync-watermark'))) {
    reasons.push('.sync-watermark at docs root');
  }

  // 4. Old changelog at docs root
  if (fs.existsSync(path.join(docsRoot, 'changelog.md'))) {
    const branchChangelog = path.join(docsRoot, '.fp-docs-branch', 'changelog.md');
    if (!fs.existsSync(branchChangelog)) {
      reasons.push('changelog.md at docs root');
    }
  }

  return { needed: reasons.length > 0, reasons };
}

/**
 * Migrate operational state from {docs-root}/.fp-docs/ to {codebase-root}/.fp-docs/.
 *
 * @param {string} docsRoot - Absolute path to docs root
 * @param {string} codebaseRoot - Absolute path to codebase root
 * @returns {{ migrated: string[], skipped: string[], errors: string[] }}
 */
function migrateGlobalState(docsRoot, codebaseRoot) {
  const migrated = [];
  const skipped = [];
  const errors = [];

  const oldRoot = path.join(docsRoot, '.fp-docs');
  const newRoot = path.join(codebaseRoot, '.fp-docs');

  if (!fs.existsSync(oldRoot)) {
    return { migrated, skipped: ['no old state directory'], errors };
  }

  ensureDir(newRoot);

  for (const item of GLOBAL_STATE_ITEMS) {
    const src = path.join(oldRoot, item);
    const dest = path.join(newRoot, item);

    if (!fs.existsSync(src)) continue;

    if (fs.existsSync(dest)) {
      skipped.push(item + ' (already exists at destination)');
      continue;
    }

    try {
      const stat = fs.statSync(src);
      if (stat.isDirectory()) {
        fs.cpSync(src, dest, { recursive: true });
      } else {
        fs.copyFileSync(src, dest);
      }

      // Verify copy
      if (fs.existsSync(dest)) {
        // Remove original
        if (stat.isDirectory()) {
          fs.rmSync(src, { recursive: true, force: true });
        } else {
          fs.unlinkSync(src);
        }
        migrated.push(item);
      } else {
        errors.push(item + ' (copy verification failed)');
      }
    } catch (e) {
      errors.push(item + ' (' + e.message + ')');
    }
  }

  // Clean up old .fp-docs/ if empty
  if (fs.existsSync(oldRoot) && isDirEmpty(oldRoot)) {
    try { fs.rmdirSync(oldRoot); } catch { /* ignore */ }
  }

  return { migrated, skipped, errors };
}

/**
 * Migrate branch-scoped data into {docs-root}/.fp-docs-branch/.
 *
 * @param {string} docsRoot - Absolute path to docs root
 * @returns {{ migrated: string[], skipped: string[], errors: string[] }}
 */
function migrateBranchData(docsRoot) {
  const migrated = [];
  const skipped = [];
  const errors = [];

  const branchDir = path.join(docsRoot, '.fp-docs-branch');
  ensureDir(branchDir);

  // diffs/ -> .fp-docs-branch/diffs/
  const oldDiffs = path.join(docsRoot, 'diffs');
  const newDiffs = path.join(branchDir, 'diffs');
  if (fs.existsSync(oldDiffs) && !fs.existsSync(newDiffs)) {
    try {
      fs.renameSync(oldDiffs, newDiffs);
      migrated.push('diffs/');
    } catch {
      try {
        fs.cpSync(oldDiffs, newDiffs, { recursive: true });
        fs.rmSync(oldDiffs, { recursive: true, force: true });
        migrated.push('diffs/ (copy+delete)');
      } catch (e) {
        errors.push('diffs/ (' + e.message + ')');
      }
    }
  }

  // FLAGGED CONCERNS/ -> .fp-docs-branch/flagged-concerns/
  const oldFlagged = path.join(docsRoot, 'FLAGGED CONCERNS');
  const newFlagged = path.join(branchDir, 'flagged-concerns');
  if (fs.existsSync(oldFlagged) && !fs.existsSync(newFlagged)) {
    try {
      fs.renameSync(oldFlagged, newFlagged);
      migrated.push('FLAGGED CONCERNS/ -> flagged-concerns/');
    } catch {
      try {
        fs.cpSync(oldFlagged, newFlagged, { recursive: true });
        fs.rmSync(oldFlagged, { recursive: true, force: true });
        migrated.push('FLAGGED CONCERNS/ -> flagged-concerns/ (copy+delete)');
      } catch (e) {
        errors.push('FLAGGED CONCERNS/ (' + e.message + ')');
      }
    }
  }

  // changelog.md -> .fp-docs-branch/changelog.md
  const oldChangelog = path.join(docsRoot, 'changelog.md');
  const newChangelog = path.join(branchDir, 'changelog.md');
  if (fs.existsSync(oldChangelog) && !fs.existsSync(newChangelog)) {
    try {
      fs.renameSync(oldChangelog, newChangelog);
      migrated.push('changelog.md');
    } catch (e) {
      errors.push('changelog.md (' + e.message + ')');
    }
  }

  // .sync-watermark -> .fp-docs-branch/.sync-watermark
  const oldWatermark = path.join(docsRoot, '.sync-watermark');
  const newWatermark = path.join(branchDir, '.sync-watermark');
  if (fs.existsSync(oldWatermark) && !fs.existsSync(newWatermark)) {
    try {
      fs.renameSync(oldWatermark, newWatermark);
      migrated.push('.sync-watermark');
    } catch (e) {
      errors.push('.sync-watermark (' + e.message + ')');
    }
  }

  return { migrated, skipped, errors };
}

/**
 * Execute docs root reorganization.
 *
 * @param {string} docsRoot - Absolute path to docs root
 * @returns {{ migrated: string[], skipped: string[], errors: string[] }}
 */
function migrateDocsReorg(docsRoot) {
  const migrated = [];
  const skipped = [];
  const errors = [];

  // About.md -> README.md
  const oldAbout = path.join(docsRoot, 'About.md');
  const newReadme = path.join(docsRoot, 'README.md');
  if (fs.existsSync(oldAbout) && !fs.existsSync(newReadme)) {
    try {
      fs.renameSync(oldAbout, newReadme);
      migrated.push('About.md -> README.md');
    } catch (e) {
      errors.push('About.md (' + e.message + ')');
    }
  } else if (fs.existsSync(newReadme)) {
    skipped.push('README.md already exists');
  }

  // claude-code-docs-system/PROJECT-INDEX.md -> PROJECT-INDEX.md
  const oldIndex = path.join(docsRoot, 'claude-code-docs-system', 'PROJECT-INDEX.md');
  const newIndex = path.join(docsRoot, 'PROJECT-INDEX.md');
  if (fs.existsSync(oldIndex) && !fs.existsSync(newIndex)) {
    try {
      fs.renameSync(oldIndex, newIndex);
      migrated.push('PROJECT-INDEX.md promoted to docs root');

      // Remove claude-code-docs-system/ if empty
      const oldDir = path.join(docsRoot, 'claude-code-docs-system');
      if (isDirEmpty(oldDir)) {
        fs.rmdirSync(oldDir);
        migrated.push('claude-code-docs-system/ removed (empty)');
      }
    } catch (e) {
      errors.push('PROJECT-INDEX.md (' + e.message + ')');
    }
  } else if (fs.existsSync(newIndex)) {
    skipped.push('PROJECT-INDEX.md already at docs root');
  }

  return { migrated, skipped, errors };
}

/**
 * Run all migration steps and return a consolidated report.
 *
 * @param {string} docsRoot - Absolute path to docs root
 * @param {string} codebaseRoot - Absolute path to codebase root
 * @returns {{ success: boolean, steps: Array<{name: string, result: object}> }}
 */
function runFullMigration(docsRoot, codebaseRoot) {
  const steps = [];

  // Step 1: Global state migration
  const globalResult = migrateGlobalState(docsRoot, codebaseRoot);
  steps.push({ name: 'global-state', result: globalResult });

  // Step 2: Branch data migration
  const branchResult = migrateBranchData(docsRoot);
  steps.push({ name: 'branch-data', result: branchResult });

  // Step 3: Docs reorganization
  const reorgResult = migrateDocsReorg(docsRoot);
  steps.push({ name: 'docs-reorg', result: reorgResult });

  // Step 4: Write plugin-version.json
  writePluginVersion(docsRoot);
  steps.push({ name: 'plugin-version', result: { migrated: ['plugin-version.json written'], skipped: [], errors: [] } });

  const hasErrors = steps.some(s => s.result.errors && s.result.errors.length > 0);

  return { success: !hasErrors, steps };
}

/**
 * Read plugin-version.json from .fp-docs-branch/.
 *
 * @param {string} docsRoot - Absolute path to docs root
 * @returns {object|null} Parsed version info, or null if not found
 */
function readPluginVersion(docsRoot) {
  const versionPath = path.join(docsRoot, '.fp-docs-branch', 'plugin-version.json');
  const raw = safeReadFile(versionPath);
  if (!raw) return null;
  const result = safeJsonParse(raw);
  return result.ok ? result.data : null;
}

/**
 * Write/update plugin-version.json in .fp-docs-branch/.
 *
 * @param {string} docsRoot - Absolute path to docs root
 */
function writePluginVersion(docsRoot) {
  const branchDir = path.join(docsRoot, '.fp-docs-branch');
  ensureDir(branchDir);
  const versionPath = path.join(branchDir, 'plugin-version.json');
  const data = {
    version: getPluginVersion(),
    last_used: new Date().toISOString(),
    compatible_since: '1.0.0',
    migration_version: MIGRATION_VERSION,
  };
  fs.writeFileSync(versionPath, JSON.stringify(data, null, 2), 'utf-8');
}

// ── CLI Handler ───────────────────────────────────────────────────────────────

/**
 * CLI handler for `fp-tools migrate <subcommand>`.
 *
 * @param {string} subcommand - check | run | status
 * @param {string[]} args - Additional arguments
 * @param {boolean} raw - Raw output mode
 */
function cmdMigrate(subcommand, args, raw) {
  if (!subcommand) {
    error('Usage: fp-tools migrate <check|run|status>');
  }

  const codebaseRoot = getCodebaseRoot();
  if (!codebaseRoot) { error('No codebase root found'); }
  const docsInfo = getDocsRoot(codebaseRoot);
  if (!docsInfo.path || !docsInfo.exists) { error('No docs repo found'); }
  const docsRoot = docsInfo.path;

  switch (subcommand) {
    case 'check': {
      const result = needsMigration(docsRoot, codebaseRoot);
      output(result, raw, JSON.stringify(result, null, 2));
      break;
    }

    case 'run': {
      const result = runFullMigration(docsRoot, codebaseRoot);
      output(result, raw, JSON.stringify(result, null, 2));
      break;
    }

    case 'status': {
      const version = readPluginVersion(docsRoot);
      output(version || { status: 'no plugin-version.json found' }, raw, JSON.stringify(version, null, 2));
      break;
    }

    default:
      error(`Unknown migrate subcommand: ${subcommand}. Use: check, run, status`);
  }
}

module.exports = {
  needsMigration,
  migrateGlobalState,
  migrateBranchData,
  migrateDocsReorg,
  runFullMigration,
  readPluginVersion,
  writePluginVersion,
  cmdMigrate,
};
