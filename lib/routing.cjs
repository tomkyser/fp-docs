'use strict';

/**
 * Routing -- Command-to-engine routing table and lookup for fp-docs.
 *
 * Per D-06, the CLI owns the routing table as the single source of truth
 * for command-to-engine mappings. This replaces the implicit routing that
 * was previously embedded in each skill file's frontmatter.
 *
 * The routing table has exactly 20 entries matching the manifest.md Commands table.
 * Each entry maps a command name (without /fp-docs: prefix) to its engine,
 * operation, and type (write/read/admin/batch).
 *
 * Zero external dependencies -- Node.js built-ins only (D-15).
 */

const fs = require('fs');
const path = require('path');
const { output, error } = require('./core.cjs');
const { getPluginRoot } = require('./paths.cjs');

// ── Routing Table ────────────────────────────────────────────────────────────

/**
 * The canonical routing table -- exactly 20 entries matching manifest.md.
 * Keyed by command name (without /fp-docs: prefix).
 */
const ROUTING_TABLE = {
  'revise':          { engine: 'modify',      operation: 'revise',              type: 'write' },
  'add':             { engine: 'modify',      operation: 'add',                 type: 'write' },
  'auto-update':     { engine: 'modify',      operation: 'auto-update',         type: 'write' },
  'auto-revise':     { engine: 'modify',      operation: 'auto-revise',         type: 'write' },
  'deprecate':       { engine: 'modify',      operation: 'deprecate',           type: 'write' },
  'audit':           { engine: 'validate',    operation: 'audit',               type: 'read' },
  'verify':          { engine: 'validate',    operation: 'verify',              type: 'read' },
  'sanity-check':    { engine: 'validate',    operation: 'sanity-check',        type: 'read' },
  'test':            { engine: 'validate',    operation: 'test',                type: 'read' },
  'citations':       { engine: 'citations',   operation: null,                  type: 'write' },
  'api-ref':         { engine: 'api-refs',    operation: null,                  type: 'write' },
  'locals':          { engine: 'locals',      operation: null,                  type: 'write' },
  'verbosity-audit': { engine: 'verbosity',   operation: 'audit',              type: 'read' },
  'update-index':    { engine: 'index',       operation: 'update-project-index', type: 'admin' },
  'update-claude':   { engine: 'index',       operation: 'update-example-claude', type: 'admin' },
  'update-skills':   { engine: 'system',      operation: 'update-skills',       type: 'admin' },
  'setup':           { engine: 'system',      operation: 'setup',               type: 'admin' },
  'sync':            { engine: 'system',      operation: 'sync',                type: 'admin' },
  'parallel':        { engine: 'orchestrate', operation: 'parallel',            type: 'batch' },
  'remediate':       { engine: 'orchestrate', operation: 'remediate',           type: 'write' },
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
  'update-claude':   'Regenerate CLAUDE.md template with current skill inventory',
  'update-skills':   'Regenerate plugin skills from current prompt definitions',
  'setup':           'First-time setup and configuration',
  'sync':            'Sync branches and verify remote state',
  'parallel':        'Run documentation operations in parallel via Agent Teams',
  'remediate':       'Resolve audit findings by dispatching to specialist engines',
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
 * Validate that all skill SKILL.md files match the routing table.
 *
 * Reads each skill's SKILL.md file, parses frontmatter + body to extract
 * Engine and Operation lines, and compares against ROUTING_TABLE.
 *
 * Uses the Phase 1 frontmatter-parser.cjs for frontmatter parsing.
 * For Engine/Operation lines, uses regex on the body.
 *
 * @param {string} pluginRoot - Absolute path to the plugin root
 * @returns {{ valid: boolean, mismatches: Array<{command: string, field: string, expected: string, actual: string}> }}
 */
function validateRoutes(pluginRoot) {
  const mismatches = [];

  // Load frontmatter parser from tests/lib (Phase 1 utility)
  // Resolve relative to this file: lib/ -> fp-docs/ -> tests/lib/
  const parserPath = path.resolve(__dirname, '..', 'tests', 'lib', 'frontmatter-parser.cjs');
  let parseFrontmatter, parseBodyField;

  try {
    const parser = require(parserPath);
    parseFrontmatter = parser.parseFrontmatter;
    parseBodyField = parser.parseBodyField;
  } catch {
    // If parser not available, fall back to inline regex parsing
    parseFrontmatter = (content) => {
      const match = content.match(/^---\n([\s\S]*?)\n---/);
      if (!match) return { frontmatter: {}, body: content };
      const body = content.slice(match[0].length).trim();
      return { frontmatter: {}, body };
    };
    parseBodyField = (body, fieldName) => {
      const re = new RegExp(`^${fieldName}:\\s*(.+)$`, 'm');
      const m = body.match(re);
      return m ? m[1].trim() : null;
    };
  }

  const skillsDir = path.join(pluginRoot, 'skills');

  for (const [command, route] of Object.entries(ROUTING_TABLE)) {
    const skillPath = path.join(skillsDir, command, 'SKILL.md');

    if (!fs.existsSync(skillPath)) {
      mismatches.push({ command, field: 'file', expected: 'exists', actual: 'missing' });
      continue;
    }

    const content = fs.readFileSync(skillPath, 'utf-8');
    const { body } = parseFrontmatter(content);

    // Extract Engine from body
    const actualEngine = parseBodyField(body, 'Engine');
    if (actualEngine && actualEngine !== route.engine) {
      mismatches.push({ command, field: 'engine', expected: route.engine, actual: actualEngine });
    }

    // Extract Operation from body -- handle "(subcommand)" and "(batch)" as null
    const actualOperation = parseBodyField(body, 'Operation');
    if (actualOperation) {
      const normalizedOp = actualOperation.startsWith('(') ? null : actualOperation;
      if (normalizedOp !== route.operation) {
        mismatches.push({ command, field: 'operation', expected: String(route.operation), actual: String(normalizedOp) });
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
    const groups = { write: [], read: [], admin: [], batch: [] };
    const groupLabels = {
      write: 'Documentation Creation & Modification',
      read: 'Validation & Auditing',
      admin: 'System & Maintenance',
      batch: 'Batch Operations',
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
