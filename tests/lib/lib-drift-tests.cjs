'use strict';

// Tests for lib/drift.cjs
// TDD RED phase: These tests define the behavior of the drift detection module.

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const LIB_DIR = path.resolve(__dirname, '..', '..', 'lib');

// ── Test Helpers ──────────────────────────────────────────────────────────────

/**
 * Create a unique temp directory for isolated staleness file I/O.
 */
function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fp-drift-test-'));
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
 * Get the staleness.json path within a temp dir.
 */
function getStalenessPath(tmpDir) {
  return path.join(tmpDir, '.fp-docs', 'staleness.json');
}

/**
 * Write a staleness file at the expected path within a temp dir.
 */
function writeStalenessFile(tmpDir, data) {
  const fpDocsDir = path.join(tmpDir, '.fp-docs');
  fs.mkdirSync(fpDocsDir, { recursive: true });
  const stalenessPath = path.join(fpDocsDir, 'staleness.json');
  fs.writeFileSync(stalenessPath, JSON.stringify(data, null, 2), 'utf-8');
  return stalenessPath;
}

/**
 * Write a config.json fixture with source_to_docs mapping for testing.
 */
function writeConfigFile(tmpDir) {
  const configPath = path.join(tmpDir, 'config.json');
  const config = {
    system: {},
    project: {
      source_to_docs: {
        'functions.php': 'docs/01-architecture/bootstrap-sequence.md',
        'inc/post-types/': 'docs/02-post-types/',
        'helpers/': 'docs/06-helpers/',
        'inc/hooks/': 'docs/08-hooks/',
        'inc/rest-api/': 'docs/09-api/rest-api/',
        'components/': 'docs/05-components/',
        'assets/src/scripts/': 'docs/18-frontend-assets/js/'
      }
    },
    pipeline: { stages: [] }
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  return configPath;
}

// ── Module Tests ──────────────────────────────────────────────────────────────

describe('lib/drift.cjs', () => {
  it('should be requireable', () => {
    const drift = require(path.join(LIB_DIR, 'drift.cjs'));
    assert.ok(drift);
  });

  it('should export analyzeDrift, addSignal, clearSignals, loadStaleness, saveStaleness, mergePending, sortByPriority, formatNudge, getChangedFiles, cmdDrift', () => {
    const drift = require(path.join(LIB_DIR, 'drift.cjs'));
    assert.equal(typeof drift.analyzeDrift, 'function');
    assert.equal(typeof drift.addSignal, 'function');
    assert.equal(typeof drift.clearSignals, 'function');
    assert.equal(typeof drift.loadStaleness, 'function');
    assert.equal(typeof drift.saveStaleness, 'function');
    assert.equal(typeof drift.mergePending, 'function');
    assert.equal(typeof drift.sortByPriority, 'function');
    assert.equal(typeof drift.formatNudge, 'function');
    assert.equal(typeof drift.getChangedFiles, 'function');
    assert.equal(typeof drift.cmdDrift, 'function');
  });

  describe('loadStaleness', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = makeTempDir();
    });

    afterEach(() => {
      cleanTempDir(tmpDir);
    });

    it('should return default staleness when file is missing', () => {
      const drift = require(path.join(LIB_DIR, 'drift.cjs'));
      const nonExistentPath = path.join(tmpDir, 'nonexistent', '.fp-docs', 'staleness.json');
      const result = drift.loadStaleness(nonExistentPath);
      assert.equal(result.version, 1);
      assert.ok(Array.isArray(result.signals));
      assert.equal(result.signals.length, 0);
    });

    it('should return parsed staleness when file exists with valid JSON', () => {
      const drift = require(path.join(LIB_DIR, 'drift.cjs'));
      const testData = {
        version: 1,
        signals: [{ doc_path: 'docs/06-helpers/', severity: 'high', source: 'post-merge', timestamp: '2026-03-20T10:00:00Z' }],
        last_updated: '2026-03-20T10:00:00Z'
      };
      const stalenessPath = writeStalenessFile(tmpDir, testData);
      const result = drift.loadStaleness(stalenessPath);
      assert.equal(result.version, 1);
      assert.equal(result.signals.length, 1);
      assert.equal(result.signals[0].doc_path, 'docs/06-helpers/');
    });
  });

  describe('saveStaleness', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = makeTempDir();
    });

    afterEach(() => {
      cleanTempDir(tmpDir);
    });

    it('should write to staleness.json using atomic write pattern (.tmp + rename)', () => {
      const drift = require(path.join(LIB_DIR, 'drift.cjs'));
      const stalenessPath = getStalenessPath(tmpDir);
      const data = { version: 1, signals: [], last_updated: null };
      drift.saveStaleness(data, stalenessPath);
      assert.ok(fs.existsSync(stalenessPath), 'staleness.json should exist after save');
      const raw = fs.readFileSync(stalenessPath, 'utf-8');
      const parsed = JSON.parse(raw);
      assert.equal(parsed.version, 1);
      assert.ok(parsed.last_updated, 'last_updated should be set after save');
    });

    it('should verify atomic write pattern exists in source code', () => {
      const source = fs.readFileSync(path.join(LIB_DIR, 'drift.cjs'), 'utf-8');
      assert.ok(source.includes('renameSync'), 'should use fs.renameSync for atomic writes');
      assert.ok(source.includes('.tmp'), 'should write to .tmp file before rename');
    });
  });

  describe('addSignal', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = makeTempDir();
    });

    afterEach(() => {
      cleanTempDir(tmpDir);
    });

    it('should append a signal to staleness.json signals array', () => {
      const drift = require(path.join(LIB_DIR, 'drift.cjs'));
      const stalenessPath = getStalenessPath(tmpDir);
      const signal = {
        doc_path: 'docs/06-helpers/',
        source: 'post-merge',
        reason: 'Source files changed',
        severity: 'high',
        timestamp: '2026-03-20T10:00:00Z',
        source_files_changed: ['helpers/posts.php']
      };
      drift.addSignal(signal, stalenessPath);
      const data = drift.loadStaleness(stalenessPath);
      assert.equal(data.signals.length, 1);
      assert.equal(data.signals[0].doc_path, 'docs/06-helpers/');
    });

    it('should keep higher severity when duplicate doc_path exists (high > medium)', () => {
      const drift = require(path.join(LIB_DIR, 'drift.cjs'));
      const stalenessPath = getStalenessPath(tmpDir);
      // Add high severity first
      drift.addSignal({
        doc_path: 'docs/06-helpers/',
        source: 'post-merge',
        reason: 'Source files changed',
        severity: 'high',
        timestamp: '2026-03-20T10:00:00Z',
        source_files_changed: ['helpers/posts.php']
      }, stalenessPath);
      // Try to add medium severity for same doc
      drift.addSignal({
        doc_path: 'docs/06-helpers/',
        source: 'manual',
        reason: 'Needs review',
        severity: 'medium',
        timestamp: '2026-03-20T11:00:00Z',
        source_files_changed: ['helpers/posts-utils.php']
      }, stalenessPath);
      const data = drift.loadStaleness(stalenessPath);
      assert.equal(data.signals.length, 1, 'should have exactly one signal after dedup');
      assert.equal(data.signals[0].severity, 'high', 'should keep higher severity');
    });

    it('should keep newer timestamp when same severity for duplicate doc_path', () => {
      const drift = require(path.join(LIB_DIR, 'drift.cjs'));
      const stalenessPath = getStalenessPath(tmpDir);
      // Add medium severity first
      drift.addSignal({
        doc_path: 'docs/06-helpers/',
        source: 'post-merge',
        reason: 'Source files changed',
        severity: 'medium',
        timestamp: '2026-03-20T10:00:00Z',
        source_files_changed: ['helpers/posts.php']
      }, stalenessPath);
      // Add medium severity again with newer timestamp
      drift.addSignal({
        doc_path: 'docs/06-helpers/',
        source: 'manual',
        reason: 'Updated review',
        severity: 'medium',
        timestamp: '2026-03-20T12:00:00Z',
        source_files_changed: ['helpers/posts-utils.php']
      }, stalenessPath);
      const data = drift.loadStaleness(stalenessPath);
      assert.equal(data.signals.length, 1, 'should have exactly one signal after dedup');
      assert.equal(data.signals[0].timestamp, '2026-03-20T12:00:00Z', 'should keep newer timestamp');
    });
  });

  describe('clearSignals', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = makeTempDir();
    });

    afterEach(() => {
      cleanTempDir(tmpDir);
    });

    it('should clear all signals when no docPath is provided', () => {
      const drift = require(path.join(LIB_DIR, 'drift.cjs'));
      const stalenessPath = getStalenessPath(tmpDir);
      // Add two signals
      drift.addSignal({ doc_path: 'docs/06-helpers/', source: 'test', reason: 'test', severity: 'high', timestamp: '2026-03-20T10:00:00Z', source_files_changed: [] }, stalenessPath);
      drift.addSignal({ doc_path: 'docs/08-hooks/', source: 'test', reason: 'test', severity: 'medium', timestamp: '2026-03-20T10:00:00Z', source_files_changed: [] }, stalenessPath);
      const result = drift.clearSignals(undefined, stalenessPath);
      assert.equal(result.cleared, 2);
      assert.equal(result.remaining, 0);
      const data = drift.loadStaleness(stalenessPath);
      assert.equal(data.signals.length, 0);
    });

    it('should clear only signals matching the given docPath', () => {
      const drift = require(path.join(LIB_DIR, 'drift.cjs'));
      const stalenessPath = getStalenessPath(tmpDir);
      drift.addSignal({ doc_path: 'docs/06-helpers/', source: 'test', reason: 'test', severity: 'high', timestamp: '2026-03-20T10:00:00Z', source_files_changed: [] }, stalenessPath);
      drift.addSignal({ doc_path: 'docs/08-hooks/', source: 'test', reason: 'test', severity: 'medium', timestamp: '2026-03-20T10:00:00Z', source_files_changed: [] }, stalenessPath);
      const result = drift.clearSignals('docs/06-helpers/', stalenessPath);
      assert.equal(result.cleared, 1);
      assert.equal(result.remaining, 1);
      const data = drift.loadStaleness(stalenessPath);
      assert.equal(data.signals.length, 1);
      assert.equal(data.signals[0].doc_path, 'docs/08-hooks/');
    });
  });

  describe('analyzeDrift', () => {
    let tmpDir;
    let configPath;

    beforeEach(() => {
      tmpDir = makeTempDir();
      configPath = writeConfigFile(tmpDir);
    });

    afterEach(() => {
      cleanTempDir(tmpDir);
    });

    it('should map changed source files to affected docs via source_to_docs config', () => {
      const drift = require(path.join(LIB_DIR, 'drift.cjs'));
      const changedFiles = ['helpers/posts.php', 'helpers/posts-utils.php', 'inc/hooks/filters.php'];
      const result = drift.analyzeDrift(null, null, configPath, changedFiles);
      assert.ok(result.affected_docs > 0, 'should have affected docs');
      // Check that helpers/ files map correctly
      const helperSignal = result.signals.find(s => s.doc_path === 'docs/06-helpers/');
      assert.ok(helperSignal, 'should have signal for docs/06-helpers/');
      assert.ok(helperSignal.source_files_changed.includes('helpers/posts.php'));
      assert.ok(helperSignal.source_files_changed.includes('helpers/posts-utils.php'));
      // Check that hooks files map correctly
      const hooksSignal = result.signals.find(s => s.doc_path === 'docs/08-hooks/');
      assert.ok(hooksSignal, 'should have signal for docs/08-hooks/');
      assert.ok(hooksSignal.source_files_changed.includes('inc/hooks/filters.php'));
    });

    it('should return empty affected map for files matching no source_to_docs pattern', () => {
      const drift = require(path.join(LIB_DIR, 'drift.cjs'));
      const changedFiles = ['random/unknown-file.php', 'package.json'];
      const result = drift.analyzeDrift(null, null, configPath, changedFiles);
      assert.equal(result.affected_docs, 0);
      assert.equal(result.signals.length, 0);
    });

    it('should map functions.php to exact file target', () => {
      const drift = require(path.join(LIB_DIR, 'drift.cjs'));
      const changedFiles = ['functions.php'];
      const result = drift.analyzeDrift(null, null, configPath, changedFiles);
      assert.equal(result.affected_docs, 1);
      const signal = result.signals[0];
      assert.equal(signal.doc_path, 'docs/01-architecture/bootstrap-sequence.md');
    });

    it('should write signals to outputPath when provided', () => {
      const drift = require(path.join(LIB_DIR, 'drift.cjs'));
      const outputPath = path.join(tmpDir, 'drift-output.json');
      const changedFiles = ['helpers/posts.php'];
      drift.analyzeDrift(null, outputPath, configPath, changedFiles);
      assert.ok(fs.existsSync(outputPath), 'output file should exist');
      const raw = fs.readFileSync(outputPath, 'utf-8');
      const parsed = JSON.parse(raw);
      assert.ok(Array.isArray(parsed), 'output should be an array of signals');
    });
  });

  describe('getChangedFiles', () => {
    it('should parse mock output into file list', () => {
      const drift = require(path.join(LIB_DIR, 'drift.cjs'));
      const mockOutput = 'helpers/posts.php\ninc/hooks/filters.php\nfunctions.php\n';
      const result = drift.getChangedFiles(null, mockOutput);
      assert.deepEqual(result, ['helpers/posts.php', 'inc/hooks/filters.php', 'functions.php']);
    });

    it('should return empty array for empty output', () => {
      const drift = require(path.join(LIB_DIR, 'drift.cjs'));
      const result = drift.getChangedFiles(null, '');
      assert.deepEqual(result, []);
    });

    it('should filter empty lines from output', () => {
      const drift = require(path.join(LIB_DIR, 'drift.cjs'));
      const mockOutput = 'helpers/posts.php\n\n\ninc/hooks/filters.php\n';
      const result = drift.getChangedFiles(null, mockOutput);
      assert.deepEqual(result, ['helpers/posts.php', 'inc/hooks/filters.php']);
    });
  });

  describe('mergePending', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = makeTempDir();
    });

    afterEach(() => {
      cleanTempDir(tmpDir);
    });

    it('should merge drift-pending.json signals into staleness.json and delete pending file', () => {
      const drift = require(path.join(LIB_DIR, 'drift.cjs'));
      const stalenessPath = getStalenessPath(tmpDir);
      const pendingPath = path.join(tmpDir, '.fp-docs', 'drift-pending.json');
      // Create .fp-docs dir
      fs.mkdirSync(path.join(tmpDir, '.fp-docs'), { recursive: true });
      // Write pending signals
      const pendingSignals = [
        { doc_path: 'docs/06-helpers/', source: 'post-merge', reason: 'Source files changed', severity: 'high', timestamp: '2026-03-20T10:00:00Z', source_files_changed: ['helpers/posts.php'] },
        { doc_path: 'docs/08-hooks/', source: 'post-merge', reason: 'Source files changed', severity: 'medium', timestamp: '2026-03-20T10:00:00Z', source_files_changed: ['inc/hooks/filters.php'] }
      ];
      fs.writeFileSync(pendingPath, JSON.stringify(pendingSignals, null, 2), 'utf-8');
      const result = drift.mergePending(stalenessPath, pendingPath);
      assert.equal(result.merged, 2);
      // Verify signals merged
      const data = drift.loadStaleness(stalenessPath);
      assert.equal(data.signals.length, 2);
      // Verify pending file deleted
      assert.equal(fs.existsSync(pendingPath), false, 'drift-pending.json should be deleted after merge');
    });
  });

  describe('sortByPriority', () => {
    it('should order by severity (high first), then by source_files_changed count, then by timestamp (newest first)', () => {
      const drift = require(path.join(LIB_DIR, 'drift.cjs'));
      const signals = [
        { doc_path: 'docs/a/', severity: 'low', timestamp: '2026-03-20T12:00:00Z', source_files_changed: ['f1.php'] },
        { doc_path: 'docs/b/', severity: 'high', timestamp: '2026-03-20T10:00:00Z', source_files_changed: ['f2.php'] },
        { doc_path: 'docs/c/', severity: 'high', timestamp: '2026-03-20T11:00:00Z', source_files_changed: ['f3.php', 'f4.php'] },
        { doc_path: 'docs/d/', severity: 'medium', timestamp: '2026-03-20T10:00:00Z', source_files_changed: ['f5.php'] }
      ];
      const sorted = drift.sortByPriority(signals);
      // High severity first: c (2 files) then b (1 file)
      assert.equal(sorted[0].doc_path, 'docs/c/');
      assert.equal(sorted[1].doc_path, 'docs/b/');
      // Then medium
      assert.equal(sorted[2].doc_path, 'docs/d/');
      // Then low
      assert.equal(sorted[3].doc_path, 'docs/a/');
    });

    it('should return a new array (not mutate input)', () => {
      const drift = require(path.join(LIB_DIR, 'drift.cjs'));
      const signals = [
        { doc_path: 'docs/a/', severity: 'low', timestamp: '2026-03-20T12:00:00Z', source_files_changed: [] },
        { doc_path: 'docs/b/', severity: 'high', timestamp: '2026-03-20T10:00:00Z', source_files_changed: [] }
      ];
      const sorted = drift.sortByPriority(signals);
      assert.notEqual(sorted, signals, 'should return new array');
    });
  });

  describe('formatNudge', () => {
    it('should return empty string when 0 signals', () => {
      const drift = require(path.join(LIB_DIR, 'drift.cjs'));
      const result = drift.formatNudge([]);
      assert.equal(result, '');
    });

    it('should return formatted nudge with 5 signals showing top 3', () => {
      const drift = require(path.join(LIB_DIR, 'drift.cjs'));
      const signals = [
        { doc_path: 'docs/06-helpers/', severity: 'high', timestamp: '2026-03-20T10:00:00Z', source_files_changed: ['f1.php', 'f2.php', 'f3.php'] },
        { doc_path: 'docs/08-hooks/', severity: 'high', timestamp: '2026-03-20T10:00:00Z', source_files_changed: ['f4.php', 'f5.php'] },
        { doc_path: 'docs/02-post-types/', severity: 'medium', timestamp: '2026-03-20T10:00:00Z', source_files_changed: ['f6.php'] },
        { doc_path: 'docs/05-components/', severity: 'medium', timestamp: '2026-03-20T10:00:00Z', source_files_changed: ['f7.php'] },
        { doc_path: 'docs/09-api/rest-api/', severity: 'low', timestamp: '2026-03-20T10:00:00Z', source_files_changed: ['f8.php'] }
      ];
      const result = drift.formatNudge(signals);
      assert.ok(result.includes('5'), 'should include total count');
      assert.ok(result.includes('doc'), 'should mention docs');
      assert.ok(result.includes('Top 3'), 'should mention Top 3');
      assert.ok(result.includes('/fp-docs:auto-revise') || result.includes('auto-revise'), 'should include actionable command');
      assert.ok(result.includes('/fp-docs:drift status') || result.includes('drift status'), 'should include status command');
    });

    it('should include actionable command suggestion per D-11', () => {
      const drift = require(path.join(LIB_DIR, 'drift.cjs'));
      const signals = [
        { doc_path: 'docs/06-helpers/', severity: 'high', timestamp: '2026-03-20T10:00:00Z', source_files_changed: ['f1.php'] }
      ];
      const result = drift.formatNudge(signals);
      assert.ok(result.includes('/fp-docs:auto-revise') || result.includes('/fp-docs:drift status'), 'should include actionable command');
    });

    it('should handle single signal correctly', () => {
      const drift = require(path.join(LIB_DIR, 'drift.cjs'));
      const signals = [
        { doc_path: 'docs/06-helpers/', severity: 'high', timestamp: '2026-03-20T10:00:00Z', source_files_changed: ['f1.php'] }
      ];
      const result = drift.formatNudge(signals);
      assert.ok(result.includes('1'), 'should include count 1');
      assert.ok(result.includes('doc'), 'should mention doc');
    });
  });

  describe('cmdDrift', () => {
    // Note: cmdDrift calls process.exit via output()/error(), so we test
    // the internal functions directly and check that the module dispatches correctly.

    it('should have cmdDrift function with correct signature', () => {
      const drift = require(path.join(LIB_DIR, 'drift.cjs'));
      assert.equal(drift.cmdDrift.length, 3, 'cmdDrift should accept 3 parameters (subcommand, args, raw)');
    });
  });

  describe('integration: analyzeDrift maps correctly', () => {
    let tmpDir;
    let configPath;

    beforeEach(() => {
      tmpDir = makeTempDir();
      configPath = writeConfigFile(tmpDir);
    });

    afterEach(() => {
      cleanTempDir(tmpDir);
    });

    it('should handle multiple files mapping to the same doc target', () => {
      const drift = require(path.join(LIB_DIR, 'drift.cjs'));
      const changedFiles = ['helpers/posts.php', 'helpers/posts-utils.php', 'helpers/terms.php'];
      const result = drift.analyzeDrift(null, null, configPath, changedFiles);
      assert.equal(result.affected_docs, 1, 'all helper files should map to one doc target');
      assert.equal(result.signals[0].source_files_changed.length, 3, 'should track all 3 source files');
    });

    it('should handle mixed mapped and unmapped files', () => {
      const drift = require(path.join(LIB_DIR, 'drift.cjs'));
      const changedFiles = ['helpers/posts.php', 'random/unknown.php', 'inc/hooks/filters.php'];
      const result = drift.analyzeDrift(null, null, configPath, changedFiles);
      assert.equal(result.affected_docs, 2, 'should have 2 affected doc targets');
    });
  });
});
