'use strict';

// Tests for lib/pipeline.cjs
// TDD RED phase: These tests should fail until the module is implemented.

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const LIB_DIR = path.resolve(__dirname, '..', '..', 'lib');
const CONFIG_PATH = path.resolve(__dirname, '..', '..', 'config.json');
const FP_TOOLS_PATH = path.resolve(__dirname, '..', '..', 'fp-tools.cjs');
const PLUGIN_DIR = path.resolve(__dirname, '..', '..');

// ── Test Helpers ──────────────────────────────────────────────────────────────

/**
 * Create a unique temp directory for isolated state file I/O.
 */
function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fp-pipeline-test-'));
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
 */
function writeStateFile(tmpDir, state) {
  const fpDocsDir = path.join(tmpDir, '.fp-docs');
  fs.mkdirSync(fpDocsDir, { recursive: true });
  const statePath = path.join(fpDocsDir, 'state.json');
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
  return statePath;
}

// ── Config Extension Tests ────────────────────────────────────────────────────

describe('lib/pipeline.cjs', () => {

  describe('config.json pipeline extensions', () => {
    let config;

    beforeEach(() => {
      // Load fresh config each time
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      config = JSON.parse(raw);
    });

    it('should have pipeline.triggerMatrix defined', () => {
      assert.ok(config.pipeline.triggerMatrix, 'triggerMatrix should exist');
      assert.equal(typeof config.pipeline.triggerMatrix, 'object');
    });

    it('should map revise to all 8 stages', () => {
      assert.deepEqual(config.pipeline.triggerMatrix['revise'], [1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it('should map citations-generate to stages 4-8', () => {
      assert.deepEqual(config.pipeline.triggerMatrix['citations-generate'], [4, 5, 6, 7, 8]);
    });

    it('should map api-refs-generate to stages 1, 2, 4-8', () => {
      assert.deepEqual(config.pipeline.triggerMatrix['api-refs-generate'], [1, 2, 4, 5, 6, 7, 8]);
    });

    it('should map locals-annotate to stages 1, 2, 4-8', () => {
      assert.deepEqual(config.pipeline.triggerMatrix['locals-annotate'], [1, 2, 4, 5, 6, 7, 8]);
    });

    it('should have skipConditions for stage 1 with configKey and flagOverride', () => {
      const cond = config.pipeline.skipConditions['1'];
      assert.ok(cond, 'skipConditions for stage 1 should exist');
      assert.equal(cond.configKey, 'system.verbosity.enabled');
      assert.equal(cond.flagOverride, '--no-verbosity');
    });

    it('should have skipConditions for stage 5 with never_skip: true', () => {
      const cond = config.pipeline.skipConditions['5'];
      assert.ok(cond, 'skipConditions for stage 5 should exist');
      assert.equal(cond.never_skip, true);
    });

    it('should have skipConditions for stage 6 with never_skip: true', () => {
      const cond = config.pipeline.skipConditions['6'];
      assert.ok(cond, 'skipConditions for stage 6 should exist');
      assert.equal(cond.never_skip, true);
    });

    it('should have skipConditions for stage 7 with structural_only and flagOverride', () => {
      const cond = config.pipeline.skipConditions['7'];
      assert.ok(cond, 'skipConditions for stage 7 should exist');
      assert.equal(cond.structural_only, true);
      assert.equal(cond.flagOverride, '--no-index');
    });

    it('should have skipConditions for stage 8 with never_skip: true', () => {
      const cond = config.pipeline.skipConditions['8'];
      assert.ok(cond, 'skipConditions for stage 8 should exist');
      assert.equal(cond.never_skip, true);
    });
  });

  describe('module exports', () => {
    it('should be requireable', () => {
      const pipeline = require(path.join(LIB_DIR, 'pipeline.cjs'));
      assert.ok(pipeline);
    });

    it('should export cmdPipeline, initPipeline, getNextAction, getStatus, resetPipeline, shouldSkipStage, resolveStages', () => {
      const pipeline = require(path.join(LIB_DIR, 'pipeline.cjs'));
      assert.equal(typeof pipeline.cmdPipeline, 'function');
      assert.equal(typeof pipeline.initPipeline, 'function');
      assert.equal(typeof pipeline.getNextAction, 'function');
      assert.equal(typeof pipeline.getStatus, 'function');
      assert.equal(typeof pipeline.resetPipeline, 'function');
      assert.equal(typeof pipeline.shouldSkipStage, 'function');
      assert.equal(typeof pipeline.resolveStages, 'function');
    });
  });

  describe('resolveStages', () => {
    it('should return 8 stage objects for revise with all applicable: true (structural context)', () => {
      const { resolveStages } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      // structural: true needed for stage 7 (index) which has structural_only skip condition
      const stages = resolveStages('revise', [], { structural: true });
      assert.equal(stages.length, 8);
      for (const stage of stages) {
        assert.equal(stage.applicable, true, `stage ${stage.id} (${stage.name}) should be applicable`);
      }
    });

    it('should return 8 stage objects for revise with stage 7 not applicable when no structural context', () => {
      const { resolveStages } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const stages = resolveStages('revise', []);
      assert.equal(stages.length, 8);
      const stage7 = stages.find(s => s.id === 7);
      assert.equal(stage7.applicable, false, 'stage 7 should not be applicable without structural context');
      // All other stages should be applicable
      const others = stages.filter(s => s.id !== 7);
      for (const stage of others) {
        assert.equal(stage.applicable, true, `stage ${stage.id} (${stage.name}) should be applicable`);
      }
    });

    it('should return 8 stage objects for citations-generate with stages 1,2,3 not applicable', () => {
      const { resolveStages } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      // structural: true so stage 7 is applicable (testing trigger matrix, not skip conditions)
      const stages = resolveStages('citations-generate', [], { structural: true });
      assert.equal(stages.length, 8);
      assert.equal(stages[0].applicable, false, 'stage 1 should not be applicable');
      assert.equal(stages[1].applicable, false, 'stage 2 should not be applicable');
      assert.equal(stages[2].applicable, false, 'stage 3 should not be applicable');
      for (let i = 3; i < 8; i++) {
        assert.equal(stages[i].applicable, true, `stage ${stages[i].id} should be applicable`);
      }
    });

    it('should return stage 1 with applicable: false when --no-verbosity flag is set', () => {
      const { resolveStages } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const stages = resolveStages('revise', ['--no-verbosity']);
      const stage1 = stages.find(s => s.id === 1);
      assert.equal(stage1.applicable, false, 'stage 1 should not be applicable with --no-verbosity');
    });

    it('should return stage 4 with applicable: false when --no-sanity-check flag is set', () => {
      const { resolveStages } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const stages = resolveStages('revise', ['--no-sanity-check']);
      const stage4 = stages.find(s => s.id === 4);
      assert.equal(stage4.applicable, false, 'stage 4 should not be applicable with --no-sanity-check');
    });

    it('should return stage 7 with applicable: false when --no-index flag is set', () => {
      const { resolveStages } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const stages = resolveStages('revise', ['--no-index']);
      const stage7 = stages.find(s => s.id === 7);
      assert.equal(stage7.applicable, false, 'stage 7 should not be applicable with --no-index');
    });

    it('should return empty array for unknown operation', () => {
      const { resolveStages } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const stages = resolveStages('unknown-operation', []);
      assert.equal(stages.length, 0, 'unknown operation should return empty array');
    });
  });

  describe('shouldSkipStage', () => {
    it('should return skip: false for stage 1 when verbosity is enabled', () => {
      const { shouldSkipStage } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const result = shouldSkipStage(1, { flags: [] });
      assert.equal(result.skip, false);
    });

    it('should return skip: true for stage 1 when --no-verbosity flag is set', () => {
      const { shouldSkipStage } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const result = shouldSkipStage(1, { flags: ['--no-verbosity'] });
      assert.equal(result.skip, true);
      assert.ok(result.reason.includes('flag'), 'reason should mention flag');
    });

    it('should return skip: false for stage 5 (never_skip)', () => {
      const { shouldSkipStage } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const result = shouldSkipStage(5, { flags: [] });
      assert.equal(result.skip, false);
    });

    it('should return skip: false for stage 6 (never_skip)', () => {
      const { shouldSkipStage } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const result = shouldSkipStage(6, { flags: [] });
      assert.equal(result.skip, false);
    });

    it('should return skip: true for stage 7 when structural is false', () => {
      const { shouldSkipStage } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const result = shouldSkipStage(7, { flags: [], structural: false });
      assert.equal(result.skip, true);
      assert.ok(result.reason.includes('structural'), 'reason should mention structural');
    });

    it('should return skip: false for stage 7 when structural is true', () => {
      const { shouldSkipStage } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const result = shouldSkipStage(7, { flags: [], structural: true });
      assert.equal(result.skip, false);
    });
  });

  describe('initPipeline', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = makeTempDir();
    });

    afterEach(() => {
      cleanTempDir(tmpDir);
    });

    it('should return pipeline state with operation, stages, and pipeline_id', () => {
      const { initPipeline } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const statePath = writeStateFile(tmpDir, { version: 1, operations: [], pipeline: null });
      const result = initPipeline({
        operation: 'revise',
        files: ['docs/06-helpers/posts.md'],
        flags: [],
      }, statePath);
      assert.equal(result.operation, 'revise');
      assert.ok(result.pipeline_id, 'should have pipeline_id');
      assert.equal(result.pipeline_id.length, 8, 'pipeline_id should be 8 chars');
      assert.equal(result.stages.length, 8);
    });

    it('should write state via updatePipeline', () => {
      const { initPipeline } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const statePath = writeStateFile(tmpDir, { version: 1, operations: [], pipeline: null });
      initPipeline({
        operation: 'revise',
        files: ['docs/06-helpers/posts.md'],
        flags: [],
      }, statePath);

      // Read state file to verify pipeline was written
      const raw = fs.readFileSync(statePath, 'utf-8');
      const state = JSON.parse(raw);
      assert.ok(state.pipeline, 'pipeline should be set in state');
      assert.equal(state.pipeline.operation, 'revise');
    });

    it('should mark stages 1,2,3 as not applicable for citations-generate (with structural)', () => {
      const { initPipeline } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const statePath = writeStateFile(tmpDir, { version: 1, operations: [], pipeline: null });
      const result = initPipeline({
        operation: 'citations-generate',
        files: ['docs/06-helpers/posts.md'],
        flags: [],
        structural: true,
      }, statePath);
      const notApplicable = result.stages.filter(s => !s.applicable);
      assert.equal(notApplicable.length, 3, 'should have 3 not applicable stages');
      assert.ok(notApplicable.every(s => [1, 2, 3].includes(s.id)), 'stages 1,2,3 should not be applicable');
    });

    it('should mark stages 1,2,3 and 7 as not applicable for citations-generate (without structural)', () => {
      const { initPipeline } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const statePath = writeStateFile(tmpDir, { version: 1, operations: [], pipeline: null });
      const result = initPipeline({
        operation: 'citations-generate',
        files: ['docs/06-helpers/posts.md'],
        flags: [],
      }, statePath);
      const notApplicable = result.stages.filter(s => !s.applicable);
      assert.equal(notApplicable.length, 4, 'should have 4 not applicable stages without structural');
      const notApplicableIds = notApplicable.map(s => s.id).sort();
      assert.deepEqual(notApplicableIds, [1, 2, 3, 7]);
    });
  });

  describe('getNextAction', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = makeTempDir();
    });

    afterEach(() => {
      cleanTempDir(tmpDir);
    });

    it('should return spawn action for stage 1 after init with revise', () => {
      const { initPipeline, getNextAction } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const statePath = writeStateFile(tmpDir, { version: 1, operations: [], pipeline: null });
      initPipeline({ operation: 'revise', files: ['docs/test.md'], flags: [] }, statePath);
      const action = getNextAction(statePath);
      assert.equal(action.action, 'spawn');
      assert.equal(action.stage.id, 1);
      assert.equal(action.stage.name, 'verbosity');
    });

    it('should return execute action for stage 6 after stages 1-5 completed', () => {
      const { initPipeline, getNextAction } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const statePath = writeStateFile(tmpDir, { version: 1, operations: [], pipeline: null });
      initPipeline({ operation: 'revise', files: ['docs/test.md'], flags: [] }, statePath);

      // Simulate stages 1-5 completed by updating pipeline state
      const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
      state.pipeline.stage_1_status = 'PASS';
      state.pipeline.stage_2_status = 'PASS';
      state.pipeline.stage_3_status = 'PASS';
      state.pipeline.stage_4_status = 'PASS';
      state.pipeline.stage_5_status = 'PASS';
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');

      const action = getNextAction(statePath);
      assert.equal(action.action, 'execute');
      assert.equal(action.stage.id, 6);
      assert.equal(action.stage.name, 'changelog');
    });

    it('should return complete action when all 8 stages are done', () => {
      const { initPipeline, getNextAction } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const statePath = writeStateFile(tmpDir, { version: 1, operations: [], pipeline: null });
      initPipeline({ operation: 'revise', files: ['docs/test.md'], flags: [] }, statePath);

      // Simulate all stages completed
      const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
      for (let i = 1; i <= 8; i++) {
        state.pipeline[`stage_${i}_status`] = 'PASS';
      }
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');

      const action = getNextAction(statePath);
      assert.equal(action.action, 'complete');
      assert.ok(action.summary, 'should have summary');
      assert.ok(typeof action.summary.stages_run === 'number', 'summary should have stages_run');
    });

    it('should skip non-applicable stages and go to next applicable stage', () => {
      const { initPipeline, getNextAction } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const statePath = writeStateFile(tmpDir, { version: 1, operations: [], pipeline: null });
      initPipeline({ operation: 'citations-generate', files: ['docs/test.md'], flags: [] }, statePath);

      // Stages 1,2,3 not applicable. Next should be stage 4.
      const action = getNextAction(statePath);
      assert.equal(action.stage.id, 4);
      assert.equal(action.stage.name, 'sanity-check');
    });

    it('should return blocked action when a stage has HALLUCINATION status', () => {
      const { initPipeline, getNextAction } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const statePath = writeStateFile(tmpDir, { version: 1, operations: [], pipeline: null });
      initPipeline({ operation: 'revise', files: ['docs/test.md'], flags: [] }, statePath);

      // Stage 1 passed, stage 2 passed, stage 3 passed, stage 4 detected hallucination
      const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
      state.pipeline.stage_1_status = 'PASS';
      state.pipeline.stage_2_status = 'PASS';
      state.pipeline.stage_3_status = 'PASS';
      state.pipeline.stage_4_status = 'HALLUCINATION';
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');

      const action = getNextAction(statePath);
      assert.equal(action.action, 'blocked');
      assert.ok(action.diagnostic, 'should have diagnostic');
      assert.ok(action.diagnostic.includes('HALLUCINATION'), 'diagnostic should mention HALLUCINATION');
    });
  });

  describe('getStatus', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = makeTempDir();
    });

    afterEach(() => {
      cleanTempDir(tmpDir);
    });

    it('should return null when no pipeline is active', () => {
      const { getStatus } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const statePath = writeStateFile(tmpDir, { version: 1, operations: [], pipeline: null });
      const result = getStatus(statePath);
      assert.equal(result, null);
    });

    it('should return status object after init', () => {
      const { initPipeline, getStatus } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const statePath = writeStateFile(tmpDir, { version: 1, operations: [], pipeline: null });
      initPipeline({ operation: 'revise', files: ['docs/test.md'], flags: [] }, statePath);
      const status = getStatus(statePath);
      assert.ok(status, 'status should not be null');
      assert.equal(status.operation, 'revise');
      assert.equal(status.stages_completed, 0);
      assert.equal(status.stages_total, 8);
    });
  });

  describe('resetPipeline', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = makeTempDir();
    });

    afterEach(() => {
      cleanTempDir(tmpDir);
    });

    it('should set pipeline state to null', () => {
      const { initPipeline, resetPipeline } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const statePath = writeStateFile(tmpDir, { version: 1, operations: [], pipeline: null });
      initPipeline({ operation: 'revise', files: ['docs/test.md'], flags: [] }, statePath);

      resetPipeline(statePath);

      const raw = fs.readFileSync(statePath, 'utf-8');
      const state = JSON.parse(raw);
      assert.equal(state.pipeline, null, 'pipeline should be null after reset');
    });

    it('should make getStatus return null after reset', () => {
      const { initPipeline, resetPipeline, getStatus } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const statePath = writeStateFile(tmpDir, { version: 1, operations: [], pipeline: null });
      initPipeline({ operation: 'revise', files: ['docs/test.md'], flags: [] }, statePath);
      resetPipeline(statePath);
      const status = getStatus(statePath);
      assert.equal(status, null);
    });
  });

  describe('state.cjs clearPipeline', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = makeTempDir();
    });

    afterEach(() => {
      cleanTempDir(tmpDir);
    });

    it('should export clearPipeline function', () => {
      const state = require(path.join(LIB_DIR, 'state.cjs'));
      assert.equal(typeof state.clearPipeline, 'function');
    });

    it('should set pipeline to null in state file', () => {
      const state = require(path.join(LIB_DIR, 'state.cjs'));
      const statePath = writeStateFile(tmpDir, {
        version: 1,
        operations: [],
        pipeline: { active: true, operation: 'revise' },
      });
      state.clearPipeline(statePath);

      const raw = fs.readFileSync(statePath, 'utf-8');
      const data = JSON.parse(raw);
      assert.equal(data.pipeline, null, 'pipeline should be null after clearPipeline');
    });
  });

  // ── Plan 02: Deterministic Stage Executors ──────────────────────────────────

  describe('module exports (Plan 02 additions)', () => {
    it('should export executeChangelog, evaluateIndexSkip, executeDocsCommit', () => {
      const pipeline = require(path.join(LIB_DIR, 'pipeline.cjs'));
      assert.equal(typeof pipeline.executeChangelog, 'function');
      assert.equal(typeof pipeline.evaluateIndexSkip, 'function');
      assert.equal(typeof pipeline.executeDocsCommit, 'function');
    });
  });

  describe('executeChangelog', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = makeTempDir();
    });

    afterEach(() => {
      cleanTempDir(tmpDir);
    });

    it('should produce entry with date and operation title', () => {
      const { executeChangelog } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const changelogPath = path.join(tmpDir, 'changelog.md');
      fs.writeFileSync(changelogPath, '# Changelog\n', 'utf-8');
      const today = new Date().toISOString().slice(0, 10);
      const result = executeChangelog({
        operation: 'revise',
        files_modified: ['docs/06-helpers/posts.md'],
        changelog_summary: 'Updated posts helper after signature change',
      }, null, changelogPath);
      assert.equal(result.status, 'completed');
      assert.equal(result.entry_added, true);
      const content = fs.readFileSync(changelogPath, 'utf-8');
      assert.ok(content.includes('### ' + today + ' -- Revise'), 'should contain dated heading with Revise title');
    });

    it('should contain Files changed and file path with modified action', () => {
      const { executeChangelog } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const changelogPath = path.join(tmpDir, 'changelog.md');
      fs.writeFileSync(changelogPath, '# Changelog\n', 'utf-8');
      executeChangelog({
        operation: 'revise',
        files_modified: ['docs/06-helpers/posts.md'],
        changelog_summary: 'Updated posts helper after signature change',
      }, null, changelogPath);
      const content = fs.readFileSync(changelogPath, 'utf-8');
      assert.ok(content.includes('- **Files changed**:'), 'should contain Files changed marker');
      assert.ok(content.includes('`docs/06-helpers/posts.md` (modified)'), 'should contain file path with modified action');
    });

    it('should contain summary text', () => {
      const { executeChangelog } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const changelogPath = path.join(tmpDir, 'changelog.md');
      fs.writeFileSync(changelogPath, '# Changelog\n', 'utf-8');
      executeChangelog({
        operation: 'revise',
        files_modified: ['docs/06-helpers/posts.md'],
        changelog_summary: 'Updated posts helper after signature change',
      }, null, changelogPath);
      const content = fs.readFileSync(changelogPath, 'utf-8');
      assert.ok(content.includes('- **Summary**: Updated posts helper after signature change'), 'should contain summary line');
    });

    it('should fall back to operation + files when changelog_summary is missing', () => {
      const { executeChangelog } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const changelogPath = path.join(tmpDir, 'changelog.md');
      fs.writeFileSync(changelogPath, '# Changelog\n', 'utf-8');
      executeChangelog({
        operation: 'revise',
        files_modified: ['docs/06-helpers/posts.md'],
      }, null, changelogPath);
      const content = fs.readFileSync(changelogPath, 'utf-8');
      assert.ok(content.includes('- **Summary**: revise -- docs/06-helpers/posts.md'), 'should fall back to operation + file path');
    });

    it('should list multiple files in the entry', () => {
      const { executeChangelog } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const changelogPath = path.join(tmpDir, 'changelog.md');
      fs.writeFileSync(changelogPath, '# Changelog\n', 'utf-8');
      executeChangelog({
        operation: 'revise',
        files_modified: ['docs/06-helpers/posts.md', 'docs/06-helpers/meta.md'],
        changelog_summary: 'Updated helpers',
      }, null, changelogPath);
      const content = fs.readFileSync(changelogPath, 'utf-8');
      assert.ok(content.includes('`docs/06-helpers/posts.md` (modified)'), 'should list first file');
      assert.ok(content.includes('`docs/06-helpers/meta.md` (modified)'), 'should list second file');
    });

    it('should use created or removed labels for file action objects', () => {
      const { executeChangelog } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const changelogPath = path.join(tmpDir, 'changelog.md');
      fs.writeFileSync(changelogPath, '# Changelog\n', 'utf-8');
      executeChangelog({
        operation: 'add',
        files_modified: [
          { path: 'docs/new-file.md', action: 'created' },
          { path: 'docs/old-file.md', action: 'removed' },
        ],
        changelog_summary: 'Added new, removed old',
      }, null, changelogPath);
      const content = fs.readFileSync(changelogPath, 'utf-8');
      assert.ok(content.includes('`docs/new-file.md` (created)'), 'should show created label');
      assert.ok(content.includes('`docs/old-file.md` (removed)'), 'should show removed label');
    });

    it('should produce correct month header format', () => {
      const { executeChangelog } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const changelogPath = path.join(tmpDir, 'changelog.md');
      fs.writeFileSync(changelogPath, '# Changelog\n', 'utf-8');
      executeChangelog({
        operation: 'revise',
        files_modified: ['docs/test.md'],
        changelog_summary: 'Test',
      }, null, changelogPath);
      const content = fs.readFileSync(changelogPath, 'utf-8');
      const now = new Date();
      const expectedHeader = `## ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      assert.ok(content.includes(expectedHeader), 'should contain month header');
    });

    it('should not duplicate month header when it already exists', () => {
      const { executeChangelog } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const changelogPath = path.join(tmpDir, 'changelog.md');
      const now = new Date();
      const monthHeader = `## ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      fs.writeFileSync(changelogPath, `# Changelog\n\n${monthHeader}\n\n### 2026-03-22 -- Old Entry\n\n- **Summary**: old\n`, 'utf-8');
      executeChangelog({
        operation: 'revise',
        files_modified: ['docs/test.md'],
        changelog_summary: 'New entry',
      }, null, changelogPath);
      const content = fs.readFileSync(changelogPath, 'utf-8');
      // Use regex to match '## YYYY-MM' at start of line (not '### YYYY-MM-DD' which also contains '## YYYY-MM')
      const headerMatches = content.match(new RegExp('^' + monthHeader.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'gm'));
      assert.equal(headerMatches ? headerMatches.length : 0, 1, 'should have exactly one month header, not a duplicate');
    });

    it('should add new month header when not present', () => {
      const { executeChangelog } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const changelogPath = path.join(tmpDir, 'changelog.md');
      // Changelog with a different (older) month header
      fs.writeFileSync(changelogPath, '# Changelog\n\n## 2025-01\n\n### 2025-01-15 -- Old\n\n- **Summary**: old\n', 'utf-8');
      executeChangelog({
        operation: 'revise',
        files_modified: ['docs/test.md'],
        changelog_summary: 'New entry',
      }, null, changelogPath);
      const content = fs.readFileSync(changelogPath, 'utf-8');
      const now = new Date();
      const expectedHeader = `## ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      assert.ok(content.includes(expectedHeader), 'should contain new month header');
      assert.ok(content.includes('## 2025-01'), 'should preserve old month header');
    });
  });

  describe('evaluateIndexSkip', () => {
    it('should return skip: false for created file', () => {
      const { evaluateIndexSkip } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const result = evaluateIndexSkip({
        files_modified: [{ path: 'docs/new.md', action: 'created' }],
      });
      assert.equal(result.skip, false);
      assert.ok(result.reason.includes('structural change'), 'reason should mention structural change');
      assert.ok(result.reason.includes('created'), 'reason should mention created');
    });

    it('should return skip: false for removed file', () => {
      const { evaluateIndexSkip } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const result = evaluateIndexSkip({
        files_modified: [{ path: 'docs/old.md', action: 'removed' }],
      });
      assert.equal(result.skip, false);
      assert.ok(result.reason.includes('structural change'), 'reason should mention structural change');
      assert.ok(result.reason.includes('removed'), 'reason should mention removed');
    });

    it('should return skip: true for only modified files', () => {
      const { evaluateIndexSkip } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const result = evaluateIndexSkip({
        files_modified: [{ path: 'docs/existing.md', action: 'modified' }],
      });
      assert.equal(result.skip, true);
      assert.ok(result.reason.includes('no structural changes'), 'reason should mention no structural changes');
    });

    it('should return skip: false when one created file exists among modified', () => {
      const { evaluateIndexSkip } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const result = evaluateIndexSkip({
        files_modified: [
          { path: 'docs/a.md', action: 'modified' },
          { path: 'docs/b.md', action: 'created' },
        ],
      });
      assert.equal(result.skip, false, 'one created file is enough to trigger index update');
    });

    it('should return skip: true for empty files_modified', () => {
      const { evaluateIndexSkip } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const result = evaluateIndexSkip({
        files_modified: [],
      });
      assert.equal(result.skip, true);
      assert.ok(result.reason.includes('no files modified'), 'reason should mention no files modified');
    });

    it('should return skip: true when files_modified is missing', () => {
      const { evaluateIndexSkip } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const result = evaluateIndexSkip({});
      assert.equal(result.skip, true);
      assert.ok(result.reason.includes('no files modified'), 'reason should mention no files modified');
    });
  });

  describe('executeDocsCommit', () => {
    it('should compose correct commit message', () => {
      const { executeDocsCommit } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      let capturedMessage = null;
      const mockGit = {
        commitDocs: (docsRoot, message, opts) => {
          capturedMessage = message;
          return { committed: true, branch: 'main', pushed: true };
        },
      };
      // Mock paths module to provide a valid docsRoot
      const originalPaths = require(path.join(LIB_DIR, 'paths.cjs'));
      const origGetCodebaseRoot = originalPaths.getCodebaseRoot;
      const origGetDocsRoot = originalPaths.getDocsRoot;
      originalPaths.getCodebaseRoot = () => '/fake/codebase';
      originalPaths.getDocsRoot = () => ({ path: '/fake/docs', exists: true, hasGit: true });
      try {
        const result = executeDocsCommit({
          operation: 'revise',
          changelog_summary: 'Updated posts helper after signature change',
          flags: [],
        }, mockGit);
        assert.equal(capturedMessage, 'fp-docs: revise -- Updated posts helper after signature change');
        assert.equal(result.status, 'committed');
      } finally {
        originalPaths.getCodebaseRoot = origGetCodebaseRoot;
        originalPaths.getDocsRoot = origGetDocsRoot;
      }
    });

    it('should pass offline flag when --offline is present', () => {
      const { executeDocsCommit } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      let capturedOpts = null;
      const mockGit = {
        commitDocs: (docsRoot, message, opts) => {
          capturedOpts = opts;
          return { committed: true, branch: 'main', pushed: false };
        },
      };
      const originalPaths = require(path.join(LIB_DIR, 'paths.cjs'));
      const origGetCodebaseRoot = originalPaths.getCodebaseRoot;
      const origGetDocsRoot = originalPaths.getDocsRoot;
      originalPaths.getCodebaseRoot = () => '/fake/codebase';
      originalPaths.getDocsRoot = () => ({ path: '/fake/docs', exists: true, hasGit: true });
      try {
        executeDocsCommit({
          operation: 'revise',
          changelog_summary: 'test',
          flags: ['--offline'],
        }, mockGit);
        assert.equal(capturedOpts.offline, true, 'offline should be true');
      } finally {
        originalPaths.getCodebaseRoot = origGetCodebaseRoot;
        originalPaths.getDocsRoot = origGetDocsRoot;
      }
    });

    it('should pass noPush flag when --no-push is present', () => {
      const { executeDocsCommit } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      let capturedOpts = null;
      const mockGit = {
        commitDocs: (docsRoot, message, opts) => {
          capturedOpts = opts;
          return { committed: true, branch: 'main', pushed: false };
        },
      };
      const originalPaths = require(path.join(LIB_DIR, 'paths.cjs'));
      const origGetCodebaseRoot = originalPaths.getCodebaseRoot;
      const origGetDocsRoot = originalPaths.getDocsRoot;
      originalPaths.getCodebaseRoot = () => '/fake/codebase';
      originalPaths.getDocsRoot = () => ({ path: '/fake/docs', exists: true, hasGit: true });
      try {
        executeDocsCommit({
          operation: 'revise',
          changelog_summary: 'test',
          flags: ['--no-push'],
        }, mockGit);
        assert.equal(capturedOpts.noPush, true, 'noPush should be true');
      } finally {
        originalPaths.getCodebaseRoot = origGetCodebaseRoot;
        originalPaths.getDocsRoot = origGetDocsRoot;
      }
    });

    it('should return skipped when docs repo not available', () => {
      const { executeDocsCommit } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const originalPaths = require(path.join(LIB_DIR, 'paths.cjs'));
      const origGetCodebaseRoot = originalPaths.getCodebaseRoot;
      const origGetDocsRoot = originalPaths.getDocsRoot;
      originalPaths.getCodebaseRoot = () => null;
      originalPaths.getDocsRoot = () => ({ path: null, exists: false, hasGit: false });
      try {
        const result = executeDocsCommit({
          operation: 'revise',
          changelog_summary: 'test',
          flags: [],
        });
        assert.equal(result.status, 'skipped');
        assert.ok(result.reason.includes('docs repo not available'), 'reason should mention docs repo');
      } finally {
        originalPaths.getCodebaseRoot = origGetCodebaseRoot;
        originalPaths.getDocsRoot = origGetDocsRoot;
      }
    });

    it('should return skipped when commitDocs returns committed: false', () => {
      const { executeDocsCommit } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const mockGit = {
        commitDocs: () => ({ committed: false, message: 'No docs changes to commit.' }),
      };
      const originalPaths = require(path.join(LIB_DIR, 'paths.cjs'));
      const origGetCodebaseRoot = originalPaths.getCodebaseRoot;
      const origGetDocsRoot = originalPaths.getDocsRoot;
      originalPaths.getCodebaseRoot = () => '/fake/codebase';
      originalPaths.getDocsRoot = () => ({ path: '/fake/docs', exists: true, hasGit: true });
      try {
        const result = executeDocsCommit({
          operation: 'revise',
          changelog_summary: 'test',
          flags: [],
        }, mockGit);
        assert.equal(result.status, 'skipped');
        assert.ok(result.reason.includes('no docs changes'), 'reason should mention no docs changes');
      } finally {
        originalPaths.getCodebaseRoot = origGetCodebaseRoot;
        originalPaths.getDocsRoot = origGetDocsRoot;
      }
    });

    it('should return failed when commitDocs throws', () => {
      const { executeDocsCommit } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const mockGit = {
        commitDocs: () => { throw new Error('git push failed'); },
      };
      const originalPaths = require(path.join(LIB_DIR, 'paths.cjs'));
      const origGetCodebaseRoot = originalPaths.getCodebaseRoot;
      const origGetDocsRoot = originalPaths.getDocsRoot;
      originalPaths.getCodebaseRoot = () => '/fake/codebase';
      originalPaths.getDocsRoot = () => ({ path: '/fake/docs', exists: true, hasGit: true });
      try {
        const result = executeDocsCommit({
          operation: 'revise',
          changelog_summary: 'test',
          flags: [],
        }, mockGit);
        assert.equal(result.status, 'failed');
        assert.ok(result.error.includes('git push failed'), 'error should contain the error message');
      } finally {
        originalPaths.getCodebaseRoot = origGetCodebaseRoot;
        originalPaths.getDocsRoot = origGetDocsRoot;
      }
    });
  });

  describe('run-stage subcommand', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = makeTempDir();
    });

    afterEach(() => {
      cleanTempDir(tmpDir);
    });

    // Note: cmdPipeline calls process.exit, so we test the underlying functions
    // and the run-stage routing indirectly through the executor functions

    it('should reject stage 1 as LLM-executed (not deterministic)', () => {
      // Tested via the stage validation logic -- stages 1-5 are not deterministic
      const { resolveStages } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const stages = resolveStages('revise', [], { structural: true });
      const stage1 = stages.find(s => s.id === 1);
      assert.equal(stage1.phase, 'write', 'stage 1 is in write phase (LLM)');
      assert.notEqual(stage1.phase, 'finalize', 'stage 1 is NOT in finalize phase');
    });

    it('should accept stages 6, 7, 8 as deterministic (finalize phase)', () => {
      const { resolveStages } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const stages = resolveStages('revise', [], { structural: true });
      const finalizeStages = stages.filter(s => s.phase === 'finalize');
      assert.equal(finalizeStages.length, 3);
      const ids = finalizeStages.map(s => s.id);
      assert.deepEqual(ids, [6, 7, 8]);
    });
  });

  describe('pipeline completion', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = makeTempDir();
    });

    afterEach(() => {
      cleanTempDir(tmpDir);
    });

    it('should include completion_marker string in complete action', () => {
      const { initPipeline, getNextAction } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const statePath = writeStateFile(tmpDir, { version: 1, operations: [], pipeline: null });
      initPipeline({ operation: 'revise', files: ['docs/test.md'], flags: [] }, statePath);

      // Simulate all applicable stages completed
      const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
      for (let i = 1; i <= 8; i++) {
        if (state.pipeline.stages[i - 1].applicable) {
          state.pipeline[`stage_${i}_status`] = 'PASS';
        }
      }
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');

      const action = getNextAction(statePath);
      assert.equal(action.action, 'complete');
      assert.ok(action.summary.completion_marker, 'should have completion_marker');
      assert.ok(action.summary.completion_marker.startsWith('Pipeline complete:'), 'marker should start with Pipeline complete:');
      assert.ok(action.summary.completion_marker.includes('[verbosity: PASS]'), 'marker should include verbosity status');
      assert.ok(action.summary.completion_marker.includes('[changelog: PASS]'), 'marker should include changelog status');
    });

    it('should have completion_marker with actual status values from pipeline state', () => {
      const { initPipeline, getNextAction } = require(path.join(LIB_DIR, 'pipeline.cjs'));
      const statePath = writeStateFile(tmpDir, { version: 1, operations: [], pipeline: null });
      initPipeline({ operation: 'revise', files: ['docs/test.md'], flags: [] }, statePath);

      const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
      state.pipeline.stage_1_status = 'PASS';
      state.pipeline.stage_2_status = 'SKIP';
      state.pipeline.stage_3_status = 'PASS';
      state.pipeline.stage_4_status = 'PASS';
      state.pipeline.stage_5_status = 'PASS';
      state.pipeline.stage_6_status = 'PASS';
      // Stage 7 not applicable (no structural), so no status needed
      state.pipeline.stage_8_status = 'PASS';
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');

      const action = getNextAction(statePath);
      assert.equal(action.action, 'complete');
      assert.ok(action.summary.completion_marker.includes('[citations: SKIP]'), 'marker should reflect SKIP for citations');
    });
  });

  // ── CLI Integration Tests (Plan 02 Task 2) ─────────────────────────────────

  describe('CLI integration: fp-tools pipeline', () => {
    /**
     * Run fp-tools.cjs as a subprocess.
     *
     * @param {...string} args - CLI arguments
     * @returns {{ stdout: string, stderr: string, exitCode: number }}
     */
    function runCli(...args) {
      try {
        const stdout = execFileSync('node', [FP_TOOLS_PATH, ...args], {
          encoding: 'utf-8',
          stdio: 'pipe',
          cwd: PLUGIN_DIR,
          timeout: 10000,
        });
        return { stdout, stderr: '', exitCode: 0 };
      } catch (err) {
        return {
          stdout: err.stdout || '',
          stderr: err.stderr || '',
          exitCode: err.status || 1,
        };
      }
    }

    it('should output usage error when no subcommand is provided', () => {
      const result = runCli('pipeline');
      assert.notEqual(result.exitCode, 0, 'should exit non-zero');
      assert.ok(result.stderr.includes('init'), 'stderr should mention init subcommand');
      assert.ok(result.stderr.includes('next'), 'stderr should mention next subcommand');
      assert.ok(result.stderr.includes('run-stage'), 'stderr should mention run-stage subcommand');
      assert.ok(result.stderr.includes('status'), 'stderr should mention status subcommand');
      assert.ok(result.stderr.includes('reset'), 'stderr should mention reset subcommand');
    });

    it('should output null for status when no active pipeline', () => {
      const result = runCli('pipeline', 'status');
      assert.equal(result.exitCode, 0, 'should exit cleanly');
      assert.equal(result.stdout.trim(), 'null', 'should output null');
    });

    it('should recognize pipeline as a valid command (not Unknown command)', () => {
      const result = runCli('pipeline', 'status');
      assert.equal(result.exitCode, 0, 'should not produce Unknown command error');
      assert.ok(!result.stderr.includes('Unknown command'), 'stderr should not contain Unknown command');
    });

    it('should reject run-stage with non-deterministic stage number', () => {
      const result = runCli('pipeline', 'run-stage', '1');
      assert.notEqual(result.exitCode, 0, 'should exit non-zero');
      assert.ok(result.stderr.includes('Stages 1-5 are LLM-executed'), 'should explain why stage 1 is rejected');
    });
  });
});
