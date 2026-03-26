'use strict';

// Golden file test execution for hook handlers.
// Auto-discovers fixture directories under tests/fixtures/hooks/,
// runs each hook handler with controlled inputs, and asserts output
// matches expected fixtures.
//
// Post-migration: bash scripts have been replaced by CJS handlers in
// lib/hooks.cjs. When bash scripts exist, they are used (backward compat).
// When they don't, CJS handlers are invoked directly. This preserves
// characterization test value through the migration.
//
// Fixture convention:
//   input.json       - stdin data to pipe to the script (empty {} if script ignores stdin)
//   env.json         - environment variable overrides (optional)
//   expected.json    - expected stdout JSON output (for scripts that produce JSON stdout)
//   expected-exit.json - expected exit code and optional stderr assertions
//
// Environment placeholder:
//   __PLUGIN_ROOT__ in env.json values is replaced with the resolved
//   path to plugins/fp-docs/ at runtime.

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { execSync } = require('node:child_process');
const { readFileSync, readdirSync, existsSync, statSync } = require('node:fs');
const path = require('node:path');
const { assertStructuralMatch, formatDiff } = require('./json-diff.cjs');

// Pre-flight: verify jq is available (required for Category B bash scripts).
// Only needed when bash scripts exist; skip check gracefully if missing.
let jqAvailable = false;
try {
  execSync('which jq', { encoding: 'utf-8', stdio: 'pipe' });
  jqAvailable = true;
} catch {
  // jq not available -- CJS fallback will be used
}

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');
const SCRIPTS_DIR = path.resolve(__dirname, '..', '..', 'plugins', 'fp-docs', 'scripts');
const PLUGIN_ROOT = path.resolve(__dirname, '..', '..', 'plugins', 'fp-docs');

// -- CJS handler fallback -----------------------------------------------------

// Lazy-load hooks module to avoid circular dependency issues at parse time
let _hooks = null;
function getHooksModule() {
  if (!_hooks) {
    _hooks = require('../../plugins/fp-docs/lib/hooks.cjs');
  }
  return _hooks;
}

// Map fixture directory names to CJS handler function names
const CJS_HANDLER_MAP = {
  'inject-manifest': 'handleInjectManifest',
  'branch-sync-check': 'handleBranchSyncCheck',
  'post-modify-check': 'handlePostModifyCheck',
  'post-orchestrate-check': 'handlePostOrchestrateCheck',
  'locals-cli-cleanup-check': 'handleLocalsCLICleanup',
  'teammate-idle-check': 'handleTeammateIdleCheck',
  'task-completed-check': 'handleTaskCompletedCheck',
};

// Category A handlers return { additionalContext, stopMessage? } -- JSON stdout, exit 0
const CATEGORY_A = new Set(['inject-manifest', 'branch-sync-check', 'locals-cli-cleanup-check']);

/**
 * Invoke CJS handler as fallback when bash scripts don't exist.
 * Returns output in the same { stdout, stderr, exitCode } format as runScript.
 *
 * @param {string} hookDir - Fixture directory name (e.g., 'inject-manifest')
 * @param {{ input: string, envOverrides: object }} fixture - Loaded fixture data
 * @returns {{ stdout: string, stderr: string, exitCode: number }}
 */
function runCjsFallback(hookDir, fixture) {
  const hooks = getHooksModule();
  const handlerName = CJS_HANDLER_MAP[hookDir];
  if (!handlerName || !hooks[handlerName]) {
    throw new Error(`No CJS handler mapped for fixture dir: ${hookDir}`);
  }
  const handler = hooks[handlerName];

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
 * Load fixture files from a scenario directory.
 * @param {string} dir - Absolute path to scenario directory
 * @returns {{ input: string, envOverrides: object, expected: object|null, expectedExit: object|null }}
 */
function loadFixture(dir) {
  const inputPath = path.join(dir, 'input.json');
  const input = existsSync(inputPath)
    ? readFileSync(inputPath, 'utf-8')
    : '';

  const envPath = path.join(dir, 'env.json');
  let envOverrides = {};
  if (existsSync(envPath)) {
    envOverrides = JSON.parse(readFileSync(envPath, 'utf-8'));
    // Replace __PLUGIN_ROOT__ placeholder with actual resolved path
    for (const [key, val] of Object.entries(envOverrides)) {
      if (typeof val === 'string' && val.includes('__PLUGIN_ROOT__')) {
        envOverrides[key] = val.replace('__PLUGIN_ROOT__', PLUGIN_ROOT);
      }
    }
  }

  const expectedPath = path.join(dir, 'expected.json');
  const expected = existsSync(expectedPath)
    ? JSON.parse(readFileSync(expectedPath, 'utf-8'))
    : null;

  const expectedExitPath = path.join(dir, 'expected-exit.json');
  const expectedExit = existsSync(expectedExitPath)
    ? JSON.parse(readFileSync(expectedExitPath, 'utf-8'))
    : null;

  return { input, envOverrides, expected, expectedExit };
}

/**
 * Execute a hook script with controlled input and environment.
 * @param {string} scriptName - Script filename (e.g., 'inject-manifest.sh')
 * @param {string} input - stdin data
 * @param {object} envOverrides - Additional environment variables
 * @returns {{ stdout: string, stderr: string, exitCode: number }}
 */
function runScript(scriptName, input, envOverrides) {
  const scriptPath = path.join(SCRIPTS_DIR, scriptName);
  const env = { ...process.env, ...envOverrides };

  try {
    const stdout = execSync(`bash "${scriptPath}"`, {
      input,
      encoding: 'utf-8',
      env,
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err) {
    return {
      stdout: err.stdout || '',
      stderr: err.stderr || '',
      exitCode: err.status,
    };
  }
}

/**
 * Map a fixture directory name to the corresponding script filename.
 * @param {string} dirName - Fixture directory name (e.g., 'inject-manifest')
 * @returns {string} Script filename (e.g., 'inject-manifest.sh')
 */
function scriptNameFromDir(dirName) {
  return `${dirName}.sh`;
}

/**
 * Sanitize JSON output from bash heredocs that embed raw newlines
 * inside string values. Replaces literal newlines between matching
 * quotes with escaped \n sequences.
 *
 * @param {string} raw - Raw stdout that may contain malformed JSON
 * @returns {string} Sanitized JSON string
 */
function sanitizeHeredocJson(raw) {
  // Strategy: find the opening { and closing }, extract each "key": "value" pair.
  // Replace unescaped newlines within string values with \\n.
  const trimmed = raw.trim();

  // Simple approach: replace all literal newlines that appear between
  // a non-backslash character and continue the string, with \\n.
  // We process char by char to handle string boundaries properly.
  let result = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];

    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      result += ch;
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }

    if (inString && ch === '\n') {
      result += '\\n';
      continue;
    }

    if (inString && ch === '\r') {
      continue; // Strip carriage returns inside strings
    }

    result += ch;
  }

  return result;
}

/**
 * Determine if a directory contains fixture files directly (flat scenario)
 * or has subdirectories (multi-scenario).
 * @param {string} dir - Path to hook fixture directory
 * @returns {string[]} Array of scenario directory paths
 */
function discoverScenarios(dir) {
  const entries = readdirSync(dir);
  // Check if this directory has fixture files directly (flat scenario)
  const hasFixtureFiles = entries.some(e =>
    e === 'input.json' || e === 'expected.json' || e === 'expected-exit.json'
  );

  if (hasFixtureFiles) {
    // Flat scenario -- the directory itself is the only scenario
    return [{ name: path.basename(dir), path: dir }];
  }

  // Multi-scenario -- subdirectories are scenarios
  return entries
    .filter(e => {
      const fullPath = path.join(dir, e);
      return statSync(fullPath).isDirectory() && !e.startsWith('.');
    })
    .map(e => ({ name: e, path: path.join(dir, e) }));
}

// Auto-discover and register tests
const hooksDir = path.join(FIXTURES_DIR, 'hooks');

if (existsSync(hooksDir)) {
  const hookDirs = readdirSync(hooksDir).filter(d => {
    const fullPath = path.join(hooksDir, d);
    return statSync(fullPath).isDirectory() && !d.startsWith('.');
  });

  for (const hookDir of hookDirs) {
    const scriptName = scriptNameFromDir(hookDir);
    const scriptPath = path.join(SCRIPTS_DIR, scriptName);
    const hasBash = existsSync(scriptPath);
    const hasCjs = Boolean(CJS_HANDLER_MAP[hookDir]);
    const backend = hasBash ? 'bash' : (hasCjs ? 'CJS' : null);

    describe(`Hook: ${scriptName}`, () => {
      // Skip if neither bash script nor CJS handler exists
      if (!backend) {
        it.skip(`no handler found (bash or CJS): ${hookDir}`, () => {});
        return;
      }

      // If bash required but jq not available, skip bash-specific tests
      if (hasBash && !jqAvailable) {
        it.skip(`jq required for bash tests but not available`, () => {});
        return;
      }

      const scenarios = discoverScenarios(path.join(hooksDir, hookDir));

      for (const scenario of scenarios) {
        it(`scenario: ${scenario.name} [${backend}]`, () => {
          const fixture = loadFixture(scenario.path);

          // Run through bash script or CJS handler
          const result = hasBash
            ? runScript(scriptName, fixture.input, fixture.envOverrides)
            : runCjsFallback(hookDir, fixture);

          // Check exit code if expected-exit.json exists
          if (fixture.expectedExit) {
            assert.strictEqual(
              result.exitCode,
              fixture.expectedExit.exitCode,
              `Exit code mismatch: expected ${fixture.expectedExit.exitCode}, got ${result.exitCode}.\n` +
              `stdout: ${result.stdout}\nstderr: ${result.stderr}`
            );

            // Check stderr contains expected substrings (case-insensitive)
            if (fixture.expectedExit.stderrContains) {
              const stderrLower = result.stderr.toLowerCase();
              for (const substr of fixture.expectedExit.stderrContains) {
                assert.ok(
                  stderrLower.includes(substr.toLowerCase()),
                  `stderr should contain "${substr}" (case-insensitive).\n` +
                  `Actual stderr: ${result.stderr}`
                );
              }
            }
          }

          // Check stdout JSON if expected.json exists
          if (fixture.expected) {
            let actual;
            try {
              actual = JSON.parse(result.stdout);
            } catch (_firstErr) {
              // Bash heredocs may embed raw newlines inside JSON string values.
              // Sanitize by replacing literal newlines within string values
              // with the escaped \n sequence.
              try {
                const sanitized = sanitizeHeredocJson(result.stdout);
                actual = JSON.parse(sanitized);
              } catch (e) {
                assert.fail(
                  `Failed to parse stdout as JSON (even after sanitization).\n` +
                  `stdout: ${result.stdout.slice(0, 500)}\nstderr: ${result.stderr}\n` +
                  `Parse error: ${e.message}`
                );
              }
            }

            try {
              assertStructuralMatch(actual, fixture.expected);
            } catch (e) {
              const diff = formatDiff(actual, fixture.expected);
              e.message = `${e.message}\n\nDiff: ${diff}`;
              throw e;
            }
          }

          // If neither expected.json nor expected-exit.json, just verify the handler ran
          if (!fixture.expected && !fixture.expectedExit) {
            assert.ok(
              result.exitCode === 0,
              `Handler exited with code ${result.exitCode} but no assertions defined.\n` +
              `stdout: ${result.stdout}\nstderr: ${result.stderr}`
            );
          }
        });
      }
    });
  }
}

module.exports = { runScript, runCjsFallback, sanitizeHeredocJson, scriptNameFromDir, loadFixture, discoverScenarios, PLUGIN_ROOT, FIXTURES_DIR, SCRIPTS_DIR };
