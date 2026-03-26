'use strict';

/**
 * Git -- Three-repo git operations for fp-docs.
 *
 * Centralizes all git operations across the three independent repositories
 * (codebase, docs, plugin), absorbing logic from:
 * - branch-sync-check.sh (originally ported -- now the canonical implementation)
 * - docs-commit.sh (originally ported -- now the canonical implementation)
 * - remote-check.sh (originally ported -- now the canonical implementation)
 *
 * Features:
 * - Structured error objects with type, message, diagnostic, recovery_hint (D-14)
 * - All git commands use `git -C <repo>` with explicit repo path (D-07)
 * - Watermark in shell-parseable key=value format, NOT JSON (D-08, Pitfall 2)
 * - --offline skips all remote ops, --no-push skips push only (D-13)
 * - CLI surface via `fp-tools git <sync-check|commit|remote-check|watermark|branches>`
 *
 * Zero external dependencies -- Node.js built-ins only (D-15).
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { output, error, safeReadFile } = require('./core.cjs');
const { getCodebaseRoot, getDocsRoot, getPluginRoot } = require('./paths.cjs');
const { validateShellArg } = require('./security.cjs');

// ── Error Handling (per D-14) ──────────────────────────────────────────────

/**
 * Classify a git error based on stderr content and exit code.
 *
 * @param {string} stderr - The stderr output from git
 * @param {number} exitCode - The git process exit code
 * @returns {string} Error type: auth_failure, diverged, uncommitted, not_repo, unreachable
 */
function classifyGitError(stderr, exitCode) {
  const lower = (stderr || '').toLowerCase();

  if (/permission denied|authentication|could not read from remote|publickey/.test(lower)) {
    return 'auth_failure';
  }
  if (/diverged|cannot be fast-forwarded/.test(lower)) {
    return 'diverged';
  }
  if (/uncommitted changes|overwritten by merge/.test(lower)) {
    return 'uncommitted';
  }
  if (exitCode === 128 && /not a git repository/.test(lower)) {
    return 'not_repo';
  }
  return 'unreachable';
}

/**
 * Get a recovery hint for a git operation failure.
 *
 * @param {string} operation - The operation that failed (ls-remote, fetch, push, pull)
 * @param {string} stderr - The stderr output from git
 * @returns {string} Recovery hint for the user
 */
function getRecoveryHint(operation, stderr) {
  const errorType = classifyGitError(stderr, 0);

  // Auth failures always get auth-specific hint regardless of operation
  if (errorType === 'auth_failure') {
    return 'Check SSH key (ssh-add -l) or GitHub token. Verify remote URL.';
  }

  switch (operation) {
    case 'ls-remote':
    case 'fetch':
    case 'push':
      return 'Check network, VPN, GitHub status. Pass --offline to skip remote ops.';
    case 'pull': {
      const pullType = classifyGitError(stderr, 0);
      if (pullType === 'diverged') {
        return 'Branches diverged. Options: git pull --rebase, git merge, or git reset --hard origin/<branch>.';
      }
      if (pullType === 'uncommitted') {
        return 'Stash or commit local changes first.';
      }
      return 'Check remote connectivity.';
    }
    default:
      return 'Check git status and remote configuration.';
  }
}

/**
 * Create a structured git error object (per D-14).
 *
 * @param {string} type - Error type (auth_failure, diverged, uncommitted, etc.)
 * @param {string} message - Human-readable error message
 * @param {string} diagnostic - Technical diagnostic details
 * @param {string} recoveryHint - Actionable recovery suggestion
 * @returns {{ type: string, message: string, diagnostic: string, recovery_hint: string }}
 */
function makeGitError(type, message, diagnostic, recoveryHint) {
  return { type, message, diagnostic, recovery_hint: recoveryHint };
}

// ── Low-level git execution (per D-07) ─────────────────────────────────────

/**
 * Execute a git command with `git -C <repoPath>` and return trimmed stdout.
 *
 * Per Pitfall 5 from RESEARCH.md, always access err.stderr not err.message
 * on failure.
 *
 * @param {string} repoPath - Absolute path to the git repository
 * @param {string[]} args - Git command arguments
 * @param {object} [opts] - Options
 * @param {number} [opts.timeout=30000] - Timeout in milliseconds
 * @returns {string} Trimmed stdout from git
 * @throws {object} Structured error object via makeGitError()
 */
function gitExec(repoPath, args, opts = {}) {
  const timeout = opts.timeout || 30000;
  try {
    const result = execFileSync('git', ['-C', repoPath, ...args], {
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout,
    });
    return result.trim();
  } catch (err) {
    // Per Pitfall 5: access err.stderr, not err.message
    const stderr = err.stderr || '';
    const exitCode = err.status || 1;
    const type = classifyGitError(stderr, exitCode);
    const operation = args[0] || 'git';
    const hint = getRecoveryHint(operation, stderr);
    throw makeGitError(type, `git ${args.join(' ')} failed`, stderr.trim(), hint);
  }
}

// ── Remote operations (originally ported from remote-check.sh) ──────────────

/**
 * Check if the docs remote origin is accessible.
 * Port of check_remote_accessible() from remote-check.sh.
 *
 * @param {string} docsRoot - Absolute path to the docs repo root
 * @returns {{ accessible: boolean, type?: string, diagnostic?: string, recovery_hint?: string }}
 */
function checkRemoteAccessible(docsRoot) {
  // Check if remote is configured
  try {
    gitExec(docsRoot, ['remote', 'get-url', 'origin']);
  } catch {
    return {
      accessible: false,
      type: 'no_remote',
      diagnostic: 'Docs repo has no remote origin configured.',
      recovery_hint: 'Run /fp-docs:setup to configure a remote.',
    };
  }

  // Test connectivity with 10s timeout (matching bash `timeout 10`)
  try {
    gitExec(docsRoot, ['ls-remote', '--exit-code', 'origin', 'HEAD'], { timeout: 10000 });
    return { accessible: true };
  } catch (err) {
    return {
      accessible: false,
      type: err.type || 'unreachable',
      diagnostic: err.diagnostic || err.message || 'Remote check failed',
      recovery_hint: err.recovery_hint || 'Check network, VPN, GitHub status. Pass --offline to skip remote ops.',
    };
  }
}

/**
 * Fetch and pull latest from remote using --ff-only.
 * Port of pull_latest() from remote-check.sh.
 *
 * @param {string} docsRoot - Absolute path to the docs repo root
 * @param {object} [opts] - Options
 * @returns {{ success: boolean, message?: string, type?: string, diagnostic?: string, recovery_hint?: string, local_ahead?: number, remote_ahead?: number }}
 */
function pullLatest(docsRoot, opts = {}) {
  const branch = getCurrentBranch(docsRoot);

  // Check for uncommitted changes
  try {
    gitExec(docsRoot, ['diff', '--quiet']);
  } catch {
    return {
      success: false,
      type: 'uncommitted',
      diagnostic: 'Docs repo has uncommitted changes that block pull.',
      recovery_hint: 'Stash or commit local changes first.',
    };
  }
  try {
    gitExec(docsRoot, ['diff', '--cached', '--quiet']);
  } catch {
    return {
      success: false,
      type: 'uncommitted',
      diagnostic: 'Docs repo has staged uncommitted changes that block pull.',
      recovery_hint: 'Stash or commit local changes first.',
    };
  }

  // Fetch from remote
  try {
    gitExec(docsRoot, ['fetch', 'origin'], { timeout: 30000 });
  } catch (err) {
    return {
      success: false,
      type: err.type || 'unreachable',
      diagnostic: err.diagnostic || 'Fetch failed',
      recovery_hint: err.recovery_hint || 'Check network, VPN, GitHub status. Pass --offline to skip remote ops.',
    };
  }

  // Check if remote branch exists
  try {
    gitExec(docsRoot, ['rev-parse', '--verify', 'origin/' + branch]);
  } catch {
    return { success: true, message: 'No remote branch -- skipping pull' };
  }

  // Pull with --ff-only
  try {
    gitExec(docsRoot, ['pull', '--ff-only'], { timeout: 30000 });
    return { success: true, message: `Pulled latest from origin/${branch}` };
  } catch (err) {
    // Check for diverged branches
    if (err.type === 'diverged' || (err.diagnostic && /diverged|cannot be fast-forwarded/i.test(err.diagnostic))) {
      let localAhead = 0;
      let remoteAhead = 0;
      try {
        localAhead = parseInt(gitExec(docsRoot, ['rev-list', '--count', `origin/${branch}..HEAD`]), 10) || 0;
        remoteAhead = parseInt(gitExec(docsRoot, ['rev-list', '--count', `HEAD..origin/${branch}`]), 10) || 0;
      } catch {
        // Count failed -- use 0
      }
      return {
        success: false,
        type: 'diverged',
        diagnostic: `Local has ${localAhead} commit(s) ahead, remote has ${remoteAhead} commit(s) ahead.`,
        recovery_hint: 'Branches diverged. Options: git pull --rebase, git merge, or git reset --hard origin/<branch>.',
        local_ahead: localAhead,
        remote_ahead: remoteAhead,
      };
    }
    return {
      success: false,
      type: err.type || 'unreachable',
      diagnostic: err.diagnostic || 'Pull failed',
      recovery_hint: err.recovery_hint || 'Check remote connectivity.',
    };
  }
}

/**
 * Push docs repo to remote.
 *
 * @param {string} docsRoot - Absolute path to the docs repo root
 * @param {string} branch - Branch name to push
 * @returns {{ success: boolean }}
 * @throws {object} Structured error on push failure
 */
function pushDocs(docsRoot, branch) {
  gitExec(docsRoot, ['push'], { timeout: 60000 });
  return { success: true };
}

// ── Branch operations ─────────────────────────────────────────────────────

/**
 * Get the current branch name for a repository.
 *
 * @param {string} repoPath - Absolute path to the git repository
 * @returns {string|null} Current branch name, or null if unavailable
 */
function getCurrentBranch(repoPath) {
  try {
    const branch = gitExec(repoPath, ['branch', '--show-current']);
    return branch || null;
  } catch {
    return null;
  }
}

/**
 * Get branch names for all three repositories (per D-06, D-12).
 *
 * @returns {{ codebase: string|null, docs: string|null, plugin: string|null }}
 */
function getBranches() {
  const codebaseRoot = getCodebaseRoot();
  const docsInfo = getDocsRoot(codebaseRoot);
  const pluginRoot = getPluginRoot();

  return {
    codebase: codebaseRoot ? getCurrentBranch(codebaseRoot) : null,
    docs: docsInfo.path && docsInfo.hasGit ? getCurrentBranch(docsInfo.path) : null,
    plugin: getCurrentBranch(pluginRoot),
  };
}

// ── Commit operations (originally ported from docs-commit.sh) ───────────────

/**
 * Commit and optionally push docs changes.
 * Docs commit and push operations.
 *
 * @param {string} docsRoot - Absolute path to the docs repo root
 * @param {string} message - Commit message
 * @param {object} [opts] - Options
 * @param {boolean} [opts.offline=false] - Skip all remote operations
 * @param {boolean} [opts.noPush=false] - Skip push only
 * @returns {{ committed: boolean, branch?: string, message?: string, pushed?: boolean }}
 */
function commitDocs(docsRoot, message, opts = {}) {
  const offline = opts.offline || false;
  const noPush = opts.noPush || offline; // --offline implies --no-push (D-13)

  // Validate commit message via security module
  const validation = validateShellArg(message);
  if (!validation.safe) {
    throw makeGitError('validation', 'Invalid commit message', validation.error, 'Use a safe commit message without shell metacharacters.');
  }

  const branch = getCurrentBranch(docsRoot);

  // Pull latest (unless offline)
  if (!offline) {
    // Check if remote is configured first
    let hasRemote = true;
    try {
      gitExec(docsRoot, ['remote', 'get-url', 'origin']);
    } catch {
      hasRemote = false;
    }

    if (hasRemote) {
      const pullResult = pullLatest(docsRoot);
      if (!pullResult.success) {
        throw makeGitError(
          pullResult.type || 'pull_failed',
          'Pull failed before commit',
          pullResult.diagnostic || 'Unknown pull failure',
          pullResult.recovery_hint || 'Check remote connectivity.'
        );
      }
    }
  }

  // Stage all changes
  gitExec(docsRoot, ['add', '-A']);

  // Check if there are changes to commit
  try {
    gitExec(docsRoot, ['diff', '--cached', '--quiet']);
    // If diff --cached --quiet succeeds, there are NO changes
    return { committed: false, message: 'No docs changes to commit.' };
  } catch {
    // diff --cached --quiet fails when there ARE staged changes -- proceed
  }

  // Commit
  gitExec(docsRoot, ['commit', '-m', message]);

  // Push (unless noPush or offline)
  let pushed = false;
  if (!noPush) {
    let hasRemote = true;
    try {
      gitExec(docsRoot, ['remote', 'get-url', 'origin']);
    } catch {
      hasRemote = false;
    }

    if (hasRemote) {
      pushDocs(docsRoot, branch);
      pushed = true;
    }
  }

  return { committed: true, branch, message, pushed };
}

// ── Watermark operations (per D-08) ─────────────────────────────────────────

/**
 * Read the sync watermark file.
 *
 * Parses key=value lines, skips comments (#) and empty lines.
 * Returns null if file missing or malformed (must have codebase_commit).
 *
 * @param {string} docsRoot - Absolute path to the docs repo root
 * @returns {{ codebase_branch: string, codebase_commit: string, sync_timestamp: string }|null}
 */
function readWatermark(docsRoot) {
  const watermarkPath = path.join(docsRoot, '.sync-watermark');
  const content = safeReadFile(watermarkPath);

  if (!content) return null;

  const result = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex);
    const value = trimmed.slice(eqIndex + 1);
    result[key] = value;
  }

  // Must have codebase_commit to be valid
  if (!result.codebase_commit) return null;

  return {
    codebase_branch: result.codebase_branch || '',
    codebase_commit: result.codebase_commit,
    sync_timestamp: result.sync_timestamp || '',
  };
}

/**
 * Write the sync watermark file in shell-parseable key=value format.
 * Per Pitfall 2: keep key=value format (NOT JSON) because bash hooks still read it.
 *
 * @param {string} docsRoot - Absolute path to the docs repo root
 * @param {string} branch - Current codebase branch name
 * @param {string} commitHash - Current codebase HEAD commit hash
 */
function writeWatermark(docsRoot, branch, commitHash) {
  const watermarkPath = path.join(docsRoot, '.sync-watermark');
  const timestamp = new Date().toISOString();
  const content = [
    '# fp-docs sync watermark -- do not edit manually',
    '# Records the codebase state that docs were last synced against.',
    `codebase_branch=${branch}`,
    `codebase_commit=${commitHash}`,
    `sync_timestamp=${timestamp}`,
    '', // trailing newline
  ].join('\n');

  fs.writeFileSync(watermarkPath, content, 'utf-8');
}

/**
 * Validate the watermark against the current codebase state.
 *
 * @param {string} docsRoot - Absolute path to the docs repo root
 * @param {string} codebaseRoot - Absolute path to the codebase root
 * @returns {{ status: string, commits_behind?: number, reason?: string }}
 */
function validateWatermark(docsRoot, codebaseRoot) {
  const watermark = readWatermark(docsRoot);

  if (!watermark) {
    // Check if file exists but is malformed
    const watermarkPath = path.join(docsRoot, '.sync-watermark');
    const content = safeReadFile(watermarkPath);
    if (content !== null) {
      return { status: 'malformed' };
    }
    return { status: 'none' };
  }

  // Get codebase HEAD
  let codebaseHead;
  try {
    codebaseHead = gitExec(codebaseRoot, ['rev-parse', 'HEAD']);
  } catch {
    return { status: 'invalid', reason: 'Cannot read codebase HEAD' };
  }

  // Compare watermark commit with HEAD
  if (watermark.codebase_commit === codebaseHead) {
    return { status: 'current' };
  }

  // Check if watermark commit exists in history
  try {
    gitExec(codebaseRoot, ['cat-file', '-t', watermark.codebase_commit]);
  } catch {
    return { status: 'invalid', reason: 'watermark commit not found in codebase history' };
  }

  // Count commits since watermark
  try {
    const count = parseInt(
      gitExec(codebaseRoot, ['rev-list', '--count', `${watermark.codebase_commit}..HEAD`]),
      10
    );
    return { status: 'stale', commits_behind: count };
  } catch {
    return { status: 'stale', commits_behind: 0 };
  }
}

// ── Sync check (originally ported from branch-sync-check.sh) ────────────────

/**
 * Perform a full sync check: branch comparison + remote check + watermark validation.
 * Port of branch-sync-check.sh logic.
 *
 * @param {string} docsRoot - Absolute path to the docs repo root
 * @param {string} codebaseRoot - Absolute path to the codebase root
 * @param {object} [opts] - Options
 * @param {boolean} [opts.offline=false] - Skip all remote operations
 * @returns {{ codebase_branch: string|null, docs_branch: string|null, branches_match: boolean, remote_status: string, watermark: object }}
 */
function syncCheck(docsRoot, codebaseRoot, opts = {}) {
  const offline = opts.offline || false;

  // Get both branches
  const codebaseBranch = getCurrentBranch(codebaseRoot);
  const docsBranch = getCurrentBranch(docsRoot);
  const branchesMatch = codebaseBranch === docsBranch;

  // Remote check (unless offline)
  let remoteStatus = 'not_checked';
  if (!offline) {
    const remoteResult = checkRemoteAccessible(docsRoot);
    if (remoteResult.accessible) {
      const pullResult = pullLatest(docsRoot);
      remoteStatus = pullResult.success ? 'pulled' : (pullResult.type || 'pull_failed');
    } else {
      remoteStatus = remoteResult.type || 'unreachable';
    }
  } else {
    remoteStatus = 'skipped (offline)';
  }

  // Validate watermark
  const watermark = validateWatermark(docsRoot, codebaseRoot);

  return {
    codebase_branch: codebaseBranch,
    docs_branch: docsBranch,
    branches_match: branchesMatch,
    remote_status: remoteStatus,
    watermark,
  };
}

// ── Flag parsing (per D-13) ─────────────────────────────────────────────────

/**
 * Parse --offline and --no-push flags from args array.
 * --offline implies --no-push.
 *
 * @param {string[]} args - Arguments array to scan
 * @returns {{ offline: boolean, noPush: boolean }}
 */
function parseFlags(args) {
  const offline = args.includes('--offline');
  const noPush = args.includes('--no-push') || offline; // --offline implies --no-push
  return { offline, noPush };
}

// ── CLI Handler (per D-12) ──────────────────────────────────────────────────

/**
 * CLI handler for `fp-tools git <subcommand>`.
 *
 * Subcommands:
 *   sync-check    - Branch comparison + remote check + watermark validation
 *   commit        - Commit and push docs changes
 *   remote-check  - Test remote accessibility
 *   watermark     - Read/write/validate sync watermark
 *   branches      - Show all three repo branch names
 *
 * @param {string} subcommand - The git subcommand
 * @param {string[]} args - Additional arguments
 * @param {boolean} raw - Whether to use raw output mode
 */
function cmdGit(subcommand, args, raw) {
  // Resolve paths at the top
  const codebaseRoot = getCodebaseRoot();
  const docsInfo = getDocsRoot(codebaseRoot);

  if (!subcommand) {
    error('Usage: fp-tools git <sync-check|commit|remote-check|watermark|branches> [args]');
  }

  switch (subcommand) {
    case 'sync-check': {
      if (!docsInfo.path || !docsInfo.hasGit) {
        error('Docs repo not available. Run /fp-docs:setup to initialize.');
      }
      const flags = parseFlags(args);
      try {
        const result = syncCheck(docsInfo.path, codebaseRoot, { offline: flags.offline });
        output(result, raw, JSON.stringify(result, null, 2));
      } catch (err) {
        if (err.type) {
          output(err, raw, JSON.stringify(err, null, 2));
        } else {
          error(`Sync check failed: ${err.message || err}`);
        }
      }
      break;
    }

    case 'commit': {
      if (!docsInfo.path || !docsInfo.hasGit) {
        error('Docs repo not available. Run /fp-docs:setup to initialize.');
      }
      const flags = parseFlags(args);
      // Extract message: first non-flag argument
      const message = args.find(a => !a.startsWith('--')) || 'fp-docs: automated update';
      try {
        const result = commitDocs(docsInfo.path, message, { offline: flags.offline, noPush: flags.noPush });
        output(result, raw, JSON.stringify(result, null, 2));
      } catch (err) {
        if (err.type) {
          output(err, raw, JSON.stringify(err, null, 2));
        } else {
          error(`Commit failed: ${err.message || err}`);
        }
      }
      break;
    }

    case 'remote-check': {
      if (!docsInfo.path || !docsInfo.hasGit) {
        error('Docs repo not available. Run /fp-docs:setup to initialize.');
      }
      const result = checkRemoteAccessible(docsInfo.path);
      output(result, raw, JSON.stringify(result, null, 2));
      break;
    }

    case 'watermark': {
      const watermarkSub = args[0];
      if (!watermarkSub) {
        error('Usage: fp-tools git watermark <read|write|validate> [args]');
      }

      switch (watermarkSub) {
        case 'read': {
          if (!docsInfo.path) {
            output(null, raw, 'null');
            break;
          }
          const wm = readWatermark(docsInfo.path);
          output(wm, raw, wm ? JSON.stringify(wm, null, 2) : 'null');
          break;
        }
        case 'write': {
          if (!docsInfo.path) {
            error('Docs repo not available. Run /fp-docs:setup to initialize.');
          }
          const branch = args[1];
          const commit = args[2];
          if (!branch || !commit) {
            error('Usage: fp-tools git watermark write <branch> <commit>');
          }
          writeWatermark(docsInfo.path, branch, commit);
          output({ written: true }, raw, 'true');
          break;
        }
        case 'validate': {
          if (!docsInfo.path || !docsInfo.hasGit || !codebaseRoot) {
            error('Both docs and codebase repos must be available for validation.');
          }
          const result = validateWatermark(docsInfo.path, codebaseRoot);
          output(result, raw, JSON.stringify(result, null, 2));
          break;
        }
        default:
          error(`Unknown watermark subcommand: ${watermarkSub}. Use: read, write, validate`);
      }
      break;
    }

    case 'branches': {
      const result = getBranches();
      output(result, raw, JSON.stringify(result, null, 2));
      break;
    }

    default:
      error(`Unknown git subcommand: ${subcommand}. Use: sync-check, commit, remote-check, watermark, branches`);
  }
}

module.exports = {
  gitExec,
  checkRemoteAccessible,
  pullLatest,
  pushDocs,
  getCurrentBranch,
  getBranches,
  syncCheck,
  commitDocs,
  readWatermark,
  writeWatermark,
  validateWatermark,
  parseFlags,
  classifyGitError,
  getRecoveryHint,
  makeGitError,
  cmdGit,
};
