'use strict';

// Tests for fp-docs/plugins/fp-docs/lib/paths.cjs
// TDD RED phase: These tests should fail until the module is implemented.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const LIB_DIR = path.resolve(__dirname, '..', '..', 'plugins', 'fp-docs', 'lib');

describe('lib/paths.cjs', () => {
  it('should be requireable', () => {
    const paths = require(path.join(LIB_DIR, 'paths.cjs'));
    assert.ok(paths);
  });

  it('should export getPluginRoot, getCodebaseRoot, getDocsRoot, resolvePath, getAllPaths', () => {
    const paths = require(path.join(LIB_DIR, 'paths.cjs'));
    assert.equal(typeof paths.getPluginRoot, 'function');
    assert.equal(typeof paths.getCodebaseRoot, 'function');
    assert.equal(typeof paths.getDocsRoot, 'function');
    assert.equal(typeof paths.resolvePath, 'function');
    assert.equal(typeof paths.getAllPaths, 'function');
  });

  describe('getPluginRoot', () => {
    it('should return a path containing plugins/fp-docs', () => {
      const paths = require(path.join(LIB_DIR, 'paths.cjs'));
      const root = paths.getPluginRoot();
      assert.ok(root.includes(path.join('plugins', 'fp-docs')));
    });

    it('should return a path that exists on disk', () => {
      const paths = require(path.join(LIB_DIR, 'paths.cjs'));
      const root = paths.getPluginRoot();
      assert.ok(fs.existsSync(root));
    });
  });

  describe('getCodebaseRoot', () => {
    it('should return a path or null', () => {
      const paths = require(path.join(LIB_DIR, 'paths.cjs'));
      const root = paths.getCodebaseRoot();
      assert.ok(root === null || typeof root === 'string');
    });
  });

  describe('getDocsRoot', () => {
    it('should return { path: null, exists: false, hasGit: false } when codebaseRoot is null', () => {
      const paths = require(path.join(LIB_DIR, 'paths.cjs'));
      const result = paths.getDocsRoot(null);
      assert.equal(result.path, null);
      assert.equal(result.exists, false);
      assert.equal(result.hasGit, false);
    });

    it('should return { path: string, exists: false, hasGit: false } for nonexistent codebase', () => {
      const paths = require(path.join(LIB_DIR, 'paths.cjs'));
      const result = paths.getDocsRoot('/nonexistent');
      assert.equal(typeof result.path, 'string');
      assert.equal(result.exists, false);
      assert.equal(result.hasGit, false);
    });
  });

  describe('resolvePath', () => {
    it('should resolve a relative path against a base', () => {
      const paths = require(path.join(LIB_DIR, 'paths.cjs'));
      const pluginRoot = paths.getPluginRoot();
      const result = paths.resolvePath('lib/core.cjs', pluginRoot);
      assert.ok(path.isAbsolute(result));
      assert.ok(result.endsWith(path.join('lib', 'core.cjs')));
    });
  });

  describe('getAllPaths', () => {
    it('should return an object with pluginRoot, codebaseRoot, docsRoot keys', () => {
      const paths = require(path.join(LIB_DIR, 'paths.cjs'));
      const all = paths.getAllPaths();
      assert.ok('pluginRoot' in all);
      assert.ok('codebaseRoot' in all);
      assert.ok('docsRoot' in all);
    });
  });
});
