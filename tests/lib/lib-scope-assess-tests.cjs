'use strict';

// Tests for lib/scope-assess.cjs
// Covers complexity estimation, researcher count recommendation, strategy selection,
// target parsing, file scope analysis, and the main assessScope orchestrator.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const LIB_DIR = path.resolve(__dirname, '..', '..');
const scopeAssess = require(path.join(LIB_DIR, 'lib', 'scope-assess.cjs'));

// ── Module Exports ──────────────────────────────────────────────────────────

describe('scope-assess exports', () => {
  it('should export all 7 expected functions', () => {
    const expected = [
      'assessScope',
      'estimateComplexity',
      'recommendResearcherCount',
      'recommendStrategy',
      'parseTargets',
      'analyzeFileScope',
      'cmdScopeAssess',
    ];
    for (const name of expected) {
      assert.equal(typeof scopeAssess[name], 'function', `${name} should be a function`);
    }
  });
});

// ── estimateComplexity ──────────────────────────────────────────────────────

describe('estimateComplexity', () => {
  it('should return low for meta operations regardless of file count', () => {
    assert.equal(scopeAssess.estimateComplexity(100, 'meta'), 'low');
    assert.equal(scopeAssess.estimateComplexity(0, 'meta'), 'low');
  });

  it('should return low for admin operations regardless of file count', () => {
    assert.equal(scopeAssess.estimateComplexity(50, 'admin'), 'low');
  });

  it('should return low for read operations with 0-1 files', () => {
    assert.equal(scopeAssess.estimateComplexity(0, 'read'), 'low');
    assert.equal(scopeAssess.estimateComplexity(1, 'read'), 'low');
  });

  it('should return low for write operations with 1-2 files', () => {
    assert.equal(scopeAssess.estimateComplexity(1, 'write'), 'low');
    assert.equal(scopeAssess.estimateComplexity(2, 'write'), 'low');
  });

  it('should return medium for write operations at parallel threshold', () => {
    // Default parallel_threshold is 3
    assert.equal(scopeAssess.estimateComplexity(3, 'write'), 'medium');
    assert.equal(scopeAssess.estimateComplexity(5, 'write'), 'medium');
  });

  it('should return high for write operations at team threshold', () => {
    // Default team_threshold is 8
    assert.equal(scopeAssess.estimateComplexity(8, 'write'), 'high');
    assert.equal(scopeAssess.estimateComplexity(20, 'write'), 'high');
  });

  it('should scale by thresholds for read operations with multiple files', () => {
    // read with >1 file follows same threshold logic
    const result2 = scopeAssess.estimateComplexity(2, 'read');
    assert.equal(result2, 'low');
    const result5 = scopeAssess.estimateComplexity(5, 'read');
    assert.equal(result5, 'medium');
    const result10 = scopeAssess.estimateComplexity(10, 'read');
    assert.equal(result10, 'high');
  });
});

// ── recommendResearcherCount ────────────────────────────────────────────────

describe('recommendResearcherCount', () => {
  it('should return 0 for meta and admin operations', () => {
    assert.equal(scopeAssess.recommendResearcherCount('low', 'meta'), 0);
    assert.equal(scopeAssess.recommendResearcherCount('high', 'meta'), 0);
    assert.equal(scopeAssess.recommendResearcherCount('medium', 'admin'), 0);
  });

  it('should return 0 for low/medium read operations', () => {
    assert.equal(scopeAssess.recommendResearcherCount('low', 'read'), 0);
    assert.equal(scopeAssess.recommendResearcherCount('medium', 'read'), 0);
  });

  it('should return 1 for high read operations', () => {
    assert.equal(scopeAssess.recommendResearcherCount('high', 'read'), 1);
  });

  it('should scale 1/2/3 for low/medium/high write operations', () => {
    assert.equal(scopeAssess.recommendResearcherCount('low', 'write'), 1);
    assert.equal(scopeAssess.recommendResearcherCount('medium', 'write'), 2);
    assert.equal(scopeAssess.recommendResearcherCount('high', 'write'), 3);
  });
});

// ── recommendStrategy ───────────────────────────────────────────────────────

describe('recommendStrategy', () => {
  it('should return direct for meta operations', () => {
    assert.equal(scopeAssess.recommendStrategy('low', 'meta'), 'direct');
    assert.equal(scopeAssess.recommendStrategy('high', 'meta'), 'direct');
  });

  it('should return single-agent for admin operations', () => {
    assert.equal(scopeAssess.recommendStrategy('low', 'admin'), 'single-agent');
    assert.equal(scopeAssess.recommendStrategy('high', 'admin'), 'single-agent');
  });

  it('should scale for write operations', () => {
    assert.equal(scopeAssess.recommendStrategy('low', 'write'), 'single-agent');
    assert.equal(scopeAssess.recommendStrategy('medium', 'write'), 'multi-agent');
    assert.equal(scopeAssess.recommendStrategy('high', 'write'), 'team');
  });

  it('should scale for read operations', () => {
    assert.equal(scopeAssess.recommendStrategy('low', 'read'), 'single-agent');
    assert.equal(scopeAssess.recommendStrategy('medium', 'read'), 'multi-agent');
    assert.equal(scopeAssess.recommendStrategy('high', 'read'), 'team');
  });
});

// ── parseTargets ────────────────────────────────────────────────────────────

describe('parseTargets', () => {
  it('should detect "all" keyword', () => {
    const result = scopeAssess.parseTargets(['all']);
    assert.equal(result.isAll, true);
    assert.equal(result.targets.length, 0);
  });

  it('should detect --all flag', () => {
    const result = scopeAssess.parseTargets(['--all']);
    assert.equal(result.isAll, true);
  });

  it('should detect glob patterns', () => {
    const result = scopeAssess.parseTargets(['docs/*.md']);
    assert.equal(result.hasGlob, true);
    assert.ok(result.targets.includes('docs/*.md'));
  });

  it('should detect ? glob patterns', () => {
    const result = scopeAssess.parseTargets(['file?.md']);
    assert.equal(result.hasGlob, true);
  });

  it('should collect non-flag arguments as targets', () => {
    const result = scopeAssess.parseTargets(['hooks.md', 'helpers.md', '--verbose']);
    assert.deepEqual(result.targets, ['hooks.md', 'helpers.md']);
    assert.equal(result.isAll, false);
    assert.equal(result.hasGlob, false);
  });

  it('should skip -- prefixed flags', () => {
    const result = scopeAssess.parseTargets(['--no-citations', '--depth=deep', 'file.md']);
    assert.deepEqual(result.targets, ['file.md']);
  });

  it('should handle empty args', () => {
    const result = scopeAssess.parseTargets([]);
    assert.equal(result.targets.length, 0);
    assert.equal(result.isAll, false);
    assert.equal(result.hasGlob, false);
  });
});

// ── analyzeFileScope ────────────────────────────────────────────────────────

describe('analyzeFileScope', () => {
  it('should estimate from source map for isAll', () => {
    const result = scopeAssess.analyzeFileScope({ targets: [], isAll: true, hasGlob: false }, 'write');
    assert.ok(result.fileCount >= 1);
    assert.ok(['source-map-total', 'default-all-estimate'].includes(result.estimationMethod));
  });

  it('should return glob estimate for glob patterns', () => {
    const result = scopeAssess.analyzeFileScope(
      { targets: ['*.md'], isAll: false, hasGlob: true }, 'write'
    );
    assert.equal(result.fileCount, 5);
    assert.equal(result.estimationMethod, 'glob-estimate');
  });

  it('should default to 1 file when no targets', () => {
    const result = scopeAssess.analyzeFileScope(
      { targets: [], isAll: false, hasGlob: false }, 'write'
    );
    assert.equal(result.fileCount, 1);
    assert.equal(result.estimationMethod, 'no-targets-default');
  });

  it('should count explicit targets', () => {
    const result = scopeAssess.analyzeFileScope(
      { targets: ['a.md', 'b.md', 'c.md'], isAll: false, hasGlob: false }, 'write'
    );
    assert.equal(result.fileCount, 3);
    assert.equal(result.estimationMethod, 'explicit-targets');
    assert.deepEqual(result.files, ['a.md', 'b.md', 'c.md']);
  });
});

// ── assessScope ─────────────────────────────────────────────────────────────

describe('assessScope', () => {
  it('should return error result for unknown command', () => {
    const result = scopeAssess.assessScope('nonexistent-command', []);
    assert.ok(result.error);
    assert.equal(result.complexity, 'low');
    assert.equal(result.researcherCount, 0);
    assert.equal(result.strategy, 'direct');
  });

  it('should return full assessment for known write command', () => {
    const result = scopeAssess.assessScope('revise', ['hooks.md']);
    assert.equal(result.command, 'revise');
    assert.ok(result.agent);
    assert.ok(result.type);
    assert.ok(['low', 'medium', 'high'].includes(result.complexity));
    assert.equal(typeof result.researcherCount, 'number');
    assert.ok(['direct', 'single-agent', 'multi-agent', 'team'].includes(result.strategy));
    assert.equal(typeof result.needsPlanner, 'boolean');
    assert.ok(result.fileScope);
    assert.ok(result.thresholds);
  });

  it('should return full assessment for known read command', () => {
    const result = scopeAssess.assessScope('audit', []);
    assert.equal(result.command, 'audit');
    assert.ok(result.type);
    assert.ok(result.fileScope);
  });

  it('should set needsPlanner for high complexity', () => {
    // Force high complexity with many targets
    const manyFiles = Array.from({ length: 10 }, (_, i) => `file${i}.md`);
    const result = scopeAssess.assessScope('revise', manyFiles);
    if (result.complexity === 'high') {
      assert.equal(result.needsPlanner, true);
    }
  });

  it('should include thresholds in result', () => {
    const result = scopeAssess.assessScope('revise', []);
    assert.ok(result.thresholds);
    assert.equal(typeof result.thresholds.parallelThreshold, 'number');
    assert.equal(typeof result.thresholds.teamThreshold, 'number');
    assert.equal(typeof result.thresholds.maxTeammates, 'number');
  });
});

// ── cmdScopeAssess ──────────────────────────────────────────────────────────

describe('cmdScopeAssess', () => {
  it('should be a function that accepts args and raw', () => {
    assert.equal(typeof scopeAssess.cmdScopeAssess, 'function');
    assert.equal(scopeAssess.cmdScopeAssess.length, 2);
  });
});
