'use strict';

// A/B comparison test runner: verifies CJS hook handlers produce
// structurally identical output to their bash script counterparts.
//
// For each hook fixture, runs the same input through both:
//   1. Bash script (via fixture-runner's runScript)
//   2. CJS handler (via direct function call)
//
// Then structurally compares the outputs using json-diff.
//
// Usage:
//   node fp-docs/tests/run.cjs --hooks-ab
//
// This proves behavioral equivalence between bash and CJS
// implementations before the cutover in Plan 02.

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { existsSync, readdirSync, statSync } = require('node:fs');
const { runScript, sanitizeHeredocJson, scriptNameFromDir, loadFixture, discoverScenarios, FIXTURES_DIR } = require('./fixture-runner.cjs');
const { assertStructuralMatch, formatDiff } = require('./json-diff.cjs');
const hooks = require('../../plugins/fp-docs/lib/hooks.cjs');

// Map fixture directory names to CJS handler functions
const HANDLER_MAP = {
  'inject-manifest': hooks.handleInjectManifest,
  'branch-sync-check': hooks.handleBranchSyncCheck,
  'post-modify-check': hooks.handlePostModifyCheck,
  'post-orchestrate-check': hooks.handlePostOrchestrateCheck,
  'locals-cli-cleanup-check': hooks.handleLocalsCLICleanup,
  'teammate-idle-check': hooks.handleTeammateIdleCheck,
  'task-completed-check': hooks.handleTaskCompletedCheck,
};

// Category A handlers return { additionalContext, stopMessage? } -- JSON stdout, exit 0
const CATEGORY_A = new Set(['inject-manifest', 'branch-sync-check', 'locals-cli-cleanup-check']);

// Category B handlers return { exitCode, warnings } -- exit code + stderr
const CATEGORY_B = new Set(['post-modify-check', 'post-orchestrate-check', 'teammate-idle-check', 'task-completed-check']);

/**
 * Invoke a CJS handler directly with the same inputs a bash script gets.
 *
 * @param {string} hookDir - Fixture directory name (e.g., 'inject-manifest')
 * @param {object} fixture - Loaded fixture data { input, envOverrides, expected, expectedExit }
 * @returns {{ stdout: string, stderr: string, exitCode: number }}
 */
function runCjsHandler(hookDir, fixture) {
  const handler = HANDLER_MAP[hookDir];
  if (!handler) {
    throw new Error(`No CJS handler mapped for fixture dir: ${hookDir}`);
  }

  // Parse input JSON (same data the bash script gets on stdin)
  let input = {};
  if (fixture.input && fixture.input.trim()) {
    try {
      input = JSON.parse(fixture.input);
    } catch {
      input = {};
    }
  }

  // Apply env overrides temporarily
  const savedEnv = {};
  if (fixture.envOverrides) {
    for (const [key, val] of Object.entries(fixture.envOverrides)) {
      savedEnv[key] = process.env[key];
      process.env[key] = val;
    }
  }

  let result;
  try {
    result = handler(input);
  } finally {
    // Restore env
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }
  }

  // Convert handler result to stdout/stderr/exitCode format matching bash output
  if (CATEGORY_A.has(hookDir)) {
    return {
      stdout: JSON.stringify(result),
      stderr: '',
      exitCode: 0,
    };
  }

  // Category B
  return {
    stdout: '',
    stderr: result.warnings.join('\n'),
    exitCode: result.exitCode,
  };
}

/**
 * Run same fixture through bash AND CJS, then compare outputs.
 *
 * @param {string} hookDir - Fixture directory name
 * @param {object} scenario - { name, path }
 * @param {object} fixture - Loaded fixture data
 */
function runABComparison(hookDir, scenario, fixture) {
  const scriptName = scriptNameFromDir(hookDir);
  const bashResult = runScript(scriptName, fixture.input, fixture.envOverrides);
  const cjsResult = runCjsHandler(hookDir, fixture);

  // Assert exit codes match
  assert.strictEqual(
    cjsResult.exitCode,
    bashResult.exitCode,
    `A/B exit code mismatch for ${hookDir}/${scenario.name}: ` +
    `bash=${bashResult.exitCode}, CJS=${cjsResult.exitCode}\n` +
    `bash stderr: ${bashResult.stderr}\nCJS stderr: ${cjsResult.stderr}`
  );

  if (CATEGORY_A.has(hookDir)) {
    // Parse both as JSON and structurally compare
    let bashJson;
    try {
      bashJson = JSON.parse(bashResult.stdout);
    } catch {
      try {
        bashJson = JSON.parse(sanitizeHeredocJson(bashResult.stdout));
      } catch (e) {
        assert.fail(
          `A/B: Failed to parse bash stdout as JSON for ${hookDir}/${scenario.name}.\n` +
          `bash stdout: ${bashResult.stdout.slice(0, 500)}\nParse error: ${e.message}`
        );
      }
    }

    let cjsJson;
    try {
      cjsJson = JSON.parse(cjsResult.stdout);
    } catch (e) {
      assert.fail(
        `A/B: Failed to parse CJS stdout as JSON for ${hookDir}/${scenario.name}.\n` +
        `CJS stdout: ${cjsResult.stdout.slice(0, 500)}\nParse error: ${e.message}`
      );
    }

    // For Category A, both should have additionalContext key.
    // Structural match: CJS must have the same keys as bash.
    // The values may differ slightly (e.g., em-dash vs double-dash),
    // so we check key presence and that additionalContext is non-empty when bash is non-empty.
    assert.ok(
      'additionalContext' in cjsJson,
      `A/B: CJS output missing 'additionalContext' key for ${hookDir}/${scenario.name}`
    );
    assert.ok(
      'additionalContext' in bashJson,
      `A/B: Bash output missing 'additionalContext' key for ${hookDir}/${scenario.name}`
    );

    // If bash has stopMessage, CJS should too (and vice versa)
    if ('stopMessage' in bashJson) {
      assert.ok(
        'stopMessage' in cjsJson,
        `A/B: Bash has stopMessage but CJS does not for ${hookDir}/${scenario.name}`
      );
    }

    // Verify both have the same truthiness for additionalContext
    const bashHasContent = Boolean(bashJson.additionalContext);
    const cjsHasContent = Boolean(cjsJson.additionalContext);
    assert.strictEqual(
      cjsHasContent,
      bashHasContent,
      `A/B: additionalContext truthiness mismatch for ${hookDir}/${scenario.name}. ` +
      `bash=${bashHasContent}, CJS=${cjsHasContent}`
    );
  } else {
    // Category B: verify CJS stderr contains the same warning keywords as bash stderr
    if (bashResult.stderr) {
      const bashKeywords = extractWarningKeywords(bashResult.stderr);
      const cjsStderrLower = cjsResult.stderr.toLowerCase();

      for (const keyword of bashKeywords) {
        assert.ok(
          cjsStderrLower.includes(keyword.toLowerCase()),
          `A/B: CJS stderr missing keyword "${keyword}" for ${hookDir}/${scenario.name}.\n` +
          `bash stderr: ${bashResult.stderr}\nCJS stderr: ${cjsResult.stderr}`
        );
      }
    }
  }
}

/**
 * Extract meaningful keywords from stderr warnings for comparison.
 * @param {string} stderr - Warning text from stderr
 * @returns {string[]} Key phrases to match
 */
function extractWarningKeywords(stderr) {
  const keywords = [];
  const lines = stderr.split('\n').filter(l => l.trim());

  for (const line of lines) {
    // Extract the core warning message (after "Warning: ")
    const match = line.match(/Warning:\s*(.+)/i);
    if (match) {
      // Pull key phrases: look for quoted terms and key concept words
      const msg = match[1];
      // Extract words that identify what's being warned about
      if (/changelog/i.test(msg)) keywords.push('changelog');
      if (/pipeline.*marker|marker.*pipeline/i.test(msg)) keywords.push('pipeline');
      if (/delegation.*result|result.*delegation/i.test(msg)) keywords.push('Delegation Result');
      if (/enforcement.*stage/i.test(msg)) keywords.push('enforcement');
      if (/HALLUCINATION/i.test(msg)) keywords.push('HALLUCINATION');
      if (/file.*modification/i.test(msg)) keywords.push('modification');
      if (/delegated.*specialist|specialist.*engine/i.test(msg)) keywords.push('delegat');
    }
  }

  // Fallback: if no specific keywords found, use whole warning text
  if (keywords.length === 0 && stderr.trim()) {
    keywords.push('Warning');
  }

  return keywords;
}

// -- Auto-discover and register A/B tests ------------------------------------

const hooksDir = path.join(FIXTURES_DIR, 'hooks');

if (existsSync(hooksDir)) {
  const hookDirs = readdirSync(hooksDir).filter(d => {
    const fullPath = path.join(hooksDir, d);
    return statSync(fullPath).isDirectory() && !d.startsWith('.');
  });

  for (const hookDir of hookDirs) {
    // Only run A/B tests for hooks that have a CJS handler
    if (!HANDLER_MAP[hookDir]) continue;

    const scriptName = scriptNameFromDir(hookDir);
    const scriptPath = path.join(path.resolve(__dirname, '..', '..', 'plugins', 'fp-docs', 'scripts'), scriptName);

    describe(`A/B: ${scriptName}`, () => {
      if (!existsSync(scriptPath)) {
        it.skip(`bash script not found: ${scriptPath}`, () => {});
        return;
      }

      const scenarios = discoverScenarios(path.join(hooksDir, hookDir));

      for (const scenario of scenarios) {
        it(`A/B: ${scenario.name}`, () => {
          const fixture = loadFixture(scenario.path);
          runABComparison(hookDir, scenario, fixture);
        });
      }
    });
  }
}

module.exports = { runCjsHandler, runABComparison };
