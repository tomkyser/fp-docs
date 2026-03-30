'use strict';

/**
 * Hooks -- CJS hook handlers (originally ported from bash scripts, now the canonical implementation).
 *
 * Handler origins:
 * - inject-manifest (SessionStart: inject plugin root + manifest)
 * - branch-sync-check (SessionStart: branch comparison + remote + watermark)
 * - drift-nudge (SessionStart: surface pending drift signals)
 * - update-check (SessionStart: spawn background update check)
 * - post-modify-check (SubagentStop: validate modify engine delegation result)
 * - post-orchestrate-check (SubagentStop: validate orchestrate pipeline)
 * - locals-cli-cleanup (SubagentStop: clean orphaned locals CLI artifacts)
 * - subagent-enforcement-check (SubagentStop: validate specialist engine delegation results)
 * - pre-tool-use-bash-git-check (PreToolUse: block raw git-write commands)
 * - teammate-idle-check (TeammateIdle: check delegation result structure)
 * - task-completed-check (TaskCompleted: verify task outputs)
 *
 * Handler categories:
 * - Category A (JSON stdout, exit 0): inject-manifest, branch-sync-check, locals-cli-cleanup,
 *   drift-nudge, update-check, post-modify-check, post-orchestrate-check, subagent-enforcement-check
 * - Category PreToolUse (exit 0 allow, exit 2 block): pre-tool-use-bash-git-check
 * - Category B (exit code + stderr): teammate-idle, task-completed
 *   Note: post-modify-check and post-orchestrate-check UPGRADED from Category B to A in Phase 17 (D-04)
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
const enforcement = require('./enforcement.cjs');

// Lazy-loaded to avoid circular dependency risk -- loaded only when drift handlers fire
let _drift = null;
function getDrift() {
  if (!_drift) _drift = require('./drift.cjs');
  return _drift;
}

// Lazy-loaded to avoid circular dependency risk -- loaded only when update handlers fire
let _update = null;
function getUpdate() {
  if (!_update) _update = require('./update.cjs');
  return _update;
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
  const pluginJsonPath = path.join(pluginRoot, '.claude-plugin', 'plugin.json');
  const pluginJson = safeReadFile(pluginJsonPath);
  let identity = 'Plugin manifest not found';
  if (pluginJson) {
    try {
      const manifest = JSON.parse(pluginJson);
      identity = `fp-docs v${manifest.version} — ${manifest.description}`;
    } catch (_) {
      identity = 'Plugin manifest invalid JSON';
    }
  }

  return {
    additionalContext: `fp-docs plugin root: ${pluginRoot}\n\n${identity}`,
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

// -- Handler 9: update-check (Category A) ------------------------------------

/**
 * SessionStart hook: spawn background update check if cache is stale.
 * Per D-06 resolved: this hook ONLY spawns the background check process.
 * It does NOT return additionalContext for update nudges.
 * The update nudge is displayed by the user-level statusline hook
 * (fp-docs-statusline.js), installed by /fp-docs:setup.
 *
 * @param {object} input - Parsed stdin JSON (ignored)
 * @returns {{ additionalContext: string }} Always empty additionalContext
 */
function handleUpdateCheck(input) {
  // Spawn background check if cache is stale or missing
  try {
    const update = getUpdate();
    const cache = update.readUpdateCache();
    if (!cache || update.isCacheStale(cache)) {
      update.spawnBackgroundCheck();
    }
  } catch {
    // Silently ignore spawn errors -- non-critical
  }

  // IMPORTANT: Do NOT return additionalContext with update nudge.
  // Per D-06 resolved, update notification uses statusline only.
  // The fp-docs-statusline.js hook (installed by /fp-docs:setup) reads
  // the cache file and shows the nudge in the statusline.
  return { additionalContext: '' };
}

// -- Handler 3: post-modify-check (Category A -- UPGRADED from B in Phase 17) -

/**
 * SubagentStop hook: validate modify engine delegation result.
 * Per D-04 (fatal), D-05 (no delegated-mode exemptions), D-10 (result parsing).
 *
 * UPGRADED from Category B (exit code warning) to Category A (JSON with violation diagnostics).
 * The orchestrator reads additionalContext and must halt on ENFORCEMENT VIOLATION prefix.
 *
 * @param {object} input - Parsed stdin JSON with last_assistant_message, agent_type
 * @returns {{ additionalContext: string }}
 */
function handlePostModifyCheck(input) {
  const lastMessage = input.last_assistant_message || input.transcript || '';
  const violations = [];

  // Check 1: Delegation result structure (D-10)
  const parsed = enforcement.parseDelegationResult(lastMessage);
  violations.push(...parsed.violations);

  // Check 2: CJS pipeline compliance -- ALL modes (D-05: no exemptions)
  const cjsWarnings = checkTranscriptMarkers(lastMessage, CJS_MODIFY_COMPLIANCE);
  for (const w of cjsWarnings) {
    violations.push({
      check: 'cjs_compliance',
      expected: 'CJS pipeline tooling invocation',
      found: w,
    });
  }

  if (violations.length > 0) {
    return {
      additionalContext: 'ENFORCEMENT VIOLATION: ' + violations.length + ' fatal violation(s) detected in modify engine output.\n' +
        violations.map(v => '- [' + v.check + '] Expected: ' + v.expected + '. Found: ' + v.found + '.').join('\n') +
        '\nOrchestrator: HALT this operation. Do not proceed to finalization.',
    };
  }

  return {
    additionalContext: 'SubagentStop check for modify engine: all enforcement checks passed.',
  };
}

// -- Handler 4: post-orchestrate-check (Category A -- UPGRADED from B in Phase 17)

/**
 * SubagentStop hook: validate orchestrate engine pipeline completion.
 * Per D-04 (fatal), D-06 (fatal violations list).
 *
 * UPGRADED from Category B to Category A with violation diagnostics.
 *
 * @param {object} input - Parsed stdin JSON with last_assistant_message
 * @returns {{ additionalContext: string }}
 */
function handlePostOrchestrateCheck(input) {
  const lastMessage = input.last_assistant_message || input.transcript || '';
  const violations = [];

  // Check 1: Pipeline completion marker
  if (!/Pipeline complete:/.test(lastMessage)) {
    violations.push({
      check: 'pipeline_completion',
      expected: 'Pipeline complete: marker in output',
      found: 'no pipeline completion marker detected',
    });
  }

  // Check 2: Changelog update for write operations
  if (/write phase|delegation result|files modified/i.test(lastMessage)) {
    if (!/changelog.*updated|updated.*changelog/i.test(lastMessage)) {
      violations.push({
        check: 'changelog_update',
        expected: 'changelog update confirmation for write operation',
        found: 'no changelog update marker detected',
      });
    }
  }

  // Check 3: Subagent delegation
  if (!/agents? used|delegation result|pipeline validation|research result|plan result/i.test(lastMessage)) {
    violations.push({
      check: 'delegation_usage',
      expected: 'evidence of specialist engine delegation',
      found: 'no delegation result markers detected',
    });
  }

  // Check 4: CJS pipeline compliance (D-04/D-05: fatal, no exemptions)
  if (/write phase|delegation result|files modified/i.test(lastMessage)) {
    const cjsWarnings = checkTranscriptMarkers(lastMessage, CJS_PIPELINE_COMPLIANCE);
    for (const w of cjsWarnings) {
      violations.push({
        check: 'cjs_compliance',
        expected: 'CJS pipeline tooling invocation',
        found: w,
      });
    }
  }

  // D-07: Auto-clear drift signals for docs modified by successful operations
  if (violations.length === 0) {
    try {
      const drift = getDrift();
      const docMatches = lastMessage.match(/docs\/[^\s,)]+\.md/g);
      if (docMatches) {
        for (const docPath of [...new Set(docMatches)]) {
          drift.clearSignals(docPath);
        }
      }
    } catch {
      // Silently ignore auto-clear errors -- non-critical
    }
  }

  if (violations.length > 0) {
    return {
      additionalContext: 'ENFORCEMENT VIOLATION: ' + violations.length + ' fatal violation(s) detected in orchestrate engine output.\n' +
        violations.map(v => '- [' + v.check + '] Expected: ' + v.expected + '. Found: ' + v.found + '.').join('\n') +
        '\nOrchestrator: HALT this operation. Review diagnostics and decide whether to retry or abort.',
    };
  }

  return {
    additionalContext: 'SubagentStop check for orchestrate engine: all enforcement checks passed.',
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

// -- Handler 10: pre-tool-use git check (PreToolUse) ---------------------------

/**
 * PreToolUse hook: block raw git-write commands from non-orchestrator engines.
 * Per D-01 (git-write interception), D-02 (all non-orchestrator engines), D-03 (CJS exemption).
 *
 * Exit code semantics for PreToolUse:
 *   Exit 0 = allow the tool call to proceed
 *   Exit 2 = BLOCK the tool call, stderr fed to Claude as feedback
 *
 * @param {object} input - Parsed stdin JSON with tool_input.command
 * @returns {{ allowed: boolean, reason: string }}
 */
function handlePreToolUseBashGitCheck(input) {
  const command = (input.tool_input && input.tool_input.command) || '';

  // Empty or non-string command: allow
  if (!command) {
    return { allowed: true, reason: 'no command to check' };
  }

  // D-03: Check using enforcement module
  const result = enforcement.isGitWriteCommand(command);

  if (result.blocked) {
    return { allowed: false, reason: result.reason };
  }

  return { allowed: true, reason: result.reason };
}

// -- Handler 11: subagent enforcement check (SubagentStop) --------------------

/**
 * SubagentStop hook: validate delegation results for specialist engines.
 * Per D-04 (fatal), D-10 (result parsing), D-11 (stage authority).
 *
 * Handles: validate, citations, api-refs, locals, researcher, planner engines.
 * Each engine is checked for delegation result structure and stage authority.
 *
 * @param {object} input - Parsed stdin JSON with last_assistant_message, agent_type
 * @returns {{ additionalContext: string }}
 */
function handleSubagentEnforcementCheck(input) {
  const agentType = input.agent_type || '';
  const lastMessage = input.last_assistant_message || input.transcript || '';
  const violations = [];

  // Determine expected phase from agent type (D-11)
  const expectedPhase = enforcement.STAGE_AUTHORITY_MAP[agentType];

  // Research and Plan phases have different result formats
  if (agentType === 'researcher') {
    // Researcher should produce ## Research Result
    if (!/## Research Result/.test(lastMessage)) {
      violations.push({
        check: 'research_result_structure',
        expected: '## Research Result section in output',
        found: 'no Research Result section detected',
      });
    }
    if (!/Research complete/.test(lastMessage)) {
      violations.push({
        check: 'research_completion',
        expected: 'Research complete. marker',
        found: 'no research completion marker',
      });
    }
  } else if (agentType === 'planner') {
    // Planner should produce ## Plan Result
    if (!/## Plan Result/.test(lastMessage)) {
      violations.push({
        check: 'plan_result_structure',
        expected: '## Plan Result section in output',
        found: 'no Plan Result section detected',
      });
    }
    if (!/Planning complete/.test(lastMessage)) {
      violations.push({
        check: 'plan_completion',
        expected: 'Planning complete. marker',
        found: 'no planning completion marker',
      });
    }
  } else if (agentType === 'validate') {
    // Validate should produce ## Pipeline Validation Report
    if (!/## Pipeline Validation Report/.test(lastMessage)) {
      violations.push({
        check: 'validation_result_structure',
        expected: '## Pipeline Validation Report section',
        found: 'no Pipeline Validation Report section detected',
      });
    }
  } else if (agentType === 'verbosity-enforcer') {
    // Verbosity enforcer produces ## Verbosity Enforcement Result
    if (!/## Verbosity Enforcement Result/.test(lastMessage)) {
      violations.push({
        check: 'verbosity_enforcement_result_structure',
        expected: '## Verbosity Enforcement Result section in output',
        found: 'no Verbosity Enforcement Result section detected',
      });
    }
    if (!/Verbosity enforcement complete/.test(lastMessage)) {
      violations.push({
        check: 'verbosity_enforcement_completion',
        expected: 'Verbosity enforcement complete. marker',
        found: 'no verbosity enforcement completion marker',
      });
    }
  } else if (expectedPhase === 'write') {
    // Write-phase engines (modify handled separately) produce Delegation Result
    const parsed = enforcement.parseDelegationResult(lastMessage);
    violations.push(...parsed.violations);
  }

  if (violations.length > 0) {
    return {
      additionalContext: 'ENFORCEMENT VIOLATION: ' + violations.length + ' fatal violation(s) detected in ' + agentType + ' engine output.\n' +
        violations.map(v => '- [' + v.check + '] Expected: ' + v.expected + '. Found: ' + v.found + '.').join('\n') +
        '\nOrchestrator: HALT this operation. Review diagnostics for ' + agentType + ' engine.',
    };
  }

  return {
    additionalContext: 'SubagentStop check for ' + agentType + ' engine: all enforcement checks passed.',
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
        error('Usage: fp-tools hooks run session-start <inject-manifest|branch-sync|drift-nudge|update-check>');
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
      } else if (matcher === 'update-check') {
        const result = handleUpdateCheck(input);
        output(result, raw, result.additionalContext);
      } else {
        error(`Unknown session-start matcher: ${matcher}. Use: inject-manifest, branch-sync, drift-nudge, update-check`);
      }
      break;
    }

    case 'pre-tool-use': {
      if (!matcher) {
        error('Usage: fp-tools hooks run pre-tool-use <bash>');
      }
      if (matcher === 'bash') {
        const result = handlePreToolUseBashGitCheck(input);
        if (!result.allowed) {
          process.stderr.write(result.reason + '\n');
          process.exit(2); // EXIT 2 = BLOCK for PreToolUse
        }
        process.exit(0); // EXIT 0 = ALLOW
      } else {
        error('Unknown pre-tool-use matcher: ' + matcher + '. Use: bash');
      }
      break;
    }

    case 'subagent-stop': {
      if (!matcher) {
        error('Usage: fp-tools hooks run subagent-stop <modify|orchestrate|locals|validate|citations|api-refs|researcher|planner|verbosity-enforcer>');
      }
      if (matcher === 'modify') {
        const result = handlePostModifyCheck(input);
        output(result, raw, result.additionalContext);
      } else if (matcher === 'orchestrate') {
        const result = handlePostOrchestrateCheck(input);
        output(result, raw, result.additionalContext);
      } else if (matcher === 'locals') {
        const result = handleLocalsCLICleanup(input);
        output(result, raw, result.additionalContext);
      } else if (matcher === 'validate' || matcher === 'citations' || matcher === 'api-refs' || matcher === 'researcher' || matcher === 'planner' || matcher === 'verbosity-enforcer') {
        const result = handleSubagentEnforcementCheck({ ...input, agent_type: matcher });
        output(result, raw, result.additionalContext);
      } else {
        error(`Unknown subagent-stop matcher: ${matcher}. Use: modify, orchestrate, locals, validate, citations, api-refs, researcher, planner, verbosity-enforcer`);
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
      error(`Unknown hook event: ${event}. Use: session-start, pre-tool-use, subagent-stop, teammate-idle, task-completed`);
  }
}

module.exports = {
  handleInjectManifest,
  handleBranchSyncCheck,
  handleDriftNudge,
  handleUpdateCheck,
  handlePostModifyCheck,
  handlePostOrchestrateCheck,
  handleLocalsCLICleanup,
  handlePreToolUseBashGitCheck,
  handleSubagentEnforcementCheck,
  handleTeammateIdleCheck,
  handleTaskCompletedCheck,
  checkTranscriptMarkers,
  cmdHooks,
};
