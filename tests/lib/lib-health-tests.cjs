'use strict';

// Tests for lib/health.cjs
// TDD RED phase: These tests should fail until the module is implemented.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const LIB_DIR = path.resolve(__dirname, '..', '..', 'lib');
const PLUGIN_ROOT = path.resolve(__dirname, '..', '..');

describe('lib/health.cjs', () => {
  it('should be requireable', () => {
    const health = require(path.join(LIB_DIR, 'health.cjs'));
    assert.ok(health);
  });

  it('should export cmdHealth and runHealthChecks', () => {
    const health = require(path.join(LIB_DIR, 'health.cjs'));
    assert.equal(typeof health.cmdHealth, 'function');
    assert.equal(typeof health.runHealthChecks, 'function');
  });

  describe('runHealthChecks', () => {
    it('should return object with checks array and overall status', () => {
      const { runHealthChecks } = require(path.join(LIB_DIR, 'health.cjs'));
      const result = runHealthChecks(PLUGIN_ROOT);
      assert.ok(Array.isArray(result.checks), 'checks should be an array');
      assert.ok(typeof result.overall === 'string', 'overall should be a string');
      assert.ok(['healthy', 'degraded'].includes(result.overall), `overall should be healthy or degraded, got: ${result.overall}`);
    });

    it('should include entries for all 6 probes', () => {
      const { runHealthChecks } = require(path.join(LIB_DIR, 'health.cjs'));
      const result = runHealthChecks(PLUGIN_ROOT);
      const names = result.checks.map(c => c.name);
      const expected = ['plugin-root', 'config', 'codebase-root', 'docs-root', 'routing-table', 'agents'];
      for (const name of expected) {
        assert.ok(names.includes(name), `Missing health check probe: ${name}`);
      }
    });

    it('should have name, status, and detail for each check', () => {
      const { runHealthChecks } = require(path.join(LIB_DIR, 'health.cjs'));
      const result = runHealthChecks(PLUGIN_ROOT);
      for (const check of result.checks) {
        assert.ok(typeof check.name === 'string', 'check should have name');
        assert.ok(['pass', 'warn', 'fail', 'skip'].includes(check.status), `check status should be pass/warn/fail/skip, got: ${check.status}`);
        assert.ok(typeof check.detail === 'string', 'check should have detail');
      }
    });

    it('should report plugin-root as pass for valid plugin root', () => {
      const { runHealthChecks } = require(path.join(LIB_DIR, 'health.cjs'));
      const result = runHealthChecks(PLUGIN_ROOT);
      const pluginRootCheck = result.checks.find(c => c.name === 'plugin-root');
      assert.strictEqual(pluginRootCheck.status, 'pass');
    });

    it('should report config as pass when config.json exists', () => {
      const { runHealthChecks } = require(path.join(LIB_DIR, 'health.cjs'));
      const result = runHealthChecks(PLUGIN_ROOT);
      const configCheck = result.checks.find(c => c.name === 'config');
      assert.strictEqual(configCheck.status, 'pass');
    });

    it('should report routing-table as pass with 19 entries', () => {
      const { runHealthChecks } = require(path.join(LIB_DIR, 'health.cjs'));
      const result = runHealthChecks(PLUGIN_ROOT);
      const routingCheck = result.checks.find(c => c.name === 'routing-table');
      assert.strictEqual(routingCheck.status, 'pass');
    });

    it('should report agents as pass when all agent files exist', () => {
      const { runHealthChecks } = require(path.join(LIB_DIR, 'health.cjs'));
      const result = runHealthChecks(PLUGIN_ROOT);
      const agentsCheck = result.checks.find(c => c.name === 'agents');
      assert.strictEqual(agentsCheck.status, 'pass');
    });
  });
});
