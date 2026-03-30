'use strict';

/**
 * Pipeline -- CJS pipeline engine for fp-docs callback loop architecture.
 *
 * Implements the 8-stage post-modification pipeline as a CJS sequencing engine
 * per D-01/D-02. The orchestrate engine calls `fp-tools pipeline next` in a
 * loop; this module answers "what's next?" at every step.
 *
 * Stage classification:
 *   - Stages 1-5 (write/review): LLM-executed via agent spawn
 *   - Stages 6-8 (finalize): Deterministic, executed directly by CJS
 *
 * Pipeline flow: init -> next (loop) -> complete
 *   - init: Resolve stages for operation, create pipeline state
 *   - next: Return spawn/execute/complete/blocked action
 *   - status: Report current pipeline progress
 *   - reset: Clear pipeline state
 *
 * Zero external dependencies -- Node.js built-ins only (D-15).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { output, error } = require('./core.cjs');
const { loadConfig, getConfigValue } = require('./config.cjs');
const { getPipeline, updatePipeline, clearPipeline, logOperation } = require('./state.cjs');
const pathsMod = require('./paths.cjs');
const enforcement = require('./enforcement.cjs');

// ── Algorithm paths for LLM stages ──────────────────────────────────────────

const ALGORITHM_PATHS = {
  1: 'references/verbosity-algorithm.md',
  2: 'references/citation-algorithm.md',
  3: 'references/api-ref-algorithm.md',
  4: 'references/validation-algorithm.md',
  5: 'references/validation-algorithm.md',
};

// ── Module names for LLM stages ─────────────────────────────────────────────

const STAGE_MODULES = {
  1: ['mod-verbosity', 'mod-standards'],
  2: ['mod-citations', 'mod-standards'],
  3: ['mod-api-refs', 'mod-standards'],
  4: ['mod-validation', 'mod-standards'],
  5: ['mod-validation', 'mod-standards'],
};

// ── Internal Functions ───────────────────────────────────────────────────────

/**
 * Get the trigger matrix from config.
 *
 * @returns {object} Operation-to-stages mapping
 */
function getTriggerMatrix() {
  return getConfigValue('pipeline.triggerMatrix') || {};
}

/**
 * Get the 8 stage definitions from config.
 *
 * @returns {Array<object>} Array of stage definition objects
 */
function getStageDefinitions() {
  return getConfigValue('pipeline.stages') || [];
}

/**
 * Get the skip conditions from config.
 *
 * @returns {object} Stage-to-skip-condition mapping
 */
function getSkipConditions() {
  return getConfigValue('pipeline.skipConditions') || {};
}

// ── Exported Functions ───────────────────────────────────────────────────────

/**
 * Evaluate skip conditions for a single stage.
 *
 * Checks config flags, operation flags, structural_only, and never_skip rules
 * to determine if a stage should be skipped.
 *
 * @param {number} stageId - The stage ID (1-8)
 * @param {object} context - Context with flags array and optional structural boolean
 * @param {string[]} context.flags - CLI flags passed to the operation
 * @param {boolean} [context.structural] - Whether structural changes occurred
 * @returns {{ skip: boolean, reason?: string }}
 */
function shouldSkipStage(stageId, context) {
  const skipConditions = getSkipConditions();
  const condition = skipConditions[String(stageId)];

  if (!condition) {
    return { skip: false };
  }

  // Never-skip stages always run
  if (condition.never_skip) {
    return { skip: false };
  }

  // Structural-only stages: skip unless structural changes detected
  if (condition.structural_only) {
    // Check flag override first
    if (condition.flagOverride && context.flags && context.flags.includes(condition.flagOverride)) {
      return { skip: true, reason: 'flag: ' + condition.flagOverride };
    }
    // Skip if no structural changes
    if (!context.structural) {
      return { skip: true, reason: 'no structural changes detected' };
    }
    return { skip: false };
  }

  // Check flag override
  if (condition.flagOverride && context.flags && context.flags.includes(condition.flagOverride)) {
    return { skip: true, reason: 'flag: ' + condition.flagOverride };
  }

  // Check config key
  if (condition.configKey) {
    const value = getConfigValue(condition.configKey);
    if (value === false) {
      return { skip: true, reason: 'config: ' + condition.configKey + ' is disabled' };
    }
  }

  return { skip: false };
}

/**
 * Validate a completed LLM stage's output before allowing pipeline progression.
 * Per D-07 (CJS gating for all 8 stages), D-08 (output validation), D-09 (fatal failure).
 *
 * Only validates stages 1-5 (LLM-executed). Stages 6-8 are CJS-deterministic
 * and validated by their own executors.
 *
 * @param {number} stageId - The stage ID that just completed (1-5)
 * @param {object} pipeline - Current pipeline state
 * @param {string} [stageOutput] - The LLM output text for this stage (from orchestrator recording)
 * @returns {{ valid: boolean, violations: Array<{ check: string, expected: string, found: string }> }}
 */
function validateStageGate(stageId, pipeline, stageOutput) {
  // Stages 6-8: CJS-deterministic, no LLM gate validation needed
  if (stageId >= 6) {
    return { valid: true, violations: [] };
  }

  // Stage must have been marked as completed (PASS or FAIL)
  const statusKey = 'stage_' + stageId + '_status';
  const status = pipeline[statusKey];

  // If stage was skipped or not yet completed, no gate check
  if (!status || status === 'SKIP' || status === 'N/A') {
    return { valid: true, violations: [] };
  }

  // If stage explicitly failed, that is itself a gate failure
  if (status === 'FAIL') {
    return {
      valid: false,
      violations: [{
        check: 'stage_' + stageId + '_status',
        expected: 'PASS or SKIP',
        found: 'FAIL -- stage reported failure',
      }],
    };
  }

  // If stage reported HALLUCINATION, that is a critical gate failure
  if (status === 'HALLUCINATION') {
    return {
      valid: false,
      violations: [{
        check: 'stage_' + stageId + '_hallucination',
        expected: 'no HALLUCINATION status',
        found: 'HALLUCINATION detected in stage ' + stageId,
      }],
    };
  }

  // For PASS status: validate the output content using enforcement module
  const outputText = stageOutput || pipeline['stage_' + stageId + '_output'] || '';
  if (!outputText) {
    // No output recorded -- allow through with a warning but no block
    // (output recording is a new feature; absence is not a violation)
    return { valid: true, violations: [] };
  }

  return enforcement.validateStageOutput(stageId, {
    lastMessage: outputText,
    targetFiles: pipeline.target_files || [],
  });
}

/**
 * Resolve the full stage plan for an operation.
 *
 * Maps each of the 8 stage definitions to an object with applicability info
 * based on the trigger matrix and skip conditions.
 *
 * @param {string} operation - The operation name (e.g., 'revise', 'citations-generate')
 * @param {string[]} flags - CLI flags passed to the operation
 * @param {object} [context] - Optional context with structural boolean
 * @returns {Array<object>} Array of stage objects with id, name, phase, agent, applicable, reason
 */
function resolveStages(operation, flags, context) {
  const triggerMatrix = getTriggerMatrix();
  const stageIds = triggerMatrix[operation];

  if (!stageIds) {
    return [];
  }

  const stageDefinitions = getStageDefinitions();

  return stageDefinitions.map(stageDef => {
    const inMatrix = stageIds.includes(stageDef.id);

    if (!inMatrix) {
      return {
        id: stageDef.id,
        name: stageDef.name,
        phase: stageDef.phase,
        agent: stageDef.agent,
        applicable: false,
        reason: 'not in trigger matrix for ' + operation,
      };
    }

    const skipResult = shouldSkipStage(stageDef.id, {
      flags: flags || [],
      structural: context?.structural,
    });

    if (skipResult.skip) {
      return {
        id: stageDef.id,
        name: stageDef.name,
        phase: stageDef.phase,
        agent: stageDef.agent,
        applicable: false,
        reason: skipResult.reason,
      };
    }

    return {
      id: stageDef.id,
      name: stageDef.name,
      phase: stageDef.phase,
      agent: stageDef.agent,
      applicable: true,
      reason: stageDef.skippable === false ? 'never skippable' : 'config enabled',
    };
  });
}

/**
 * Initialize a new pipeline run.
 *
 * Creates pipeline state with resolved stages and writes to state file.
 *
 * @param {object} opts - Pipeline options
 * @param {string} opts.operation - The operation name
 * @param {string[]} [opts.files] - Target files for the operation
 * @param {string[]} [opts.flags] - CLI flags
 * @param {string} [opts.changelog_summary] - Summary for changelog entry
 * @param {boolean} [opts.structural] - Whether structural changes occurred
 * @param {string} [statePath] - Optional explicit path to state.json
 * @returns {object} The pipeline state object
 */
function initPipeline(opts, statePath) {
  const pipelineId = crypto.randomBytes(4).toString('hex');
  const resolvedStages = resolveStages(
    opts.operation,
    opts.flags || [],
    { structural: opts.structural }
  );

  if (resolvedStages.length === 0) {
    return { error: true, message: 'Unknown operation: ' + opts.operation };
  }

  const pipelineState = {
    pipeline_id: pipelineId,
    operation: opts.operation,
    command: opts.operation,
    started_at: new Date().toISOString(),
    current_stage: null,
    flags: opts.flags || [],
    target_files: opts.files || [],
    files_modified: opts.files || [],
    changelog_summary: opts.changelog_summary || null,
    stages: resolvedStages,
    stage_1_status: null,
    stage_2_status: null,
    stage_3_status: null,
    stage_4_status: null,
    stage_5_status: null,
    stage_6_status: null,
    stage_7_status: null,
    stage_8_status: null,
  };

  updatePipeline(pipelineState, statePath);
  return pipelineState;
}

/**
 * Determine the next pipeline action.
 *
 * Reads current pipeline state and returns what the orchestrator should do next:
 *   - 'spawn': Start an LLM agent for stages 1-5
 *   - 'execute': Run deterministic logic for stages 6-8
 *   - 'complete': All stages done
 *   - 'blocked': HALLUCINATION detected, cannot proceed
 *   - 'error': No active pipeline
 *
 * @param {string} [statePath] - Optional explicit path to state.json
 * @returns {object} Action object with type and stage details
 */
function getNextAction(statePath) {
  const pipeline = getPipeline(statePath);

  if (!pipeline) {
    return { action: 'error', message: 'No active pipeline. Call init first.' };
  }

  const stages = pipeline.stages || [];

  // Check for HALLUCINATION in any completed stage
  for (const stage of stages) {
    if (stage.applicable) {
      const statusKey = `stage_${stage.id}_status`;
      if (pipeline[statusKey] === 'HALLUCINATION') {
        return {
          action: 'blocked',
          stage: { id: stage.id, name: stage.name, phase: stage.phase },
          diagnostic: 'HALLUCINATION detected in stage ' + stage.id + ' (' + stage.name + ')',
        };
      }
    }
  }

  // Gate validation: check the most recently completed LLM stage
  // Per D-07: validate outputs at each stage boundary before allowing progression
  let lastCompletedStage = null;
  for (const stage of stages) {
    if (!stage.applicable) continue;
    const statusKey = `stage_${stage.id}_status`;
    const status = pipeline[statusKey];
    if (status !== null && status !== undefined && stage.id <= 5) {
      lastCompletedStage = stage;
    }
  }

  if (lastCompletedStage) {
    const gateResult = validateStageGate(
      lastCompletedStage.id,
      pipeline,
      pipeline['stage_' + lastCompletedStage.id + '_output']
    );
    if (!gateResult.valid) {
      return {
        action: 'gate_failed',
        stage: { id: lastCompletedStage.id, name: lastCompletedStage.name, phase: lastCompletedStage.phase },
        diagnostic: 'Stage ' + lastCompletedStage.id + ' (' + lastCompletedStage.name + ') gate validation failed',
        violations: gateResult.violations,
      };
    }
  }

  // Find first applicable stage with null status
  let nextStage = null;
  for (const stage of stages) {
    if (!stage.applicable) continue;
    const statusKey = `stage_${stage.id}_status`;
    if (pipeline[statusKey] === null || pipeline[statusKey] === undefined) {
      nextStage = stage;
      break;
    }
  }

  // If no next stage, all applicable stages are done
  if (!nextStage) {
    const stagesRun = stages.filter(s => {
      if (!s.applicable) return false;
      const status = pipeline[`stage_${s.id}_status`];
      return status !== null && status !== undefined;
    }).length;

    const stagesSkipped = stages.filter(s => !s.applicable).length;
    const allPassed = stages.filter(s => s.applicable).every(s => {
      const status = pipeline[`stage_${s.id}_status`];
      return status === 'PASS' || status === 'SKIP' || status === 'N/A';
    });

    // Build completion marker
    const markerParts = stages.map(s => {
      if (!s.applicable) return null;
      const status = pipeline[`stage_${s.id}_status`];
      return `[${s.name}: ${status}]`;
    }).filter(Boolean);

    const completionMarker = 'Pipeline complete: ' + markerParts.join(' ');

    // Log operation to history before clearing pipeline state
    logOperation({
      operation: pipeline.operation,
      engine: 'pipeline',
      command: pipeline.command,
      summary: completionMarker,
      files: pipeline.target_files,
    }, statePath);

    // Clear pipeline state after logging
    clearPipeline(statePath);

    return {
      action: 'complete',
      summary: {
        stages_run: stagesRun,
        stages_skipped: stagesSkipped,
        all_passed: allPassed,
        completion_marker: completionMarker,
      },
    };
  }

  // Update current_stage in pipeline state
  updatePipeline({ current_stage: nextStage.id }, statePath);

  // Determine action type based on phase
  if (nextStage.phase === 'finalize') {
    // Stages 6-8: deterministic execution
    const actionData = {
      action: 'execute',
      stage: { id: nextStage.id, name: nextStage.name, phase: nextStage.phase },
    };

    // Include relevant context for finalize stages
    if (nextStage.id === 6) {
      actionData.changelog_summary = pipeline.changelog_summary;
      actionData.files_modified = pipeline.files_modified;
      actionData.operation = pipeline.operation;
    } else if (nextStage.id === 7) {
      actionData.structural = pipeline.flags ? pipeline.flags.includes('--structural') : false;
    } else if (nextStage.id === 8) {
      actionData.flags = pipeline.flags;
      actionData.changelog_summary = pipeline.changelog_summary;
      actionData.operation = pipeline.operation;
    }

    return actionData;
  }

  // Stages 1-5: LLM spawn
  return {
    action: 'spawn',
    stage: { id: nextStage.id, name: nextStage.name, phase: nextStage.phase },
    agent: nextStage.agent,
    prompt_context: {
      algorithm: ALGORITHM_PATHS[nextStage.id] || null,
      modules: STAGE_MODULES[nextStage.id] || [],
      target_files: pipeline.target_files || [],
    },
    record_via: `fp-tools state pipeline stage_${nextStage.id}_status={PASS|FAIL|SKIP}`,
  };
}

/**
 * Report current pipeline state.
 *
 * @param {string} [statePath] - Optional explicit path to state.json
 * @returns {object|null} Status object or null if no active pipeline
 */
function getStatus(statePath) {
  const pipeline = getPipeline(statePath);

  if (!pipeline) {
    return null;
  }

  const stages = pipeline.stages || [];
  const completed = stages.filter(s => {
    if (!s.applicable) return false;
    const status = pipeline[`stage_${s.id}_status`];
    return status !== null && status !== undefined;
  }).length;

  const skipped = stages.filter(s => !s.applicable).length;
  const total = stages.length;
  const elapsedMs = pipeline.started_at
    ? Date.now() - new Date(pipeline.started_at).getTime()
    : 0;

  return {
    pipeline_id: pipeline.pipeline_id,
    operation: pipeline.operation,
    current_stage: pipeline.current_stage,
    stages_completed: completed,
    stages_total: total,
    stages_skipped: skipped,
    started_at: pipeline.started_at,
    elapsed_ms: elapsedMs,
  };
}

/**
 * Clear pipeline state entirely.
 *
 * @param {string} [statePath] - Optional explicit path to state.json
 */
function resetPipeline(statePath) {
  clearPipeline(statePath);
}

// ── Deterministic Stage Executors (Plan 02) ─────────────────────────────────

/**
 * Build a month header string for the current month.
 *
 * @returns {string} Month header in format '## YYYY-MM'
 */
function buildMonthHeader() {
  const now = new Date();
  return `## ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Capitalize the first letter of a string.
 *
 * @param {string} str - Input string
 * @returns {string} Capitalized string
 */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Execute Stage 6: Changelog update.
 *
 * Produces a correctly formatted changelog entry per mod-changelog format:
 *   ### YYYY-MM-DD -- [Title]
 *   - **Files changed**:
 *     - `path` (action)
 *   - **Summary**: [summary text]
 *
 * @param {object} pipelineState - Pipeline state with operation, files_modified, changelog_summary
 * @param {string} [docsRootPath] - Optional docs root path (resolved via pathsMod.getDocsRoot if not provided)
 * @param {string} [changelogPath] - Optional explicit changelog file path (for testing)
 * @returns {{ status: string, file?: string, entry_added?: boolean, date?: string, files_listed?: number, reason?: string }}
 */
function executeChangelog(pipelineState, docsRootPath, changelogPath) {
  // Resolve changelog path
  let resolvedPath = changelogPath;
  if (!resolvedPath) {
    const docRoot = docsRootPath || (function () {
      const codebaseRoot = pathsMod.getCodebaseRoot();
      const docsInfo = pathsMod.getDocsRoot(codebaseRoot);
      return docsInfo.path;
    })();
    if (!docRoot) {
      return { status: 'skipped', reason: 'docs root not available' };
    }
    resolvedPath = path.join(docRoot, 'changelog.md');
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const title = capitalize(pipelineState.operation);

  // Build file list entries
  const filesModified = pipelineState.files_modified || [];
  const fileEntries = filesModified.map(f => {
    if (typeof f === 'string') {
      return `  - \`${f}\` (modified)`;
    }
    const action = f.action || 'modified';
    return `  - \`${f.path}\` (${action})`;
  });

  // Build summary
  let summary;
  if (pipelineState.changelog_summary) {
    summary = pipelineState.changelog_summary;
  } else {
    const filePaths = filesModified.map(f => typeof f === 'string' ? f : f.path);
    summary = pipelineState.operation + ' -- ' + filePaths.join(', ');
  }

  // Build the entry
  const entry = [
    `### ${dateStr} -- ${title}`,
    '',
    '- **Files changed**:',
    ...fileEntries,
    `- **Summary**: ${summary}`,
    '',
  ].join('\n');

  const monthHeader = buildMonthHeader();

  // Read or create changelog
  let existing = '';
  try {
    existing = fs.readFileSync(resolvedPath, 'utf-8');
  } catch {
    // File doesn't exist -- create with month header + entry
  }

  let updated;
  if (!existing) {
    // No existing file -- create with month header + entry
    updated = `# Changelog\n\n${monthHeader}\n\n${entry}`;
  } else if (existing.includes(monthHeader)) {
    // Month header exists -- insert entry directly below it (after header line + blank line)
    const headerIndex = existing.indexOf(monthHeader);
    const afterHeader = headerIndex + monthHeader.length;
    // Find end of header line (could be followed by \n or \n\n)
    let insertPoint = afterHeader;
    if (existing[insertPoint] === '\n') insertPoint++;
    if (existing[insertPoint] === '\n') insertPoint++;
    updated = existing.slice(0, insertPoint) + entry + existing.slice(insertPoint);
  } else {
    // Month header does not exist -- add new month header + entry
    // Insert after H1 heading if present, otherwise at top
    const h1Match = existing.match(/^# .+\n/);
    if (h1Match) {
      const afterH1 = h1Match.index + h1Match[0].length;
      // Skip any blank lines after H1
      let insertPoint = afterH1;
      while (existing[insertPoint] === '\n') insertPoint++;
      updated = existing.slice(0, insertPoint) + `${monthHeader}\n\n${entry}` + existing.slice(insertPoint);
    } else {
      updated = `${monthHeader}\n\n${entry}${existing}`;
    }
  }

  // Ensure parent directory exists
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(resolvedPath, updated, 'utf-8');

  return {
    status: 'completed',
    file: 'docs/changelog.md',
    entry_added: true,
    date: dateStr,
    files_listed: filesModified.length,
  };
}

/**
 * Evaluate whether Stage 7 (index) should be skipped.
 *
 * Conservative heuristic: only trigger index update when structural changes
 * (file creation or deletion) occurred.
 *
 * @param {object} pipelineState - Pipeline state with files_modified array
 * @returns {{ skip: boolean, reason: string }}
 */
function evaluateIndexSkip(pipelineState) {
  const filesModified = pipelineState.files_modified;

  if (!filesModified || filesModified.length === 0) {
    return { skip: true, reason: 'no files modified' };
  }

  // Check for structural changes (created or removed files)
  for (const f of filesModified) {
    if (typeof f === 'object' && f.action) {
      if (f.action === 'created' || f.action === 'removed') {
        return { skip: false, reason: 'structural change: file ' + f.action };
      }
    }
  }

  return { skip: true, reason: 'no structural changes' };
}

/**
 * Execute Stage 8: Docs commit.
 *
 * Delegates to git.cjs commitDocs with composed message and parsed flags.
 *
 * @param {object} pipelineState - Pipeline state with operation, changelog_summary, flags
 * @param {object} [gitModule] - Optional git module for dependency injection (testing)
 * @returns {{ status: string, pushed?: boolean, branch?: string, reason?: string, error?: string }}
 */
function executeDocsCommit(pipelineState, gitModule) {
  const git = gitModule || require('./git.cjs');

  const codebaseRoot = pathsMod.getCodebaseRoot();
  const docsInfo = pathsMod.getDocsRoot(codebaseRoot);

  if (!docsInfo.path || !docsInfo.hasGit) {
    return { status: 'skipped', reason: 'docs repo not available' };
  }

  const message = 'fp-docs: ' + pipelineState.operation + ' -- ' + (pipelineState.changelog_summary || 'automated update');
  const flags = pipelineState.flags || [];
  const offline = flags.includes('--offline');
  const noPush = flags.includes('--no-push');

  try {
    const result = git.commitDocs(docsInfo.path, message, { offline, noPush });
    if (result.committed === false) {
      return { status: 'skipped', reason: 'no docs changes to commit' };
    }
    return { status: 'committed', pushed: result.pushed || false, branch: result.branch || 'unknown' };
  } catch (err) {
    return { status: 'failed', error: err.message || String(err) };
  }
}

// ── CLI Handler ──────────────────────────────────────────────────────────────

/**
 * CLI handler for `fp-tools pipeline <subcommand>`.
 *
 * Subcommands:
 *   init       - Initialize a new pipeline run
 *   next       - Get the next pipeline action
 *   run-stage  - Execute a deterministic stage (6, 7, 8) directly
 *   status     - Report current pipeline state
 *   reset      - Clear pipeline state
 *
 * @param {string} subcommand - The pipeline subcommand
 * @param {string[]} args - Additional arguments
 * @param {boolean} raw - Whether to use raw output mode
 */
function cmdPipeline(subcommand, args, raw) {
  if (!subcommand) {
    error('Usage: fp-tools pipeline <init|next|run-stage|record-output|status|reset> [args]');
  }

  switch (subcommand) {
    case 'init': {
      const opts = {};
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--operation' && args[i + 1]) { opts.operation = args[++i]; }
        else if (arg === '--files' && args[i + 1]) {
          opts.files = args[++i].split(',').map(f => f.trim());
        }
        else if (arg === '--flags' && args[i + 1]) {
          opts.flags = args[++i].split(',').map(f => f.trim());
        }
        else if (arg === '--changelog-summary' && args[i + 1]) {
          opts.changelog_summary = args[++i];
        }
        else if (arg === '--structural') { opts.structural = true; }
      }
      if (!opts.operation) {
        error('Usage: fp-tools pipeline init --operation <op> [--files <f1,f2>] [--flags <f1,f2>] [--changelog-summary <s>] [--structural]');
      }
      const result = initPipeline(opts);
      if (result.error) {
        error(result.message);
      }
      output(result, raw, JSON.stringify(result, null, 2));
      break;
    }

    case 'next': {
      const result = getNextAction();
      output(result, raw, JSON.stringify(result, null, 2));
      break;
    }

    case 'run-stage': {
      const stageId = parseInt(args[0], 10);
      if (isNaN(stageId)) {
        error('Usage: fp-tools pipeline run-stage <stage-id>');
      }
      // Only deterministic stages (6, 7, 8) can be run directly
      if (stageId < 6 || stageId > 8) {
        error('Only deterministic stages 6-8 can be executed via run-stage. Stages 1-5 are LLM-executed.');
      }
      const pipeline = getPipeline();
      if (!pipeline) {
        error('No active pipeline. Call fp-tools pipeline init first.');
      }
      let result;
      switch (stageId) {
        case 6:
          result = executeChangelog(pipeline);
          break;
        case 7: {
          const skipResult = evaluateIndexSkip(pipeline);
          if (skipResult.skip) {
            result = { status: 'skipped', reason: skipResult.reason };
          } else {
            // Stage 7 execution is LLM when triggered -- return spawn instruction
            result = { status: 'needs_spawn', reason: 'Index regeneration requires LLM', agent: 'orchestrator' };
          }
          break;
        }
        case 8:
          result = executeDocsCommit(pipeline);
          break;
      }
      // Record result in pipeline state
      const stageStatus = result.status === 'completed' || result.status === 'committed' ? 'PASS' : result.status === 'skipped' ? 'SKIP' : 'FAIL';
      updatePipeline({ ['stage_' + stageId + '_status']: stageStatus });
      output(result, raw, JSON.stringify(result, null, 2));
      break;
    }

    case 'record-output': {
      const stageId = parseInt(args[0], 10);
      if (isNaN(stageId) || stageId < 1 || stageId > 5) {
        error('Usage: fp-tools pipeline record-output <stage-id> (1-5). Reads output from remaining args.');
      }
      // Read stage output from remaining args
      let stageOutput = args.slice(1).join(' ');
      if (!stageOutput) {
        try {
          stageOutput = require('fs').readFileSync(0, 'utf-8');
        } catch {
          stageOutput = '';
        }
      }
      updatePipeline({ ['stage_' + stageId + '_output']: stageOutput });
      output({ recorded: true, stage: stageId }, raw, 'Stage ' + stageId + ' output recorded');
      break;
    }

    case 'status': {
      const result = getStatus();
      output(result, raw, JSON.stringify(result, null, 2));
      break;
    }

    case 'reset': {
      resetPipeline();
      output({ reset: true }, raw, JSON.stringify({ reset: true }));
      break;
    }

    default:
      error('Unknown pipeline subcommand: ' + subcommand + '. Use: init, next, run-stage, record-output, status, reset');
  }
}

module.exports = {
  cmdPipeline,
  initPipeline,
  getNextAction,
  getStatus,
  resetPipeline,
  shouldSkipStage,
  resolveStages,
  executeChangelog,
  evaluateIndexSkip,
  executeDocsCommit,
  validateStageGate,
};
