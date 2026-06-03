'use strict';

// Tests for lib/model-profiles.cjs
// Covers resolveModel, listModels.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const LIB_DIR = path.resolve(__dirname, '..', '..', 'lib');

describe('lib/model-profiles.cjs', () => {
  it('should be requireable', () => {
    const mp = require(path.join(LIB_DIR, 'model-profiles.cjs'));
    assert.ok(mp);
  });

  it('should export resolveModel, listModels, cmdResolveModel', () => {
    const mp = require(path.join(LIB_DIR, 'model-profiles.cjs'));
    assert.equal(typeof mp.resolveModel, 'function');
    assert.equal(typeof mp.listModels, 'function');
    assert.equal(typeof mp.cmdResolveModel, 'function');
  });

  describe('resolveModel', () => {
    it('should resolve fp-docs-modifier to a model name', () => {
      const { resolveModel } = require(path.join(LIB_DIR, 'model-profiles.cjs'));
      const model = resolveModel('fp-docs-modifier');
      assert.equal(typeof model, 'string');
      assert.ok(model.length > 0, 'model name should be non-empty');
    });

    it('should return fallback for unknown agent', () => {
      const { resolveModel } = require(path.join(LIB_DIR, 'model-profiles.cjs'));
      const model = resolveModel('nonexistent-agent');
      assert.equal(typeof model, 'string');
      assert.ok(model.length > 0, 'should return fallback model');
    });

    it('should resolve fp-docs-validator', () => {
      const { resolveModel } = require(path.join(LIB_DIR, 'model-profiles.cjs'));
      const model = resolveModel('fp-docs-validator');
      assert.equal(typeof model, 'string');
    });
  });

  describe('listModels', () => {
    it('should return an object mapping agents to models', () => {
      const { listModels } = require(path.join(LIB_DIR, 'model-profiles.cjs'));
      const models = listModels();
      assert.equal(typeof models, 'object');
      assert.ok(Object.keys(models).length > 0, 'should have at least one agent mapping');
    });
  });
});
