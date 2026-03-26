'use strict';

// Pipeline marker registry verification module.
// Validates that pipeline-registry.json has correct structure,
// all marker patterns are valid regexes, all checked_by scripts
// exist on disk, and transcript excerpts contain expected markers.
//
// Registered in run.cjs as the --markers test module.

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const MARKERS_DIR = path.join(__dirname, '..', 'markers');
const LIB_DIR = path.resolve(__dirname, '..', '..', 'lib');

const registryPath = path.join(MARKERS_DIR, 'pipeline-registry.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));

const writeExcerptPath = path.join(MARKERS_DIR, 'write-operation-excerpt.md');
const readExcerptPath = path.join(MARKERS_DIR, 'read-operation-excerpt.md');

// Valid type values for markers
const VALID_TYPES = ['positive', 'negative', 'detection'];

// Valid applies_to values
const VALID_APPLIES_TO = [
  'write_operations',
  'orchestrated_operations',
  'delegated_teammates',
  'write_tasks',
  'all_tasks'
];

describe('Pipeline Marker Registry', () => {

  it('has markers array', () => {
    assert.ok(Array.isArray(registry.markers), 'Registry must have a markers array');
    assert.ok(registry.markers.length > 0, 'Markers array must not be empty');
  });

  it('has completion_format containing Pipeline complete:', () => {
    assert.ok(
      typeof registry.completion_format === 'string',
      'Registry must have a completion_format string'
    );
    assert.match(
      registry.completion_format,
      /Pipeline complete:/,
      'completion_format must contain "Pipeline complete:"'
    );
  });

  for (const marker of registry.markers) {

    describe(`Marker: ${marker.name}`, () => {

      it('has required fields: name, pattern, checked_by, applies_to, type', () => {
        assert.ok(marker.name, 'Marker must have a name');
        assert.ok(marker.pattern, 'Marker must have a pattern');
        assert.ok(marker.checked_by, 'Marker must have checked_by');
        assert.ok(marker.applies_to, 'Marker must have applies_to');
        assert.ok(marker.type, 'Marker must have type');
      });

      it('has a valid regex pattern', () => {
        const flags = marker.flags || '';
        assert.doesNotThrow(
          () => new RegExp(marker.pattern, flags),
          `Pattern "${marker.pattern}" with flags "${flags}" is not a valid regex`
        );
      });

      it('checked_by references existing CJS modules', () => {
        const modules = Array.isArray(marker.checked_by)
          ? marker.checked_by
          : [marker.checked_by];
        for (const mod of modules) {
          const modPath = path.join(LIB_DIR, mod);
          assert.ok(
            fs.existsSync(modPath),
            `CJS module not found: ${modPath}`
          );
        }
      });

      it('type is one of: positive, negative, detection', () => {
        assert.ok(
          VALID_TYPES.includes(marker.type),
          `Marker "${marker.name}" has invalid type "${marker.type}". Must be one of: ${VALID_TYPES.join(', ')}`
        );
      });

      it('applies_to is a recognized category', () => {
        assert.ok(
          VALID_APPLIES_TO.includes(marker.applies_to),
          `Marker "${marker.name}" has invalid applies_to "${marker.applies_to}". Must be one of: ${VALID_APPLIES_TO.join(', ')}`
        );
      });
    });
  }
});

describe('Transcript Excerpts', () => {

  it('write-operation-excerpt.md exists', () => {
    assert.ok(
      fs.existsSync(writeExcerptPath),
      `Write operation excerpt not found at ${writeExcerptPath}`
    );
  });

  it('write excerpt contains Pipeline complete: marker', () => {
    const content = fs.readFileSync(writeExcerptPath, 'utf-8');
    assert.match(
      content,
      /Pipeline complete:/,
      'Write excerpt must contain "Pipeline complete:" marker'
    );
  });

  it('write excerpt contains changelog updated marker', () => {
    const content = fs.readFileSync(writeExcerptPath, 'utf-8');
    assert.match(
      content,
      /changelog.*updated/i,
      'Write excerpt must contain changelog updated marker'
    );
  });

  it('write excerpt contains delegation marker', () => {
    const content = fs.readFileSync(writeExcerptPath, 'utf-8');
    assert.match(
      content,
      /delegation result|agents? used/i,
      'Write excerpt must contain delegation marker'
    );
  });

  it('read-operation-excerpt.md exists', () => {
    assert.ok(
      fs.existsSync(readExcerptPath),
      `Read operation excerpt not found at ${readExcerptPath}`
    );
  });

  it('read excerpt does NOT contain Pipeline complete: marker', () => {
    const content = fs.readFileSync(readExcerptPath, 'utf-8');
    assert.doesNotMatch(
      content,
      /Pipeline complete:/,
      'Read excerpt must NOT contain "Pipeline complete:" marker (read ops skip full pipeline)'
    );
  });
});
