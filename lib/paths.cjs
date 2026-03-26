'use strict';

/**
 * Paths -- Three-repo path resolution for fp-docs.
 *
 * Resolves the three independent repository roots that fp-docs operates across:
 * 1. Plugin root: where fp-tools.cjs and lib/ live
 * 2. Codebase root: the WordPress wp-content/ git repo (detected via git)
 * 3. Docs root: the nested docs repo at {codebase}/themes/foreign-policy-2017/docs/
 *
 * Each resolution function returns structured results with existence checks,
 * enabling graceful degradation when repos are missing (e.g., first run, CI).
 *
 * Zero external dependencies -- Node.js built-ins only (D-15).
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// ── Plugin Root ─────────────────────────────────────────────────────────────

/**
 * Get the plugin root directory.
 *
 * Resolution order:
 * 1. __dirname resolved up one level (lib/ -> plugin root)
 * 2. $CLAUDE_PLUGIN_ROOT environment variable (set by SessionStart hook) as fallback
 *
 * @returns {string} Absolute path to the plugin root
 */
function getPluginRoot() {
  // lib/ is one level below the plugin root
  const fromDirname = path.resolve(__dirname, '..');

  // Verify the dirname-based resolution looks correct
  if (fs.existsSync(fromDirname)) {
    return fromDirname;
  }

  // Fallback to env var (set by SessionStart hook per D-11)
  if (process.env.CLAUDE_PLUGIN_ROOT) {
    return process.env.CLAUDE_PLUGIN_ROOT;
  }

  // Last resort: return the dirname-based path even if it doesn't exist
  return fromDirname;
}

// ── Codebase Root ───────────────────────────────────────────────────────────

/**
 * Detect the codebase root via git.
 *
 * Uses execFileSync with array args (not execSync with string) per anti-pattern
 * guidance to prevent shell injection.
 *
 * @returns {string|null} Absolute path to git root, or null if not in a git repo
 */
function getCodebaseRoot() {
  try {
    const result = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: process.cwd(),
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    return result.trim();
  } catch {
    return null;
  }
}

// ── Docs Root ───────────────────────────────────────────────────────────────

/**
 * Resolve the docs root directory from a codebase root.
 *
 * The docs repo is a separate git repository nested at:
 *   {codebase-root}/themes/foreign-policy-2017/docs/
 *
 * Returns structured info so callers can check existence and git state
 * without additional filesystem calls.
 *
 * @param {string|null} codebaseRoot - The codebase root path, or null
 * @returns {{ path: string|null, exists: boolean, hasGit: boolean }}
 */
function getDocsRoot(codebaseRoot) {
  if (!codebaseRoot) {
    return { path: null, exists: false, hasGit: false };
  }

  const docsPath = path.join(codebaseRoot, 'themes', 'foreign-policy-2017', 'docs');
  const exists = fs.existsSync(docsPath);
  const hasGit = exists && fs.existsSync(path.join(docsPath, '.git'));

  return { path: docsPath, exists, hasGit };
}

// ── Path Resolution ─────────────────────────────────────────────────────────

/**
 * Resolve a relative path against a base directory.
 * Simple wrapper around path.resolve for consistent API.
 *
 * @param {string} relativePath - The relative path to resolve
 * @param {string} baseDir - The base directory
 * @returns {string} Absolute resolved path
 */
function resolvePath(relativePath, baseDir) {
  return path.resolve(baseDir, relativePath);
}

// ── Convenience ─────────────────────────────────────────────────────────────

/**
 * Get all three repo paths in one call.
 *
 * @returns {{ pluginRoot: string, codebaseRoot: string|null, docsRoot: { path: string|null, exists: boolean, hasGit: boolean } }}
 */
function getAllPaths() {
  const pluginRoot = getPluginRoot();
  const codebaseRoot = getCodebaseRoot();
  const docsRoot = getDocsRoot(codebaseRoot);

  return { pluginRoot, codebaseRoot, docsRoot };
}

module.exports = { getPluginRoot, getCodebaseRoot, getDocsRoot, resolvePath, getAllPaths };
