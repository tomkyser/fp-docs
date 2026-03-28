'use strict';

/**
 * Source Map -- Source-to-documentation mapping abstraction for fp-docs.
 *
 * Provides the single authoritative source-to-doc mapping module (D-11).
 * All consumers access mappings through this module -- no direct JSON reads.
 *
 * Features:
 * - Load/save source-map.json with module-level caching
 * - Lookup: source path -> doc target (exact match, then directory prefix)
 * - Reverse lookup: doc path -> source entries
 * - Unmapped: list all source files without doc targets
 * - Generate: scan codebase and docs trees to build mapping
 * - CLI surface via `fp-tools source-map <lookup|reverse-lookup|unmapped|generate|dump>` (D-12)
 *
 * CRITICAL: This module depends ONLY on core.cjs and paths.cjs (leaf modules).
 * It must NOT require drift.cjs or config.cjs to prevent circular dependencies (Pitfall 3).
 *
 * Zero external dependencies -- Node.js built-ins only.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { output, error, safeReadFile, safeJsonParse } = require('./core.cjs');
const { getPluginRoot, getCodebaseRoot, getDocsRoot } = require('./paths.cjs');

// -- Constants --

const DEFAULT_MAP = { version: 1, generated: null, generator: 'fp-tools source-map generate', mappings: [] };
const SOURCE_MAP_FILENAME = 'source-map.json';

// Directory-level seed mappings from mod-project's 30+ entry table.
// These are the canonical directory-to-doc mappings for the FP codebase.
const DIRECTORY_SEED = [
  { source: 'inc/post-types/', doc: 'docs/02-post-types/', type: 'directory', status: 'mapped' },
  { source: 'inc/taxonomies/', doc: 'docs/03-taxonomies/', type: 'directory', status: 'mapped' },
  { source: 'inc/meta-boxes/', doc: 'docs/04-meta-boxes/', type: 'directory', status: 'mapped' },
  { source: 'components/', doc: 'docs/05-components/', type: 'directory', status: 'mapped' },
  { source: 'helpers/', doc: 'docs/06-helpers/', type: 'directory', status: 'mapped' },
  { source: 'inc/shortcodes/', doc: 'docs/07-shortcodes/', type: 'directory', status: 'mapped' },
  { source: 'inc/hooks/', doc: 'docs/08-hooks/', type: 'directory', status: 'mapped' },
  { source: 'inc/rest-api/', doc: 'docs/09-api/rest-api/', type: 'directory', status: 'mapped' },
  { source: 'inc/graphql/', doc: 'docs/09-api/graphql/', type: 'directory', status: 'mapped' },
  { source: 'layouts/', doc: 'docs/10-layouts-and-templates/', type: 'directory', status: 'mapped' },
  { source: 'partials/', doc: 'docs/11-partials/', type: 'directory', status: 'mapped' },
  { source: 'inc/menus/', doc: 'docs/12-menus/', type: 'directory', status: 'mapped' },
  { source: 'inc/widgets/', doc: 'docs/13-widgets/', type: 'directory', status: 'mapped' },
  { source: 'inc/blocks/', doc: 'docs/14-gutenberg-blocks/', type: 'directory', status: 'mapped' },
  { source: 'inc/cli/', doc: 'docs/15-wp-cli/', type: 'directory', status: 'mapped' },
  { source: 'inc/admin/', doc: 'docs/16-admin/', type: 'directory', status: 'mapped' },
  { source: 'inc/caching/', doc: 'docs/17-caching/', type: 'directory', status: 'mapped' },
  { source: 'assets/src/scripts/', doc: 'docs/18-frontend-assets/js/', type: 'directory', status: 'mapped' },
  { source: 'assets/src/styles/', doc: 'docs/18-frontend-assets/css/', type: 'directory', status: 'mapped' },
  { source: 'inc/search/', doc: 'docs/19-search/', type: 'directory', status: 'mapped' },
  { source: 'inc/exports/', doc: 'docs/20-exports-notifications/', type: 'directory', status: 'mapped' },
  { source: 'inc/notifications/', doc: 'docs/20-exports-notifications/', type: 'directory', status: 'mapped' },
  { source: 'inc/custom-field-types/', doc: 'docs/04-meta-boxes/', type: 'directory', status: 'mapped' },
  { source: 'inc/custom-location-rules/', doc: 'docs/04-meta-boxes/', type: 'directory', status: 'mapped' },
  { source: 'crons/', doc: 'docs/21-crons/', type: 'directory', status: 'mapped' },
  { source: 'feeds/', doc: 'docs/22-feeds/', type: 'directory', status: 'mapped' },
  { source: 'rewrites/', doc: 'docs/23-rewrites/', type: 'directory', status: 'mapped' },
  { source: 'redirects/', doc: 'docs/23-rewrites/', type: 'directory', status: 'mapped' },
  { source: 'sponsored/', doc: 'docs/24-sponsored/', type: 'directory', status: 'mapped' },
  { source: 'dynamic-pdfs/', doc: 'docs/25-dynamic-pdfs/', type: 'directory', status: 'mapped' },
  { source: 'amp/', doc: 'docs/26-amp/', type: 'directory', status: 'mapped' },
  { source: 'mobile/', doc: 'docs/27-mobile/', type: 'directory', status: 'mapped' },
];

// -- Module-level cache --

let _cachedMap = null;

// -- Internal Functions --

/**
 * Get the default source-map.json path in the plugin root.
 *
 * @returns {string} Absolute path to source-map.json
 */
function getSourceMapPath() {
  return path.join(getPluginRoot(), SOURCE_MAP_FILENAME);
}

/**
 * Ensure a directory exists, creating it recursively if needed.
 *
 * @param {string} dirPath - Directory path to ensure
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Write data to a file using atomic rename pattern.
 * Writes to .tmp file first, then renames for atomicity.
 *
 * @param {object} data - Data to write as JSON
 * @param {string} filePath - Target file path
 */
function writeAtomic(data, filePath) {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

/**
 * List git-tracked files via git ls-tree.
 *
 * @param {string} repoRoot - Path to the git repository root
 * @returns {string[]} Array of relative file paths, or empty array on failure
 */
function listGitFiles(repoRoot) {
  try {
    const result = execFileSync('git', [
      '-C', repoRoot, 'ls-tree',
      '-r', '--name-only', 'HEAD',
    ], {
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 15000,
    }).trim();
    return result ? result.split('\n').filter(Boolean) : [];
  } catch {
    return [];
  }
}

/**
 * Check if a source file matches any directory seed mapping.
 *
 * @param {string} filePath - Relative source file path
 * @returns {object|null} The matching seed entry, or null
 */
function findSeedMatch(filePath) {
  for (const seed of DIRECTORY_SEED) {
    if (filePath.startsWith(seed.source)) {
      return seed;
    }
  }
  return null;
}

// -- Exported Functions --

/**
 * Load source-map data from disk, with caching.
 *
 * If file is missing, returns a copy of DEFAULT_MAP.
 * Cache is bypassed when an explicit mapPath is provided.
 *
 * @param {string} [mapPath] - Optional explicit path to source-map.json
 * @returns {object} Source map object with version, generated, generator, mappings
 */
function loadSourceMap(mapPath) {
  // Return cache if available and no explicit path override
  if (_cachedMap && !mapPath) {
    return _cachedMap;
  }

  const resolvedPath = mapPath || getSourceMapPath();
  const raw = safeReadFile(resolvedPath);

  if (!raw) {
    return { ...DEFAULT_MAP, mappings: [] };
  }

  const result = safeJsonParse(raw);
  if (!result.ok) {
    return { ...DEFAULT_MAP, mappings: [] };
  }

  const data = result.data;
  if (!Array.isArray(data.mappings)) data.mappings = [];

  if (!mapPath) _cachedMap = data;
  return data;
}

/**
 * Save source-map data to disk via atomic write.
 * Sets data.generated to current timestamp. Clears module cache.
 *
 * @param {object} data - Source map data to save
 * @param {string} [mapPath] - Optional explicit path to source-map.json
 */
function saveSourceMap(data, mapPath) {
  const resolvedPath = mapPath || getSourceMapPath();
  data.generated = new Date().toISOString();
  writeAtomic(data, resolvedPath);

  // Clear cache
  _cachedMap = null;
}

/**
 * Look up the doc target for a given source path.
 *
 * Match order: exact file match first, then directory prefix match.
 * Returns null for unmatched paths or paths mapped to null (unmapped).
 *
 * @param {string} sourcePath - Source file path relative to theme root
 * @param {string} [mapPath] - Optional explicit path to source-map.json
 * @returns {string|null} The doc target path, or null if not found/unmapped
 */
function lookupDoc(sourcePath, mapPath) {
  const map = loadSourceMap(mapPath);

  // Pass 1: exact file match
  for (const m of map.mappings) {
    if (m.source === sourcePath) {
      return m.doc; // Returns null for unmapped entries (doc: null)
    }
  }

  // Pass 2: directory prefix match
  for (const m of map.mappings) {
    if (m.type === 'directory' && sourcePath.startsWith(m.source)) {
      return m.doc;
    }
  }

  return null;
}

/**
 * Reverse lookup: find source entries that map to a given doc path.
 *
 * Returns entries with exact doc match plus directory-level matches
 * where the queried doc path starts with the mapping's doc value.
 *
 * @param {string} docPath - Doc file path to look up
 * @param {string} [mapPath] - Optional explicit path to source-map.json
 * @returns {Array<object>} Array of matching mapping entries
 */
function lookupSource(docPath, mapPath) {
  const map = loadSourceMap(mapPath);
  const results = [];

  for (const m of map.mappings) {
    if (!m.doc) continue; // Skip unmapped entries

    // Exact match on doc path
    if (m.doc === docPath) {
      results.push(m);
    }
    // Directory-level match: queried doc path starts with mapping's doc
    else if (m.type === 'directory' && docPath.startsWith(m.doc)) {
      results.push(m);
    }
  }

  return results;
}

/**
 * Get all unmapped source entries (status === 'unmapped').
 *
 * @param {string} [mapPath] - Optional explicit path to source-map.json
 * @returns {Array<object>} Array of unmapped mapping entries
 */
function getUnmapped(mapPath) {
  const map = loadSourceMap(mapPath);
  return map.mappings.filter(m => m.status === 'unmapped');
}

/**
 * Generate a source map by scanning codebase and docs trees.
 *
 * Starts from the DIRECTORY_SEED (mod-project's 30+ entry table),
 * then adds file-level granularity from git ls-tree of both repos.
 * Unmapped source files get { doc: null, status: "unmapped" } per D-09.
 *
 * @param {string} codebaseRoot - Absolute path to the codebase root
 * @param {string} docsRoot - Absolute path to the docs root
 * @returns {object} Complete source map object
 */
function generateSourceMap(codebaseRoot, docsRoot) {
  const mappings = [];

  // Step 1: Add directory-level seed mappings
  for (const seed of DIRECTORY_SEED) {
    mappings.push({ ...seed });
  }

  // Step 2: Get file-level lists from git
  const sourceFiles = listGitFiles(codebaseRoot);
  const docsFiles = listGitFiles(docsRoot);

  // Step 3: Build a set of known doc files for quick lookup
  const docsSet = new Set(docsFiles.map(f => 'docs/' + f));

  // Step 4: Add file-level mappings for source files
  // Track which sources already have explicit file-level mappings
  const fileMappedSources = new Set();

  // Known file-level mappings (exact source -> exact doc)
  const FILE_SEEDS = [
    { source: 'functions.php', doc: 'docs/01-architecture/bootstrap-sequence.md', type: 'file', status: 'mapped' },
    { source: 'style.css', doc: 'docs/01-architecture/theme-identity.md', type: 'file', status: 'mapped' },
  ];

  for (const fileSeed of FILE_SEEDS) {
    mappings.push({ ...fileSeed });
    fileMappedSources.add(fileSeed.source);
  }

  // Step 5: For each source file, check if it has a directory mapping
  // If not, mark as unmapped
  for (const sourceFile of sourceFiles) {
    if (fileMappedSources.has(sourceFile)) continue;

    const seedMatch = findSeedMatch(sourceFile);
    if (!seedMatch) {
      // No directory mapping found -- unmapped source file
      mappings.push({
        source: sourceFile,
        doc: null,
        type: 'file',
        status: 'unmapped',
      });
    }
    // Files matching a directory seed are already covered by the directory entry
  }

  return {
    version: 1,
    generated: null,
    generator: 'fp-tools source-map generate',
    mappings,
  };
}

// -- CLI Handler --

/**
 * CLI handler for `fp-tools source-map <subcommand>`.
 *
 * Subcommands (per D-12):
 *   lookup <source-path>       - Look up doc target for a source path
 *   reverse-lookup <doc-path>  - Reverse lookup: doc -> source entries
 *   unmapped                   - List all unmapped source entries
 *   generate                   - Generate source map from codebase/docs scan
 *   dump                       - Output full source map JSON
 *
 * @param {string} subcommand - The source-map subcommand
 * @param {string[]} args - Additional arguments
 * @param {boolean} raw - Whether to use raw output mode
 */
function cmdSourceMap(subcommand, args, raw) {
  if (!subcommand) {
    error('Usage: fp-tools source-map <lookup|reverse-lookup|unmapped|generate|dump> [args]');
  }

  switch (subcommand) {
    case 'lookup': {
      const sourcePath = args[0];
      if (!sourcePath) {
        error('Usage: fp-tools source-map lookup <source-path>');
      }
      const result = lookupDoc(sourcePath);
      output({ source: sourcePath, doc: result }, raw, result || 'null');
      break;
    }

    case 'reverse-lookup': {
      const docPath = args[0];
      if (!docPath) {
        error('Usage: fp-tools source-map reverse-lookup <doc-path>');
      }
      const result = lookupSource(docPath);
      output(result, raw, JSON.stringify(result, null, 2));
      break;
    }

    case 'unmapped': {
      const result = getUnmapped();
      output(result, raw, JSON.stringify(result, null, 2));
      break;
    }

    case 'generate': {
      const codebaseRoot = getCodebaseRoot();
      if (!codebaseRoot) {
        error('Cannot determine codebase root. Run from within a git repository.');
      }
      const docsInfo = getDocsRoot(codebaseRoot);
      if (!docsInfo.path || !docsInfo.exists) {
        error('Cannot find docs root. Ensure the FP codebase is available.');
      }
      const map = generateSourceMap(codebaseRoot, docsInfo.path);
      saveSourceMap(map);
      const summary = {
        total: map.mappings.length,
        mapped: map.mappings.filter(m => m.status === 'mapped').length,
        unmapped: map.mappings.filter(m => m.status === 'unmapped').length,
        directories: map.mappings.filter(m => m.type === 'directory').length,
        files: map.mappings.filter(m => m.type === 'file').length,
      };
      output(summary, raw, JSON.stringify(summary, null, 2));
      break;
    }

    case 'dump': {
      const map = loadSourceMap();
      output(map, raw, JSON.stringify(map, null, 2));
      break;
    }

    default:
      error(`Unknown source-map subcommand: ${subcommand}. Use: lookup, reverse-lookup, unmapped, generate, dump`);
  }
}

module.exports = { loadSourceMap, saveSourceMap, lookupDoc, lookupSource, getUnmapped, generateSourceMap, cmdSourceMap };
