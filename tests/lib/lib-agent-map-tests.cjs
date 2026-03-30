'use strict';

// Tests for lib/agent-map.cjs
// Covers AGENT_NAME_MAP, STAGE_AUTHORITY_MAP, lookup functions,
// and cross-map consistency between the two registries.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const agentMap = require(path.resolve(__dirname, '..', '..', 'lib', 'agent-map.cjs'));

// ── Module Exports ──────────────────────────────────────────────────────────

describe('agent-map exports', () => {
  it('should export AGENT_NAME_MAP as a plain object', () => {
    assert.equal(typeof agentMap.AGENT_NAME_MAP, 'object');
    assert.ok(!Array.isArray(agentMap.AGENT_NAME_MAP));
  });

  it('should export STAGE_AUTHORITY_MAP as a plain object', () => {
    assert.equal(typeof agentMap.STAGE_AUTHORITY_MAP, 'object');
    assert.ok(!Array.isArray(agentMap.STAGE_AUTHORITY_MAP));
  });

  it('should export all 7 expected members', () => {
    const expected = [
      'AGENT_NAME_MAP',
      'STAGE_AUTHORITY_MAP',
      'getCanonicalName',
      'getPhaseAuthority',
      'isGsdAgentName',
      'getGsdAgentNames',
      'getCanonicalNames',
    ];
    for (const name of expected) {
      assert.ok(name in agentMap, `missing export: ${name}`);
    }
  });
});

// ── AGENT_NAME_MAP ──────────────────────────────────────────────────────────

describe('AGENT_NAME_MAP', () => {
  const map = agentMap.AGENT_NAME_MAP;

  it('should have 11 GSD agent entries', () => {
    assert.equal(Object.keys(map).length, 11);
  });

  it('should map all known GSD agent names to canonical short names', () => {
    const expected = {
      'fp-docs-modifier':            'modify',
      'fp-docs-validator':           'validate',
      'fp-docs-citations':           'citations',
      'fp-docs-api-refs':            'api-refs',
      'fp-docs-locals':              'locals',
      'fp-docs-researcher':          'researcher',
      'fp-docs-planner':             'planner',
      'fp-docs-verbosity':           'verbosity',
      'fp-docs-verbosity-enforcer':  'verbosity-enforcer',
      'fp-docs-indexer':             'index',
      'fp-docs-system':              'system',
    };
    for (const [gsd, canonical] of Object.entries(expected)) {
      assert.equal(map[gsd], canonical, `${gsd} should map to ${canonical}`);
    }
  });

  it('all keys should have fp-docs- prefix', () => {
    for (const key of Object.keys(map)) {
      assert.ok(key.startsWith('fp-docs-'), `key ${key} missing fp-docs- prefix`);
    }
  });

  it('all values should be non-empty strings', () => {
    for (const [key, val] of Object.entries(map)) {
      assert.equal(typeof val, 'string', `value for ${key} should be string`);
      assert.ok(val.length > 0, `value for ${key} should be non-empty`);
    }
  });

  it('all values should be unique (no duplicate canonical names)', () => {
    const values = Object.values(map);
    const unique = new Set(values);
    assert.equal(unique.size, values.length, 'canonical names should be unique');
  });
});

// ── STAGE_AUTHORITY_MAP ─────────────────────────────────────────────────────

describe('STAGE_AUTHORITY_MAP', () => {
  const map = agentMap.STAGE_AUTHORITY_MAP;

  it('should have 17 entries (8 GSD + 9 canonical)', () => {
    assert.equal(Object.keys(map).length, 17);
  });

  it('all values should be valid pipeline phases', () => {
    const validPhases = new Set(['research', 'plan', 'write', 'review', 'finalize']);
    for (const [key, phase] of Object.entries(map)) {
      assert.ok(validPhases.has(phase), `${key} has invalid phase: ${phase}`);
    }
  });

  it('GSD names and their canonical equivalents should map to the same phase', () => {
    const gsdEntries = Object.entries(map).filter(([k]) => k.startsWith('fp-docs-'));
    for (const [gsdName, gsdPhase] of gsdEntries) {
      const canonical = agentMap.getCanonicalName(gsdName);
      const canonicalPhase = map[canonical];
      if (canonicalPhase !== undefined) {
        assert.equal(gsdPhase, canonicalPhase,
          `${gsdName} (${gsdPhase}) and ${canonical} (${canonicalPhase}) should have same phase`);
      }
    }
  });

  it('orchestrate should map to finalize', () => {
    assert.equal(map['orchestrate'], 'finalize');
  });

  it('fp-docs-verbosity-enforcer should map to write', () => {
    assert.equal(map['fp-docs-verbosity-enforcer'], 'write');
  });

  it('fp-docs-validator should map to review', () => {
    assert.equal(map['fp-docs-validator'], 'review');
  });
});

// ── getCanonicalName ────────────────────────────────────────────────────────

describe('getCanonicalName', () => {
  it('should resolve GSD name to canonical short name', () => {
    assert.equal(agentMap.getCanonicalName('fp-docs-modifier'), 'modify');
    assert.equal(agentMap.getCanonicalName('fp-docs-validator'), 'validate');
    assert.equal(agentMap.getCanonicalName('fp-docs-verbosity-enforcer'), 'verbosity-enforcer');
  });

  it('should return input unchanged for already-canonical names', () => {
    assert.equal(agentMap.getCanonicalName('modify'), 'modify');
    assert.equal(agentMap.getCanonicalName('validate'), 'validate');
  });

  it('should return input unchanged for unknown names', () => {
    assert.equal(agentMap.getCanonicalName('fp-docs-unknown'), 'fp-docs-unknown');
    assert.equal(agentMap.getCanonicalName('random-agent'), 'random-agent');
  });

  it('should return empty string for null/undefined/non-string', () => {
    assert.equal(agentMap.getCanonicalName(null), '');
    assert.equal(agentMap.getCanonicalName(undefined), '');
    assert.equal(agentMap.getCanonicalName(42), '');
    assert.equal(agentMap.getCanonicalName(''), '');
  });
});

// ── getPhaseAuthority ───────────────────────────────────────────────────────

describe('getPhaseAuthority', () => {
  it('should return phase for GSD agent names', () => {
    assert.equal(agentMap.getPhaseAuthority('fp-docs-modifier'), 'write');
    assert.equal(agentMap.getPhaseAuthority('fp-docs-researcher'), 'research');
    assert.equal(agentMap.getPhaseAuthority('fp-docs-validator'), 'review');
  });

  it('should return phase for canonical short names', () => {
    assert.equal(agentMap.getPhaseAuthority('modify'), 'write');
    assert.equal(agentMap.getPhaseAuthority('researcher'), 'research');
    assert.equal(agentMap.getPhaseAuthority('orchestrate'), 'finalize');
  });

  it('should return undefined for agents without phase authority', () => {
    assert.equal(agentMap.getPhaseAuthority('fp-docs-system'), undefined);
    assert.equal(agentMap.getPhaseAuthority('fp-docs-indexer'), undefined);
    assert.equal(agentMap.getPhaseAuthority('fp-docs-verbosity'), undefined);
  });

  it('should return undefined for null/undefined/non-string', () => {
    assert.equal(agentMap.getPhaseAuthority(null), undefined);
    assert.equal(agentMap.getPhaseAuthority(undefined), undefined);
    assert.equal(agentMap.getPhaseAuthority(123), undefined);
  });
});

// ── isGsdAgentName ──────────────────────────────────────────────────────────

describe('isGsdAgentName', () => {
  it('should return true for GSD agent names', () => {
    assert.equal(agentMap.isGsdAgentName('fp-docs-modifier'), true);
    assert.equal(agentMap.isGsdAgentName('fp-docs-verbosity-enforcer'), true);
  });

  it('should return false for canonical short names', () => {
    assert.equal(agentMap.isGsdAgentName('modify'), false);
    assert.equal(agentMap.isGsdAgentName('validate'), false);
  });

  it('should return false for unknown names', () => {
    assert.equal(agentMap.isGsdAgentName('fp-docs-unknown'), false);
    assert.equal(agentMap.isGsdAgentName(''), false);
  });
});

// ── getGsdAgentNames / getCanonicalNames ────────────────────────────────────

describe('getGsdAgentNames', () => {
  it('should return an array of 11 GSD agent names', () => {
    const names = agentMap.getGsdAgentNames();
    assert.ok(Array.isArray(names));
    assert.equal(names.length, 11);
  });

  it('all returned names should start with fp-docs-', () => {
    for (const name of agentMap.getGsdAgentNames()) {
      assert.ok(name.startsWith('fp-docs-'), `${name} missing fp-docs- prefix`);
    }
  });
});

describe('getCanonicalNames', () => {
  it('should return an array of 11 canonical names', () => {
    const names = agentMap.getCanonicalNames();
    assert.ok(Array.isArray(names));
    assert.equal(names.length, 11);
  });

  it('should include modify, validate, citations, verbosity-enforcer', () => {
    const names = agentMap.getCanonicalNames();
    assert.ok(names.includes('modify'));
    assert.ok(names.includes('validate'));
    assert.ok(names.includes('citations'));
    assert.ok(names.includes('verbosity-enforcer'));
  });
});

// ── Cross-Map Consistency ───────────────────────────────────────────────────

describe('cross-map consistency', () => {
  it('every GSD name in STAGE_AUTHORITY_MAP should exist in AGENT_NAME_MAP', () => {
    const gsdStageKeys = Object.keys(agentMap.STAGE_AUTHORITY_MAP)
      .filter(k => k.startsWith('fp-docs-'));
    for (const gsdName of gsdStageKeys) {
      assert.ok(gsdName in agentMap.AGENT_NAME_MAP,
        `${gsdName} is in STAGE_AUTHORITY_MAP but missing from AGENT_NAME_MAP`);
    }
  });

  it('every canonical name in STAGE_AUTHORITY_MAP should be a value in AGENT_NAME_MAP (except orchestrate)', () => {
    const canonicalStageKeys = Object.keys(agentMap.STAGE_AUTHORITY_MAP)
      .filter(k => !k.startsWith('fp-docs-'));
    const canonicalValues = new Set(Object.values(agentMap.AGENT_NAME_MAP));
    for (const canonicalName of canonicalStageKeys) {
      if (canonicalName === 'orchestrate') continue; // orchestrate is not in AGENT_NAME_MAP (it's the orchestrator itself)
      assert.ok(canonicalValues.has(canonicalName),
        `${canonicalName} is in STAGE_AUTHORITY_MAP but not a value in AGENT_NAME_MAP`);
    }
  });
});
