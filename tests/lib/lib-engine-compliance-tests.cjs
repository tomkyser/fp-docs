'use strict';

// Engine compliance tests for Phase 08: Engine CJS Migration.
//
// Organized into two groups:
//   - Baseline: Structural tests (engine files exist, hooks.json valid, etc.)
//   - Migration: Content tests verifying CJS integration across all engines,
//     instruction files, modules, and config files. All tests are now active
//     (migration complete as of Plan 08-03).
//
// Run standalone: node fp-docs/tests/run.cjs --engine-compliance

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PLUGIN_ROOT = path.resolve(__dirname, '..', '..');
const AGENTS_DIR = path.join(PLUGIN_ROOT, 'agents');
const INSTRUCTIONS_DIR = path.join(PLUGIN_ROOT, 'framework', 'instructions');
const MODULES_DIR = path.join(PLUGIN_ROOT, 'modules');
const SKILLS_DIR = path.join(PLUGIN_ROOT, 'skills');
const ALGORITHMS_DIR = path.join(PLUGIN_ROOT, 'framework', 'algorithms');
const CONFIG_DIR = path.join(PLUGIN_ROOT, 'framework', 'config');
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

describe('Engine Compliance: Baseline', () => {

  const ENGINE_NAMES = [
    'orchestrate', 'modify', 'validate', 'citations',
    'api-refs', 'locals', 'verbosity', 'index', 'system',
    'researcher', 'planner',
  ];

  it('all 11 engine agent .md files exist', () => {
    for (const name of ENGINE_NAMES) {
      const filePath = path.join(AGENTS_DIR, `${name}.md`);
      assert.ok(
        fs.existsSync(filePath),
        `Missing engine agent file: agents/${name}.md`
      );
    }
  });

  it('read-only engines do not reference scripts/ or docs-commit.sh', () => {
    const readOnlyEngines = ['validate.md', 'verbosity.md'];
    for (const file of readOnlyEngines) {
      const content = readFile(path.join(AGENTS_DIR, file));
      assert.ok(
        !content.includes('scripts/'),
        `${file} should not reference scripts/ directory`
      );
      assert.ok(
        !content.includes('docs-commit.sh'),
        `${file} should not reference docs-commit.sh`
      );
    }
  });

  it('hooks.json exists and is valid JSON', () => {
    const hooksPath = path.join(HOOKS_DIR, 'hooks.json');
    assert.ok(fs.existsSync(hooksPath), 'hooks/hooks.json should exist');
    const content = readFile(hooksPath);
    let parsed;
    assert.doesNotThrow(() => {
      parsed = JSON.parse(content);
    }, 'hooks.json should be valid JSON');
    assert.ok(parsed.hooks, 'hooks.json should have a hooks property');
  });

  // -- Phase 16: New engine compliance tests --

  it('researcher and planner are delegation-only agents', () => {
    const delegationOnlyEngines = ['researcher.md', 'planner.md'];
    for (const file of delegationOnlyEngines) {
      const content = readFile(path.join(AGENTS_DIR, file));
      assert.ok(
        content.includes('DELEGATED'),
        `${file} should reference DELEGATED mode`
      );
      assert.ok(
        !content.includes('disallowedTools'),
        `${file} should not have disallowedTools (they need Write for file output)`
      );
    }
  });

  it('researcher agent has opus model and 75 maxTurns', () => {
    const content = readFile(path.join(AGENTS_DIR, 'researcher.md'));
    assert.ok(content.includes('model: opus'), 'researcher should use opus model');
    assert.ok(content.includes('maxTurns: 75'), 'researcher should have 75 maxTurns');
  });

  it('planner agent has sonnet model and 75 maxTurns', () => {
    const content = readFile(path.join(AGENTS_DIR, 'planner.md'));
    assert.ok(content.includes('model: sonnet'), 'planner should use sonnet model');
    assert.ok(content.includes('maxTurns: 75'), 'planner should have 75 maxTurns');
  });

  it('researcher agent does not have Edit tool', () => {
    const content = readFile(path.join(AGENTS_DIR, 'researcher.md'));
    // Check the tools section in frontmatter - should not contain Edit
    const frontmatter = content.split('---')[1];
    assert.ok(
      !frontmatter.includes('- Edit'),
      'researcher should not have Edit tool (analysis only, no file modification)'
    );
  });

  it('planner agent preloads mod-orchestration module', () => {
    const content = readFile(path.join(AGENTS_DIR, 'planner.md'));
    assert.ok(
      content.includes('mod-orchestration'),
      'planner should preload mod-orchestration for batching thresholds'
    );
  });

  it('delegate.md defines 5-phase delegation model', () => {
    const content = readFile(path.join(INSTRUCTIONS_DIR, 'orchestrate', 'delegate.md'));
    assert.ok(content.includes('Research Phase'), 'delegate.md should define Research Phase');
    assert.ok(content.includes('Plan Phase'), 'delegate.md should define Plan Phase');
    assert.ok(content.includes('--plan-only'), 'delegate.md should document --plan-only flag');
    assert.ok(content.includes('--no-research'), 'delegate.md should document --no-research flag');
  });

  it('config.json has model_profile section for agent model configuration', () => {
    const configPath = path.join(PLUGIN_ROOT, 'config.json');
    const content = readFile(configPath);
    const config = JSON.parse(content);
    assert.ok(config.model_profile, 'config.json should have model_profile section');
    assert.ok(config.model_profile.agents, 'model_profile should have agents map');
    assert.ok(config.system, 'config.json should have system section');
  });

  it('mod-orchestration reflects 5-phase pipeline grouping', () => {
    const content = readFile(path.join(MODULES_DIR, 'mod-orchestration', 'SKILL.md'));
    assert.ok(content.includes('Research Phase'), 'mod-orchestration should list Research Phase');
    assert.ok(content.includes('Plan Phase'), 'mod-orchestration should list Plan Phase');
  });

  it('all 30 instruction files exist', () => {
    const expectedFiles = [
      // api-refs (2)
      'api-refs/audit.md',
      'api-refs/generate.md',
      // citations (4)
      'citations/audit.md',
      'citations/generate.md',
      'citations/update.md',
      'citations/verify.md',
      // index (2)
      'index/update.md',
      'index/update-example-claude.md',
      // locals (6)
      'locals/annotate.md',
      'locals/contracts.md',
      'locals/coverage.md',
      'locals/cross-ref.md',
      'locals/shapes.md',
      'locals/validate.md',
      // modify (5)
      'modify/add.md',
      'modify/auto-revise.md',
      'modify/auto-update.md',
      'modify/deprecate.md',
      'modify/revise.md',
      // orchestrate (3)
      'orchestrate/delegate.md',
      'orchestrate/do.md',
      'orchestrate/remediate.md',
      // system (3)
      'system/setup.md',
      'system/sync.md',
      'system/update-skills.md',
      // validate (4)
      'validate/audit.md',
      'validate/sanity-check.md',
      'validate/test.md',
      'validate/verify.md',
      // verbosity (1)
      'verbosity/audit.md',
    ];

    for (const relPath of expectedFiles) {
      const filePath = path.join(INSTRUCTIONS_DIR, relPath);
      assert.ok(
        fs.existsSync(filePath),
        `Missing instruction file: framework/instructions/${relPath}`
      );
    }
  });
});

// ── Migration Tests ────────────────────────────────────────────────────────────
// These tests verify the CJS migration is complete across all engines,
// instruction files, modules, and config files. All tests are active.

describe('Engine Compliance: Migration', () => {

  // -- Plan 08-01 Task 1 fixes --

  it('delegate.md contains fp-tools.cjs pipeline next', () => {
    const content = readFile(path.join(INSTRUCTIONS_DIR, 'orchestrate', 'delegate.md'));
    assert.ok(
      content.includes('fp-tools.cjs pipeline next'),
      'delegate.md should reference fp-tools.cjs pipeline next'
    );
  });

  it('delegate.md does NOT contain docs-commit.sh', () => {
    const content = readFile(path.join(INSTRUCTIONS_DIR, 'orchestrate', 'delegate.md'));
    assert.ok(
      !content.includes('docs-commit.sh'),
      'delegate.md should not reference docs-commit.sh'
    );
  });

  it('all 5 locals instruction files contain fp-tools.cjs locals-cli setup', () => {
    const localsFiles = ['annotate.md', 'contracts.md', 'coverage.md', 'cross-ref.md', 'validate.md'];
    for (const file of localsFiles) {
      const content = readFile(path.join(INSTRUCTIONS_DIR, 'locals', file));
      assert.ok(
        content.includes('fp-tools.cjs locals-cli setup'),
        `locals/${file} should reference fp-tools.cjs locals-cli setup`
      );
    }
  });

  it('zero locals instruction files contain scripts/locals-cli-setup.sh', () => {
    const localsFiles = ['annotate.md', 'contracts.md', 'coverage.md', 'cross-ref.md', 'validate.md', 'shapes.md'];
    for (const file of localsFiles) {
      const content = readFile(path.join(INSTRUCTIONS_DIR, 'locals', file));
      assert.ok(
        !content.includes('scripts/locals-cli-setup.sh'),
        `locals/${file} should not reference scripts/locals-cli-setup.sh`
      );
    }
  });

  // -- Plan 08-01 Task 2 fixes --

  it('setup/SKILL.md does NOT contain scripts/ as a directory name', () => {
    const content = readFile(path.join(SKILLS_DIR, 'setup', 'SKILL.md'));
    assert.ok(
      !content.includes('scripts/'),
      'setup/SKILL.md should not reference scripts/ directory'
    );
  });

  // -- Plan 08-01 Task 3 fixes --

  it('sync.md does NOT contain raw git -C {docs-root} commands for commit/push operations', () => {
    const content = readFile(path.join(INSTRUCTIONS_DIR, 'system', 'sync.md'));
    // Check for git -C patterns used for commit and push operations specifically
    const commitPushPattern = /git -C \{docs-root\} (commit|push|add )/;
    assert.ok(
      !commitPushPattern.test(content),
      'sync.md should not contain raw git -C {docs-root} commit/push/add commands'
    );
  });

  // -- Plan 08-02 Task 1 fixes --

  it('orchestrate.md contains fp-tools.cjs pipeline next', () => {
    const content = readFile(path.join(AGENTS_DIR, 'orchestrate.md'));
    assert.ok(
      content.includes('fp-tools.cjs pipeline next'),
      'orchestrate.md should reference fp-tools.cjs pipeline next'
    );
  });

  it('modify.md does NOT contain docs-commit.sh', () => {
    const content = readFile(path.join(AGENTS_DIR, 'modify.md'));
    assert.ok(
      !content.includes('docs-commit.sh'),
      'modify.md should not reference docs-commit.sh'
    );
  });

  it('locals.md contains fp-tools.cjs locals-cli setup', () => {
    const content = readFile(path.join(AGENTS_DIR, 'locals.md'));
    assert.ok(
      content.includes('fp-tools.cjs locals-cli setup'),
      'locals.md should reference fp-tools.cjs locals-cli setup'
    );
  });

  // -- Plan 08-02 Task 2 fixes --

  it('all write-capable engine delegation mode sections do NOT contain docs-commit.sh', () => {
    const writeEngines = ['modify.md', 'citations.md', 'api-refs.md', 'locals.md'];
    for (const file of writeEngines) {
      const content = readFile(path.join(AGENTS_DIR, file));
      assert.ok(
        !content.includes('docs-commit.sh'),
        `${file} delegation mode should not reference docs-commit.sh`
      );
    }
  });

  it('system.md does NOT contain scripts/: {present', () => {
    const content = readFile(path.join(AGENTS_DIR, 'system.md'));
    assert.ok(
      !content.includes('scripts/: {present'),
      'system.md should not reference scripts/ directory check'
    );
  });

  it('system.md contains 9 engine', () => {
    const content = readFile(path.join(AGENTS_DIR, 'system.md'));
    assert.ok(
      content.includes('9 engine'),
      'system.md should reference 9 engines'
    );
  });

  // -- Plan 08-03 Task 1 fixes --

  it('mod-locals/SKILL.md does NOT contain scripts/locals-cli-setup.sh', () => {
    const content = readFile(path.join(MODULES_DIR, 'mod-locals', 'SKILL.md'));
    assert.ok(
      !content.includes('scripts/locals-cli-setup.sh'),
      'mod-locals/SKILL.md should not reference scripts/locals-cli-setup.sh'
    );
  });

  it('config.json does NOT contain scripts/locals-cli-setup.sh', () => {
    const configPath = path.join(PLUGIN_ROOT, 'config.json');
    const content = readFile(configPath);
    assert.ok(
      !content.includes('scripts/locals-cli-setup.sh'),
      'config.json should not reference scripts/locals-cli-setup.sh'
    );
  });

  it('hooks.cjs contains CJS_PIPELINE_COMPLIANCE or CJS_MODIFY_COMPLIANCE', () => {
    const content = readFile(path.join(LIB_DIR, 'hooks.cjs'));
    const hasPipelineCompliance = content.includes('CJS_PIPELINE_COMPLIANCE');
    const hasModifyCompliance = content.includes('CJS_MODIFY_COMPLIANCE');
    assert.ok(
      hasPipelineCompliance || hasModifyCompliance,
      'hooks.cjs should contain CJS compliance check constants'
    );
  });

  // -- Stale reference sweep (full plugin scan) --

  it('no stale bash script references remain in plugin .md files', () => {
    const stalePatterns = [
      'scripts/locals-cli-setup.sh',
      'scripts/locals-cli-teardown.sh',
      'locals-cli-cleanup-check.sh',
      'docs-commit.sh',
    ];

    // Collect all .md files across the plugin
    const allMdFiles = [
      ...collectMdFiles(AGENTS_DIR),
      ...collectMdFiles(INSTRUCTIONS_DIR),
      ...collectMdFiles(MODULES_DIR),
      ...collectMdFiles(SKILLS_DIR),
      ...collectMdFiles(ALGORITHMS_DIR),
      ...collectMdFiles(CONFIG_DIR),
    ];

    const violations = [];

    for (const filePath of allMdFiles) {
      const content = readFile(filePath);
      const relativePath = path.relative(PLUGIN_ROOT, filePath);

      // Skip known false positives
      // - mod-project and project-config reference `assets/src/scripts/` (codebase path)
      // - codebase-analysis-guide.md references codebase JS paths
      if (relativePath.includes('mod-project') ||
          relativePath.includes('project-config') ||
          relativePath.includes('codebase-analysis-guide')) {
        continue;
      }

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
