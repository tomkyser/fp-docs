'use strict';

// GSD architecture compliance tests.
//
// Validates the command-workflow-agent architecture is structurally sound:
//   - Baseline: All expected files exist (agents, commands, workflows, references, hooks, config)
//   - Integration: Cross-references between components are valid (routing table, config, health)
//
// Run standalone: node fp-docs/tests/run.cjs --engine-compliance

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PLUGIN_ROOT = path.resolve(__dirname, '..', '..');
const AGENTS_DIR = path.join(PLUGIN_ROOT, 'agents');
const COMMANDS_DIR = path.join(PLUGIN_ROOT, 'commands', 'fp-docs');
const WORKFLOWS_DIR = path.join(PLUGIN_ROOT, 'workflows');
const REFERENCES_DIR = path.join(PLUGIN_ROOT, 'references');
const HOOKS_DIR = path.join(PLUGIN_ROOT, 'hooks');
const LIB_DIR = path.join(PLUGIN_ROOT, 'lib');

// Helper: read file content
function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

// Helper: recursively collect all .md files under a directory
function collectMdFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMdFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

// ── Baseline Tests ─────────────────────────────────────────────────────────────

describe('GSD Compliance: Baseline', () => {

  const AGENT_NAMES = [
    'fp-docs-modifier', 'fp-docs-validator', 'fp-docs-citations',
    'fp-docs-api-refs', 'fp-docs-locals', 'fp-docs-verbosity',
    'fp-docs-indexer', 'fp-docs-system', 'fp-docs-researcher', 'fp-docs-planner',
  ];

  it('all 10 specialist agent .md files exist', () => {
    for (const name of AGENT_NAMES) {
      const filePath = path.join(AGENTS_DIR, `${name}.md`);
      assert.ok(
        fs.existsSync(filePath),
        `Missing agent file: agents/${name}.md`
      );
    }
  });

  it('all 23 command files exist', () => {
    const commands = fs.readdirSync(COMMANDS_DIR).filter(f => f.endsWith('.md'));
    assert.strictEqual(
      commands.length,
      23,
      `Expected 23 command files, found ${commands.length}`
    );
  });

  it('all 23 workflow files exist', () => {
    const workflows = fs.readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith('.md'));
    assert.strictEqual(
      workflows.length,
      23,
      `Expected 23 workflow files, found ${workflows.length}`
    );
  });

  it('references directory exists with files', () => {
    assert.ok(fs.existsSync(REFERENCES_DIR), 'references/ should exist');
    const refs = fs.readdirSync(REFERENCES_DIR).filter(f => f.endsWith('.md'));
    assert.ok(refs.length > 0, 'references/ should contain .md files');
  });

  it('all 6 standalone hook files exist', () => {
    const expectedHooks = [
      'fp-docs-session-start.js',
      'fp-docs-check-update.js',
      'fp-docs-git-guard.js',
      'fp-docs-subagent-stop.js',
      'fp-docs-teammate-idle.js',
      'fp-docs-task-completed.js',
    ];
    for (const hook of expectedHooks) {
      const filePath = path.join(HOOKS_DIR, hook);
      assert.ok(
        fs.existsSync(filePath),
        `Missing hook file: hooks/${hook}`
      );
    }
  });

  it('config.json exists and has all required sections', () => {
    const configPath = path.join(PLUGIN_ROOT, 'config.json');
    assert.ok(fs.existsSync(configPath), 'config.json should exist');
    const config = JSON.parse(readFile(configPath));
    assert.ok(config.system, 'config.json should have system section');
    assert.ok(config.project, 'config.json should have project section');
    assert.ok(config.model_profile, 'config.json should have model_profile section');
    assert.ok(config.pipeline, 'config.json should have pipeline section');
  });

  it('config.json model_profile has all 10 agents', () => {
    const config = JSON.parse(readFile(path.join(PLUGIN_ROOT, 'config.json')));
    const agents = Object.keys(config.model_profile.agents);
    assert.strictEqual(agents.length, 10, `Expected 10 agent profiles, found ${agents.length}`);
    for (const name of AGENT_NAMES) {
      assert.ok(
        config.model_profile.agents[name],
        `Missing model profile for agent: ${name}`
      );
    }
  });

  it('researcher agent does not have Edit tool', () => {
    const content = readFile(path.join(AGENTS_DIR, 'fp-docs-researcher.md'));
    const frontmatter = content.split('---')[1];
    assert.ok(
      !frontmatter.includes('- Edit'),
      'researcher should not have Edit tool (analysis only, no file modification)'
    );
  });

  it('command files use GSD XML structure', () => {
    const commands = fs.readdirSync(COMMANDS_DIR).filter(f => f.endsWith('.md'));
    for (const cmd of commands) {
      const content = readFile(path.join(COMMANDS_DIR, cmd));
      assert.ok(
        content.includes('<objective>') || content.includes('<execution_context>'),
        `Command ${cmd} should use GSD XML structure`
      );
    }
  });

  it('command files have allowed-tools in frontmatter', () => {
    const commands = fs.readdirSync(COMMANDS_DIR).filter(f => f.endsWith('.md'));
    for (const cmd of commands) {
      const content = readFile(path.join(COMMANDS_DIR, cmd));
      assert.ok(
        content.includes('allowed-tools:'),
        `Command ${cmd} should declare allowed-tools in frontmatter`
      );
    }
  });
});

// ── Integration Tests ─────────────────────────────────────────────────────────

describe('GSD Compliance: Integration', () => {

  it('routing table has 23 entries matching commands', () => {
    const { getRoutingTable } = require(path.join(LIB_DIR, 'routing.cjs'));
    const table = getRoutingTable();
    assert.strictEqual(
      Object.keys(table).length,
      23,
      `Expected 23 routing entries, found ${Object.keys(table).length}`
    );
  });

  it('every routing entry has a matching command file', () => {
    const { getRoutingTable } = require(path.join(LIB_DIR, 'routing.cjs'));
    const table = getRoutingTable();
    for (const command of Object.keys(table)) {
      const cmdPath = path.join(COMMANDS_DIR, `${command}.md`);
      assert.ok(
        fs.existsSync(cmdPath),
        `Routing entry "${command}" has no matching command file`
      );
    }
  });

  it('every routing entry has a matching workflow file', () => {
    const { getRoutingTable } = require(path.join(LIB_DIR, 'routing.cjs'));
    const table = getRoutingTable();
    for (const [command, route] of Object.entries(table)) {
      const wfPath = path.join(WORKFLOWS_DIR, route.workflow);
      assert.ok(
        fs.existsSync(wfPath),
        `Routing entry "${command}" references missing workflow: ${route.workflow}`
      );
    }
  });

  it('every routing entry with an agent has a matching agent file', () => {
    const { getRoutingTable } = require(path.join(LIB_DIR, 'routing.cjs'));
    const table = getRoutingTable();
    for (const [command, route] of Object.entries(table)) {
      if (route.agent) {
        const agentPath = path.join(AGENTS_DIR, `${route.agent}.md`);
        assert.ok(
          fs.existsSync(agentPath),
          `Routing entry "${command}" references missing agent: ${route.agent}`
        );
      }
    }
  });

  it('hooks.cjs contains CJS compliance check constants', () => {
    const content = readFile(path.join(LIB_DIR, 'hooks.cjs'));
    const hasPipelineCompliance = content.includes('CJS_PIPELINE_COMPLIANCE');
    const hasModifyCompliance = content.includes('CJS_MODIFY_COMPLIANCE');
    assert.ok(
      hasPipelineCompliance || hasModifyCompliance,
      'hooks.cjs should contain CJS compliance check constants'
    );
  });

  it('config.json does NOT contain stale script references', () => {
    const content = readFile(path.join(PLUGIN_ROOT, 'config.json'));
    assert.ok(
      !content.includes('scripts/locals-cli-setup.sh'),
      'config.json should not reference scripts/locals-cli-setup.sh'
    );
  });

  it('no stale bash script references in new architecture .md files', () => {
    const stalePatterns = [
      'scripts/locals-cli-setup.sh',
      'scripts/locals-cli-teardown.sh',
      'locals-cli-cleanup-check.sh',
      'docs-commit.sh',
    ];

    const allMdFiles = [
      ...collectMdFiles(AGENTS_DIR),
      ...collectMdFiles(COMMANDS_DIR),
      ...collectMdFiles(WORKFLOWS_DIR),
      ...collectMdFiles(REFERENCES_DIR),
    ];

    const violations = [];

    for (const filePath of allMdFiles) {
      const content = readFile(filePath);
      const relativePath = path.relative(PLUGIN_ROOT, filePath);

      for (const pattern of stalePatterns) {
        if (content.includes(pattern)) {
          violations.push(`${relativePath}: contains "${pattern}"`);
        }
      }
    }

    assert.equal(
      violations.length,
      0,
      `Found ${violations.length} stale bash script references:\n  ${violations.join('\n  ')}`
    );
  });
});
