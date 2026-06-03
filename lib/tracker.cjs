'use strict';

/**
 * Tracker -- Shared JSON tracker document management for fp-docs.
 *
 * Creates, updates, and reads JSON tracker files that persist operation
 * state across agents in a delegation chain. Each tracker follows an
 * operation from scope assessment through finalization.
 *
 * Storage: {project-root}/.fp-docs/trackers/{id}.json
 * Fallback: {plugin-root}/.fp-docs/trackers/{id}.json
 *
 * CLI: fp-tools tracker <create|read|summary|update|close|add-issue|add-note|list|prune>
 *
 * Zero external dependencies -- Node.js built-ins only.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { output, error, safeReadFile, safeJsonParse } = require('./core.cjs');
const { getPluginRoot, getGlobalStateRoot } = require('./paths.cjs');
const { getConfigValue } = require('./config.cjs');

// ── Constants ───────────────────────────────────────────────────────────────

const TRACKERS_DIR = 'trackers';
const FP_DOCS_DIR = '.fp-docs';

// ── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Resolve the tracker storage directory.
 * Prefers {project-root}/.fp-docs/trackers, falls back to plugin-root/.fp-docs/trackers.
 *
 * @returns {string} Absolute path to tracker directory
 */
function resolveTrackerDir() {
  try {
    const globalRoot = getGlobalStateRoot();
    if (globalRoot) {
      return path.join(globalRoot, TRACKERS_DIR);
    }
  } catch { /* fall through */ }

  return path.join(getPluginRoot(), FP_DOCS_DIR, TRACKERS_DIR);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Generate a tracker ID with 8-char hex suffix.
 * @returns {string} e.g., 'tracker-a1b2c3d4'
 */
function generateId() {
  const hex = Date.now().toString(16).slice(-8).padStart(8, '0');
  return 'tracker-' + hex;
}

/**
 * Atomic write: write to .tmp file, then rename.
 * @param {string} filePath
 * @param {string} content
 */
function atomicWrite(filePath, content) {
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, content, 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

/**
 * Resolve tracker file path from ID or absolute path.
 * @param {string} idOrPath
 * @returns {string}
 */
function resolveTrackerPath(idOrPath) {
  if (path.isAbsolute(idOrPath)) return idOrPath;
  const dir = resolveTrackerDir();
  return path.join(dir, `${idOrPath}.json`);
}

/**
 * Check if tracker feature is enabled.
 * @returns {boolean}
 */
function isEnabled() {
  return getConfigValue('system.tracker.enabled') !== false;
}

/**
 * Get max trackers from config.
 * @returns {number}
 */
function getMaxTrackers() {
  return getConfigValue('system.tracker.max_trackers') || 200;
}

/**
 * Get retention days from config.
 * @returns {number}
 */
function getRetentionDays() {
  return getConfigValue('system.tracker.retention_days') || 30;
}

// ── Core Operations ─────────────────────────────────────────────────────────

/**
 * Create a new tracker document.
 *
 * @param {{ operation: string, complexity?: string, targets?: Array<{ docPath: string, sourcePaths?: string[], status?: string }> }} options
 * @returns {{ id: string, path: string }}
 */
function create(options) {
  if (!isEnabled()) return { id: null, path: null };

  const dir = resolveTrackerDir();
  ensureDir(dir);

  const id = generateId();
  const now = new Date().toISOString();

  const tracker = {
    id,
    operation: (options && options.operation) || 'unknown',
    complexity: (options && options.complexity) || 'low',
    status: 'active',
    created: now,
    updated: now,
    closed: null,
    targets: (options && options.targets) || [],
    phases: {},
    issues: [],
    notes: [],
  };

  const filePath = path.join(dir, `${id}.json`);
  atomicWrite(filePath, JSON.stringify(tracker, null, 2));

  return { id, path: filePath };
}

/**
 * Read a tracker by ID or path.
 *
 * @param {string} idOrPath
 * @returns {object|null} Full tracker JSON or null
 */
function read(idOrPath) {
  const filePath = resolveTrackerPath(idOrPath);
  const content = safeReadFile(filePath);
  if (!content) return null;

  const parsed = safeJsonParse(content);
  if (!parsed.ok) return null;

  return parsed.data;
}

/**
 * Get a condensed summary of a tracker (small token footprint for agent prompts).
 *
 * @param {string} idOrPath
 * @returns {object|null} Summary or null
 */
function summary(idOrPath) {
  const tracker = read(idOrPath);
  if (!tracker) return null;

  const phaseStatuses = {};
  for (const [phase, data] of Object.entries(tracker.phases || {})) {
    phaseStatuses[phase] = data.status || 'unknown';
  }

  return {
    id: tracker.id,
    operation: tracker.operation,
    complexity: tracker.complexity,
    status: tracker.status,
    phaseStatuses,
    issueCount: (tracker.issues || []).length,
    targetCount: (tracker.targets || []).length,
    targetsCompleted: (tracker.targets || []).filter(t => t.status === 'completed').length,
  };
}

/**
 * Update a specific phase in the tracker.
 *
 * @param {string} idOrPath
 * @param {{ phase: string, agent: string, status: string, result?: object }} phaseUpdate
 * @returns {{ ok: boolean }}
 */
function update(idOrPath, phaseUpdate) {
  const filePath = resolveTrackerPath(idOrPath);
  const tracker = read(filePath);
  if (!tracker) return { ok: false };

  const now = new Date().toISOString();

  if (!tracker.phases) tracker.phases = {};
  tracker.phases[phaseUpdate.phase] = {
    status: phaseUpdate.status || 'completed',
    agent: phaseUpdate.agent || 'unknown',
    timestamp: now,
    result: phaseUpdate.result || null,
  };

  tracker.updated = now;
  atomicWrite(filePath, JSON.stringify(tracker, null, 2));

  return { ok: true };
}

/**
 * Close a tracker with a final status.
 *
 * @param {string} idOrPath
 * @param {string} status - 'completed', 'failed', or 'aborted'
 * @returns {{ ok: boolean }}
 */
function close(idOrPath, status) {
  const filePath = resolveTrackerPath(idOrPath);
  const tracker = read(filePath);
  if (!tracker) return { ok: false };

  const now = new Date().toISOString();
  tracker.status = status || 'completed';
  tracker.closed = now;
  tracker.updated = now;

  atomicWrite(filePath, JSON.stringify(tracker, null, 2));
  return { ok: true };
}

/**
 * Append an issue to the tracker.
 *
 * @param {string} idOrPath
 * @param {{ phase: string, severity: string, message: string, target?: string }} issue
 * @returns {{ ok: boolean }}
 */
function addIssue(idOrPath, issue) {
  const filePath = resolveTrackerPath(idOrPath);
  const tracker = read(filePath);
  if (!tracker) return { ok: false };

  if (!tracker.issues) tracker.issues = [];
  tracker.issues.push({
    phase: issue.phase || 'unknown',
    severity: issue.severity || 'info',
    message: issue.message || '',
    target: issue.target || null,
    timestamp: new Date().toISOString(),
  });

  tracker.updated = new Date().toISOString();
  atomicWrite(filePath, JSON.stringify(tracker, null, 2));
  return { ok: true };
}

/**
 * Append a freeform note to the tracker.
 *
 * @param {string} idOrPath
 * @param {string} note
 * @returns {{ ok: boolean }}
 */
function addNote(idOrPath, note) {
  const filePath = resolveTrackerPath(idOrPath);
  const tracker = read(filePath);
  if (!tracker) return { ok: false };

  if (!tracker.notes) tracker.notes = [];
  tracker.notes.push({
    text: note,
    timestamp: new Date().toISOString(),
  });

  tracker.updated = new Date().toISOString();
  atomicWrite(filePath, JSON.stringify(tracker, null, 2));
  return { ok: true };
}

/**
 * List trackers, optionally filtered by status.
 *
 * @param {string} [statusFilter] - 'active', 'completed', 'failed', 'all'
 * @returns {Array<object>} Array of tracker summaries
 */
function list(statusFilter) {
  const dir = resolveTrackerDir();
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().reverse();
  const results = [];

  for (const file of files) {
    const tracker = read(path.join(dir, file));
    if (!tracker) continue;
    if (statusFilter && statusFilter !== 'all' && tracker.status !== statusFilter) continue;

    const s = summary(path.join(dir, file));
    if (s) results.push(s);
  }

  return results;
}

/**
 * Prune completed/failed trackers older than retention period.
 * Active trackers are never pruned.
 *
 * @param {number} [days] - Override retention days
 * @returns {{ pruned: number, remaining: number }}
 */
function prune(days) {
  const dir = resolveTrackerDir();
  if (!fs.existsSync(dir)) return { pruned: 0, remaining: 0 };

  const retentionDays = days || getRetentionDays();
  const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
  const maxTrackers = getMaxTrackers();

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  let pruned = 0;

  // Prune by age: only closed trackers
  for (const file of files) {
    const tracker = read(path.join(dir, file));
    if (!tracker) continue;
    if (tracker.status === 'active') continue; // Never prune active

    const closedMs = tracker.closed ? new Date(tracker.closed).getTime() : 0;
    if (closedMs > 0 && closedMs < cutoff) {
      try {
        fs.unlinkSync(path.join(dir, file));
        pruned++;
      } catch { /* ignore */ }
    }
  }

  // Prune by count: remove oldest if exceeding max
  const remaining = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  if (remaining.length > maxTrackers) {
    const toRemove = remaining.slice(0, remaining.length - maxTrackers);
    for (const file of toRemove) {
      const tracker = read(path.join(dir, file));
      if (tracker && tracker.status === 'active') continue;
      try {
        fs.unlinkSync(path.join(dir, file));
        pruned++;
      } catch { /* ignore */ }
    }
  }

  const finalCount = fs.readdirSync(dir).filter(f => f.endsWith('.json')).length;
  return { pruned, remaining: finalCount };
}

// ── CLI Handler ─────────────────────────────────────────────────────────────

/**
 * CLI handler for `fp-tools tracker <subcommand> [args...]`.
 *
 * @param {string} subcommand
 * @param {string[]} args
 * @param {boolean} raw
 */
function cmdTracker(subcommand, args, raw) {
  if (!subcommand) {
    error('Usage: fp-tools tracker <create|read|summary|update|close|add-issue|add-note|list|prune> [args...]');
  }

  switch (subcommand) {
    case 'create': {
      const options = {};
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--operation' && args[i + 1]) options.operation = args[++i];
        else if (args[i] === '--complexity' && args[i + 1]) options.complexity = args[++i];
        else if (args[i] === '--targets' && args[i + 1]) {
          const parsed = safeJsonParse(args[++i]);
          if (parsed.ok) options.targets = parsed.data;
        }
      }
      if (!options.operation && args[0] && !args[0].startsWith('--')) {
        options.operation = args[0];
      }
      const result = create(options);
      output(result, raw, result.id || 'disabled');
      break;
    }

    case 'read': {
      const id = args[0];
      if (!id) error('Usage: fp-tools tracker read <id>');
      const result = read(id);
      if (!result) error('Tracker not found: ' + id);
      output(result, raw);
      break;
    }

    case 'summary': {
      const id = args[0];
      if (!id) error('Usage: fp-tools tracker summary <id>');
      const result = summary(id);
      if (!result) error('Tracker not found: ' + id);
      output(result, raw);
      break;
    }

    case 'update': {
      const id = args[0];
      if (!id) error('Usage: fp-tools tracker update <id> --phase <name> --agent <name> --status <status> [--content <json>]');

      const phaseUpdate = {};
      for (let i = 1; i < args.length; i++) {
        if (args[i] === '--phase' && args[i + 1]) phaseUpdate.phase = args[++i];
        else if (args[i] === '--agent' && args[i + 1]) phaseUpdate.agent = args[++i];
        else if (args[i] === '--status' && args[i + 1]) phaseUpdate.status = args[++i];
        else if (args[i] === '--content' && args[i + 1]) {
          const parsed = safeJsonParse(args[++i]);
          if (parsed.ok) phaseUpdate.result = parsed.data;
        }
      }

      if (!phaseUpdate.phase) error('--phase is required for tracker update');
      const result = update(id, phaseUpdate);
      output(result, raw, result.ok ? 'ok' : 'failed');
      break;
    }

    case 'close': {
      const id = args[0];
      if (!id) error('Usage: fp-tools tracker close <id> --status <completed|failed|aborted>');

      let status = 'completed';
      for (let i = 1; i < args.length; i++) {
        if (args[i] === '--status' && args[i + 1]) status = args[++i];
      }

      const result = close(id, status);
      output(result, raw, result.ok ? 'ok' : 'failed');
      break;
    }

    case 'add-issue': {
      const id = args[0];
      if (!id) error('Usage: fp-tools tracker add-issue <id> --phase <name> --severity <level> --message <text> [--target <path>]');

      const issue = {};
      for (let i = 1; i < args.length; i++) {
        if (args[i] === '--phase' && args[i + 1]) issue.phase = args[++i];
        else if (args[i] === '--severity' && args[i + 1]) issue.severity = args[++i];
        else if (args[i] === '--message' && args[i + 1]) issue.message = args[++i];
        else if (args[i] === '--target' && args[i + 1]) issue.target = args[++i];
      }

      const result = addIssue(id, issue);
      output(result, raw, result.ok ? 'ok' : 'failed');
      break;
    }

    case 'add-note': {
      const id = args[0];
      if (!id) error('Usage: fp-tools tracker add-note <id> --note <text>');

      let note = '';
      for (let i = 1; i < args.length; i++) {
        if (args[i] === '--note' && args[i + 1]) note = args[++i];
      }
      if (!note && args[1] && !args[1].startsWith('--')) note = args[1];

      const result = addNote(id, note);
      output(result, raw, result.ok ? 'ok' : 'failed');
      break;
    }

    case 'list': {
      let statusFilter;
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--status' && args[i + 1]) statusFilter = args[++i];
      }
      const result = list(statusFilter);
      output(result, raw);
      break;
    }

    case 'prune': {
      let days;
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--days' && args[i + 1]) days = parseInt(args[++i], 10);
      }
      const result = prune(days);
      output(result, raw, `pruned: ${result.pruned}, remaining: ${result.remaining}`);
      break;
    }

    default:
      error('Unknown tracker subcommand: ' + subcommand + '. Use: create, read, summary, update, close, add-issue, add-note, list, prune');
  }
}

module.exports = {
  create,
  read,
  summary,
  update,
  close,
  addIssue,
  addNote,
  list,
  prune,
  cmdTracker,
};
