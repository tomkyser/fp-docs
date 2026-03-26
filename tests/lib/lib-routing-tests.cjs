'use strict';

// Tests for lib/routing.cjs
// Covers lookupRoute, getRoutingTable, validateRoutes, and cmdHelp grouped output.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const LIB_DIR = path.resolve(__dirname, '..', '..', 'lib');

describe('lib/routing.cjs', () => {
  it('should be requireable', () => {
    const routing = require(path.join(LIB_DIR, 'routing.cjs'));
    assert.ok(routing);
  });

  it('should export lookupRoute, getRoutingTable, validateRoutes, cmdRoute, cmdHelp', () => {
    const routing = require(path.join(LIB_DIR, 'routing.cjs'));
    assert.equal(typeof routing.lookupRoute, 'function');
    assert.equal(typeof routing.getRoutingTable, 'function');
    assert.equal(typeof routing.validateRoutes, 'function');
    assert.equal(typeof routing.cmdRoute, 'function');
    assert.equal(typeof routing.cmdHelp, 'function');
  });

  describe('lookupRoute', () => {
    it('should return correct route for revise', () => {
      const { lookupRoute } = require(path.join(LIB_DIR, 'routing.cjs'));
      const route = lookupRoute('revise');
      assert.deepStrictEqual(route, { engine: 'modify', operation: 'revise', type: 'write' });
    });

    it('should return correct route for audit', () => {
      const { lookupRoute } = require(path.join(LIB_DIR, 'routing.cjs'));
      const route = lookupRoute('audit');
      assert.deepStrictEqual(route, { engine: 'validate', operation: 'audit', type: 'read' });
    });

    it('should return correct route for parallel', () => {
      const { lookupRoute } = require(path.join(LIB_DIR, 'routing.cjs'));
      const route = lookupRoute('parallel');
      assert.deepStrictEqual(route, { engine: 'orchestrate', operation: 'parallel', type: 'batch' });
    });

    it('should return null for nonexistent command', () => {
      const { lookupRoute } = require(path.join(LIB_DIR, 'routing.cjs'));
      const route = lookupRoute('nonexistent');
      assert.strictEqual(route, null);
    });

    it('should return correct route for citations', () => {
      const { lookupRoute } = require(path.join(LIB_DIR, 'routing.cjs'));
      const route = lookupRoute('citations');
      assert.deepStrictEqual(route, { engine: 'citations', operation: null, type: 'write' });
    });

    it('should return correct route for update-index', () => {
      const { lookupRoute } = require(path.join(LIB_DIR, 'routing.cjs'));
      const route = lookupRoute('update-index');
      assert.deepStrictEqual(route, { engine: 'index', operation: 'update-project-index', type: 'admin' });
    });

    it('should return correct route for remediate', () => {
      const { lookupRoute } = require(path.join(LIB_DIR, 'routing.cjs'));
      const route = lookupRoute('remediate');
      assert.deepStrictEqual(route, { engine: 'orchestrate', operation: 'remediate', type: 'write' });
    });

    it('should return correct route for update', () => {
      const { lookupRoute } = require(path.join(LIB_DIR, 'routing.cjs'));
      const route = lookupRoute('update');
      assert.deepStrictEqual(route, { engine: 'system', operation: 'update', type: 'admin' });
    });
  });

  describe('getRoutingTable', () => {
    it('should return object with exactly 21 command keys', () => {
      const { getRoutingTable } = require(path.join(LIB_DIR, 'routing.cjs'));
      const table = getRoutingTable();
      assert.strictEqual(Object.keys(table).length, 21);
    });

    it('should include all 21 expected command names', () => {
      const { getRoutingTable } = require(path.join(LIB_DIR, 'routing.cjs'));
      const table = getRoutingTable();
      const expected = [
        'revise', 'add', 'auto-update', 'auto-revise', 'deprecate',
        'audit', 'verify', 'sanity-check', 'test',
        'citations', 'api-ref', 'locals',
        'verbosity-audit',
        'update-index', 'update-claude',
        'update-skills', 'setup', 'sync',
        'parallel', 'remediate', 'update',
      ];
      for (const cmd of expected) {
        assert.ok(table[cmd], `Missing routing table entry for: ${cmd}`);
      }
    });

    it('should have engine, operation, and type for every entry', () => {
      const { getRoutingTable } = require(path.join(LIB_DIR, 'routing.cjs'));
      const table = getRoutingTable();
      for (const [cmd, route] of Object.entries(table)) {
        assert.ok('engine' in route, `${cmd} missing engine`);
        assert.ok('type' in route, `${cmd} missing type`);
        assert.ok('operation' in route, `${cmd} missing operation`);
      }
    });
  });

  describe('validateRoutes', () => {
    it('should validate all 21 skills match routing table', () => {
      const { validateRoutes } = require(path.join(LIB_DIR, 'routing.cjs'));
      const pluginRoot = path.resolve(__dirname, '..', '..');
      const result = validateRoutes(pluginRoot);
      assert.strictEqual(result.valid, true, `Expected valid=true, got mismatches: ${JSON.stringify(result.mismatches)}`);
      assert.strictEqual(result.mismatches.length, 0, `Expected 0 mismatches, got: ${JSON.stringify(result.mismatches)}`);
    });
  });

  describe('cmdHelp grouped output via CLI', () => {
    const fpTools = path.resolve(__dirname, '..', '..', 'fp-tools.cjs');

    it('should output grouped markdown when called with grouped subcommand', () => {
      const result = execFileSync('node', [fpTools, 'help', 'grouped', '--raw'], { encoding: 'utf-8' });
      assert.match(result, /# fp-docs Command Reference/);
    });

    it('should have all 4 type group headings', () => {
      const result = execFileSync('node', [fpTools, 'help', 'grouped', '--raw'], { encoding: 'utf-8' });
      assert.match(result, /## Documentation Creation & Modification/);
      assert.match(result, /## Validation & Auditing/);
      assert.match(result, /## System & Maintenance/);
      assert.match(result, /## Batch Operations/);
    });

    it('should include all 21 commands in grouped output', () => {
      const result = execFileSync('node', [fpTools, 'help', 'grouped', '--raw'], { encoding: 'utf-8' });
      const expectedCommands = [
        'revise', 'add', 'auto-update', 'auto-revise', 'deprecate',
        'audit', 'verify', 'sanity-check', 'test',
        'citations', 'api-ref', 'locals',
        'verbosity-audit',
        'update-index', 'update-claude',
        'update-skills', 'setup', 'sync',
        'parallel', 'remediate', 'update',
      ];
      for (const cmd of expectedCommands) {
        assert.match(result, new RegExp(`/fp-docs:${cmd}`), `Missing command: /fp-docs:${cmd}`);
      }
    });

    it('should preserve existing help output when called without subcommand', () => {
      const result = execFileSync('node', [fpTools, 'help', '--raw'], { encoding: 'utf-8' });
      assert.match(result, /revise - Fix specific documentation/);
      assert.match(result, /audit - Compare documentation against source code/);
    });

    it('should output valid JSON when called with grouped subcommand without --raw', () => {
      const result = execFileSync('node', [fpTools, 'help', 'grouped'], { encoding: 'utf-8' });
      const parsed = JSON.parse(result);
      assert.ok(parsed.markdown, 'should have markdown field');
      assert.match(parsed.markdown, /# fp-docs Command Reference/);
    });
  });
});
