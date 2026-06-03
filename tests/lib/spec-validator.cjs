'use strict';

// Behavioral spec structural validation module.
// Validates that behavioral spec files in tests/specs/ have correct
// routing metadata matching the routing table in lib/routing.cjs
// and corresponding command/workflow files on disk.
//
// Uses parseFrontmatter from frontmatter-parser.cjs to parse spec files,
// then cross-references against the canonical routing table.
//
// Registered in run.cjs as the --commands test module.

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('./frontmatter-parser.cjs');

const SPECS_DIR = path.join(__dirname, '..', 'specs');
const PLUGIN_ROOT = path.resolve(__dirname, '..', '..');

const { getRoutingTable } = require(path.join(PLUGIN_ROOT, 'lib', 'routing.cjs'));
const routingTable = getRoutingTable();

// Valid type values for behavioral specs
const VALID_TYPES = ['write', 'read', 'admin', 'batch', 'meta'];

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

  it('covers all 21 document-operation commands', () => {
    assert.strictEqual(
      documentSpecs.length,
      21,
      `Expected 21 document-operation spec files, found ${documentSpecs.length}: ${documentSpecs.join(', ')}`
    );
  });

  it('has 2 meta-command specs', () => {
    assert.strictEqual(
      metaSpecs.length,
      2,
      `Expected 2 meta-command spec files, found ${metaSpecs.length}: ${metaSpecs.join(', ')}`
    );
  });

  it('total spec count matches routing table (23)', () => {
    assert.strictEqual(
      specFiles.length,
      Object.keys(routingTable).length,
      `Expected ${Object.keys(routingTable).length} spec files matching routing table, found ${specFiles.length}`
    );
  });

  for (const specFile of specFiles) {
    const commandName = specFile.replace('.md', '');
    const specPath = path.join(SPECS_DIR, specFile);
    const specContent = fs.readFileSync(specPath, 'utf-8');
    const { frontmatter: specFm, body: specBody } = parseFrontmatter(specContent);

    const route = routingTable[commandName];

    describe(`Command: ${commandName}`, () => {

      it('has a corresponding command file', () => {
        const commandPath = path.join(PLUGIN_ROOT, 'commands', 'fp-docs', `${commandName}.md`);
        assert.ok(
          fs.existsSync(commandPath),
          `Command file not found at commands/${commandName}.md`
        );
      });

      it('has a routing table entry', () => {
        assert.ok(
          route,
          `No routing table entry for command "${commandName}"`
        );
      });

      // Only run routing-dependent tests if the route exists
      if (route) {
        it('spec agent matches routing table', () => {
          const expectedAgent = route.agent || 'none';
          assert.strictEqual(
            specFm.agent,
            expectedAgent,
            `Spec agent "${specFm.agent}" does not match routing table agent "${expectedAgent}"`
          );
        });

        it('spec type matches routing table', () => {
          assert.strictEqual(
            specFm.type,
            route.type,
            `Spec type "${specFm.type}" does not match routing table type "${route.type}"`
          );
        });

        it('spec workflow file exists', () => {
          const workflowPath = path.join(PLUGIN_ROOT, specFm.workflow);
          assert.ok(
            fs.existsSync(workflowPath),
            `Workflow file not found at ${specFm.workflow}`
          );
        });

        it('spec workflow matches routing table', () => {
          const expectedWorkflow = `workflows/${route.workflow}`;
          assert.strictEqual(
            specFm.workflow,
            expectedWorkflow,
            `Spec workflow "${specFm.workflow}" does not match routing table "workflows/${route.workflow}"`
          );
        });
      }

      it('has required frontmatter fields', () => {
        const requiredFields = ['command', 'engine', 'workflow', 'agent', 'type'];
        for (const field of requiredFields) {
          assert.ok(
            specFm[field],
            `Spec "${commandName}" missing required frontmatter field: ${field}`
          );
        }
      });

      it('type is one of: write, read, admin, batch, meta', () => {
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
