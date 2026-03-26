'use strict';

// Structural JSON matcher with regex pattern support for env-dependent values.
// Values wrapped in {{ }} in expected fixtures are treated as regex patterns.
//
// Example:
//   expected: { "path": "{{/.*docs/}}" }
//   actual:   { "path": "/Users/tom/themes/foreign-policy-2017/docs/" }
//   Result: PASS (regex matches)

const assert = require('node:assert');

/**
 * Assert that actual JSON structurally matches expected JSON.
 * Supports regex patterns wrapped in {{ }} for environment-dependent values.
 *
 * @param {*} actual - The actual value to check
 * @param {*} expected - The expected value (may contain {{ regex }} patterns)
 * @param {string} [path=''] - Dot-delimited path for error messages
 * @throws {AssertionError} On mismatch
 */
function assertStructuralMatch(actual, expected, path = '') {
  if (expected === null || expected === undefined) {
    assert.strictEqual(actual, expected, `${path}: expected ${expected}, got ${actual}`);
    return;
  }

  if (typeof expected === 'string' && expected.startsWith('{{') && expected.endsWith('}}')) {
    // Regex pattern value
    const pattern = expected.slice(2, -2);
    const regex = new RegExp(pattern);
    assert.ok(
      typeof actual === 'string',
      `${path}: expected string for regex match, got ${typeof actual}`
    );
    assert.match(actual, regex, `${path}: value "${actual}" did not match pattern /${pattern}/`);
    return;
  }

  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), `${path}: expected array, got ${typeof actual}`);
    assert.strictEqual(
      actual.length,
      expected.length,
      `${path}: array length mismatch (actual: ${actual.length}, expected: ${expected.length})`
    );
    for (let i = 0; i < expected.length; i++) {
      assertStructuralMatch(actual[i], expected[i], `${path}[${i}]`);
    }
    return;
  }

  if (typeof expected === 'object') {
    assert.ok(
      typeof actual === 'object' && actual !== null,
      `${path}: expected object, got ${actual === null ? 'null' : typeof actual}`
    );
    for (const key of Object.keys(expected)) {
      assert.ok(
        key in actual,
        `Missing key "${path ? path + '.' : ''}${key}" in actual output`
      );
      assertStructuralMatch(actual[key], expected[key], `${path ? path + '.' : ''}${key}`);
    }
    return;
  }

  // Primitive value -- exact match
  assert.deepStrictEqual(
    actual,
    expected,
    `${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
  );
}

/**
 * Format a human-readable diff string showing the first difference
 * between actual and expected values.
 *
 * @param {*} actual - The actual value
 * @param {*} expected - The expected value
 * @param {string} [path=''] - Current path in the object tree
 * @returns {string} Human-readable diff description
 */
function formatDiff(actual, expected, path = '') {
  if (expected === null || expected === undefined) {
    if (actual !== expected) {
      return `${path || 'root'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
    }
    return '';
  }

  if (typeof expected === 'string' && expected.startsWith('{{') && expected.endsWith('}}')) {
    const pattern = expected.slice(2, -2);
    const regex = new RegExp(pattern);
    if (typeof actual !== 'string' || !regex.test(actual)) {
      return `${path || 'root'}: value ${JSON.stringify(actual)} did not match pattern /${pattern}/`;
    }
    return '';
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      return `${path || 'root'}: expected array, got ${typeof actual}`;
    }
    if (actual.length !== expected.length) {
      return `${path || 'root'}: array length mismatch (actual: ${actual.length}, expected: ${expected.length})`;
    }
    for (let i = 0; i < expected.length; i++) {
      const diff = formatDiff(actual[i], expected[i], `${path}[${i}]`);
      if (diff) return diff;
    }
    return '';
  }

  if (typeof expected === 'object') {
    if (typeof actual !== 'object' || actual === null) {
      return `${path || 'root'}: expected object, got ${actual === null ? 'null' : typeof actual}`;
    }
    for (const key of Object.keys(expected)) {
      const keyPath = path ? `${path}.${key}` : key;
      if (!(key in actual)) {
        return `${keyPath}: key missing in actual output`;
      }
      const diff = formatDiff(actual[key], expected[key], keyPath);
      if (diff) return diff;
    }
    return '';
  }

  if (actual !== expected) {
    return `${path || 'root'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
  }
  return '';
}

module.exports = { assertStructuralMatch, formatDiff };
