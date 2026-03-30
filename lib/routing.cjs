'use strict';

/**
 * Routing -- Command-to-engine routing table and lookup for fp-docs.
 *
 * Per D-06, the CLI owns the routing table as the single source of truth
 * for command-to-engine mappings. This replaces the implicit routing that
 * was previously embedded in each skill file's frontmatter.
 *
 * The routing table has exactly 23 entries matching the full command set.
 * Each entry maps a command name (without /fp-docs: prefix) to its agent,
 * workflow, operation, and type (write/read/admin/batch/meta).
 *
 * Zero external dependencies -- Node.js built-ins only (D-15).
 */

const fs = require('fs');
const path = require('path');
const { output, error } = require('./core.cjs');
const { getPluginRoot } = require('./paths.cjs');

// ── Routing Table ────────────────────────────────────────────────────────────

/**
 * The canonical routing table -- exactly 23 entries matching the full command set.
 * Keyed by command name (without /fp-docs: prefix).
 *
 * Each entry has:
 *   agent    - Primary agent name (fp-docs-* prefix)
 *   workflow - Workflow file name (in workflows/)
 *   operation - Operation name within the agent (null for multi-subcommand)
 *   type     - Command type (write/read/admin/batch/meta)
 *
 * Legacy `engine` field preserved for backward compatibility.
 */
const ROUTING_TABLE = {
  'revise':          { agent: 'fp-docs-modifier',   engine: 'modify',      workflow: 'revise.md',          operation: 'revise',              type: 'write' },
  'add':             { agent: 'fp-docs-modifier',   engine: 'modify',      workflow: 'add.md',             operation: 'add',                 type: 'write' },
  'auto-update':     { agent: 'fp-docs-modifier',   engine: 'modify',      workflow: 'auto-update.md',     operation: 'auto-update',         type: 'write' },
  'auto-revise':     { agent: 'fp-docs-modifier',   engine: 'modify',      workflow: 'auto-revise.md',     operation: 'auto-revise',         type: 'write' },
  'deprecate':       { agent: 'fp-docs-modifier',   engine: 'modify',      workflow: 'deprecate.md',       operation: 'deprecate',           type: 'write' },
  'audit':           { agent: 'fp-docs-validator',  engine: 'validate',    workflow: 'audit.md',           operation: 'audit',               type: 'read' },
  'verify':          { agent: 'fp-docs-validator',  engine: 'validate',    workflow: 'verify.md',          operation: 'verify',              type: 'read' },
  'sanity-check':    { agent: 'fp-docs-validator',  engine: 'validate',    workflow: 'sanity-check.md',    operation: 'sanity-check',        type: 'read' },
  'test':            { agent: 'fp-docs-validator',  engine: 'validate',    workflow: 'test.md',            operation: 'test',                type: 'read' },
  'citations':       { agent: 'fp-docs-citations',  engine: 'citations',   workflow: 'citations.md',       operation: null,                  type: 'write' },
  'api-ref':         { agent: 'fp-docs-api-refs',   engine: 'api-refs',    workflow: 'api-ref.md',         operation: null,                  type: 'write' },
  'locals':          { agent: 'fp-docs-locals',     engine: 'locals',      workflow: 'locals.md',          operation: null,                  type: 'write' },
  'verbosity-audit': { agent: 'fp-docs-verbosity',  engine: 'verbosity',   workflow: 'verbosity-audit.md', operation: 'audit',               type: 'read' },
  'update-index':    { agent: 'fp-docs-indexer',    engine: 'index',       workflow: 'update-index.md',    operation: 'update-project-index', type: 'admin' },
  'update-claude':   { agent: 'fp-docs-indexer',    engine: 'index',       workflow: 'update-claude.md',   operation: 'update-example-claude', type: 'admin' },
  'update-skills':   { agent: 'fp-docs-system',     engine: 'system',      workflow: 'update-skills.md',   operation: 'update-skills',       type: 'admin' },
  'setup':           { agent: 'fp-docs-system',     engine: 'system',      workflow: 'setup.md',           operation: 'setup',               type: 'admin' },
  'sync':            { agent: 'fp-docs-system',     engine: 'system',      workflow: 'sync.md',            operation: 'sync',                type: 'admin' },
  'update':          { agent: 'fp-docs-system',     engine: 'system',      workflow: 'update.md',          operation: 'update',              type: 'admin' },
  'parallel':        { agent: null,                  engine: 'orchestrate', workflow: 'parallel.md',        operation: 'parallel',            type: 'batch' },
  'remediate':       { agent: null,                  engine: 'orchestrate', workflow: 'remediate.md',       operation: 'remediate',           type: 'write' },
  'do':              { agent: null,                  engine: null,          workflow: 'do.md',              operation: 'do',                  type: 'meta' },
  'help':            { agent: null,                  engine: null,          workflow: 'help.md',            operation: 'help',                type: 'meta' },
};

/**
 * Brief descriptions for each command, derived from skill file descriptions.
 */
const DESCRIPTIONS = {
  'revise':          'Fix specific documentation you know is wrong or outdated',
  'add':             'Create new documentation for a source file or feature',
  'auto-update':     'Detect and update docs affected by recent code changes',
  'auto-revise':     'Batch process the needs-revision tracker',
  'deprecate':       'Mark documentation as deprecated with lifecycle tracking',
  'audit':           'Compare documentation against source code and report discrepancies',
  'verify':          '10-point verification check on documentation files',
  'sanity-check':    'Zero-tolerance check for claim-code mismatches',
  'test':            'Runtime testing against local dev environment',
  'citations':       'Manage code citations (generate, update, verify, audit)',
  'api-ref':         'Generate or update API reference sections',
  'locals':          'Manage locals contract documentation for components',
  'verbosity-audit': 'Scan docs for verbosity gaps and summarization language',
  'update-index':    'Refresh the PROJECT-INDEX.md codebase reference',
  'update-claude':   'Regenerate CLAUDE.md template with current command inventory',
  'update-skills':   'Regenerate plugin command files from current definitions',
  'setup':           'First-time setup and configuration',
  'sync':            'Sync branches and verify remote state',
  'update':          'Check for and install fp-docs plugin updates',
  'parallel':        'Run documentation operations in parallel via Agent Teams',
  'remediate':       'Resolve audit findings by dispatching to specialist agents',
  'do':              'Route natural language to the right fp-docs command',
  'help':            'Display all fp-docs commands grouped by type with descriptions',
};

// ── Lookup ───────────────────────────────────────────────────────────────────

/**
 * Look up the routing entry for a command.
 *
 * @param {string} command - Command name (without /fp-docs: prefix)
 * @returns {{ engine: string, operation: string|null, type: string }|null} Route entry or null
 */
function lookupRoute(command) {
  return ROUTING_TABLE[command] || null;
}

/**
 * Get the full routing table.
 *
 * @returns {object} The complete ROUTING_TABLE object
 */
function getRoutingTable() {
  return ROUTING_TABLE;
}

// ── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate that all command files and workflow files exist for each routing entry.
 *
 * Checks:
 *   1. Command file exists at commands/fp-docs/{command}.md
 *   2. Workflow file exists at workflows/{workflow}
 *   3. Agent file exists at agents/{agent}.md (if agent is specified)
 *
 * @param {string} pluginRoot - Absolute path to the plugin root
 * @returns {{ valid: boolean, mismatches: Array<{command: string, field: string, expected: string, actual: string}> }}
 */
function validateRoutes(pluginRoot) {
  const mismatches = [];

  for (const [command, route] of Object.entries(ROUTING_TABLE)) {
    // Check command file exists
    const commandPath = path.join(pluginRoot, 'commands', 'fp-docs', `${command}.md`);
    if (!fs.existsSync(commandPath)) {
      mismatches.push({ command, field: 'command-file', expected: 'exists', actual: 'missing' });
    }

    // Check workflow file exists
    if (route.workflow) {
      const workflowPath = path.join(pluginRoot, 'workflows', route.workflow);
      if (!fs.existsSync(workflowPath)) {
        mismatches.push({ command, field: 'workflow-file', expected: route.workflow, actual: 'missing' });
      }
    }

    // Check agent file exists (if agent is specified)
    if (route.agent) {
      const agentPath = path.join(pluginRoot, 'agents', `${route.agent}.md`);
      if (!fs.existsSync(agentPath)) {
        mismatches.push({ command, field: 'agent-file', expected: route.agent, actual: 'missing' });
      }
    }
  }

  return { valid: mismatches.length === 0, mismatches };
}

// ── CLI Handlers ─────────────────────────────────────────────────────────────

/**
 * CLI handler for `fp-tools route <subcommand>`.
 *
 * Subcommands:
 *   lookup <command> - Look up the routing entry for a command
 *   table            - Output the full routing table
 *   validate         - Validate all skills match the routing table
 *
 * @param {string} subcommand - The route subcommand
 * @param {string[]} args - Additional arguments
 * @param {boolean} raw - Whether to use raw output mode
 */
function cmdRoute(subcommand, args, raw) {
  if (!subcommand) {
    error('Usage: fp-tools route <lookup|table|validate> [args]');
  }

  switch (subcommand) {
    case 'lookup': {
      const command = args[0];
      if (!command) {
        error('Usage: fp-tools route lookup <command>');
      }
      const route = lookupRoute(command);
      if (!route) {
        error(`Unknown command: ${command}. Run fp-tools help for available commands`);
      }
      output(route, raw, `${route.engine}:${route.operation}:${route.type}`);
      break;
    }

    case 'table': {
      output(ROUTING_TABLE, raw, JSON.stringify(ROUTING_TABLE, null, 2));
      break;
    }

    case 'validate': {
      const pluginRoot = getPluginRoot();
      const result = validateRoutes(pluginRoot);
      output(result, raw, result.valid ? 'valid' : `invalid: ${result.mismatches.length} mismatches`);
      break;
    }

    default:
      error(`Unknown route subcommand: ${subcommand}. Use: lookup, table, validate`);
  }
}

/**
 * CLI handler for `fp-tools help [subcommand]`.
 *
 * Subcommands:
 *   (none)    - List commands as JSON array (backward-compatible, unprefixed)
 *   grouped   - Output grouped markdown tables with /fp-docs: prefix
 *
 * @param {string} [subcommand] - Optional subcommand ('grouped' or undefined)
 * @param {boolean} raw - Whether to use raw output mode
 */
function cmdHelp(subcommand, raw) {
  if (subcommand === 'grouped') {
    // Grouped markdown output with /fp-docs: prefix
    const groups = { write: [], read: [], admin: [], batch: [], meta: [] };
    const groupLabels = {
      write: 'Documentation Creation & Modification',
      read: 'Validation & Auditing',
      admin: 'System & Maintenance',
      batch: 'Batch Operations',
      meta: 'Utility & Routing',
    };

    for (const [command, route] of Object.entries(ROUTING_TABLE)) {
      groups[route.type].push({
        command: `/fp-docs:${command}`,
        description: DESCRIPTIONS[command] || '',
        engine: route.engine,
      });
    }

    let md = '# fp-docs Command Reference\n\n';
    for (const [type, label] of Object.entries(groupLabels)) {
      if (groups[type].length === 0) continue;
      md += `## ${label}\n\n`;
      md += '| Command | Description | Engine |\n';
      md += '|---------|-------------|--------|\n';
      for (const cmd of groups[type]) {
        md += `| ${cmd.command} | ${cmd.description} | ${cmd.engine} |\n`;
      }
      md += '\n';
    }

    output({ markdown: md }, raw, md);
  } else {
    // Default: backward-compatible unprefixed format
    const commands = Object.entries(ROUTING_TABLE).map(([command, route]) => ({
      command,
      description: DESCRIPTIONS[command] || '',
      engine: route.engine,
      type: route.type,
    }));

    output({ commands }, raw, commands.map(c => `${c.command} - ${c.description}`).join('\n'));
  }
}

module.exports = { lookupRoute, getRoutingTable, validateRoutes, cmdRoute, cmdHelp };
