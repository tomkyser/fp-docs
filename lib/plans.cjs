'use strict';

/**
 * Plans -- Execution plan and analysis file persistence for fp-docs.
 *
 * Stores execution plans as JSON in {project-root}/.fp-docs/plans/
 * and research analysis documents in {project-root}/.fp-docs/analyses/.
 * Follows the same CRUD patterns as remediation plans in state.cjs.
 *
 * Features:
 * - Plan CRUD with auto-ID generation (plan- prefix)
 * - Analysis document save/load
 * - Age-based auto-prune for both plans and analyses
 * - Atomic write pattern for corruption prevention
 *
 * CLI surface via `fp-tools plans <save|load|list|update|prune|save-analysis|load-analysis>`.
 *
 * Zero external dependencies -- Node.js built-ins only (D-15).
 */

const fs = require('fs');
const path = require('path');
const { output, error, safeReadFile, safeJsonParse } = require('./core.cjs');
const { getGlobalStateRoot } = require('./paths.cjs');

// -- Constants ----------------------------------------------------------------

const PLANS_DIR = 'plans';
const ANALYSES_DIR = 'analyses';
const MAX_PLANS = 200;
const PLAN_RETENTION_DAYS = 30;

// -- Internal Helpers ---------------------------------------------------------

/**
 * Resolve the global state root path, returning null if unavailable.
 *
 * @returns {string|null} Absolute path to global state root, or null
 */
function resolveStateRoot() {
  try {
    return getGlobalStateRoot();
  } catch { return null; }
}

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
 * Generate a plan ID with 'plan-' prefix and 8-character hex suffix.
 *
 * @returns {string} Plan ID (e.g., "plan-a1b2c3d4")
 */
function generatePlanId() {
  return 'plan-' + require('crypto').randomBytes(4).toString('hex');
}

/**
 * Atomic write: write to .tmp then rename to final path.
 * Rename is atomic on POSIX, preventing corruption from partial writes.
 *
 * @param {any} data - Data to JSON-serialize and write
 * @param {string} filePath - Final destination path
 */
function atomicWrite(data, filePath) {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

/**
 * Get the plans directory path for a given state root.
 *
 * @param {string} stateRoot - The global state root directory ({project-root}/.fp-docs/)
 * @returns {string} Absolute path to plans/
 */
function getPlansDir(stateRoot) {
  return path.join(stateRoot, PLANS_DIR);
}

/**
 * Get the analyses directory path for a given state root.
 *
 * @param {string} stateRoot - The global state root directory ({project-root}/.fp-docs/)
 * @returns {string} Absolute path to analyses/
 */
function getAnalysesDir(stateRoot) {
  return path.join(stateRoot, ANALYSES_DIR);
}

// -- Exported Plan CRUD Functions ---------------------------------------------

/**
 * Save a plan to disk as a JSON file.
 *
 * Auto-generates plan_id (with plan- prefix), created_at, version, and
 * status defaults if not present in the plan object.
 *
 * @param {object} plan - The plan object
 * @param {string} [stateRootPath] - Optional docs root override (for testing)
 * @returns {string|null} Absolute path to the saved plan file, or null if docs root unavailable
 */
function savePlan(plan, stateRootPath) {
  const stateRoot = stateRootPath || resolveStateRoot();
  if (!stateRoot) { return null; }

  // Auto-generate defaults if not present
  if (!plan.plan_id) {
    plan.plan_id = generatePlanId();
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

  const plansDir = getPlansDir(stateRoot);
  ensureDir(plansDir);
  const planPath = path.join(plansDir, `${plan.plan_id}.json`);
  atomicWrite(plan, planPath);
  return planPath;
}

/**
 * Load a plan from disk by ID or absolute path.
 *
 * If idOrPath is an absolute path, loads directly from that path.
 * Otherwise, resolves to {stateRoot}/plans/{idOrPath}.json.
 *
 * @param {string} idOrPath - Plan ID (e.g., "plan-a1b2c3d4") or absolute path
 * @param {string} [stateRootPath] - Optional docs root override (for testing)
 * @returns {object|null} Parsed plan object, or null if not found/invalid
 */
function loadPlan(idOrPath, stateRootPath) {
  let planPath;
  if (path.isAbsolute(idOrPath)) {
    planPath = idOrPath;
  } else {
    const stateRoot = stateRootPath || resolveStateRoot();
    if (!stateRoot) return null;
    planPath = path.join(getPlansDir(stateRoot), `${idOrPath}.json`);
  }
  const raw = safeReadFile(planPath);
  if (!raw) return null;
  const result = safeJsonParse(raw);
  return result.ok ? result.data : null;
}

/**
 * List all plans in the plans directory.
 *
 * Returns a summary array with id, created_at, status, operation, and target for each plan.
 *
 * @param {string} [stateRootPath] - Optional docs root override (for testing)
 * @returns {Array<{id: string, created_at: string, status: string, operation: string, target: string}>}
 */
function listPlans(stateRootPath) {
  const stateRoot = stateRootPath || resolveStateRoot();
  if (!stateRoot) return [];
  const plansDir = getPlansDir(stateRoot);
  if (!fs.existsSync(plansDir)) return [];
  return fs.readdirSync(plansDir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const raw = safeReadFile(path.join(plansDir, f));
      if (!raw) return null;
      const result = safeJsonParse(raw);
      if (!result.ok) return null;
      const p = result.data;
      return {
        id: p.plan_id || null,
        created_at: p.created_at || null,
        status: p.status || null,
        operation: p.operation || null,
        target: p.target || null,
      };
    })
    .filter(Boolean);
}

/**
 * Update a plan by merging updates into the existing plan.
 *
 * Special handling: if updates contains completed or failed arrays,
 * they are merged (union) with existing arrays instead of replaced.
 *
 * @param {string} idOrPath - Plan ID or absolute path
 * @param {object} updates - Fields to merge into the plan
 * @param {string} [stateRootPath] - Optional docs root override (for testing)
 * @returns {object|null} The merged plan object, or null if plan not found
 */
function updatePlan(idOrPath, updates, stateRootPath) {
  const plan = loadPlan(idOrPath, stateRootPath);
  if (!plan) return null;
  const merged = { ...plan, ...updates };
  // Special handling: union arrays for completed and failed
  if (updates.completed && Array.isArray(plan.completed)) {
    merged.completed = [...new Set([...plan.completed, ...updates.completed])];
  }
  if (updates.failed && Array.isArray(plan.failed)) {
    merged.failed = [...new Set([...plan.failed, ...updates.failed])];
  }
  savePlan(merged, stateRootPath);
  return merged;
}

/**
 * Prune completed plans older than PLAN_RETENTION_DAYS.
 * Also enforces MAX_PLANS cap (oldest completed first).
 *
 * @param {string} [stateRootPath] - Optional docs root override (for testing)
 * @returns {{ pruned: number, remaining: number }}
 */
function prunePlans(stateRootPath) {
  const stateRoot = stateRootPath || resolveStateRoot();
  if (!stateRoot) return { pruned: 0, remaining: 0 };
  const plansDir = getPlansDir(stateRoot);
  if (!fs.existsSync(plansDir)) return { pruned: 0, remaining: 0 };

  const files = fs.readdirSync(plansDir).filter(f => f.endsWith('.json'));
  const cutoff = Date.now() - (PLAN_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  let pruned = 0;

  // Phase 1: Remove completed plans older than retention threshold
  const remaining = [];
  for (const f of files) {
    const filePath = path.join(plansDir, f);
    const raw = safeReadFile(filePath);
    if (!raw) continue;
    const result = safeJsonParse(raw);
    if (!result.ok) continue;
    const p = result.data;
    const createdAt = p.created_at ? new Date(p.created_at).getTime() : Date.now();
    if (p.status === 'complete' && createdAt < cutoff) {
      fs.unlinkSync(filePath);
      pruned++;
    } else {
      remaining.push({ file: f, path: filePath, data: p, createdAt });
    }
  }

  // Phase 2: Enforce MAX_PLANS cap (oldest completed first)
  if (remaining.length > MAX_PLANS) {
    // Sort completed plans by creation date (oldest first)
    const completed = remaining
      .filter(r => r.data.status === 'complete')
      .sort((a, b) => a.createdAt - b.createdAt);
    const toRemove = remaining.length - MAX_PLANS;
    for (let i = 0; i < toRemove && i < completed.length; i++) {
      fs.unlinkSync(completed[i].path);
      pruned++;
    }
  }

  // Count remaining files
  const finalCount = fs.existsSync(plansDir)
    ? fs.readdirSync(plansDir).filter(f => f.endsWith('.json')).length
    : 0;

  return { pruned, remaining: finalCount };
}

// -- Exported Analysis File Functions -----------------------------------------

/**
 * Save an analysis markdown file to disk.
 *
 * Writes to .fp-docs/analyses/{operation}-{YYYYMMDD-HHmmss}.md.
 *
 * @param {string} content - Markdown content to write
 * @param {string} operation - Operation name (e.g., "revise", "audit")
 * @param {string} [stateRootPath] - Optional docs root override (for testing)
 * @returns {string|null} Absolute path to the saved analysis file, or null
 */
function saveAnalysis(content, operation, stateRootPath) {
  const stateRoot = stateRootPath || resolveStateRoot();
  if (!stateRoot) { return null; }

  const analysesDir = getAnalysesDir(stateRoot);
  ensureDir(analysesDir);

  const now = new Date();
  const timestamp = now.getFullYear().toString()
    + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0')
    + '-'
    + String(now.getHours()).padStart(2, '0')
    + String(now.getMinutes()).padStart(2, '0')
    + String(now.getSeconds()).padStart(2, '0');

  const filename = `${operation}-${timestamp}.md`;
  const filePath = path.join(analysesDir, filename);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

/**
 * Load an analysis markdown file from an absolute path.
 *
 * @param {string} filePath - Absolute path to the analysis file
 * @returns {string|null} File content as string, or null if not found
 */
function loadAnalysis(filePath) {
  return safeReadFile(filePath);
}

/**
 * Prune analysis files older than PLAN_RETENTION_DAYS.
 *
 * @param {string} [stateRootPath] - Optional docs root override (for testing)
 * @returns {{ pruned: number, remaining: number }}
 */
function pruneAnalyses(stateRootPath) {
  const stateRoot = stateRootPath || resolveStateRoot();
  if (!stateRoot) return { pruned: 0, remaining: 0 };
  const analysesDir = getAnalysesDir(stateRoot);
  if (!fs.existsSync(analysesDir)) return { pruned: 0, remaining: 0 };

  const files = fs.readdirSync(analysesDir).filter(f => f.endsWith('.md'));
  const cutoff = Date.now() - (PLAN_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  let pruned = 0;

  for (const f of files) {
    const filePath = path.join(analysesDir, f);
    const stat = fs.statSync(filePath);
    if (stat.mtimeMs < cutoff) {
      fs.unlinkSync(filePath);
      pruned++;
    }
  }

  const finalCount = fs.existsSync(analysesDir)
    ? fs.readdirSync(analysesDir).filter(f => f.endsWith('.md')).length
    : 0;

  return { pruned, remaining: finalCount };
}

// -- CLI Handler --------------------------------------------------------------

/**
 * CLI handler for `fp-tools plans <subcommand>`.
 *
 * Subcommands:
 *   save <json-string>                         - Save a plan from JSON
 *   load <plan-id|path>                        - Load a plan by ID or path
 *   list                                       - List all plans
 *   update <plan-id> <json-updates>            - Update a plan with JSON merge
 *   prune                                      - Prune old plans and analyses
 *   save-analysis --operation <op> --content <md> - Save analysis markdown
 *   load-analysis <path>                       - Load analysis markdown
 *
 * @param {string} subcommand - The plans subcommand
 * @param {string[]} args - Additional arguments
 * @param {boolean} raw - Whether to use raw output mode
 */
function cmdPlans(subcommand, args, raw) {
  if (!subcommand) {
    error('Usage: fp-tools plans <save|load|list|update|prune|save-analysis|load-analysis> [args]');
  }

  switch (subcommand) {
    case 'save': {
      const jsonStr = args[0];
      if (!jsonStr) {
        error('Usage: fp-tools plans save <json-string>');
      }
      const parsed = safeJsonParse(jsonStr);
      if (!parsed.ok) {
        error(`Invalid JSON: ${parsed.error}`);
      }
      const plan = parsed.data;
      const planPath = savePlan(plan);
      if (!planPath) {
        error('Could not save plan: state root not available');
      }
      output({ plan_id: plan.plan_id, path: planPath }, raw, planPath);
      break;
    }

    case 'load': {
      const idOrPath = args[0];
      if (!idOrPath) {
        error('Usage: fp-tools plans load <plan-id|path>');
      }
      const plan = loadPlan(idOrPath);
      if (!plan) {
        error(`Plan not found: ${idOrPath}`);
      }
      output(plan, raw, JSON.stringify(plan, null, 2));
      break;
    }

    case 'list': {
      const plans = listPlans();
      output(plans, raw, JSON.stringify(plans, null, 2));
      break;
    }

    case 'update': {
      const updateId = args[0];
      const updateJson = args[1];
      if (!updateId || !updateJson) {
        error('Usage: fp-tools plans update <plan-id|path> <json-updates>');
      }
      const parsed = safeJsonParse(updateJson);
      if (!parsed.ok) {
        error(`Invalid JSON: ${parsed.error}`);
      }
      const updated = updatePlan(updateId, parsed.data);
      if (!updated) {
        error(`Plan not found: ${updateId}`);
      }
      output(updated, raw, JSON.stringify(updated, null, 2));
      break;
    }

    case 'prune': {
      const planStats = prunePlans();
      const analysisStats = pruneAnalyses();
      const combined = {
        plans: planStats,
        analyses: analysisStats,
        total_pruned: planStats.pruned + analysisStats.pruned,
      };
      output(combined, raw, JSON.stringify(combined, null, 2));
      break;
    }

    case 'save-analysis': {
      let operation = null;
      let content = null;
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--operation' && args[i + 1]) { operation = args[++i]; }
        else if (args[i] === '--content' && args[i + 1]) { content = args[++i]; }
      }
      if (!operation || !content) {
        error('Usage: fp-tools plans save-analysis --operation <op> --content <markdown>');
      }
      const analysisPath = saveAnalysis(content, operation);
      if (!analysisPath) {
        error('Could not save analysis: docs root not available');
      }
      output({ path: analysisPath }, raw, analysisPath);
      break;
    }

    case 'load-analysis': {
      const analysisPathArg = args[0];
      if (!analysisPathArg) {
        error('Usage: fp-tools plans load-analysis <path>');
      }
      const analysisContent = loadAnalysis(analysisPathArg);
      if (analysisContent === null) {
        error(`Analysis not found: ${analysisPathArg}`);
      }
      output({ content: analysisContent }, raw, analysisContent);
      break;
    }

    default:
      error(`Unknown plans subcommand: ${subcommand}. Use: save, load, list, update, prune, save-analysis, load-analysis`);
  }
}

module.exports = { savePlan, loadPlan, listPlans, updatePlan, prunePlans, saveAnalysis, loadAnalysis, pruneAnalyses, cmdPlans };
