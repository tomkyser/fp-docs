'use strict';

// Tests for lib/init.cjs
// Covers init subcommands: write-op, read-op, admin-op, parallel, remediate.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const LIB_DIR = path.resolve(__dirname, '..', '..', 'lib');

describe('lib/init.cjs', () => {
  it('should be requireable', () => {
    const init = require(path.join(LIB_DIR, 'init.cjs'));
    assert.ok(init);
  });

  it('should export cmdInit, initWriteOp, initReadOp, initAdminOp, initParallel, initRemediate', () => {
    const init = require(path.join(LIB_DIR, 'init.cjs'));
    assert.equal(typeof init.cmdInit, 'function');
    assert.equal(typeof init.initWriteOp, 'function');
    assert.equal(typeof init.initReadOp, 'function');
    assert.equal(typeof init.initAdminOp, 'function');
    assert.equal(typeof init.initParallel, 'function');
    assert.equal(typeof init.initRemediate, 'function');
  });

  describe('initWriteOp', () => {
    it('should return object with required fields for revise', () => {
      const { initWriteOp } = require(path.join(LIB_DIR, 'init.cjs'));
      const result = initWriteOp('revise', ['target-file.md'], false);
      assert.ok(result.route, 'should have route');
      assert.ok(result.paths, 'should have paths');
      assert.ok(result.feature_flags, 'should have feature_flags');
      assert.ok(result.pipeline, 'should have pipeline config');
      assert.equal(result.route.command, 'revise');
      assert.equal(result.route.type, 'write');
    });

    it('should include agent name in route', () => {
      const { initWriteOp } = require(path.join(LIB_DIR, 'init.cjs'));
      const result = initWriteOp('revise', [], false);
      assert.ok(result.route.agent, 'should have agent in route');
    });
  });

  describe('initReadOp', () => {
    it('should return object with required fields for audit', () => {
      const { initReadOp } = require(path.join(LIB_DIR, 'init.cjs'));
      const result = initReadOp('audit', [], false);
      assert.ok(result.route, 'should have route');
      assert.ok(result.paths, 'should have paths');
      assert.equal(result.route.command, 'audit');
      assert.equal(result.route.type, 'read');
    });
  });

  describe('initAdminOp', () => {
    it('should return object with required fields for setup', () => {
      const { initAdminOp } = require(path.join(LIB_DIR, 'init.cjs'));
      const result = initAdminOp('setup', [], false);
      assert.ok(result.route, 'should have route');
      assert.ok(result.paths, 'should have paths');
      assert.equal(result.route.command, 'setup');
      assert.equal(result.route.type, 'admin');
    });
  });

  describe('initParallel', () => {
    it('should return object with batch config', () => {
      const { initParallel } = require(path.join(LIB_DIR, 'init.cjs'));
      const result = initParallel(['revise', 'all'], false);
      assert.ok(result.batch_config, 'should have batch_config');
      assert.ok(typeof result.batch_config.max_teammates === 'number', 'should have max_teammates');
    });
  });

  describe('initRemediate', () => {
    it('should return object with pipeline config', () => {
      const { initRemediate } = require(path.join(LIB_DIR, 'init.cjs'));
      const result = initRemediate([], false);
      assert.ok(result.route, 'should have route');
      assert.ok(result.pipeline, 'should have pipeline config');
    });
  });
});
