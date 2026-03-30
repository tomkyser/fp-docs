'use strict';

/**
 * Locals CLI -- Ephemeral WP-CLI lifecycle management for fp-docs.
 *
 * Originally ported from bash scripts (now the canonical implementation):
 * - locals-cli-setup.sh -> setup(): Install ephemeral wp fp-locals CLI tool
 * - locals-cli-teardown.sh -> teardown(): Remove ephemeral wp fp-locals CLI tool
 *
 * The CLI tool is ephemeral -- it MUST be installed before locals operations
 * and removed immediately after. The SubagentStop hook (handleLocalsCLICleanup)
 * enforces this as a safety net.
 *
 * CLI surface: fp-tools locals-cli <setup|teardown>
 *
 * Zero external dependencies -- Node.js built-ins only.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { output, error, safeReadFile } = require('./core.cjs');
const { getPluginRoot, getCodebaseRoot } = require('./paths.cjs');

// -- Setup -------------------------------------------------------------------

/**
 * Install the ephemeral wp fp-locals CLI tool into the theme.
 * Originally ported from locals-cli-setup.sh.
 *
 * Steps:
 * 1. Copy class-locals-cli.php from plugin into theme's inc/cli/
 * 2. Register the CLI command in functions.php inside the WP_CLI block
 * 3. Verify the command is available via ddev wp fp-locals --help
 *
 * @returns {{ status: string, verified: boolean }}
 * @throws {Error} On pre-flight failure, ddev not running, or verification failure
 */
function setup() {
  // Resolve paths
  const pluginRoot = getPluginRoot();
  const codebaseRoot = getCodebaseRoot();
  if (!codebaseRoot) {
    throw new Error('Could not determine codebase root (not in a git repository).');
  }

  const cliSource = path.join(pluginRoot, 'tools', 'class-locals-cli.php');
  const themeRoot = path.join(codebaseRoot, 'themes', 'foreign-policy-2017');
  const cliTarget = path.join(themeRoot, 'inc', 'cli', 'class-locals-cli.php');
  const functionsFile = path.join(themeRoot, 'functions.php');
  const requireLine = "\trequire_once( FP_PATH . '/inc/cli/class-locals-cli.php' );";

  // Pre-flight checks
  if (!fs.existsSync(cliSource)) {
    throw new Error(`CLI source not found at: ${cliSource}`);
  }
  if (!fs.existsSync(themeRoot)) {
    throw new Error(`Theme root not found at: ${themeRoot}`);
  }
  if (!fs.existsSync(functionsFile)) {
    throw new Error(`functions.php not found at: ${functionsFile}`);
  }

  // Check ddev is running
  try {
    execFileSync('ddev', ['status'], { encoding: 'utf-8', stdio: 'pipe', timeout: 10000 });
  } catch {
    throw new Error('ddev is not running. Start it with \'ddev start\' before running locals CLI operations.');
  }

  // Idempotency: skip if already installed
  if (fs.existsSync(cliTarget)) {
    const funcContent = safeReadFile(functionsFile);
    if (funcContent && funcContent.includes('class-locals-cli.php')) {
      // Already installed -- verify it works
      try {
        execFileSync('ddev', ['wp', 'fp-locals', '--help'], { encoding: 'utf-8', stdio: 'pipe', timeout: 15000 });
        return { status: 'already_installed', verified: true };
      } catch {
        // Fall through to reinstall
      }
    }
  }

  // Step 1: Copy CLI file into theme
  fs.mkdirSync(path.dirname(cliTarget), { recursive: true });
  fs.copyFileSync(cliSource, cliTarget);

  // Step 2: Register in functions.php (if not already present)
  const funcContent = safeReadFile(functionsFile);
  if (funcContent && !funcContent.includes('class-locals-cli.php')) {
    const lines = funcContent.split('\n');

    // Find the WP_CLI block start line
    let wpCliLineIndex = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (/defined.*WP_CLI.*&&.*WP_CLI/.test(lines[i])) {
        wpCliLineIndex = i;
        break;
      }
    }

    if (wpCliLineIndex === -1) {
      // Clean up since we can't register
      try { fs.unlinkSync(cliTarget); } catch { /* ignore */ }
      throw new Error('Could not find WP_CLI block in functions.php');
    }

    // Find the last require_once after the WP_CLI line (within 50 lines)
    let lastRequireIndex = -1;
    const searchEnd = Math.min(wpCliLineIndex + 50, lines.length);
    for (let i = wpCliLineIndex; i < searchEnd; i++) {
      if (/require_once/.test(lines[i])) {
        lastRequireIndex = i;
      }
    }

    if (lastRequireIndex === -1) {
      try { fs.unlinkSync(cliTarget); } catch { /* ignore */ }
      throw new Error('Could not find any require_once inside the WP_CLI block in functions.php');
    }

    // Insert our require_once line after the last existing one
    lines.splice(lastRequireIndex + 1, 0, requireLine);
    fs.writeFileSync(functionsFile, lines.join('\n'), 'utf-8');
  }

  // Step 3: Verify
  try {
    execFileSync('ddev', ['wp', 'fp-locals', '--help'], { encoding: 'utf-8', stdio: 'pipe', timeout: 15000 });
  } catch {
    // Verification failed -- teardown and throw
    try { teardown(); } catch { /* ignore teardown errors */ }
    throw new Error('wp fp-locals command not recognized after setup. Check functions.php registration.');
  }

  return { status: 'installed', verified: true };
}

// -- Teardown ----------------------------------------------------------------

/**
 * Remove the ephemeral wp fp-locals CLI tool from the theme.
 * Originally ported from locals-cli-teardown.sh.
 *
 * Steps:
 * 1. Remove the require_once line from functions.php
 * 2. Delete the copied CLI file from inc/cli/
 * 3. Clean up empty directory
 *
 * @returns {{ status: string }}
 */
function teardown() {
  const codebaseRoot = getCodebaseRoot();
  if (!codebaseRoot) {
    return { status: 'already_clean' };
  }

  const themeRoot = path.join(codebaseRoot, 'themes', 'foreign-policy-2017');
  const cliTarget = path.join(themeRoot, 'inc', 'cli', 'class-locals-cli.php');
  const functionsFile = path.join(themeRoot, 'functions.php');

  let cleaned = false;

  // Step 1: Remove require_once from functions.php
  if (fs.existsSync(functionsFile)) {
    const content = safeReadFile(functionsFile);
    if (content && content.includes('class-locals-cli.php')) {
      const filtered = content.split('\n').filter(line => !line.includes('class-locals-cli.php')).join('\n');
      fs.writeFileSync(functionsFile, filtered, 'utf-8');
      cleaned = true;
    }
  }

  // Step 2: Delete the copied CLI file
  if (fs.existsSync(cliTarget)) {
    fs.unlinkSync(cliTarget);
    cleaned = true;
  }

  // Step 3: Clean up empty directory
  const cliDir = path.join(themeRoot, 'inc', 'cli');
  try {
    fs.rmdirSync(cliDir);
  } catch {
    // Directory not empty or doesn't exist -- that's fine
  }

  return { status: cleaned ? 'cleaned' : 'already_clean' };
}

// -- CLI Handler -------------------------------------------------------------

/**
 * CLI handler for `fp-tools locals-cli <setup|teardown>`.
 *
 * @param {string} subcommand - 'setup' or 'teardown'
 * @param {string[]} args - Additional arguments (unused)
 * @param {boolean} raw - Whether to use raw output mode
 */
function cmdLocalsCli(subcommand, args, raw) {
  switch (subcommand) {
    case 'setup': {
      try {
        const result = setup();
        output(result, raw, JSON.stringify(result, null, 2));
      } catch (err) {
        error(err.message || String(err));
      }
      break;
    }
    case 'teardown': {
      try {
        const result = teardown();
        output(result, raw, JSON.stringify(result, null, 2));
      } catch (err) {
        error(err.message || String(err));
      }
      break;
    }
    default:
      error('Usage: fp-tools locals-cli <setup|teardown>');
  }
}

module.exports = { setup, teardown, cmdLocalsCli };
