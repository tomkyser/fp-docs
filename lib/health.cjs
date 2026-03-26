'use strict';

/**
 * Health -- System health checks and diagnostics for fp-docs.
 *
 * Per D-05, the health command provides a quick overview of system state
 * by probing 6 areas: plugin root, config, codebase root, docs root,
 * routing table, and agent files.
 *
 * Each probe returns { name, status, detail } where status is one of:
 * pass, warn, fail, skip.
 *
 * Overall status: 'healthy' if no fails, 'degraded' if any fail.
 *
 * Zero external dependencies -- Node.js built-ins only (D-15).
 */

const fs = require('fs');
const path = require('path');
const { output, error, safeReadFile, safeJsonParse } = require('./core.cjs');
const paths = require('./paths.cjs');
const { getRoutingTable } = require('./routing.cjs');

// ── Health Checks ────────────────────────────────────────────────────────────

/**
 * Run all health check probes.
 *
 * @param {string} [pluginRoot] - Plugin root path. If not provided, uses paths.getPluginRoot().
 * @returns {{ checks: Array<{name: string, status: string, detail: string}>, overall: string }}
 */
function runHealthChecks(pluginRoot) {
  if (!pluginRoot) {
    pluginRoot = paths.getPluginRoot();
  }

  const checks = [];

  // 1. Plugin root: check plugin.json exists
  const pluginJsonPath = path.join(pluginRoot, '.claude-plugin', 'plugin.json');
  if (fs.existsSync(pluginJsonPath)) {
    checks.push({ name: 'plugin-root', status: 'pass', detail: `Plugin manifest found at ${pluginJsonPath}` });
  } else {
    checks.push({ name: 'plugin-root', status: 'fail', detail: `Plugin manifest not found at ${pluginJsonPath}` });
  }

  // 2. Config: check config.json exists and is valid JSON
  const configPath = path.join(pluginRoot, 'config.json');
  if (fs.existsSync(configPath)) {
    const raw = safeReadFile(configPath);
    const parsed = raw ? safeJsonParse(raw) : { ok: false, error: 'Empty file' };
    if (parsed.ok) {
      checks.push({ name: 'config', status: 'pass', detail: `Config loaded from ${configPath}` });
    } else {
      checks.push({ name: 'config', status: 'fail', detail: `Config parse error: ${parsed.error}` });
    }
  } else {
    checks.push({ name: 'config', status: 'fail', detail: `Config file not found at ${configPath}` });
  }

  // 3. Codebase root: detect via git
  const codebaseRoot = paths.getCodebaseRoot();
  if (codebaseRoot) {
    checks.push({ name: 'codebase-root', status: 'pass', detail: `Codebase root at ${codebaseRoot}` });
  } else {
    checks.push({ name: 'codebase-root', status: 'warn', detail: 'Not in a git repository -- codebase root unavailable' });
  }

  // 4. Docs root: check if docs repo exists with .git
  if (codebaseRoot) {
    const docsInfo = paths.getDocsRoot(codebaseRoot);
    if (docsInfo.hasGit) {
      checks.push({ name: 'docs-root', status: 'pass', detail: `Docs repo at ${docsInfo.path}` });
    } else if (docsInfo.exists) {
      checks.push({ name: 'docs-root', status: 'warn', detail: `Docs directory exists but no .git at ${docsInfo.path}` });
    } else {
      checks.push({ name: 'docs-root', status: 'warn', detail: `Docs directory not found at ${docsInfo.path}` });
    }
  } else {
    checks.push({ name: 'docs-root', status: 'skip', detail: 'Skipped -- codebase root not available' });
  }

  // 5. Routing table: verify all 19 entries exist
  const table = getRoutingTable();
  const entryCount = Object.keys(table).length;
  if (entryCount === 19) {
    checks.push({ name: 'routing-table', status: 'pass', detail: `All ${entryCount} routing entries present` });
  } else {
    checks.push({ name: 'routing-table', status: 'fail', detail: `Expected 19 routing entries, found ${entryCount}` });
  }

  // 6. Agents: verify all unique engine agent files exist
  const engines = new Set(Object.values(table).map(r => r.engine));
  const missingAgents = [];
  for (const engine of engines) {
    const agentPath = path.join(pluginRoot, 'agents', engine + '.md');
    if (!fs.existsSync(agentPath)) {
      missingAgents.push(engine);
    }
  }
  if (missingAgents.length === 0) {
    checks.push({ name: 'agents', status: 'pass', detail: `All ${engines.size} engine agent files present` });
  } else {
    checks.push({ name: 'agents', status: 'fail', detail: `Missing agent files: ${missingAgents.join(', ')}` });
  }

  // Overall status
  const hasFail = checks.some(c => c.status === 'fail');
  const overall = hasFail ? 'degraded' : 'healthy';

  return { checks, overall };
}

// ── CLI Handler ─────────────────────────────────────────────────────────────

/**
 * CLI handler for `fp-tools health <subcommand>`.
 *
 * Subcommands:
 *   check    - Run health checks and output results
 *   diagnose - Verbose version with more detail per check
 *
 * @param {string} subcommand - The health subcommand
 * @param {string[]} args - Additional arguments
 * @param {boolean} raw - Whether to use raw output mode
 */
function cmdHealth(subcommand, args, raw) {
  if (!subcommand) {
    error('Usage: fp-tools health <check|diagnose> [args]');
  }

  switch (subcommand) {
    case 'check': {
      const result = runHealthChecks();
      output(result, raw, result.overall);
      break;
    }

    case 'diagnose': {
      const pluginRoot = paths.getPluginRoot();
      const result = runHealthChecks(pluginRoot);

      // Add extra diagnostic info
      const diagnostics = {
        ...result,
        pluginRoot,
        codebaseRoot: paths.getCodebaseRoot(),
        docsRoot: paths.getDocsRoot(paths.getCodebaseRoot()),
        nodeVersion: process.version,
        platform: process.platform,
      };

      output(diagnostics, raw, JSON.stringify(diagnostics, null, 2));
      break;
    }

    default:
      error(`Unknown health subcommand: ${subcommand}. Use: check, diagnose`);
  }
}

module.exports = { runHealthChecks, cmdHealth };
