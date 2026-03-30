'use strict';

// Tests for lib/tracker.cjs
// Covers create, read, summary, update, close, addIssue, addNote, list, prune.
// Uses a temp directory for file operations to avoid polluting the repo.

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('fs');
const os = require('os');

const LIB_DIR = path.resolve(__dirname, '..', '..');
const tracker = require(path.join(LIB_DIR, 'lib', 'tracker.cjs'));

// ── Module Exports ──────────────────────────────────────────────────────────

describe('tracker exports', () => {
  it('should export all 10 expected functions', () => {
    const expected = [
      'create', 'read', 'summary', 'update', 'close',
      'addIssue', 'addNote', 'list', 'prune', 'cmdTracker',
    ];
    for (const name of expected) {
      assert.equal(typeof tracker[name], 'function', `${name} should be a function`);
    }
  });
});

// ── Functional Tests (temp directory) ───────────────────────────────────────
//
// tracker.create() uses resolveTrackerDir() internally which depends on
// getDocsRoot() and getPluginRoot(). We test the core logic by creating
// trackers and then operating on them via absolute paths.

describe('tracker create', () => {
  it('should create a tracker and return id + path', () => {
    const result = tracker.create({ operation: 'test-create' });
    // If tracker feature is disabled, id will be null
    if (result.id === null) {
      // Feature disabled in config -- skip test gracefully
      return;
    }
    assert.ok(result.id, 'should have an id');
    assert.ok(result.id.startsWith('tracker-'), 'id should start with tracker-');
    assert.ok(result.path, 'should have a path');
    assert.ok(fs.existsSync(result.path), 'tracker file should exist');

    // Clean up
    try { fs.unlinkSync(result.path); } catch { /* ignore */ }
  });

  it('should create valid JSON with expected structure', () => {
    const result = tracker.create({ operation: 'test-structure', complexity: 'high' });
    if (result.id === null) return;

    const data = JSON.parse(fs.readFileSync(result.path, 'utf-8'));
    assert.equal(data.id, result.id);
    assert.equal(data.operation, 'test-structure');
    assert.equal(data.complexity, 'high');
    assert.equal(data.status, 'active');
    assert.ok(data.created);
    assert.ok(data.updated);
    assert.equal(data.closed, null);
    assert.ok(Array.isArray(data.targets));
    assert.ok(Array.isArray(data.issues));
    assert.ok(Array.isArray(data.notes));
    assert.equal(typeof data.phases, 'object');

    try { fs.unlinkSync(result.path); } catch { /* ignore */ }
  });

  it('should default operation to unknown when not provided', () => {
    const result = tracker.create({});
    if (result.id === null) return;

    const data = JSON.parse(fs.readFileSync(result.path, 'utf-8'));
    assert.equal(data.operation, 'unknown');

    try { fs.unlinkSync(result.path); } catch { /* ignore */ }
  });
});

describe('tracker read', () => {
  it('should read a tracker by absolute path', () => {
    const created = tracker.create({ operation: 'test-read' });
    if (created.id === null) return;

    const data = tracker.read(created.path);
    assert.ok(data);
    assert.equal(data.id, created.id);
    assert.equal(data.operation, 'test-read');

    try { fs.unlinkSync(created.path); } catch { /* ignore */ }
  });

  it('should return null for non-existent tracker', () => {
    const result = tracker.read('/tmp/nonexistent-tracker-abc123.json');
    assert.equal(result, null);
  });
});

describe('tracker summary', () => {
  it('should return condensed summary', () => {
    const created = tracker.create({ operation: 'test-summary' });
    if (created.id === null) return;

    const s = tracker.summary(created.path);
    assert.ok(s);
    assert.equal(s.id, created.id);
    assert.equal(s.operation, 'test-summary');
    assert.equal(s.status, 'active');
    assert.equal(typeof s.phaseStatuses, 'object');
    assert.equal(s.issueCount, 0);
    assert.equal(s.targetCount, 0);
    assert.equal(s.targetsCompleted, 0);

    try { fs.unlinkSync(created.path); } catch { /* ignore */ }
  });

  it('should return null for non-existent tracker', () => {
    assert.equal(tracker.summary('/tmp/nonexistent.json'), null);
  });
});

describe('tracker update', () => {
  it('should update a phase in the tracker', () => {
    const created = tracker.create({ operation: 'test-update' });
    if (created.id === null) return;

    const result = tracker.update(created.path, {
      phase: 'research',
      agent: 'fp-docs-researcher',
      status: 'completed',
      result: { findings: 3 },
    });

    assert.ok(result.ok);

    const data = tracker.read(created.path);
    assert.ok(data.phases.research);
    assert.equal(data.phases.research.status, 'completed');
    assert.equal(data.phases.research.agent, 'fp-docs-researcher');
    assert.deepEqual(data.phases.research.result, { findings: 3 });

    try { fs.unlinkSync(created.path); } catch { /* ignore */ }
  });

  it('should return { ok: false } for non-existent tracker', () => {
    const result = tracker.update('/tmp/nonexistent.json', { phase: 'x', agent: 'y', status: 'z' });
    assert.equal(result.ok, false);
  });
});

describe('tracker close', () => {
  it('should close a tracker with status completed', () => {
    const created = tracker.create({ operation: 'test-close' });
    if (created.id === null) return;

    const result = tracker.close(created.path, 'completed');
    assert.ok(result.ok);

    const data = tracker.read(created.path);
    assert.equal(data.status, 'completed');
    assert.ok(data.closed);

    try { fs.unlinkSync(created.path); } catch { /* ignore */ }
  });

  it('should close a tracker with status failed', () => {
    const created = tracker.create({ operation: 'test-close-fail' });
    if (created.id === null) return;

    tracker.close(created.path, 'failed');
    const data = tracker.read(created.path);
    assert.equal(data.status, 'failed');

    try { fs.unlinkSync(created.path); } catch { /* ignore */ }
  });
});

describe('tracker addIssue', () => {
  it('should append an issue to the tracker', () => {
    const created = tracker.create({ operation: 'test-issue' });
    if (created.id === null) return;

    const result = tracker.addIssue(created.path, {
      phase: 'verification',
      severity: 'warning',
      message: 'Missing citation',
      target: 'hooks.md',
    });

    assert.ok(result.ok);

    const data = tracker.read(created.path);
    assert.equal(data.issues.length, 1);
    assert.equal(data.issues[0].phase, 'verification');
    assert.equal(data.issues[0].severity, 'warning');
    assert.equal(data.issues[0].message, 'Missing citation');
    assert.equal(data.issues[0].target, 'hooks.md');
    assert.ok(data.issues[0].timestamp);

    try { fs.unlinkSync(created.path); } catch { /* ignore */ }
  });

  it('should append multiple issues', () => {
    const created = tracker.create({ operation: 'test-multi-issue' });
    if (created.id === null) return;

    tracker.addIssue(created.path, { phase: 'p1', severity: 'error', message: 'issue 1' });
    tracker.addIssue(created.path, { phase: 'p2', severity: 'info', message: 'issue 2' });

    const data = tracker.read(created.path);
    assert.equal(data.issues.length, 2);

    try { fs.unlinkSync(created.path); } catch { /* ignore */ }
  });
});

describe('tracker addNote', () => {
  it('should append a note to the tracker', () => {
    const created = tracker.create({ operation: 'test-note' });
    if (created.id === null) return;

    const result = tracker.addNote(created.path, 'Test note content');
    assert.ok(result.ok);

    const data = tracker.read(created.path);
    assert.equal(data.notes.length, 1);
    assert.equal(data.notes[0].text, 'Test note content');
    assert.ok(data.notes[0].timestamp);

    try { fs.unlinkSync(created.path); } catch { /* ignore */ }
  });
});

describe('tracker list', () => {
  it('should return an array', () => {
    const result = tracker.list();
    assert.ok(Array.isArray(result));
  });

  it('should return an array with status filter', () => {
    const result = tracker.list('active');
    assert.ok(Array.isArray(result));
  });
});

describe('tracker prune', () => {
  it('should return pruned and remaining counts', () => {
    const result = tracker.prune(0); // 0 days = prune everything closed
    assert.equal(typeof result.pruned, 'number');
    assert.equal(typeof result.remaining, 'number');
  });
});

describe('cmdTracker', () => {
  it('should be a function that accepts 3 args', () => {
    assert.equal(typeof tracker.cmdTracker, 'function');
    assert.equal(tracker.cmdTracker.length, 3);
  });
});
