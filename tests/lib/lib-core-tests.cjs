'use strict';

// Tests for lib/core.cjs
// TDD RED phase: These tests should fail until the module is implemented.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const LIB_DIR = path.resolve(__dirname, '..', '..', 'lib');

describe('lib/core.cjs', () => {
  it('should be requireable', () => {
    const core = require(path.join(LIB_DIR, 'core.cjs'));
    assert.ok(core);
  });

  it('should export output, error, safeReadFile, safeJsonParse', () => {
    const core = require(path.join(LIB_DIR, 'core.cjs'));
    assert.equal(typeof core.output, 'function');
    assert.equal(typeof core.error, 'function');
    assert.equal(typeof core.safeReadFile, 'function');
    assert.equal(typeof core.safeJsonParse, 'function');
  });

  describe('safeReadFile', () => {
    it('should read a valid file and return string contents', () => {
      const core = require(path.join(LIB_DIR, 'core.cjs'));
      // Read the core.cjs file itself as test input
      const result = core.safeReadFile(path.join(LIB_DIR, 'core.cjs'));
      assert.equal(typeof result, 'string');
      assert.ok(result.length > 0);
    });

    it('should return null for missing file (no throw)', () => {
      const core = require(path.join(LIB_DIR, 'core.cjs'));
      const result = core.safeReadFile('/nonexistent/path/does-not-exist.txt');
      assert.equal(result, null);
    });
  });

  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      const core = require(path.join(LIB_DIR, 'core.cjs'));
      const result = core.safeJsonParse('{"a":1}');
      assert.equal(result.ok, true);
      assert.deepEqual(result.data, { a: 1 });
    });

    it('should return error for invalid JSON', () => {
      const core = require(path.join(LIB_DIR, 'core.cjs'));
      const result = core.safeJsonParse('not json');
      assert.equal(result.ok, false);
      assert.equal(typeof result.error, 'string');
    });

    it('should reject text exceeding default 1MB limit', () => {
      const core = require(path.join(LIB_DIR, 'core.cjs'));
      const bigText = 'x'.repeat(1048577); // 1MB + 1 byte
      const result = core.safeJsonParse(bigText);
      assert.equal(result.ok, false);
    });

    it('should respect custom maxSize option', () => {
      const core = require(path.join(LIB_DIR, 'core.cjs'));
      const result = core.safeJsonParse('{"ok":true}', { maxSize: 5 });
      assert.equal(result.ok, false);
    });
  });

  describe('output protocol (subprocess tests)', () => {
    const nodeExe = process.execPath;

    it('should write JSON to stdout and exit 0 for output()', () => {
      const script = `
        const core = require('${path.join(LIB_DIR, 'core.cjs').replace(/\\/g, '\\\\')}');
        core.output({ok: true}, false);
      `;
      const result = execFileSync(nodeExe, ['-e', script], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      assert.equal(result.trim(), '{\n  "ok": true\n}');
    });

    it('should write raw value when raw=true', () => {
      const script = `
        const core = require('${path.join(LIB_DIR, 'core.cjs').replace(/\\/g, '\\\\')}');
        core.output({ok: true}, true, 'yes');
      `;
      const result = execFileSync(nodeExe, ['-e', script], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      assert.equal(result, 'yes');
    });

    it('should write error to stderr and exit 1 for error()', () => {
      const script = `
        const core = require('${path.join(LIB_DIR, 'core.cjs').replace(/\\/g, '\\\\')}');
        core.error('bad');
      `;
      try {
        execFileSync(nodeExe, ['-e', script], {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        assert.fail('Should have thrown (exit 1)');
      } catch (err) {
        assert.equal(err.status, 1);
        assert.ok(err.stderr.includes('Error: bad'));
      }
    });
  });
});
