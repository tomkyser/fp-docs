'use strict';

/**
 * Core -- Output protocol, error handling, and safe file I/O utilities.
 *
 * This module provides the foundational output contract for fp-tools:
 * - JSON to stdout by default
 * - --raw flag for pipe-friendly single values
 * - @file: protocol for large payloads (>50KB)
 * - Consistent exit codes (0 success, 1 error)
 *
 * Adapted from GSD's lib/core.cjs output protocol.
 * Zero external dependencies -- Node.js built-ins only (D-15).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ── Output Protocol ─────────────────────────────────────────────────────────

/**
 * Write structured output to stdout and exit 0.
 *
 * Default mode: serialize result as pretty-printed JSON.
 * Raw mode (raw=true): write rawValue as a string (for piping).
 * Large payloads (>50KB JSON): write to temp file, output @file: path.
 *
 * @param {any} result - The result object to serialize as JSON
 * @param {boolean} raw - Whether to use raw output mode
 * @param {any} [rawValue] - The value to write in raw mode
 */
function output(result, raw, rawValue) {
  if (raw && rawValue !== undefined) {
    process.stdout.write(String(rawValue));
  } else {
    const json = JSON.stringify(result, null, 2);
    // Large payloads exceed Claude Code's Bash tool buffer (~50KB).
    // Write to tmpfile and output the path prefixed with @file: so callers can detect it.
    if (json.length > 50000) {
      const tmpPath = path.join(os.tmpdir(), `fp-${Date.now()}.json`);
      fs.writeFileSync(tmpPath, json, 'utf-8');
      process.stdout.write('@file:' + tmpPath);
    } else {
      process.stdout.write(json);
    }
  }
  process.exit(0);
}

/**
 * Write error message to stderr and exit 1.
 *
 * @param {string} message - Error description
 */
function error(message) {
  process.stderr.write('Error: ' + message + '\n');
  process.exit(1);
}

// ── Safe File I/O ───────────────────────────────────────────────────────────

/**
 * Read a file safely, returning null on any error.
 * Never throws -- callers can check for null to detect failure.
 *
 * @param {string} filePath - Absolute or relative path to read
 * @returns {string|null} File contents as UTF-8 string, or null on failure
 */
function safeReadFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Safely parse JSON with size limit enforcement.
 * Never throws -- returns structured result with ok/data/error fields.
 *
 * @param {string} text - JSON string to parse
 * @param {object} [opts] - Options
 * @param {number} [opts.maxSize=1048576] - Maximum input length in bytes (default 1MB)
 * @returns {{ ok: boolean, data?: any, error?: string }}
 */
function safeJsonParse(text, opts = {}) {
  const maxSize = opts.maxSize || 1048576;

  if (!text || typeof text !== 'string') {
    return { ok: false, error: 'Empty or invalid input' };
  }

  if (text.length > maxSize) {
    return { ok: false, error: `Input exceeds ${maxSize} byte limit (got ${text.length})` };
  }

  try {
    const data = JSON.parse(text);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: `Parse error: ${err.message}` };
  }
}

module.exports = { output, error, safeReadFile, safeJsonParse };
