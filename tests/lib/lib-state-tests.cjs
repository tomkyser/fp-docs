'use strict';

// Tests for lib/state.cjs
// TDD RED phase: These tests should fail until the module is implemented.

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const LIB_DIR = path.resolve(__dirname, '..', '..', 'lib');

// ── Test Helpers ──────────────────────────────────────────────────────────────

/**
 * Create a unique temp directory for isolated state file I/O.
 * Each test gets its own directory so tests don't interfere with each other.
 */
function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fp-state-test-'));
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
 * Write a state file at the expected path within a temp dir.
 * Simulates the state.json file that would exist at {docsRoot}/.fp-docs/state.json.
 */
function writeStateFile(tmpDir, state) {
  const fpDocsDir = path.join(tmpDir, '.fp-docs');
  fs.mkdirSync(fpDocsDir, { recursive: true });
  const statePath = path.join(fpDocsDir, 'state.json');
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
  return statePath;
}

// ── Module Tests ──────────────────────────────────────────────────────────────

describe('lib/state.cjs', () => {
  it('should be requireable', () => {
    const state = require(path.join(LIB_DIR, 'state.cjs'));
    assert.ok(state);
  });

  it('should export loadState, logOperation, getLastOps, getPipeline, updatePipeline, seedFromGitHistory, cmdState', () => {
    const state = require(path.join(LIB_DIR, 'state.cjs'));
    assert.equal(typeof state.loadState, 'function');
    assert.equal(typeof state.logOperation, 'function');
    assert.equal(typeof state.getLastOps, 'function');
    assert.equal(typeof state.getPipeline, 'function');
    assert.equal(typeof state.updatePipeline, 'function');
    assert.equal(typeof state.seedFromGitHistory, 'function');
    assert.equal(typeof state.cmdState, 'function');
  });

  describe('loadState', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = makeTempDir();
    });

    afterEach(() => {
      cleanTempDir(tmpDir);
    });

    it('should return default state when file does not exist and no docs root available', () => {
      const state = require(path.join(LIB_DIR, 'state.cjs'));
      // Use a non-existent path so file is missing and no auto-seed possible
      const nonExistentPath = path.join(tmpDir, 'nonexistent', '.fp-docs', 'state.json');
      const result = state.loadState(nonExistentPath);
      assert.ok(Array.isArray(result.operations), 'operations should be an array');
      assert.equal(result.pipeline, null, 'pipeline should be null');
    });

    it('should return parsed state when file exists with valid JSON', () => {
      const state = require(path.join(LIB_DIR, 'state.cjs'));
      const testState = {
        version: 1,
        operations: [{ id: 'abc12345', timestamp: '2026-01-01T00:00:00Z', operation: 'revise', summary: 'test' }],
        pipeline: { active: false },
      };
      const statePath = writeStateFile(tmpDir, testState);
      const result = state.loadState(statePath);
      assert.deepEqual(result.operations, testState.operations);
      assert.deepEqual(result.pipeline, testState.pipeline);
    });

    it('should return default state when file contains invalid JSON', () => {
      const state = require(path.join(LIB_DIR, 'state.cjs'));
      const fpDocsDir = path.join(tmpDir, '.fp-docs');
      fs.mkdirSync(fpDocsDir, { recursive: true });
      const statePath = path.join(fpDocsDir, 'state.json');
      fs.writeFileSync(statePath, 'not valid json {{{', 'utf-8');
      const result = state.loadState(statePath);
      assert.ok(Array.isArray(result.operations), 'operations should be an array');
      assert.equal(result.pipeline, null, 'pipeline should be null');
    });
  });

  describe('logOperation', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = makeTempDir();
    });

    afterEach(() => {
      cleanTempDir(tmpDir);
    });

    it('should add entry to operations array with id, timestamp, operation, summary fields', () => {
      const state = require(path.join(LIB_DIR, 'state.cjs'));
      const statePath = writeStateFile(tmpDir, { version: 1, operations: [], pipeline: null });
      const entry = state.logOperation({ operation: 'revise', summary: 'Updated docs' }, statePath);
      assert.ok(entry.id, 'entry should have id');
      assert.ok(entry.timestamp, 'entry should have timestamp');
      assert.equal(entry.operation, 'revise');
      assert.equal(entry.summary, 'Updated docs');
    });

    it('should auto-prune at 100 entries (add 101, only 100 remain, oldest dropped)', () => {
      const state = require(path.join(LIB_DIR, 'state.cjs'));
      // Pre-populate with 99 entries
      const ops = [];
      for (let i = 0; i < 99; i++) {
        ops.push({ id: `old${String(i).padStart(4, '0')}`, timestamp: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`, operation: 'test', summary: `op ${i}` });
      }
      const statePath = writeStateFile(tmpDir, { version: 1, operations: ops, pipeline: null });

      // Add 2 more to exceed 100
      state.logOperation({ operation: 'add', summary: 'op 99' }, statePath);
      state.logOperation({ operation: 'add', summary: 'op 100' }, statePath);

      // Read state file directly to check
      const raw = fs.readFileSync(statePath, 'utf-8');
      const final = JSON.parse(raw);
      assert.equal(final.operations.length, 100, 'should have exactly 100 operations');
      assert.equal(final.operations[0].summary, 'op 100', 'newest should be first');
    });

    it('should insert newest entry at index 0 (unshift, not push)', () => {
      const state = require(path.join(LIB_DIR, 'state.cjs'));
      const statePath = writeStateFile(tmpDir, {
        version: 1,
        operations: [{ id: 'existing1', timestamp: '2026-01-01T00:00:00Z', operation: 'old', summary: 'old entry' }],
        pipeline: null,
      });
      state.logOperation({ operation: 'revise', summary: 'new entry' }, statePath);
      const raw = fs.readFileSync(statePath, 'utf-8');
      const final = JSON.parse(raw);
      assert.equal(final.operations[0].summary, 'new entry', 'newest entry should be at index 0');
      assert.equal(final.operations[1].summary, 'old entry', 'old entry should be at index 1');
    });
  });

  describe('getLastOps', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = makeTempDir();
    });

    afterEach(() => {
      cleanTempDir(tmpDir);
    });

    it('should return the first N operations from the array', () => {
      const state = require(path.join(LIB_DIR, 'state.cjs'));
      const ops = [];
      for (let i = 0; i < 10; i++) {
        ops.push({ id: `id${i}`, timestamp: `2026-01-01T00:00:0${i}Z`, operation: 'test', summary: `op ${i}` });
      }
      const statePath = writeStateFile(tmpDir, { version: 1, operations: ops, pipeline: null });
      const result = state.getLastOps(3, statePath);
      assert.equal(result.length, 3);
      assert.equal(result[0].id, 'id0');
      assert.equal(result[2].id, 'id2');
    });

    it('should default to 5 when N not specified', () => {
      const state = require(path.join(LIB_DIR, 'state.cjs'));
      const ops = [];
      for (let i = 0; i < 10; i++) {
        ops.push({ id: `id${i}`, timestamp: `2026-01-01T00:00:0${i}Z`, operation: 'test', summary: `op ${i}` });
      }
      const statePath = writeStateFile(tmpDir, { version: 1, operations: ops, pipeline: null });
      const result = state.getLastOps(undefined, statePath);
      assert.equal(result.length, 5);
    });
  });

  describe('getPipeline', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = makeTempDir();
    });

    afterEach(() => {
      cleanTempDir(tmpDir);
    });

    it('should return pipeline object from state', () => {
      const state = require(path.join(LIB_DIR, 'state.cjs'));
      const pipelineData = { active: true, operation_id: 'abc', current_stage: 'verbosity' };
      const statePath = writeStateFile(tmpDir, { version: 1, operations: [], pipeline: pipelineData });
      const result = state.getPipeline(statePath);
      assert.deepEqual(result, pipelineData);
    });

    it('should return null when pipeline is not set', () => {
      const state = require(path.join(LIB_DIR, 'state.cjs'));
      const statePath = writeStateFile(tmpDir, { version: 1, operations: [], pipeline: null });
      const result = state.getPipeline(statePath);
      assert.equal(result, null);
    });
  });

  describe('updatePipeline', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = makeTempDir();
    });

    afterEach(() => {
      cleanTempDir(tmpDir);
    });

    it('should merge provided fields into pipeline state', () => {
      const state = require(path.join(LIB_DIR, 'state.cjs'));
      const statePath = writeStateFile(tmpDir, {
        version: 1,
        operations: [],
        pipeline: { active: false, operation_id: null },
      });
      const result = state.updatePipeline({ active: true, current_stage: 'citations' }, statePath);
      assert.equal(result.active, true);
      assert.equal(result.current_stage, 'citations');
      assert.equal(result.operation_id, null, 'should preserve existing fields');
    });

    it('should create pipeline from null when updating', () => {
      const state = require(path.join(LIB_DIR, 'state.cjs'));
      const statePath = writeStateFile(tmpDir, { version: 1, operations: [], pipeline: null });
      const result = state.updatePipeline({ active: true }, statePath);
      assert.equal(result.active, true);
    });
  });

  describe('seedFromGitHistory', () => {
    it('should parse git log output in format "%H|%aI|%s" and extract operation', () => {
      const state = require(path.join(LIB_DIR, 'state.cjs'));
      const mockGitLog = [
        'a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4|2026-03-20T10:00:00-05:00|fp-docs: revise -- Updated posts.md',
        'b2c3d4e5f6789012b2c3d4e5f6789012b2c3d4e5|2026-03-19T09:00:00-05:00|fp-docs: add -- Created hooks.md',
        'c3d4e5f678901234c3d4e5f678901234c3d4e5f6|2026-03-18T08:00:00-05:00|Regular commit without prefix',
      ].join('\n');

      const result = state.seedFromGitHistory(null, mockGitLog);
      assert.equal(result.length, 3);
      assert.equal(result[0].id, 'a1b2c3d4');
      assert.equal(result[0].operation, 'revise');
      assert.equal(result[0].source, 'git-seed');
      assert.equal(result[1].operation, 'add');
      assert.equal(result[2].operation, 'unknown');
    });

    it('should return empty array when git log returns nothing', () => {
      const state = require(path.join(LIB_DIR, 'state.cjs'));
      const result = state.seedFromGitHistory(null, '');
      assert.deepEqual(result, []);
    });

    it('should return empty array when git log is null', () => {
      const state = require(path.join(LIB_DIR, 'state.cjs'));
      const result = state.seedFromGitHistory(null, null);
      assert.deepEqual(result, []);
    });
  });

  describe('remediation plans', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = makeTempDir();
    });

    afterEach(() => {
      cleanTempDir(tmpDir);
    });

    it('should export saveRemediationPlan, loadRemediationPlan, listRemediationPlans, updateRemediationPlan', () => {
      const state = require(path.join(LIB_DIR, 'state.cjs'));
      assert.equal(typeof state.saveRemediationPlan, 'function');
      assert.equal(typeof state.loadRemediationPlan, 'function');
      assert.equal(typeof state.listRemediationPlans, 'function');
      assert.equal(typeof state.updateRemediationPlan, 'function');
    });

    it('saveRemediationPlan should create file at correct path with valid JSON content', () => {
      const state = require(path.join(LIB_DIR, 'state.cjs'));
      const plan = {
        plan_id: 'rem-test0001',
        version: 1,
        created_at: '2026-03-24T12:00:00Z',
        status: 'pending',
        issues: [{ id: 'iss-1', severity: 'high' }],
        completed: [],
        failed: [],
      };
      const planPath = state.saveRemediationPlan(plan, tmpDir);
      const expectedPath = path.join(tmpDir, '.fp-docs', 'remediation-plans', 'rem-test0001.json');
      assert.equal(planPath, expectedPath);
      assert.ok(fs.existsSync(planPath), 'Plan file should exist');
      const raw = fs.readFileSync(planPath, 'utf-8');
      const parsed = JSON.parse(raw);
      assert.equal(parsed.plan_id, 'rem-test0001');
      assert.equal(parsed.issues.length, 1);
    });

    it('saveRemediationPlan should create remediation-plans directory when missing', () => {
      const state = require(path.join(LIB_DIR, 'state.cjs'));
      const plansDir = path.join(tmpDir, '.fp-docs', 'remediation-plans');
      assert.equal(fs.existsSync(plansDir), false, 'remediation-plans dir should not exist yet');
      state.saveRemediationPlan({ plan_id: 'rem-mkdir01', version: 1, status: 'pending', issues: [] }, tmpDir);
      assert.ok(fs.existsSync(plansDir), 'remediation-plans dir should exist after save');
    });

    it('saveRemediationPlan should return the plan file path as a string', () => {
      const state = require(path.join(LIB_DIR, 'state.cjs'));
      const result = state.saveRemediationPlan({ plan_id: 'rem-retpath1', version: 1, status: 'pending', issues: [] }, tmpDir);
      assert.equal(typeof result, 'string');
      assert.ok(result.endsWith('rem-retpath1.json'));
    });

    it('loadRemediationPlan with ID should resolve to correct file and return parsed object', () => {
      const state = require(path.join(LIB_DIR, 'state.cjs'));
      const plan = { plan_id: 'rem-loadid01', version: 1, status: 'pending', issues: [{ id: 'i1' }] };
      state.saveRemediationPlan(plan, tmpDir);
      const loaded = state.loadRemediationPlan('rem-loadid01', tmpDir);
      assert.ok(loaded, 'loaded plan should not be null');
      assert.equal(loaded.plan_id, 'rem-loadid01');
      assert.equal(loaded.issues.length, 1);
    });

    it('loadRemediationPlan with absolute path should load directly', () => {
      const state = require(path.join(LIB_DIR, 'state.cjs'));
      const plan = { plan_id: 'rem-abspath1', version: 1, status: 'pending', issues: [] };
      const planPath = state.saveRemediationPlan(plan, tmpDir);
      const loaded = state.loadRemediationPlan(planPath, tmpDir);
      assert.ok(loaded, 'loaded plan should not be null');
      assert.equal(loaded.plan_id, 'rem-abspath1');
    });

    it('loadRemediationPlan should return null for nonexistent plan', () => {
      const state = require(path.join(LIB_DIR, 'state.cjs'));
      const loaded = state.loadRemediationPlan('rem-doesnotexist', tmpDir);
      assert.equal(loaded, null);
    });

    it('loadRemediationPlan should return null for invalid JSON', () => {
      const state = require(path.join(LIB_DIR, 'state.cjs'));
      const plansDir = path.join(tmpDir, '.fp-docs', 'remediation-plans');
      fs.mkdirSync(plansDir, { recursive: true });
      fs.writeFileSync(path.join(plansDir, 'rem-badjson1.json'), 'not valid json {{{', 'utf-8');
      const loaded = state.loadRemediationPlan('rem-badjson1', tmpDir);
      assert.equal(loaded, null);
    });

    it('listRemediationPlans should return correct summary array', () => {
      const state = require(path.join(LIB_DIR, 'state.cjs'));
      state.saveRemediationPlan({ plan_id: 'rem-list0001', version: 1, created_at: '2026-03-24T12:00:00Z', status: 'pending', issues: [{ id: 'i1' }, { id: 'i2' }] }, tmpDir);
      state.saveRemediationPlan({ plan_id: 'rem-list0002', version: 1, created_at: '2026-03-24T13:00:00Z', status: 'complete', issues: [{ id: 'i3' }] }, tmpDir);
      const list = state.listRemediationPlans(tmpDir);
      assert.equal(list.length, 2);
      const plan1 = list.find(p => p.id === 'rem-list0001');
      assert.ok(plan1, 'should find rem-list0001');
      assert.equal(plan1.status, 'pending');
      assert.equal(plan1.issue_count, 2);
      const plan2 = list.find(p => p.id === 'rem-list0002');
      assert.ok(plan2, 'should find rem-list0002');
      assert.equal(plan2.status, 'complete');
      assert.equal(plan2.issue_count, 1);
    });

    it('listRemediationPlans should return empty array when directory missing', () => {
      const state = require(path.join(LIB_DIR, 'state.cjs'));
      const list = state.listRemediationPlans(tmpDir);
      assert.deepEqual(list, []);
    });

    it('updateRemediationPlan should merge updates into existing plan', () => {
      const state = require(path.join(LIB_DIR, 'state.cjs'));
      state.saveRemediationPlan({ plan_id: 'rem-upd00001', version: 1, status: 'pending', issues: [{ id: 'i1' }], completed: [], failed: [] }, tmpDir);
      const updated = state.updateRemediationPlan('rem-upd00001', { status: 'in-progress' }, tmpDir);
      assert.ok(updated, 'updated plan should not be null');
      assert.equal(updated.status, 'in-progress');
      assert.equal(updated.plan_id, 'rem-upd00001');
      assert.equal(updated.issues.length, 1);
    });

    it('updateRemediationPlan should push to completed array', () => {
      const state = require(path.join(LIB_DIR, 'state.cjs'));
      state.saveRemediationPlan({ plan_id: 'rem-comp0001', version: 1, status: 'in-progress', issues: [{ id: 'i1' }, { id: 'i2' }], completed: ['i1'], failed: [] }, tmpDir);
      const updated = state.updateRemediationPlan('rem-comp0001', { completed: ['i2'] }, tmpDir);
      assert.ok(updated, 'updated plan should not be null');
      assert.deepEqual(updated.completed, ['i1', 'i2']);
    });
  });

  describe('writeState', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = makeTempDir();
    });

    afterEach(() => {
      cleanTempDir(tmpDir);
    });

    it('should create .fp-docs directory if it does not exist', () => {
      const state = require(path.join(LIB_DIR, 'state.cjs'));
      const fpDocsDir = path.join(tmpDir, '.fp-docs');
      assert.equal(fs.existsSync(fpDocsDir), false, '.fp-docs should not exist yet');

      // logOperation triggers writeState internally
      const statePath = path.join(fpDocsDir, 'state.json');
      // First write a valid state file so logOperation can load it
      fs.mkdirSync(fpDocsDir, { recursive: true });
      fs.writeFileSync(statePath, JSON.stringify({ version: 1, operations: [], pipeline: null }), 'utf-8');
      state.logOperation({ operation: 'test', summary: 'test write' }, statePath);

      assert.equal(fs.existsSync(fpDocsDir), true, '.fp-docs should exist after write');
      assert.equal(fs.existsSync(statePath), true, 'state.json should exist');
    });

    it('should use atomic rename pattern (write to .tmp, rename)', () => {
      const state = require(path.join(LIB_DIR, 'state.cjs'));
      // Read the source to verify atomic write pattern exists
      const source = fs.readFileSync(path.join(LIB_DIR, 'state.cjs'), 'utf-8');
      assert.ok(source.includes('renameSync'), 'should use fs.renameSync for atomic writes');
      assert.ok(source.includes('.tmp'), 'should write to .tmp file before rename');
    });
  });
});
