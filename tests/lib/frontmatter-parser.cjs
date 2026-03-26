'use strict';

// Zero-dependency YAML frontmatter parser for flat key-value pairs.
// Designed for fp-docs skill/agent/spec files which use simple
// `key: value` format (no nesting, no arrays).
//
// Also provides parseBodyField() for extracting `FieldName: value`
// lines from the markdown body below the frontmatter block.

/**
 * Parse YAML frontmatter from a markdown string.
 *
 * @param {string} content - Full file content with optional --- delimited frontmatter
 * @returns {{ frontmatter: Record<string, string>, body: string }}
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { frontmatter: {}, body: content };

  const frontmatter = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^([\w-]+):\s*(.+)$/);
    if (kv) {
      let val = kv[2].trim();
      // Strip surrounding quotes (single or double)
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      frontmatter[kv[1]] = val;
    }
  }

  const body = content.slice(match[0].length).trim();
  return { frontmatter, body };
}

/**
 * Extract a named field value from the markdown body.
 * Looks for lines matching `FieldName: value` (case-sensitive).
 *
 * @param {string} body - Markdown body text (after frontmatter)
 * @param {string} fieldName - Field name to search for (e.g., 'Engine', 'Operation')
 * @returns {string|null} The field value, or null if not found
 */
function parseBodyField(body, fieldName) {
  const re = new RegExp(`^${fieldName}:\\s*(.+)$`, 'm');
  const match = body.match(re);
  return match ? match[1].trim() : null;
}

module.exports = { parseFrontmatter, parseBodyField };
