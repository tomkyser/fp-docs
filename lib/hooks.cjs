'use strict';

/**
 * Hooks -- CJS hook handlers (originally ported from bash scripts, now the canonical implementation).
 *
 * Handler origins:
 * - inject-manifest (SessionStart: inject plugin root + manifest)
 * - branch-sync-check (SessionStart: branch comparison + remote + watermark)
 * - post-modify-check (SubagentStop: validate modify pipeline completion)
 * - post-orchestrate-check (SubagentStop: validate orchestrate pipeline)
 * - locals-cli-cleanup (SubagentStop: clean orphaned locals CLI artifacts)
 * - teammate-idle-check (TeammateIdle: check delegation result structure)
 * - task-completed-check (TaskCompleted: verify task outputs)
 *
 * Handler categories:
 * - Category A (JSON stdout, exit 0): inject-manifest, branch-sync-check, locals-cli-cleanup
 *   Returns: { additionalContext: string, stopMessage?: string }
 * - Category B (exit code + stderr): post-modify, post-orchestrate, teammate-idle, task-completed
 *   Returns: { exitCode: 0|2, warnings: string[] }
 *
 * CLI surface: fp-tools hooks run <event> [matcher]
 *
 * Zero external dependencies -- Node.js built-ins only.
 */

const fs = require('fs');
const path = require('path');
const { output, error, safeReadFile, safeJsonParse } = require('./core.cjs');
const { getPluginRoot, getCodebaseRoot, getDocsRoot } = require('./paths.cjs');
const git = require('./git.cjs');

// Lazy-loaded to avoid circular dependency risk -- loaded only when drift handlers fire
let _drift = null;
function getDrift() {
  if (!_drift) _drift = require('./drift.cjs');
  return _drift;
}

// -- CJS compliance patterns (D-05) ------------------------------------------
// Non-blocking checks for write-capable engine transcripts.
// If an engine skips expected CJS calls, a warning is emitted but operation completes.
const CJS_PIPELINE_COMPLIANCE = [
  { pattern: /fp-tools\.cjs\s+pipeline\s+init/, warning: 'Engine may not have initialized CJS pipeline' },
  { pattern: /fp-tools\.cjs\s+pipeline\s+next/, warning: 'Engine may not have used CJS pipeline callback loop' },
];

const CJS_MODIFY_COMPLIANCE = [
  { pattern: /fp-tools\.cjs\s+pipeline/, warning: 'Modify engine may not have used CJS pipeline tooling' },
];

// -- Shared utility ----------------------------------------------------------

/**
 * Check a transcript for required marker patterns.
 * Returns an array of warning strings for any missing markers.
 *
 * @param {string} transcript - The agent transcript text
 * @param {Array<{ pattern: RegExp, warning: string }>} checks - Patterns to test
 * @returns {string[]} Array of warning messages for missing markers
 */
function checkTranscriptMarkers(transcript, checks) {
  const warnings = [];
  for (const { pattern, warning } of checks) {
    if (!pattern.test(transcript)) {
      warnings.push(warning);
    }
  }
  return warnings;
}

// -- Handler 1: inject-manifest (Category A) ---------------------------------

/**
 * SessionStart hook: inject plugin root path and manifest into session context.
 * Port of inject-manifest.sh (13 lines).
 *
 * @param {object} input - Parsed stdin JSON (ignored for this hook)
 * @returns {{ additionalContext: string }}
 */
function handleInjectManifest(input) {
  const pluginRoot = getPluginRoot();
  const manifestPath = path.join(pluginRoot, 'framework', 'manifest.md');
  const manifestContent = safeReadFile(manifestPath) || 'Manifest not found';

  return {
    additionalContext: `fp-docs plugin root: ${pluginRoot}\n\n${manifestContent}`,
  };
}

// -- Handler 2: branch-sync-check (Category A) ------------------------------

/**
 * SessionStart hook: detect codebase branch, compare with docs branch,
 * check remote, validate watermark. Port of branch-sync-check.sh (123 lines).
 *
 * @param {object} input - Parsed stdin JSON (ignored for this hook)
 * @returns {{ additionalContext: string, stopMessage?: string }}
 */
function handleBranchSyncCheck(input) {
  // Find codebase root
  const codebaseRoot = getCodebaseRoot();
  if (!codebaseRoot) {
    // Not in a git repo, skip silently (matches bash `exit 0`)
    return { additionalContext: '' };
  }

  // Resolve docs path
  const docsInfo = getDocsRoot(codebaseRoot);
  if (!docsInfo.hasGit) {
    return {
      additionalContext: `Docs repo not detected at ${docsInfo.path}. Run /fp-docs:setup to initialize.`,
    };
  }

  const docsRoot = docsInfo.path;

  // Perform full sync check (branch comparison + remote + watermark)
  const sync = git.syncCheck(docsRoot, codebaseRoot);

  const codebaseBranch = sync.codebase_branch || '';
  const docsBranch = sync.docs_branch || '';
  const remoteStatus = sync.remote_status;
  const watermark = sync.watermark || {};

  // Handle remote failures: if remote_status indicates a problem, return with stopMessage
  const safeStatuses = ['pulled', 'not_checked', 'skipped', 'skipped (offline)', 'no_remote', 'utils_unavailable'];
  if (!safeStatuses.includes(remoteStatus)) {
    // Remote failure -- halt with diagnostic and --offline hint
    return {
      additionalContext: `Docs repo: ${docsRoot}. Codebase: ${codebaseBranch}, Docs: ${docsBranch}. Remote: ${remoteStatus}.`,
      stopMessage: `Docs remote issue: ${remoteStatus}.\n\nPass --offline to any fp-docs command to work without remote sync.`,
    };
  }

  // Format watermark status
  let watermarkInfo;
  switch (watermark.status) {
    case 'current':
      watermarkInfo = 'current';
      break;
    case 'stale':
      watermarkInfo = watermark.commits_behind != null
        ? `stale (${watermark.commits_behind} new codebase commits since last sync)`
        : 'stale';
      break;
    case 'invalid':
      watermarkInfo = watermark.reason
        ? `invalid (${watermark.reason})`
        : 'invalid (watermark commit not found in codebase history)';
      break;
    case 'malformed':
      watermarkInfo = 'malformed (missing codebase_commit value)';
      break;
    default:
      watermarkInfo = 'none';
      break;
  }

  // Branch match logic
  if (codebaseBranch === docsBranch) {
    if (watermark.status === 'stale') {
      // Branches aligned but codebase has new changes
      return {
        additionalContext: `Branches aligned (${codebaseBranch}). Docs git root: ${docsRoot}. Remote: ${remoteStatus}. Watermark: ${watermarkInfo}. Run /fp-docs:sync to detect affected docs.`,
      };
    }
    // Fully synced
    return {
      additionalContext: `Repos synced. Codebase: ${codebaseBranch}, Docs: ${docsBranch}. Docs git root: ${docsRoot}. Remote: ${remoteStatus}. Watermark: ${watermarkInfo}.`,
    };
  }

  // Branch mismatch
  return {
    additionalContext: `BRANCH MISMATCH -- Codebase: ${codebaseBranch}, Docs: ${docsBranch}. Run /fp-docs:sync to align. Docs git root: ${docsRoot}. Remote: ${remoteStatus}. Watermark: ${watermarkInfo}.`,
    stopMessage: `Docs branch '${docsBranch}' does not match codebase branch '${codebaseBranch}'. Run /fp-docs:sync to create/switch the docs branch and generate a diff report. Or continue if you want to work on docs independently.`,
  };
}

// -- Handler 8: drift-nudge (Category A) ------------------------------------

/**
 * SessionStart hook: surface pending drift signals as a nudge.
 * Merges drift-pending.json into staleness.json first, then formats summary.
 * Per D-09/D-10/D-11/D-12 from CONTEXT.md.
 *
 * @param {object} input - Parsed stdin JSON (ignored for this hook)
 * @returns {{ additionalContext: string }}
 */
function handleDriftNudge(input) {
  const drift = getDrift();

  // Step 1: Merge any pending drift signals from git hooks into staleness
  try {
    drift.mergePending();
  } catch {
    // Silently ignore merge errors (pending file may not exist)
  }

  // Step 2: Load current staleness state
  let data;
  try {
    data = drift.loadStaleness();
  } catch {
    return { additionalContext: '' };
  }

  // D-10: Suppress when clean
  if (!data || !data.signals || data.signals.length === 0) {
    return { additionalContext: '' };
  }

  // Step 3: Format nudge using drift module
  const nudge = drift.formatNudge(data.signals);
  return { additionalContext: nudge };
}

// -- Handler 3: post-modify-check (Category B) ------------------------------

/**
 * SubagentStop hook: validate modify pipeline completion.
 * Port of post-modify-check.sh (15 lines).
 *
 * @param {object} input - Parsed stdin JSON with { transcript }
 * @returns {{ exitCode: number, warnings: string[] }}
 */
function handlePostModifyCheck(input) {
  const transcript = (input.transcript || '');
  const warnings = [];

  // Check 1: Changelog update
  if (!/changelog.*updated|updated.*changelog/i.test(transcript)) {
    warnings.push('Warning: modify completed without changelog update confirmation');
  }

  // Check 2: CJS pipeline compliance (D-05) -- standalone mode only
  // In delegated mode, the modify engine does not run the full pipeline,
  // so missing fp-tools pipeline calls are expected and not flagged.
  if (/standalone|Step 5.*Finalize/i.test(transcript)) {
    const cjsWarnings = checkTranscriptMarkers(transcript, CJS_MODIFY_COMPLIANCE);
    warnings.push(...cjsWarnings);
  }

  return {
    exitCode: warnings.length > 0 ? 2 : 0,
    warnings,
  };
}

// -- Handler 4: post-orchestrate-check (Category B) -------------------------

/**
 * SubagentStop hook: validate orchestrate pipeline completion.
 * Port of post-orchestrate-check.sh (33 lines).
 *
 * @param {object} input - Parsed stdin JSON with { transcript }
 * @returns {{ exitCode: number, warnings: string[] }}
 */
function handlePostOrchestrateCheck(input) {
  const transcript = (input.transcript || '');
  const warnings = [];

  // Check 1: Pipeline completion marker
  if (!/Pipeline complete:/.test(transcript)) {
    warnings.push('Warning: orchestrate completed without pipeline completion marker');
  }

  // Check 2: Changelog update for write operations
  if (/write phase|delegation result|files modified/i.test(transcript)) {
    if (!/changelog.*updated|updated.*changelog/i.test(transcript)) {
      warnings.push('Warning: write operation completed without changelog update');
    }
  }

  // Check 3: Subagent delegation
  if (!/agents? used|delegation result|pipeline validation/i.test(transcript)) {
    warnings.push('Warning: orchestrate may not have delegated to specialist engines');
  }

  // Check 4: CJS pipeline compliance (D-05)
  // Only check for write operations (transcripts mentioning write phase or delegation)
  if (/write phase|delegation result|files modified/i.test(transcript)) {
    const cjsWarnings = checkTranscriptMarkers(transcript, CJS_PIPELINE_COMPLIANCE);
    warnings.push(...cjsWarnings);
  }

  // D-07: Auto-clear drift signals for docs modified by successful operations
  if (warnings.length === 0) {
    try {
      const drift = getDrift();
      // Extract doc paths from transcript (look for "Files Modified" or file paths in docs/)
      const docMatches = transcript.match(/docs\/[^\s,)]+\.md/g);
      if (docMatches) {
        for (const docPath of [...new Set(docMatches)]) {
          drift.clearSignals(docPath);
        }
      }
    } catch {
      // Silently ignore auto-clear errors -- non-critical
    }
  }

  return {
    exitCode: warnings.length > 0 ? 2 : 0,
    warnings,
  };
}

// -- Handler 5: locals-cli-cleanup (Category A) -----------------------------

/**
 * SubagentStop hook: ensure locals CLI artifacts are cleaned up after engine stops.
 * Port of locals-cli-cleanup-check.sh (34 lines).
 *
 * @param {object} input - Parsed stdin JSON (ignored for this hook)
 * @returns {{ additionalContext: string }}
 */
function handleLocalsCLICleanup(input) {
  const codebaseRoot = getCodebaseRoot();
  if (!codebaseRoot) {
    return {
      additionalContext: 'SubagentStop check for locals engine: Could not determine codebase root.',
    };
  }

  const themeRoot = path.join(codebaseRoot, 'themes', 'foreign-policy-2017');
  const cliTarget = path.join(themeRoot, 'inc', 'cli', 'class-locals-cli.php');
  const functionsFile = path.join(themeRoot, 'functions.php');

  let orphaned = false;
  let cleanupLog = '';

  // Check for orphaned CLI file
  if (fs.existsSync(cliTarget)) {
    orphaned = true;
    fs.unlinkSync(cliTarget);
    cleanupLog += ' Removed orphaned CLI file.';
  }

  // Check for orphaned functions.php registration
  if (fs.existsSync(functionsFile)) {
    const content = safeReadFile(functionsFile);
    if (content && content.includes('class-locals-cli.php')) {
      orphaned = true;
      const filtered = content.split('\n').filter(line => !line.includes('class-locals-cli.php')).join('\n');
      fs.writeFileSync(functionsFile, filtered, 'utf-8');
      cleanupLog += ' Removed orphaned require_once from functions.php.';
    }
  }

  if (orphaned) {
    return {
      additionalContext: `SubagentStop safety check for locals engine: WARNING -- Locals CLI teardown was not completed by the engine. Auto-cleaned:${cleanupLog} The CLI tool is ephemeral and must never persist in the theme.`,
    };
  }

  return {
    additionalContext: 'SubagentStop check for locals engine: Locals CLI teardown verified -- no orphaned artifacts. Engine completed cleanly.',
  };
}

// -- Handler 6: teammate-idle-check (Category B) ----------------------------

/**
 * TeammateIdle hook: check teammate pipeline completion during orchestration.
 * Port of teammate-idle-check.sh (29 lines).
 *
 * @param {object} input - Parsed stdin JSON with { transcript }
 * @returns {{ exitCode: number, warnings: string[] }}
 */
function handleTeammateIdleCheck(input) {
  const transcript = (input.transcript || '');
  const warnings = [];

  // Only check delegation markers if transcript indicates delegated mode
  if (/mode.*delegated|delegation/i.test(transcript)) {
    if (!/## Delegation Result/.test(transcript)) {
      warnings.push('Warning: delegated teammate missing Delegation Result structure');
    }
    if (!/delegation complete:|enforcement stages/i.test(transcript)) {
      warnings.push('Warning: delegated teammate missing enforcement stage markers');
    }
  }

  return {
    exitCode: warnings.length > 0 ? 2 : 0,
    warnings,
  };
}

// -- Handler 7: task-completed-check (Category B) ---------------------------

/**
 * TaskCompleted hook: verify task outputs during orchestration.
 * Port of task-completed-check.sh (36 lines).
 *
 * @param {object} input - Parsed stdin JSON with { transcript, subject }
 * @returns {{ exitCode: number, warnings: string[] }}
 */
function handleTaskCompletedCheck(input) {
  const transcript = (input.transcript || '');
  const subject = (input.subject || '');
  const warnings = [];

  // Check 1: Write tasks must report file modifications
  if (/revise|add|update|generate|annotate|contracts|shapes|deprecate/i.test(subject)) {
    if (!/files modified|changes made|delegation result/i.test(transcript)) {
      warnings.push(`Warning: write task '${subject}' completed without reporting file modifications`);
    }
  }

  // Check 2: HALLUCINATION markers
  if (/HALLUCINATION/i.test(transcript)) {
    warnings.push(`Warning: task '${subject}' contains HALLUCINATION markers in results`);
  }

  // Check 3: Missing changelog entries for write tasks
  if (/revise|add|update|deprecate/i.test(subject)) {
    if (/changelog.*missing|no changelog/i.test(transcript)) {
      warnings.push(`Warning: task '${subject}' may be missing changelog entry`);
    }
  }

  return {
    exitCode: warnings.length > 0 ? 2 : 0,
    warnings,
  };
}

// -- CLI Handler -------------------------------------------------------------

/**
 * CLI handler for `fp-tools hooks run <event> [matcher]`.
 * Dispatches to the correct handler based on event and matcher.
 *
 * @param {string} subcommand - Must be 'run'
 * @param {string[]} args - [event, matcher?]
 * @param {boolean} raw - Whether to use raw output mode
 * @param {object} input - Parsed stdin JSON
 */
function cmdHooks(subcommand, args, raw, input) {
  if (subcommand !== 'run') {
    error('Usage: fp-tools hooks run <event> [matcher]');
  }

  const event = args[0];
  const matcher = args[1];

  if (!event) {
    error('Usage: fp-tools hooks run <event> [matcher]');
  }

  switch (event) {
    case 'session-start': {
      if (!matcher) {
        error('Usage: fp-tools hooks run session-start <inject-manifest|branch-sync|drift-nudge>');
      }
      if (matcher === 'inject-manifest') {
        const result = handleInjectManifest(input);
        output(result, raw, result.additionalContext);
      } else if (matcher === 'branch-sync') {
        const result = handleBranchSyncCheck(input);
        output(result, raw, result.additionalContext);
      } else if (matcher === 'drift-nudge') {
        const result = handleDriftNudge(input);
        output(result, raw, result.additionalContext);
      } else {
        error(`Unknown session-start matcher: ${matcher}. Use: inject-manifest, branch-sync, drift-nudge`);
      }
      break;
    }

    case 'subagent-stop': {
      if (!matcher) {
        error('Usage: fp-tools hooks run subagent-stop <modify|orchestrate|locals>');
      }
      if (matcher === 'modify') {
        const result = handlePostModifyCheck(input);
        if (result.warnings.length > 0) {
          for (const w of result.warnings) {
            process.stderr.write(w + '\n');
          }
          process.exit(result.exitCode);
        }
        process.exit(0);
      } else if (matcher === 'orchestrate') {
        const result = handlePostOrchestrateCheck(input);
        if (result.warnings.length > 0) {
          for (const w of result.warnings) {
            process.stderr.write(w + '\n');
          }
          process.exit(result.exitCode);
        }
        process.exit(0);
      } else if (matcher === 'locals') {
        const result = handleLocalsCLICleanup(input);
        output(result, raw, result.additionalContext);
      } else {
        error(`Unknown subagent-stop matcher: ${matcher}. Use: modify, orchestrate, locals`);
      }
      break;
    }

    case 'teammate-idle': {
      const result = handleTeammateIdleCheck(input);
      if (result.warnings.length > 0) {
        for (const w of result.warnings) {
          process.stderr.write(w + '\n');
        }
        process.exit(result.exitCode);
      }
      process.exit(0);
      break;
    }

    case 'task-completed': {
      const result = handleTaskCompletedCheck(input);
      if (result.warnings.length > 0) {
        for (const w of result.warnings) {
          process.stderr.write(w + '\n');
        }
        process.exit(result.exitCode);
      }
      process.exit(0);
      break;
    }

    default:
      error(`Unknown hook event: ${event}. Use: session-start, subagent-stop, teammate-idle, task-completed`);
  }
}

module.exports = {
  handleInjectManifest,
  handleBranchSyncCheck,
  handleDriftNudge,
  handlePostModifyCheck,
  handlePostOrchestrateCheck,
  handleLocalsCLICleanup,
  handleTeammateIdleCheck,
  handleTaskCompletedCheck,
  checkTranscriptMarkers,
  cmdHooks,
};
