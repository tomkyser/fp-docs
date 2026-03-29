'use strict';

// Tests for lib/plans.cjs
// Unit tests for execution plan and analysis file CRUD operations.

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const LIB_DIR = path.resolve(__dirname, '..', '..', 'lib');

// -- Test Helpers -------------------------------------------------------------

/**
 * Create a unique temp directory for isolated plan file I/O.
 * Each test group gets its own directory so tests don't interfere.
 */
function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fp-plans-'));
}

/**
 * Remove a temp directory and all contents.
 */
function cleanTempDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup
  }
}

/**
 * Write a plan JSON file at the expected path within a temp dir.
 */
function writePlanFile(tmpDir, plan) {
  const plansDir = path.join(tmpDir, '.fp-docs', 'plans');
  fs.mkdirSync(plansDir, { recursive: true });
  const planPath = path.join(plansDir, `${plan.plan_id}.json`);
  fs.writeFileSync(planPath, JSON.stringify(plan, null, 2), 'utf-8');
  return planPath;
}

// -- Module Tests -------------------------------------------------------------

describe('Plans Module: Exports', () => {
  it('should be requireable', () => {
    const plans = require(path.join(LIB_DIR, 'plans.cjs'));
    assert.ok(plans);
  });

  it('should export all 9 functions: savePlan, loadPlan, listPlans, updatePlan, prunePlans, saveAnalysis, loadAnalysis, pruneAnalyses, cmdPlans', () => {
    const plans = require(path.join(LIB_DIR, 'plans.cjs'));
    assert.equal(typeof plans.savePlan, 'function');
    assert.equal(typeof plans.loadPlan, 'function');
    assert.equal(typeof plans.listPlans, 'function');
    assert.equal(typeof plans.updatePlan, 'function');
    assert.equal(typeof plans.prunePlans, 'function');
    assert.equal(typeof plans.saveAnalysis, 'function');
    assert.equal(typeof plans.loadAnalysis, 'function');
    assert.equal(typeof plans.pruneAnalyses, 'function');
    assert.equal(typeof plans.cmdPlans, 'function');
  });
});

describe('Plans Module: Plan CRUD', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    cleanTempDir(tmpDir);
  });

  it('Test 1: savePlan creates file in .fp-docs/plans/ with correct filename', () => {
    const plans = require(path.join(LIB_DIR, 'plans.cjs'));
    const plan = { plan_id: 'plan-test0001', operation: 'revise', target: 'docs/posts.md' };
    const planPath = plans.savePlan(plan, tmpDir);
    const expectedPath = path.join(tmpDir, '.fp-docs', 'plans', 'plan-test0001.json');
    assert.equal(planPath, expectedPath);
    assert.ok(fs.existsSync(planPath), 'Plan file should exist');
  });

  it('Test 2: savePlan auto-generates plan_id with plan- prefix when not provided', () => {
    const plans = require(path.join(LIB_DIR, 'plans.cjs'));
    const plan = { operation: 'revise', target: 'docs/posts.md' };
    const planPath = plans.savePlan(plan, tmpDir);
    assert.ok(planPath, 'Should return a path');
    assert.ok(plan.plan_id, 'plan_id should be set');
    assert.ok(plan.plan_id.startsWith('plan-'), 'plan_id should start with plan- prefix');
    assert.equal(plan.plan_id.length, 13, 'plan_id should be plan- + 8 hex chars = 13 chars');
  });

  it('Test 3: savePlan auto-sets created_at, version: 1, status: pending defaults', () => {
    const plans = require(path.join(LIB_DIR, 'plans.cjs'));
    const plan = { operation: 'add', target: 'docs/new.md' };
    plans.savePlan(plan, tmpDir);
    assert.ok(plan.created_at, 'created_at should be set');
    assert.equal(plan.version, 1, 'version should default to 1');
    assert.equal(plan.status, 'pending', 'status should default to pending');
  });

  it('Test 4: loadPlan by ID returns the saved plan object', () => {
    const plans = require(path.join(LIB_DIR, 'plans.cjs'));
    const plan = {
      plan_id: 'plan-loadid01',
      operation: 'revise',
      target: 'docs/posts.md',
      status: 'pending',
      version: 1,
      created_at: '2026-03-29T10:00:00Z',
    };
    plans.savePlan(plan, tmpDir);
    const loaded = plans.loadPlan('plan-loadid01', tmpDir);
    assert.ok(loaded, 'loaded plan should not be null');
    assert.equal(loaded.plan_id, 'plan-loadid01');
    assert.equal(loaded.operation, 'revise');
    assert.equal(loaded.target, 'docs/posts.md');
  });

  it('Test 5: loadPlan by absolute path returns the plan', () => {
    const plans = require(path.join(LIB_DIR, 'plans.cjs'));
    const plan = { plan_id: 'plan-abspath1', operation: 'add', target: 'docs/new.md', status: 'pending', version: 1, created_at: '2026-03-29T10:00:00Z' };
    const planPath = plans.savePlan(plan, tmpDir);
    const loaded = plans.loadPlan(planPath, tmpDir);
    assert.ok(loaded, 'loaded plan should not be null');
    assert.equal(loaded.plan_id, 'plan-abspath1');
  });

  it('Test 6: loadPlan returns null for nonexistent plan', () => {
    const plans = require(path.join(LIB_DIR, 'plans.cjs'));
    const loaded = plans.loadPlan('plan-doesnotexist', tmpDir);
    assert.equal(loaded, null);
  });

  it('Test 7: listPlans returns summary array with id, created_at, status, operation, target', () => {
    const plans = require(path.join(LIB_DIR, 'plans.cjs'));
    plans.savePlan({ plan_id: 'plan-list0001', operation: 'revise', target: 'docs/posts.md', status: 'pending', version: 1, created_at: '2026-03-29T10:00:00Z' }, tmpDir);
    plans.savePlan({ plan_id: 'plan-list0002', operation: 'add', target: 'docs/new.md', status: 'complete', version: 1, created_at: '2026-03-29T11:00:00Z' }, tmpDir);
    const list = plans.listPlans(tmpDir);
    assert.equal(list.length, 2);
    const plan1 = list.find(p => p.id === 'plan-list0001');
    assert.ok(plan1, 'should find plan-list0001');
    assert.equal(plan1.status, 'pending');
    assert.equal(plan1.operation, 'revise');
    assert.equal(plan1.target, 'docs/posts.md');
    assert.ok(plan1.created_at, 'should have created_at');
  });

  it('Test 8: listPlans returns empty array when no plans exist', () => {
    const plans = require(path.join(LIB_DIR, 'plans.cjs'));
    const list = plans.listPlans(tmpDir);
    assert.deepEqual(list, []);
  });

  it('Test 9: updatePlan merges fields and preserves existing data', () => {
    const plans = require(path.join(LIB_DIR, 'plans.cjs'));
    plans.savePlan({ plan_id: 'plan-upd00001', operation: 'revise', target: 'docs/posts.md', status: 'pending', version: 1, created_at: '2026-03-29T10:00:00Z', completed: [], failed: [] }, tmpDir);
    const updated = plans.updatePlan('plan-upd00001', { status: 'in-progress' }, tmpDir);
    assert.ok(updated, 'updated plan should not be null');
    assert.equal(updated.status, 'in-progress');
    assert.equal(updated.plan_id, 'plan-upd00001');
    assert.equal(updated.operation, 'revise', 'existing fields should be preserved');
  });

  it('Test 10: updatePlan unions completed and failed arrays (not replaces)', () => {
    const plans = require(path.join(LIB_DIR, 'plans.cjs'));
    plans.savePlan({ plan_id: 'plan-comp0001', operation: 'revise', target: 'docs/posts.md', status: 'in-progress', version: 1, created_at: '2026-03-29T10:00:00Z', completed: ['phase-1'], failed: ['phase-x'] }, tmpDir);
    const updated = plans.updatePlan('plan-comp0001', { completed: ['phase-2'], failed: ['phase-y'] }, tmpDir);
    assert.ok(updated, 'updated plan should not be null');
    assert.deepEqual(updated.completed.sort(), ['phase-1', 'phase-2']);
    assert.deepEqual(updated.failed.sort(), ['phase-x', 'phase-y']);
  });

  it('Test 11: updatePlan returns null for nonexistent plan', () => {
    const plans = require(path.join(LIB_DIR, 'plans.cjs'));
    const updated = plans.updatePlan('plan-doesnotexist', { status: 'complete' }, tmpDir);
    assert.equal(updated, null);
  });
});

describe('Plans Module: Analysis Files', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    cleanTempDir(tmpDir);
  });

  it('Test 12: saveAnalysis writes markdown to .fp-docs/analyses/ with operation-timestamp filename', () => {
    const plans = require(path.join(LIB_DIR, 'plans.cjs'));
    const content = '# Analysis\n\nSome findings here.';
    const analysisPath = plans.saveAnalysis(content, 'revise', tmpDir);
    assert.ok(analysisPath, 'Should return a path');
    assert.ok(analysisPath.includes('.fp-docs'), 'Path should include .fp-docs');
    assert.ok(analysisPath.includes('analyses'), 'Path should include analyses');
    assert.ok(analysisPath.endsWith('.md'), 'File should have .md extension');
    assert.ok(path.basename(analysisPath).startsWith('revise-'), 'Filename should start with operation name');
    assert.ok(fs.existsSync(analysisPath), 'Analysis file should exist');
  });

  it('Test 13: loadAnalysis reads back the saved markdown content', () => {
    const plans = require(path.join(LIB_DIR, 'plans.cjs'));
    const content = '# Research Analysis\n\nDetailed findings about the codebase.\n\n## Sections\n- Item 1\n- Item 2';
    const analysisPath = plans.saveAnalysis(content, 'audit', tmpDir);
    const loaded = plans.loadAnalysis(analysisPath);
    assert.equal(loaded, content, 'Loaded content should match original');
  });

  it('Test 14: loadAnalysis returns null for nonexistent path', () => {
    const plans = require(path.join(LIB_DIR, 'plans.cjs'));
    const loaded = plans.loadAnalysis('/tmp/nonexistent-analysis-file.md');
    assert.equal(loaded, null);
  });
});

describe('Plans Module: Pruning', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    cleanTempDir(tmpDir);
  });

  it('Test 15: prunePlans removes completed plans older than retention threshold', () => {
    const plans = require(path.join(LIB_DIR, 'plans.cjs'));
    // Create a completed plan with old date (60 days ago)
    const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const plansDir = path.join(tmpDir, '.fp-docs', 'plans');
    fs.mkdirSync(plansDir, { recursive: true });
    fs.writeFileSync(path.join(plansDir, 'plan-old00001.json'), JSON.stringify({
      plan_id: 'plan-old00001', status: 'complete', created_at: oldDate, version: 1, operation: 'revise', target: 'docs/old.md',
    }), 'utf-8');
    // Create a recent completed plan (1 day ago)
    const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    fs.writeFileSync(path.join(plansDir, 'plan-new00001.json'), JSON.stringify({
      plan_id: 'plan-new00001', status: 'complete', created_at: recentDate, version: 1, operation: 'revise', target: 'docs/new.md',
    }), 'utf-8');
    const result = plans.prunePlans(tmpDir);
    assert.equal(result.pruned, 1, 'Should prune 1 old plan');
    assert.equal(result.remaining, 1, 'Should have 1 remaining');
    assert.equal(fs.existsSync(path.join(plansDir, 'plan-old00001.json')), false, 'Old plan should be deleted');
    assert.equal(fs.existsSync(path.join(plansDir, 'plan-new00001.json')), true, 'Recent plan should remain');
  });

  it('Test 16: prunePlans enforces MAX_PLANS cap (oldest completed first)', () => {
    const plans = require(path.join(LIB_DIR, 'plans.cjs'));
    const plansDir = path.join(tmpDir, '.fp-docs', 'plans');
    fs.mkdirSync(plansDir, { recursive: true });
    // Create 202 recent completed plans to exceed MAX_PLANS (200)
    for (let i = 0; i < 202; i++) {
      const created = new Date(Date.now() - i * 60 * 1000).toISOString(); // spaced 1 minute apart
      const id = `plan-cap${String(i).padStart(5, '0')}`;
      fs.writeFileSync(path.join(plansDir, `${id}.json`), JSON.stringify({
        plan_id: id, status: 'complete', created_at: created, version: 1, operation: 'revise', target: `docs/file${i}.md`,
      }), 'utf-8');
    }
    const result = plans.prunePlans(tmpDir);
    assert.ok(result.pruned >= 2, 'Should prune at least 2 plans to get under 200');
    assert.ok(result.remaining <= 200, 'Should have at most 200 remaining');
  });

  it('Test 17: prunePlans does not remove pending or in-progress plans regardless of age', () => {
    const plans = require(path.join(LIB_DIR, 'plans.cjs'));
    const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const plansDir = path.join(tmpDir, '.fp-docs', 'plans');
    fs.mkdirSync(plansDir, { recursive: true });
    // Old pending plan
    fs.writeFileSync(path.join(plansDir, 'plan-pend0001.json'), JSON.stringify({
      plan_id: 'plan-pend0001', status: 'pending', created_at: oldDate, version: 1, operation: 'revise', target: 'docs/pending.md',
    }), 'utf-8');
    // Old in-progress plan
    fs.writeFileSync(path.join(plansDir, 'plan-prog0001.json'), JSON.stringify({
      plan_id: 'plan-prog0001', status: 'in-progress', created_at: oldDate, version: 1, operation: 'add', target: 'docs/progress.md',
    }), 'utf-8');
    const result = plans.prunePlans(tmpDir);
    assert.equal(result.pruned, 0, 'Should not prune any non-complete plans');
    assert.equal(result.remaining, 2, 'Both plans should remain');
    assert.ok(fs.existsSync(path.join(plansDir, 'plan-pend0001.json')), 'Pending plan should remain');
    assert.ok(fs.existsSync(path.join(plansDir, 'plan-prog0001.json')), 'In-progress plan should remain');
  });

  it('Test 18: pruneAnalyses removes analysis files older than retention threshold', () => {
    const plans = require(path.join(LIB_DIR, 'plans.cjs'));
    const analysesDir = path.join(tmpDir, '.fp-docs', 'analyses');
    fs.mkdirSync(analysesDir, { recursive: true });
    // Create an analysis file
    const filePath = path.join(analysesDir, 'revise-20260101-100000.md');
    fs.writeFileSync(filePath, '# Old analysis', 'utf-8');
    // Set the mtime to 60 days ago to simulate an old file
    const oldTime = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    fs.utimesSync(filePath, oldTime, oldTime);
    // Create a recent analysis file
    const recentPath = path.join(analysesDir, 'audit-20260329-100000.md');
    fs.writeFileSync(recentPath, '# Recent analysis', 'utf-8');
    const result = plans.pruneAnalyses(tmpDir);
    assert.equal(result.pruned, 1, 'Should prune 1 old analysis');
    assert.equal(result.remaining, 1, 'Should have 1 remaining');
    assert.equal(fs.existsSync(filePath), false, 'Old analysis should be deleted');
    assert.ok(fs.existsSync(recentPath), 'Recent analysis should remain');
  });
});

describe('Plans Module: Atomic Write', () => {
  it('should use atomic rename pattern (write to .tmp, rename)', () => {
    const source = fs.readFileSync(path.join(LIB_DIR, 'plans.cjs'), 'utf-8');
    assert.ok(source.includes('renameSync'), 'should use fs.renameSync for atomic writes');
    assert.ok(source.includes('.tmp'), 'should write to .tmp file before rename');
  });
});
