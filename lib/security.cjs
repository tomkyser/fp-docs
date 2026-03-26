'use strict';

/**
 * Security -- Path traversal prevention, prompt injection detection, input validation.
 *
 * This module centralizes security checks for fp-tools. Because fp-docs generates
 * markdown files that become LLM system prompts (engine agents, pipeline state),
 * any user-controlled text that flows into these files is a potential indirect
 * prompt injection vector.
 *
 * Threat model:
 *   1. Path traversal: user-supplied file paths escape the project directory
 *   2. Prompt injection: malicious text in arguments embeds LLM instructions
 *   3. Shell metacharacter injection: user text interpreted by shell
 *   4. JSON injection: malformed JSON crashes or corrupts state
 *
 * Adapted from GSD's lib/security.cjs patterns.
 * Zero external dependencies -- Node.js built-ins only (D-15).
 */

const fs = require('fs');
const path = require('path');

// ── Path Traversal Prevention ───────────────────────────────────────────────

/**
 * Validate that a file path resolves within an allowed base directory.
 * Prevents path traversal attacks via ../ sequences, symlinks, or absolute paths.
 *
 * Handles macOS /var -> /private/var symlink resolution by resolving both
 * the base and target through fs.realpathSync.
 *
 * @param {string} filePath - The user-supplied file path
 * @param {string} baseDir - The allowed base directory
 * @param {object} [opts] - Options
 * @param {boolean} [opts.allowAbsolute=false] - Allow absolute paths (still must be within baseDir)
 * @returns {{ safe: boolean, resolved: string, error?: string }}
 */
function validatePath(filePath, baseDir, opts = {}) {
  if (!filePath || typeof filePath !== 'string') {
    return { safe: false, resolved: '', error: 'Empty or invalid file path' };
  }

  if (!baseDir || typeof baseDir !== 'string') {
    return { safe: false, resolved: '', error: 'Empty or invalid base directory' };
  }

  // Reject null bytes (can bypass path checks in some environments)
  if (filePath.includes('\0')) {
    return { safe: false, resolved: '', error: 'Path contains null bytes' };
  }

  // Resolve symlinks in base directory to handle macOS /var -> /private/var
  let resolvedBase;
  try {
    resolvedBase = fs.realpathSync(path.resolve(baseDir));
  } catch {
    resolvedBase = path.resolve(baseDir);
  }

  let resolvedPath;

  if (path.isAbsolute(filePath)) {
    if (!opts.allowAbsolute) {
      return { safe: false, resolved: '', error: 'Absolute paths not allowed' };
    }
    resolvedPath = path.resolve(filePath);
  } else {
    resolvedPath = path.resolve(baseDir, filePath);
  }

  // Resolve symlinks in the target path too
  try {
    resolvedPath = fs.realpathSync(resolvedPath);
  } catch {
    // File may not exist yet -- resolve parent directory if it exists
    const parentDir = path.dirname(resolvedPath);
    try {
      const realParent = fs.realpathSync(parentDir);
      resolvedPath = path.join(realParent, path.basename(resolvedPath));
    } catch {
      // Parent doesn't exist either -- keep the resolved path as-is
    }
  }

  // Normalize both paths and check containment
  const normalizedBase = resolvedBase + path.sep;
  const normalizedPath = resolvedPath + path.sep;

  // The resolved path must start with the base directory (or be exactly the base directory)
  if (resolvedPath !== resolvedBase && !normalizedPath.startsWith(normalizedBase)) {
    return {
      safe: false,
      resolved: resolvedPath,
      error: `Path escapes allowed directory: ${resolvedPath} is outside ${resolvedBase}`,
    };
  }

  return { safe: true, resolved: resolvedPath };
}

// ── Prompt Injection Detection ──────────────────────────────────────────────

/**
 * Patterns that indicate prompt injection attempts in user-supplied text.
 * These patterns catch common indirect prompt injection techniques where
 * an attacker embeds LLM instructions in text that will be read by an agent.
 *
 * 15+ patterns covering: instruction override, role manipulation, system prompt
 * extraction, exfiltration, tool manipulation, hidden instruction markers.
 */
const INJECTION_PATTERNS = [
  // Direct instruction override attempts
  { pattern: /ignore\s+(all\s+)?previous\s+instructions/i, category: 'instruction-override' },
  { pattern: /ignore\s+(all\s+)?above\s+instructions/i, category: 'instruction-override' },
  { pattern: /disregard\s+(all\s+)?previous/i, category: 'instruction-override' },
  { pattern: /forget\s+(all\s+)?(your\s+)?instructions/i, category: 'instruction-override' },
  { pattern: /override\s+(system|previous)\s+(prompt|instructions)/i, category: 'instruction-override' },

  // Role/identity manipulation
  { pattern: /you\s+are\s+now\s+(?:a|an|the)\s+/i, category: 'role-manipulation' },
  { pattern: /act\s+as\s+(?:a|an|the)\s+/i, category: 'role-manipulation' },
  { pattern: /pretend\s+(?:you(?:'re| are)\s+|to\s+be\s+)/i, category: 'role-manipulation' },
  { pattern: /from\s+now\s+on,?\s+you\s+(?:are|will|should|must)/i, category: 'role-manipulation' },

  // System prompt extraction
  { pattern: /(?:print|output|reveal|show|display|repeat)\s+(?:me\s+)?(?:your\s+)?(?:system\s+)?(?:prompt|instructions)/i, category: 'prompt-extraction' },
  { pattern: /what\s+(?:are|is)\s+your\s+(?:system\s+)?(?:prompt|instructions)/i, category: 'prompt-extraction' },

  // Hidden instruction markers (XML/HTML tags that mimic system messages)
  { pattern: /<\/?(?:system|assistant|human)>/i, category: 'hidden-markers' },
  { pattern: /\[SYSTEM\]/i, category: 'hidden-markers' },
  { pattern: /\[INST\]/i, category: 'hidden-markers' },
  { pattern: /<<\s*SYS\s*>>/i, category: 'hidden-markers' },

  // Exfiltration attempts
  { pattern: /(?:send|post|fetch|curl|wget)\s+(?:to|from)\s+https?:\/\//i, category: 'exfiltration' },
  { pattern: /(?:base64|btoa|encode)\s+(?:and\s+)?(?:send|exfiltrate|output)/i, category: 'exfiltration' },

  // Tool manipulation
  { pattern: /(?:run|execute|call|invoke)\s+(?:the\s+)?(?:bash|shell|exec|spawn)\s+(?:tool|command)/i, category: 'tool-manipulation' },
];

/**
 * Scan text for potential prompt injection patterns.
 *
 * @param {string} text - The text to scan
 * @returns {{ safe: boolean, matches: Array<{pattern: string, match: string}> }}
 */
function scanForInjection(text) {
  if (!text || typeof text !== 'string') {
    return { safe: true, matches: [] };
  }

  const matches = [];

  for (const entry of INJECTION_PATTERNS) {
    const m = text.match(entry.pattern);
    if (m) {
      matches.push({
        pattern: entry.category,
        match: m[0],
      });
    }
  }

  return { safe: matches.length === 0, matches };
}

// ── Shell Safety ────────────────────────────────────────────────────────────

/**
 * Validate that a string is safe to use as a shell argument.
 * Rejects null bytes, command substitution, pipe, redirect, semicolons, ampersands.
 *
 * @param {string} arg - The argument to validate
 * @returns {{ safe: boolean, sanitized: string, error?: string }}
 */
function validateShellArg(arg) {
  if (!arg || typeof arg !== 'string') {
    return { safe: false, sanitized: '', error: 'Empty or invalid argument' };
  }

  // Reject null bytes
  if (arg.includes('\0')) {
    return { safe: false, sanitized: '', error: 'Argument contains null bytes' };
  }

  // Reject command substitution patterns: $(...) and backticks
  if (/\$\(/.test(arg) || /`/.test(arg)) {
    return { safe: false, sanitized: '', error: 'Argument contains command substitution' };
  }

  // Reject pipe, redirect, semicolons, ampersands
  if (/[|><;&]/.test(arg)) {
    return { safe: false, sanitized: '', error: 'Argument contains shell metacharacters' };
  }

  return { safe: true, sanitized: arg };
}

// ── JSON Safety ─────────────────────────────────────────────────────────────

/**
 * Safely parse JSON with error handling and size limits.
 * Self-contained version for consumers that only need security module.
 *
 * @param {string} text - JSON string to parse
 * @param {object} [opts] - Options
 * @param {number} [opts.maxSize=1048576] - Maximum input length (default 1MB)
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

module.exports = {
  validatePath,
  INJECTION_PATTERNS,
  scanForInjection,
  validateShellArg,
  safeJsonParse,
};
