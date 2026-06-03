'use strict';

/**
 * Merge Intel -- Docs branch merge intelligence for fp-docs.
 *
 * Detects recently merged codebase branches that have matching docs branches,
 * assesses staleness, and provides merge recommendations for the sync workflow.
 *
 * Storage: {project-root}/.fp-docs/merge-intel/
 *   candidates.json  -- current scan results
 *   history.json     -- past merge decisions
 *
 * CLI: fp-tools merge-intel <scan|status|history|clear>
 *
 * Zero external dependencies -- Node.js built-ins only.
 */

const fs = require('fs');
const path = require('path');
const { output, error, safeReadFile, safeJsonParse } = require('./core.cjs');
const { getGlobalStateRoot, getCodebaseRoot, getDocsRoot } = require('./paths.cjs');

// ── Constants ─────────────────────────────────────────────────────────────────

const MERGE_INTEL_DIR = 'merge-intel';
const CANDIDATES_FILE = 'candidates.json';
const HISTORY_FILE = 'history.json';
const MAX_MERGE_LOOKBACK = 20;
const MAX_HISTORY_ENTRIES = 100;
const SKIP_BRANCHES = new Set(['master', 'main', 'dev', 'develop']);
const DEFAULT_CANDIDATES = { version: 1, last_scan: null, codebase_branch: null, candidates: [] };
const DEFAULT_HISTORY = { version: 1, decisions: [] };

// ── Internal Helpers ──────────────────────────────────────────────────────────

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function atomicWrite(data, filePath) {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function getMergeIntelDir() {
  const globalRoot = getGlobalStateRoot();
  if (!globalRoot) return null;
  return path.join(globalRoot, MERGE_INTEL_DIR);
}

/**
 * Execute a git command safely, returning stdout or null on failure.
 */
function gitExec(repoRoot, args) {
  try {
    const { execFileSync } = require('child_process');
    return execFileSync('git', ['-C', repoRoot, ...args], {
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 15000,
    }).trim();
  } catch {
    return null;
  }
}

// ── Exported Functions ────────────────────────────────────────────────────────

/**
 * Detect recently merged branches from git merge commits.
 *
 * @param {string} codebaseRoot - Absolute path to codebase git root
 * @param {object} [opts]
 * @param {number} [opts.lookback=20] - Number of merge commits to scan
 * @returns {Array<{branch: string, merge_commit: string, merge_date: string}>}
 */
function detectMergedBranches(codebaseRoot, opts) {
  const lookback = (opts && opts.lookback) || MAX_MERGE_LOOKBACK;
  const logOutput = gitExec(codebaseRoot, [
    'log', '--merges', '--first-parent',
    '-n', String(lookback),
    '--format=%H|%aI|%s',
  ]);

  if (!logOutput) return [];

  const seen = new Set();
  const results = [];

  for (const line of logOutput.split('\n').filter(Boolean)) {
    const parts = line.split('|');
    const hash = parts[0] || '';
    const date = parts[1] || '';
    const subject = parts.slice(2).join('|');

    let branch = null;

    // Standard git merge: "Merge branch 'feature/x'"
    const stdMatch = subject.match(/Merge branch '(.+?)'/);
    if (stdMatch) branch = stdMatch[1];

    // GitHub PR merge: "Merge pull request #123 from owner/branch"
    if (!branch) {
      const prMatch = subject.match(/Merge pull request #\d+ from \S+\/(.+)/);
      if (prMatch) branch = prMatch[1];
    }

    // Alternative: "Merge feature/x into master"
    if (!branch) {
      const altMatch = subject.match(/Merge (\S+) into/);
      if (altMatch) branch = altMatch[1];
    }

    if (!branch) continue;
    if (SKIP_BRANCHES.has(branch)) continue;
    if (seen.has(branch)) continue;

    seen.add(branch);
    results.push({ branch, merge_commit: hash, merge_date: date });
  }

  return results;
}

/**
 * Check for docs branches matching detected codebase merge branches.
 *
 * @param {string} docsRoot - Absolute path to docs git root
 * @param {Array<{branch: string, merge_commit: string, merge_date: string}>} branches
 * @returns {Array<{branch: string, merge_commit: string, merge_date: string, docs_exists: boolean}>}
 */
function findMatchingDocsBranches(docsRoot, branches) {
  const results = [];

  for (const entry of branches) {
    const localCheck = gitExec(docsRoot, ['branch', '--list', entry.branch]);
    const remoteCheck = gitExec(docsRoot, ['branch', '-r', '--list', 'origin/' + entry.branch]);

    const docsExists = !!(
      (localCheck && localCheck.trim().length > 0) ||
      (remoteCheck && remoteCheck.trim().length > 0)
    );

    if (docsExists) {
      results.push({ ...entry, docs_exists: true });
    }
  }

  return results;
}

/**
 * Assess staleness of docs branches relative to their codebase merge points.
 *
 * @param {string} docsRoot - Absolute path to docs git root
 * @param {string} codebaseRoot - Absolute path to codebase git root
 * @param {Array<{branch: string, merge_commit: string, merge_date: string}>} candidates
 * @returns {Array<object>} Enriched candidates with staleness assessment
 */
function assessStaleness(docsRoot, codebaseRoot, candidates) {
  const results = [];

  for (const candidate of candidates) {
    const docsLog = gitExec(docsRoot, ['log', '-1', '--format=%H|%aI', candidate.branch]);
    if (!docsLog) {
      results.push({ ...candidate, status: 'orphaned', docs_last_commit: null, docs_last_date: null, codebase_last_date: null, staleness_commits: 0, action: null, action_date: null });
      continue;
    }

    const [docsLastCommit, docsLastDate] = docsLog.split('|');

    // Get last commit on codebase branch before merge (second parent)
    let codebaseLastDate = gitExec(codebaseRoot, ['log', '-1', '--format=%aI', candidate.merge_commit + '^2']);

    // Fallback for squash merges (no second parent)
    if (!codebaseLastDate) {
      codebaseLastDate = gitExec(codebaseRoot, ['log', '-1', '--format=%aI', candidate.merge_commit + '~1']);
    }

    let status;
    if (!codebaseLastDate) {
      status = 'current'; // Can't determine, assume current
    } else if (docsLastDate >= codebaseLastDate) {
      status = 'current';
    } else {
      status = 'stale';
    }

    // Count staleness commits (how far behind docs branch is)
    let stalenessCommits = 0;
    if (status === 'stale' && docsLastCommit) {
      const countOutput = gitExec(docsRoot, ['rev-list', '--count', docsLastCommit + '..' + candidate.branch]);
      if (countOutput) {
        stalenessCommits = parseInt(countOutput, 10) || 0;
      }
    }

    results.push({
      ...candidate,
      docs_last_commit: docsLastCommit || null,
      docs_last_date: docsLastDate || null,
      codebase_last_date: codebaseLastDate || null,
      status,
      staleness_commits: stalenessCommits,
      action: null,
      action_date: null,
    });
  }

  return results;
}

/**
 * Merge a docs branch into the current docs branch.
 *
 * @param {string} docsRoot - Absolute path to docs git root
 * @param {string} branch - Branch name to merge
 * @param {object} [opts]
 * @param {boolean} [opts.noPush=false] - Skip push after merge
 * @param {boolean} [opts.deleteBranch=true] - Delete branch after successful merge
 * @returns {{ success: boolean, merged: boolean, conflicts: boolean, message: string }}
 */
function executeMerge(docsRoot, branch, opts) {
  const noPush = opts && opts.noPush;
  const deleteBranch = opts && opts.deleteBranch !== false;

  // Guard: check for uncommitted changes before merging
  const status = gitExec(docsRoot, ['status', '--porcelain']);
  if (status && status.trim().length > 0) {
    return { success: false, merged: false, conflicts: false, message: `Docs repo has uncommitted changes. Commit or stash before merging ${branch}.` };
  }

  const mergeResult = gitExec(docsRoot, ['merge', branch, '--no-edit']);

  if (mergeResult === null) {
    // Merge failed -- likely conflict
    gitExec(docsRoot, ['merge', '--abort']);
    return { success: false, merged: false, conflicts: true, message: `Merge conflict with ${branch}. Aborted.` };
  }

  // Push if requested
  if (!noPush) {
    const pushResult = gitExec(docsRoot, ['push']);
    if (pushResult === null) {
      return { success: true, merged: true, conflicts: false, message: `Merged ${branch} but push failed. Push manually.` };
    }
  }

  // Delete branch if requested (safe delete only)
  if (deleteBranch) {
    const deleteResult = gitExec(docsRoot, ['branch', '-d', branch]);
    if (deleteResult === null) {
      return { success: true, merged: true, conflicts: false, message: `Merged ${branch}. Branch deletion skipped (may have unmerged commits).` };
    }
  }

  return { success: true, merged: true, conflicts: false, message: `Merged and cleaned up ${branch}.` };
}

/**
 * Run the complete merge intelligence scan.
 *
 * @param {string} docsRoot - Absolute path to docs git root
 * @param {string} codebaseRoot - Absolute path to codebase git root
 * @param {object} [opts]
 * @param {number} [opts.lookback=20] - Merge commit lookback count
 * @returns {{ scanned: boolean, candidates: Array, auto_merge: Array, needs_review: Array, errors: Array, reason?: string }}
 */
function scanAndReport(docsRoot, codebaseRoot, opts) {
  // Check current branch is master/main
  const currentBranch = gitExec(codebaseRoot, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (!currentBranch || !['master', 'main'].includes(currentBranch)) {
    return { scanned: false, reason: 'not on master', candidates: [], auto_merge: [], needs_review: [], errors: [] };
  }

  const errors = [];

  // Step 1: Detect merged branches
  const merged = detectMergedBranches(codebaseRoot, opts);
  if (merged.length === 0) {
    return { scanned: true, candidates: [], auto_merge: [], needs_review: [], errors };
  }

  // Step 2: Find matching docs branches
  const matched = findMatchingDocsBranches(docsRoot, merged);
  if (matched.length === 0) {
    return { scanned: true, candidates: [], auto_merge: [], needs_review: [], errors };
  }

  // Step 3: Assess staleness
  const assessed = assessStaleness(docsRoot, codebaseRoot, matched);

  // Partition
  const autoMerge = assessed.filter(c => c.status === 'current');
  const needsReview = assessed.filter(c => c.status !== 'current');

  // Save candidates
  const intelDir = getMergeIntelDir();
  if (intelDir) {
    const candidatesData = {
      version: 1,
      last_scan: new Date().toISOString(),
      codebase_branch: currentBranch,
      candidates: assessed,
    };
    atomicWrite(candidatesData, path.join(intelDir, CANDIDATES_FILE));
  }

  return { scanned: true, candidates: assessed, auto_merge: autoMerge, needs_review: needsReview, errors };
}

/**
 * Record a merge intelligence decision in history.
 *
 * @param {string} branch - Branch name
 * @param {string} action - "merged" | "skipped" | "deferred"
 * @param {boolean} wasStale - Whether docs were stale at decision time
 * @param {string} [notes] - Optional notes
 */
function recordDecision(branch, action, wasStale, notes) {
  const intelDir = getMergeIntelDir();
  if (!intelDir) return;

  const historyPath = path.join(intelDir, HISTORY_FILE);
  const raw = safeReadFile(historyPath);
  const history = raw ? (safeJsonParse(raw).ok ? safeJsonParse(raw).data : { ...DEFAULT_HISTORY }) : { ...DEFAULT_HISTORY };

  if (!Array.isArray(history.decisions)) history.decisions = [];

  history.decisions.unshift({
    codebase_branch: branch,
    docs_branch: branch,
    action,
    was_stale: wasStale,
    date: new Date().toISOString(),
    notes: notes || '',
  });

  // Auto-prune
  if (history.decisions.length > MAX_HISTORY_ENTRIES) {
    history.decisions = history.decisions.slice(0, MAX_HISTORY_ENTRIES);
  }

  atomicWrite(history, historyPath);
}

/**
 * Load current candidates from disk.
 *
 * @returns {object} Candidates data or default empty
 */
function loadCandidates() {
  const intelDir = getMergeIntelDir();
  if (!intelDir) return { ...DEFAULT_CANDIDATES };
  const raw = safeReadFile(path.join(intelDir, CANDIDATES_FILE));
  if (!raw) return { ...DEFAULT_CANDIDATES };
  const result = safeJsonParse(raw);
  return result.ok ? result.data : { ...DEFAULT_CANDIDATES };
}

/**
 * Load merge history from disk.
 *
 * @returns {object} History data or default empty
 */
function loadHistory() {
  const intelDir = getMergeIntelDir();
  if (!intelDir) return { ...DEFAULT_HISTORY };
  const raw = safeReadFile(path.join(intelDir, HISTORY_FILE));
  if (!raw) return { ...DEFAULT_HISTORY };
  const result = safeJsonParse(raw);
  return result.ok ? result.data : { ...DEFAULT_HISTORY };
}

// ── CLI Handler ───────────────────────────────────────────────────────────────

/**
 * CLI handler for `fp-tools merge-intel <subcommand>`.
 *
 * @param {string} subcommand - scan | status | history | clear
 * @param {string[]} args - Additional arguments
 * @param {boolean} raw - Raw output mode
 */
function cmdMergeIntel(subcommand, args, raw) {
  if (!subcommand) {
    error('Usage: fp-tools merge-intel <scan|status|history|clear>');
  }

  switch (subcommand) {
    case 'scan': {
      const codebaseRoot = getCodebaseRoot();
      if (!codebaseRoot) { error('No codebase root found'); }
      const docsInfo = getDocsRoot(codebaseRoot);
      if (!docsInfo.path || !docsInfo.exists) { error('No docs repo found'); }
      const result = scanAndReport(docsInfo.path, codebaseRoot);
      output(result, raw, JSON.stringify(result, null, 2));
      break;
    }

    case 'status': {
      const candidates = loadCandidates();
      output(candidates, raw, JSON.stringify(candidates, null, 2));
      break;
    }

    case 'history': {
      const n = args[0] ? parseInt(args[0], 10) : 10;
      const history = loadHistory();
      const trimmed = { ...history, decisions: history.decisions.slice(0, n) };
      output(trimmed, raw, JSON.stringify(trimmed, null, 2));
      break;
    }

    case 'clear': {
      const intelDir = getMergeIntelDir();
      if (intelDir) {
        const candidatesPath = path.join(intelDir, CANDIDATES_FILE);
        if (fs.existsSync(candidatesPath)) {
          fs.unlinkSync(candidatesPath);
        }
      }
      output({ cleared: true }, raw, 'Candidates cleared.');
      break;
    }

    default:
      error(`Unknown merge-intel subcommand: ${subcommand}. Use: scan, status, history, clear`);
  }
}

module.exports = {
  detectMergedBranches,
  findMatchingDocsBranches,
  assessStaleness,
  executeMerge,
  scanAndReport,
  recordDecision,
  loadCandidates,
  loadHistory,
  cmdMergeIntel,
};
