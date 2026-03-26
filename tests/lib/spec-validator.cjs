'use strict';

// Behavioral spec structural validation module.
// Validates that behavioral spec files in tests/specs/ have correct
// routing metadata matching actual skill files in skills/.
//
// Uses parseFrontmatter and parseBodyField from frontmatter-parser.cjs
// to parse both spec files and skill files, then cross-references
// their routing metadata.
//
// Registered in run.cjs as the --commands test module.

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter, parseBodyField } = require('./frontmatter-parser.cjs');

const SPECS_DIR = path.join(__dirname, '..', 'specs');
const SKILLS_DIR = path.resolve(__dirname, '..', '..', 'skills');

// Valid type values for behavioral specs
const VALID_TYPES = ['write', 'read', 'admin', 'batch', 'varies', 'meta'];

// Auto-discover all .md files in specs directory
const specFiles = fs.readdirSync(SPECS_DIR)
  .filter(f => f.endsWith('.md'))
  .sort();

// Separate document-operation specs from meta-command specs
const metaSpecs = [];
const documentSpecs = [];
for (const specFile of specFiles) {
  const specPath = path.join(SPECS_DIR, specFile);
  const specContent = fs.readFileSync(specPath, 'utf-8');
  const { frontmatter } = parseFrontmatter(specContent);
  if (frontmatter.type === 'meta') {
    metaSpecs.push(specFile);
  } else {
    documentSpecs.push(specFile);
  }
}

describe('Behavioral Specs', () => {

  it('covers all 20 document-operation commands', () => {
    assert.strictEqual(
      documentSpecs.length,
      20,
      `Expected 20 document-operation spec files, found ${documentSpecs.length}: ${documentSpecs.join(', ')}`
    );
  });

  it('has meta-command specs', () => {
    assert.ok(
      metaSpecs.length > 0,
      `Expected at least 1 meta-command spec file, found ${metaSpecs.length}`
    );
  });

  for (const specFile of specFiles) {
    const commandName = specFile.replace('.md', '');
    const specPath = path.join(SPECS_DIR, specFile);
    const specContent = fs.readFileSync(specPath, 'utf-8');
    const { frontmatter: specFm, body: specBody } = parseFrontmatter(specContent);

    // Locate corresponding skill file
    const skillPath = path.join(SKILLS_DIR, commandName, 'SKILL.md');

    describe(`Command: ${commandName}`, () => {

      it('has a corresponding skill file', () => {
        assert.ok(
          fs.existsSync(skillPath),
          `Skill file not found at ${skillPath}`
        );
      });

      // Only run skill-dependent tests if the skill file exists
      if (fs.existsSync(skillPath)) {
        const skillContent = fs.readFileSync(skillPath, 'utf-8');
        const { frontmatter: skillFm, body: skillBody } = parseFrontmatter(skillContent);

        it('spec engine matches skill Engine field', () => {
          const skillEngine = parseBodyField(skillBody, 'Engine');
          assert.ok(skillEngine, 'Skill file missing Engine field in body');
          assert.strictEqual(
            specFm.engine,
            skillEngine,
            `Spec engine "${specFm.engine}" does not match skill Engine "${skillEngine}"`
          );
        });

        it('spec agent matches skill agent frontmatter', () => {
          assert.strictEqual(
            specFm.agent,
            skillFm.agent,
            `Spec agent "${specFm.agent}" does not match skill agent "${skillFm.agent}"`
          );
        });

        it('spec context matches skill context frontmatter', () => {
          assert.strictEqual(
            specFm.context,
            skillFm.context,
            `Spec context "${specFm.context}" does not match skill context "${skillFm.context}"`
          );
        });
      }

      it('has required frontmatter fields', () => {
        const requiredFields = ['command', 'engine', 'agent', 'context', 'type'];
        for (const field of requiredFields) {
          assert.ok(
            specFm[field],
            `Spec "${commandName}" missing required frontmatter field: ${field}`
          );
        }
      });

      it('type is one of: write, read, admin, batch, varies, meta', () => {
        assert.ok(
          VALID_TYPES.includes(specFm.type),
          `Spec "${commandName}" has invalid type "${specFm.type}". Must be one of: ${VALID_TYPES.join(', ')}`
        );
      });

      it('body contains Routing Path section', () => {
        assert.match(
          specBody,
          /## Routing Path/,
          `Spec "${commandName}" missing "## Routing Path" section in body`
        );
      });

      it('body contains Expected Markers or Error Paths section', () => {
        assert.match(
          specBody,
          /## (Expected Markers|Error Paths|Pipeline Stages)/,
          `Spec "${commandName}" missing "## Expected Markers", "## Error Paths", or "## Pipeline Stages" section in body`
        );
      });
    });
  }
});
