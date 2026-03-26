'use strict';

/**
 * State -- Operation history and pipeline state management for fp-docs.
 *
 * Tracks operation log and pipeline state in JSON at {docs-root}/.fp-docs/state.json.
 * Features:
 * - Operation log with 100-entry auto-prune (D-04)
 * - Auto-seed from docs repo git history on first access (D-09/D-10)
 * - Pipeline state tracking for resume/reporting
 * - Module-level cache (same pattern as config.cjs)
 * - Atomic write pattern to prevent corruption (Pitfall 3)
 *
 * CLI surface via `fp-tools state <log|last|pipeline|get|dump>` (D-11).
 *
 * Zero external dependencies -- Node.js built-ins only (D-15).
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { output, error, safeReadFile, safeJsonParse } = require('./core.cjs');
const { getCodebaseRoot, getDocsRoot } = require('./paths.cjs');

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_OPERATIONS = 100;
const SEED_COMMIT_COUNT = 20;
const DEFAULT_STATE = { version: 1, operations: [], pipeline: null };

// ── Module-level cache ────────────────────────────────────────────────────────

let _cachedState = null;

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
 * Generate an 8-character hex ID using crypto.randomBytes.
 *
 * @returns {string} 8-character hex string
 */
function generateId() {
  return require('crypto').randomBytes(4).toString('hex');
}

/**
 * Get the state file path for a given docs root.
 *
 * @param {string} docsRoot - The docs root directory
 * @returns {string} Absolute path to state.json
 */
function getStatePath(docsRoot) {
  return path.join(docsRoot, '.fp-docs', 'state.json');
}

/**
 * Seed operation log from docs repo git history (D-09).
 *
 * Parses git log output in format "%H|%aI|%s" and extracts operation
 * from commit prefix matching /^fp-docs:\s*(\S+)/.
 *
 * When called with a mockLogOutput parameter (for testing), parses that
 * string instead of running git. When docsRoot is provided and mockLogOutput
 * is not, runs git log against the docs repo.
 *
 * @param {string|null} docsRoot - Path to docs repo root, or null for testing
 * @param {string|null} [mockLogOutput] - Mock git log output for testing
 * @returns {Array<object>} Array of seeded operation entries
 */
function seedFromGitHistory(docsRoot, mockLogOutput) {
  let logOutput = mockLogOutput;

  // If no mock provided, try to get real git log
  if (logOutput === undefined && docsRoot) {
    try {
      logOutput = execFileSync('git', [
        '-C', docsRoot, 'log',
        `--format=%H|%aI|%s`,
        `-${SEED_COMMIT_COUNT}`,
      ], {
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 10000,
      }).trim();
    } catch {
      return [];
    }
  }

  if (!logOutput) return [];

  return logOutput.split('\n').filter(Boolean).map(line => {
    const parts = line.split('|');
    const hash = parts[0] || '';
    const timestamp = parts[1] || '';
    // Rejoin remaining parts in case subject contains pipes
    const subject = parts.slice(2).join('|');
    const match = subject.match(/^fp-docs:\s*(\S+)/);
    return {
      id: hash.slice(0, 8),
      timestamp,
      operation: match ? match[1] : 'unknown',
      summary: subject,
      source: 'git-seed',
    };
  });
}

/**
 * Write state to disk using atomic rename pattern (Pitfall 3).
 *
 * Ensures the .fp-docs directory exists, writes to a .tmp file,
 * then renames to the final path. Rename is atomic on POSIX.
 *
 * @param {object} state - The state object to write
 * @param {string} statePath - Absolute path to state.json
 */
function writeState(state, statePath) {
  const dir = path.dirname(statePath);
  ensureDir(dir);
  const tmpPath = statePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
  fs.renameSync(tmpPath, statePath);
}

// ── Exported Functions ────────────────────────────────────────────────────────

/**
 * Load state from disk, with caching and auto-seed.
 *
 * Resolution:
 * 1. If cached and no statePath override, return cache
 * 2. Resolve docs root via getCodebaseRoot() + getDocsRoot()
 * 3. If docs root unavailable and no statePath, return DEFAULT_STATE
 * 4. Read state file -- if missing, auto-seed from git history
 * 5. If file exists but invalid JSON, return DEFAULT_STATE
 * 6. Parse, cache (if no override), return
 *
 * @param {string} [statePath] - Optional explicit path to state.json (for testing)
 * @returns {object} The state object with operations array and pipeline
 */
function loadState(statePath) {
  // Return cache if available and no explicit path override
  if (_cachedState && !statePath) {
    return _cachedState;
  }

  let resolvedPath = statePath;
  let docsRootPath = null;

  // If no explicit path, resolve from docs root
  if (!resolvedPath) {
    const codebaseRoot = getCodebaseRoot();
    const docsInfo = getDocsRoot(codebaseRoot);
    if (!docsInfo.path || !docsInfo.exists) {
      return { ...DEFAULT_STATE };
    }
    docsRootPath = docsInfo.path;
    resolvedPath = getStatePath(docsRootPath);
  }

  const raw = safeReadFile(resolvedPath);

  if (!raw) {
    // File doesn't exist -- if we have a docs root, auto-seed
    if (docsRootPath) {
      const seeded = seedFromGitHistory(docsRootPath);
      const state = { version: 1, operations: seeded, pipeline: null };
      writeState(state, resolvedPath);
      if (!statePath) _cachedState = state;
      return state;
    }
    // No docs root and no file -- return default
    return { ...DEFAULT_STATE };
  }

  const result = safeJsonParse(raw);
  if (!result.ok) {
    return { ...DEFAULT_STATE };
  }

  // Ensure required fields exist
  const state = result.data;
  if (!Array.isArray(state.operations)) state.operations = [];
  if (!('pipeline' in state)) state.pipeline = null;

  if (!statePath) _cachedState = state;
  return state;
}

/**
 * Log a new operation entry to the state file.
 *
 * Creates entry with auto-generated id and timestamp, unshifts onto
 * operations array, and auto-prunes at MAX_OPERATIONS (D-04).
 *
 * @param {object} entry - Operation data (operation, summary, engine, command, files, etc.)
 * @param {string} [statePath] - Optional explicit path to state.json
 * @returns {object} The newly created entry
 */
function logOperation(entry, statePath) {
  const state = loadState(statePath);
  const newEntry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    ...entry,
  };
  state.operations.unshift(newEntry);

  // Auto-prune: keep only last MAX_OPERATIONS entries (D-04)
  if (state.operations.length > MAX_OPERATIONS) {
    state.operations = state.operations.slice(0, MAX_OPERATIONS);
  }

  // Resolve write path
  const writePath = statePath || resolveDefaultStatePath();
  if (writePath) {
    writeState(state, writePath);
  }

  // Update cache
  if (!statePath) _cachedState = state;

  return newEntry;
}

/**
 * Get the last N operations from the state.
 *
 * @param {number} [n=5] - Number of operations to return (default: 5 per D-11)
 * @param {string} [statePath] - Optional explicit path to state.json
 * @returns {Array<object>} Array of the most recent N operation entries
 */
function getLastOps(n, statePath) {
  const state = loadState(statePath);
  return state.operations.slice(0, n || 5);
}

/**
 * Get the current pipeline state.
 *
 * @param {string} [statePath] - Optional explicit path to state.json
 * @returns {object|null} The pipeline state object, or null
 */
function getPipeline(statePath) {
  const state = loadState(statePath);
  return state.pipeline;
}

/**
 * Update the pipeline state by merging provided fields.
 *
 * @param {object} updates - Fields to merge into pipeline state
 * @param {string} [statePath] - Optional explicit path to state.json
 * @returns {object} The updated pipeline state
 */
function updatePipeline(updates, statePath) {
  const state = loadState(statePath);
  state.pipeline = { ...state.pipeline, ...updates };

  const writePath = statePath || resolveDefaultStatePath();
  if (writePath) {
    writeState(state, writePath);
  }

  if (!statePath) _cachedState = state;

  return state.pipeline;
}

/**
 * Clear the pipeline state entirely (set to null).
 *
 * Unlike updatePipeline which merges, this resets pipeline to null.
 * Used by pipeline.cjs resetPipeline to fully clear pipeline state.
 *
 * @param {string} [statePath] - Optional explicit path to state.json
 */
function clearPipeline(statePath) {
  const state = loadState(statePath);
  state.pipeline = null;

  const writePath = statePath || resolveDefaultStatePath();
  if (writePath) {
    writeState(state, writePath);
  }

  if (!statePath) _cachedState = state;
}

/**
 * Resolve the default state file path from docs root.
 * Returns null if docs root is not available.
 *
 * @returns {string|null} Absolute path to state.json, or null
 */
function resolveDefaultStatePath() {
  const codebaseRoot = getCodebaseRoot();
  const docsInfo = getDocsRoot(codebaseRoot);
  if (!docsInfo.path || !docsInfo.exists) return null;
  return getStatePath(docsInfo.path);
}

// ── Remediation Plan Functions ──────────────────────────────────────────────

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
 * Save a remediation plan to disk as a JSON file.
 *
 * Creates the remediation-plans directory if it does not exist.
 * Uses atomic write pattern (write to .tmp, rename) matching state.cjs conventions.
 *
 * @param {object} plan - The remediation plan object (must include plan_id)
 * @param {string} [docsRootPath] - Optional docs root override (for testing)
 * @returns {string|null} Absolute path to the saved plan file, or null if docs root unavailable
 */
function saveRemediationPlan(plan, docsRootPath) {
  const docsRoot = docsRootPath || resolveDocsRoot();
  if (!docsRoot) { return null; }
  const plansDir = path.join(docsRoot, '.fp-docs', 'remediation-plans');
  ensureDir(plansDir);
  const planPath = path.join(plansDir, `${plan.plan_id}.json`);
  writeState(plan, planPath);
  return planPath;
}

/**
 * Load a remediation plan from disk by ID or absolute path.
 *
 * If idOrPath is an absolute path, loads directly from that path.
 * Otherwise, resolves to {docsRoot}/.fp-docs/remediation-plans/{idOrPath}.json.
 *
 * @param {string} idOrPath - Plan ID (e.g., "rem-abc12345") or absolute path
 * @param {string} [docsRootPath] - Optional docs root override (for testing)
 * @returns {object|null} Parsed plan object, or null if not found/invalid
 */
function loadRemediationPlan(idOrPath, docsRootPath) {
  let planPath;
  if (path.isAbsolute(idOrPath)) {
    planPath = idOrPath;
  } else {
    const docsRoot = docsRootPath || resolveDocsRoot();
    if (!docsRoot) return null;
    planPath = path.join(docsRoot, '.fp-docs', 'remediation-plans', `${idOrPath}.json`);
  }
  const raw = safeReadFile(planPath);
  if (!raw) return null;
  const result = safeJsonParse(raw);
  return result.ok ? result.data : null;
}

/**
 * List all remediation plans in the remediation-plans directory.
 *
 * Returns a summary array with id, created_at, status, and issue_count for each plan.
 *
 * @param {string} [docsRootPath] - Optional docs root override (for testing)
 * @returns {Array<{id: string, created_at: string, status: string, issue_count: number}>}
 */
function listRemediationPlans(docsRootPath) {
  const docsRoot = docsRootPath || resolveDocsRoot();
  if (!docsRoot) return [];
  const plansDir = path.join(docsRoot, '.fp-docs', 'remediation-plans');
  if (!fs.existsSync(plansDir)) return [];
  return fs.readdirSync(plansDir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const raw = safeReadFile(path.join(plansDir, f));
      if (!raw) return null;
      const result = safeJsonParse(raw);
      if (!result.ok) return null;
      const p = result.data;
      return { id: p.plan_id, created_at: p.created_at, status: p.status, issue_count: (p.issues || []).length };
    })
    .filter(Boolean);
}

/**
 * Update a remediation plan by merging updates into the existing plan.
 *
 * Special handling: if updates contains completed or failed arrays,
 * they are merged (union) with existing arrays instead of replaced.
 *
 * @param {string} idOrPath - Plan ID or absolute path
 * @param {object} updates - Fields to merge into the plan
 * @param {string} [docsRootPath] - Optional docs root override (for testing)
 * @returns {object|null} The merged plan object, or null if plan not found
 */
function updateRemediationPlan(idOrPath, updates, docsRootPath) {
  const plan = loadRemediationPlan(idOrPath, docsRootPath);
  if (!plan) return null;
  const merged = { ...plan, ...updates };
  // Special handling: if updates has completed items to append, merge arrays
  if (updates.completed && Array.isArray(plan.completed)) {
    merged.completed = [...new Set([...plan.completed, ...updates.completed])];
  }
  if (updates.failed && Array.isArray(plan.failed)) {
    merged.failed = [...new Set([...plan.failed, ...updates.failed])];
  }
  saveRemediationPlan(merged, docsRootPath);
  return merged;
}

// ── CLI Handler ───────────────────────────────────────────────────────────────

/**
 * CLI handler for `fp-tools state <subcommand>`.
 *
 * Subcommands (per D-11):
 *   log        - Record a new operation entry
 *   last [N]   - Show last N operations (default: 5)
 *   pipeline   - Show/update pipeline state
 *   get <key>  - Query specific state key via dot-notation
 *   dump       - Full state JSON output
 *
 * @param {string} subcommand - The state subcommand
 * @param {string[]} args - Additional arguments
 * @param {boolean} raw - Whether to use raw output mode
 */
function cmdState(subcommand, args, raw) {
  if (!subcommand) {
    error('Usage: fp-tools state <log|last|pipeline|get|dump> [args]');
  }

  switch (subcommand) {
    case 'log': {
      // Extract named args: --operation, --engine, --command, --summary, --files
      const entry = {};
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--operation' && args[i + 1]) { entry.operation = args[++i]; }
        else if (arg === '--engine' && args[i + 1]) { entry.engine = args[++i]; }
        else if (arg === '--command' && args[i + 1]) { entry.command = args[++i]; }
        else if (arg === '--summary' && args[i + 1]) { entry.summary = args[++i]; }
        else if (arg === '--files' && args[i + 1]) {
          entry.files = args[++i].split(',').map(f => f.trim());
        }
      }
      if (!entry.operation) {
        error('Usage: fp-tools state log --operation <op> [--engine <e>] [--command <c>] [--summary <s>] [--files <f1,f2>]');
      }
      const newEntry = logOperation(entry);
      output(newEntry, raw, JSON.stringify(newEntry, null, 2));
      break;
    }

    case 'last': {
      const n = args[0] ? parseInt(args[0], 10) : 5;
      if (isNaN(n) || n < 1) {
        error('Usage: fp-tools state last [N] -- N must be a positive integer');
      }
      const ops = getLastOps(n);
      output(ops, raw, JSON.stringify(ops, null, 2));
      break;
    }

    case 'pipeline': {
      if (args.length > 0) {
        // Parse key=value pairs for update
        const updates = {};
        for (const arg of args) {
          const eqIndex = arg.indexOf('=');
          if (eqIndex === -1) {
            error(`Invalid pipeline argument: ${arg}. Use key=value format.`);
          }
          const key = arg.slice(0, eqIndex);
          let value = arg.slice(eqIndex + 1);
          // Try to parse as JSON for booleans and numbers
          try { value = JSON.parse(value); } catch { /* keep as string */ }
          updates[key] = value;
        }
        const result = updatePipeline(updates);
        output(result, raw, JSON.stringify(result, null, 2));
      } else {
        const pipeline = getPipeline();
        output(pipeline, raw, JSON.stringify(pipeline, null, 2));
      }
      break;
    }

    case 'get': {
      const keyPath = args[0];
      if (!keyPath) {
        error('Usage: fp-tools state get <key.path>');
      }
      const state = loadState();
      const keys = keyPath.split('.');
      let current = state;
      for (const key of keys) {
        if (current === undefined || current === null || typeof current !== 'object') {
          error(`State key not found: ${keyPath}`);
        }
        current = current[key];
      }
      if (current === undefined) {
        error(`State key not found: ${keyPath}`);
      }
      output(current, raw, typeof current === 'object' ? JSON.stringify(current, null, 2) : String(current));
      break;
    }

    case 'dump': {
      const state = loadState();
      output(state, raw, JSON.stringify(state, null, 2));
      break;
    }

    default:
      error(`Unknown state subcommand: ${subcommand}. Use: log, last, pipeline, get, dump`);
  }
}

/**
 * CLI handler for `fp-tools remediate <subcommand>`.
 *
 * Subcommands:
 *   save <json>     - Save a remediation plan from JSON string
 *   load <id|path>  - Load a remediation plan by ID or path
 *   list            - List all remediation plans
 *   update <id> <json> - Update a plan with JSON merge
 *
 * @param {string} subcommand - The remediate subcommand
 * @param {string[]} args - Additional arguments
 * @param {boolean} raw - Whether to use raw output mode
 */
function cmdRemediate(subcommand, args, raw) {
  if (!subcommand) {
    error('Usage: fp-tools remediate <save|load|list|update> [args]');
  }

  switch (subcommand) {
    case 'save': {
      const jsonStr = args[0];
      if (!jsonStr) {
        error('Usage: fp-tools remediate save <json-string>');
      }
      const parsed = safeJsonParse(jsonStr);
      if (!parsed.ok) {
        error(`Invalid JSON: ${parsed.error}`);
      }
      const plan = parsed.data;
      if (!plan.plan_id) {
        plan.plan_id = `rem-${generateId()}`;
      }
      if (!plan.created_at) {
        plan.created_at = new Date().toISOString();
      }
      if (!plan.version) {
        plan.version = 1;
      }
      if (!plan.status) {
        plan.status = 'pending';
      }
      const planPath = saveRemediationPlan(plan);
      if (!planPath) {
        error('Could not save plan: docs root not available');
      }
      output({ plan_id: plan.plan_id, path: planPath }, raw, planPath);
      break;
    }

    case 'load': {
      const idOrPath = args[0];
      if (!idOrPath) {
        error('Usage: fp-tools remediate load <plan-id|path>');
      }
      const plan = loadRemediationPlan(idOrPath);
      if (!plan) {
        error(`Plan not found: ${idOrPath}`);
      }
      output(plan, raw, JSON.stringify(plan, null, 2));
      break;
    }

    case 'list': {
      const plans = listRemediationPlans();
      output(plans, raw, JSON.stringify(plans, null, 2));
      break;
    }

    case 'update': {
      const updateId = args[0];
      const updateJson = args[1];
      if (!updateId || !updateJson) {
        error('Usage: fp-tools remediate update <plan-id|path> <json-updates>');
      }
      const parsed = safeJsonParse(updateJson);
      if (!parsed.ok) {
        error(`Invalid JSON: ${parsed.error}`);
      }
      const updated = updateRemediationPlan(updateId, parsed.data);
      if (!updated) {
        error(`Plan not found: ${updateId}`);
      }
      output(updated, raw, JSON.stringify(updated, null, 2));
      break;
    }

    default:
      error(`Unknown remediate subcommand: ${subcommand}. Use: save, load, list, update`);
  }
}

module.exports = { loadState, logOperation, getLastOps, getPipeline, updatePipeline, clearPipeline, seedFromGitHistory, cmdState, cmdRemediate, saveRemediationPlan, loadRemediationPlan, listRemediationPlans, updateRemediationPlan };
