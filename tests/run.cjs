#!/usr/bin/env node
'use strict';

// CJS test runner entry point for fp-docs characterization tests.
// Zero external dependencies -- uses only Node.js built-ins.
//
// Usage:
//   node fp-docs/tests/run.cjs              # Run all test suites
//   node fp-docs/tests/run.cjs --hooks      # Golden file tests for hook scripts
//   node fp-docs/tests/run.cjs --hooks-ab   # A/B comparison tests (CJS vs bash hooks)
//   node fp-docs/tests/run.cjs --commands   # Behavioral spec validation for commands
//   node fp-docs/tests/run.cjs --markers    # Pipeline marker registry verification
//   node fp-docs/tests/run.cjs --cli        # CLI integration tests for fp-tools.cjs
//   node fp-docs/tests/run.cjs --state      # State module unit tests
//   node fp-docs/tests/run.cjs --git        # Git module unit tests
//   node fp-docs/tests/run.cjs --locals-cli # Locals CLI module tests
//   node fp-docs/tests/run.cjs --pipeline   # Pipeline engine unit tests
//   node fp-docs/tests/run.cjs --engine-compliance # Engine CJS migration compliance tests
//
// Per decisions D-07, D-08, D-09 from 01-CONTEXT.md

const { run } = require('node:test');
const { spec } = require('node:test/reporters');
const path = require('node:path');

const args = process.argv.slice(2);
const filters = {
  hooks: args.includes('--hooks'),
  'hooks-ab': args.includes('--hooks-ab'),
  'locals-cli': args.includes('--locals-cli'),
  commands: args.includes('--commands'),
  markers: args.includes('--markers'),
  cli: args.includes('--cli'),
  state: args.includes('--state'),
  git: args.includes('--git'),
  pipeline: args.includes('--pipeline'),
  drift: args.includes('--drift'),
  'engine-compliance': args.includes('--engine-compliance'),
};
const runAll = !filters.hooks && !filters['hooks-ab'] && !filters['locals-cli'] && !filters.commands && !filters.markers && !filters.cli && !filters.state && !filters.git && !filters.pipeline && !filters.drift && !filters['engine-compliance'];

const testFiles = [];
if (runAll || filters.hooks) testFiles.push(path.join(__dirname, 'lib', 'fixture-runner.cjs'));
if (runAll || filters.commands) testFiles.push(path.join(__dirname, 'lib', 'spec-validator.cjs'));
if (runAll || filters.markers) testFiles.push(path.join(__dirname, 'lib', 'marker-checker.cjs'));
if (runAll || filters.cli) testFiles.push(path.join(__dirname, 'lib', 'cli-runner.cjs'));
if (runAll || filters.cli) testFiles.push(path.join(__dirname, 'lib', 'lib-routing-tests.cjs'));
if (runAll || filters.cli || filters.state) testFiles.push(path.join(__dirname, 'lib', 'lib-state-tests.cjs'));
if (runAll || filters.cli || filters.git) testFiles.push(path.join(__dirname, 'lib', 'lib-git-tests.cjs'));
if (runAll || filters['hooks-ab']) testFiles.push(path.join(__dirname, 'lib', 'hooks-ab-runner.cjs'));
if (runAll || filters.pipeline) testFiles.push(path.join(__dirname, 'lib', 'lib-pipeline-tests.cjs'));
if (runAll || filters.drift) testFiles.push(path.join(__dirname, 'lib', 'lib-drift-tests.cjs'));
if (runAll || filters['engine-compliance']) testFiles.push(path.join(__dirname, 'lib', 'lib-engine-compliance-tests.cjs'));

// Track failures for exit code (D-09)
let hasFailed = false;

const stream = run({ files: testFiles });

stream.on('test:fail', () => {
  hasFailed = true;
});

stream.compose(new spec()).pipe(process.stdout);

stream.on('end', () => {
  process.exitCode = hasFailed ? 1 : 0;
});
