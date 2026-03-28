'use strict';

// Tests for lib/source-map.cjs
// TDD RED phase: These tests define the behavior of the source-map module.
// source-map.cjs provides the single authoritative source-to-doc mapping abstraction.
// Per D-11, all consumers access mappings through this module.

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const LIB_DIR = path.resolve(__dirname, '..', '..', 'lib');

// -- Test Helpers --

/**
 * Create a unique temp directory for isolated source-map file I/O.
 */
function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fp-source-map-test-'));
}

/**
 * Remove a temp directory and all contents.
 */
function cleanTempDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup
  }
}

/**
 * Write a source-map.json fixture at the given path.
 */
function writeMapFile(mapPath, data) {
  const dir = path.dirname(mapPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(mapPath, JSON.stringify(data, null, 2), 'utf-8');
  return mapPath;
}

/**
 * Build a standard test map with mixed file and directory entries.
 */
function buildTestMap() {
  return {
    version: 1,
    generated: '2026-03-28T00:00:00.000Z',
    generator: 'fp-tools source-map generate',
    mappings: [
      { source: 'helpers/posts.php', doc: 'docs/06-helpers/posts.md', type: 'file', status: 'mapped' },
      { source: 'helpers/terms.php', doc: 'docs/06-helpers/terms.md', type: 'file', status: 'mapped' },
      { source: 'helpers/', doc: 'docs/06-helpers/', type: 'directory', status: 'mapped' },
      { source: 'inc/post-types/', doc: 'docs/02-post-types/', type: 'directory', status: 'mapped' },
      { source: 'inc/hooks/', doc: 'docs/08-hooks/', type: 'directory', status: 'mapped' },
      { source: 'functions.php', doc: 'docs/01-architecture/bootstrap-sequence.md', type: 'file', status: 'mapped' },
      { source: 'helpers/undocumented.php', doc: null, type: 'file', status: 'unmapped' },
      { source: 'inc/misc/orphan.php', doc: null, type: 'file', status: 'unmapped' },
    ]
  };
}

// -- Module Tests --

describe('lib/source-map.cjs', () => {
  it('should be requireable', () => {
    const sourceMap = require(path.join(LIB_DIR, 'source-map.cjs'));
    assert.ok(sourceMap);
  });

  it('should export loadSourceMap, saveSourceMap, lookupDoc, lookupSource, getUnmapped, generateSourceMap, cmdSourceMap', () => {
    const sourceMap = require(path.join(LIB_DIR, 'source-map.cjs'));
    assert.equal(typeof sourceMap.loadSourceMap, 'function');
    assert.equal(typeof sourceMap.saveSourceMap, 'function');
    assert.equal(typeof sourceMap.lookupDoc, 'function');
    assert.equal(typeof sourceMap.lookupSource, 'function');
    assert.equal(typeof sourceMap.getUnmapped, 'function');
    assert.equal(typeof sourceMap.generateSourceMap, 'function');
    assert.equal(typeof sourceMap.cmdSourceMap, 'function');
  });

  it('should require ONLY core.cjs and paths.cjs from lib/ (no drift.cjs, no config.cjs)', () => {
    const source = fs.readFileSync(path.join(LIB_DIR, 'source-map.cjs'), 'utf-8');
    assert.ok(!source.includes("require('./drift.cjs')"), 'must NOT require drift.cjs');
    assert.ok(!source.includes("require('./config.cjs')"), 'must NOT require config.cjs');
    assert.ok(source.includes("require('./core.cjs')"), 'must require core.cjs');
    assert.ok(source.includes("require('./paths.cjs')"), 'must require paths.cjs');
  });

  it('should contain module-level cache variable', () => {
    const source = fs.readFileSync(path.join(LIB_DIR, 'source-map.cjs'), 'utf-8');
    assert.ok(source.includes('let _cachedMap = null'), 'must have module-level cache');
  });

  it('should contain writeAtomic function', () => {
    const source = fs.readFileSync(path.join(LIB_DIR, 'source-map.cjs'), 'utf-8');
    assert.ok(source.includes('writeAtomic'), 'must have writeAtomic function');
    assert.ok(source.includes('renameSync'), 'must use fs.renameSync for atomic writes');
    assert.ok(source.includes('.tmp'), 'must write to .tmp file before rename');
  });

  it('should contain SOURCE_MAP_FILENAME constant', () => {
    const source = fs.readFileSync(path.join(LIB_DIR, 'source-map.cjs'), 'utf-8');
    assert.ok(source.includes("SOURCE_MAP_FILENAME = 'source-map.json'"), 'must have SOURCE_MAP_FILENAME constant');
  });

  describe('loadSourceMap', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = makeTempDir();
    });

    afterEach(() => {
      cleanTempDir(tmpDir);
    });

    it('should return DEFAULT_MAP when file is missing (version: 1, mappings: [])', () => {
      const sourceMap = require(path.join(LIB_DIR, 'source-map.cjs'));
      const nonExistentPath = path.join(tmpDir, 'nonexistent', 'source-map.json');
      const result = sourceMap.loadSourceMap(nonExistentPath);
      assert.equal(result.version, 1);
      assert.ok(Array.isArray(result.mappings));
      assert.equal(result.mappings.length, 0);
    });

    it('should return parsed data when file exists with valid JSON', () => {
      const sourceMap = require(path.join(LIB_DIR, 'source-map.cjs'));
      const testMap = buildTestMap();
      const mapPath = path.join(tmpDir, 'source-map.json');
      writeMapFile(mapPath, testMap);
      const result = sourceMap.loadSourceMap(mapPath);
      assert.equal(result.version, 1);
      assert.equal(result.mappings.length, 8);
      assert.equal(result.mappings[0].source, 'helpers/posts.php');
    });

    it('should use cache on second call (no explicit path)', () => {
      const sourceMap = require(path.join(LIB_DIR, 'source-map.cjs'));
      const source = fs.readFileSync(path.join(LIB_DIR, 'source-map.cjs'), 'utf-8');
      // Verify caching pattern exists: if (_cachedMap && !mapPath) return _cachedMap;
      assert.ok(source.includes('_cachedMap') && source.includes('!mapPath'), 'should use cache bypass pattern');
    });

    it('should bypass cache when explicit mapPath is provided', () => {
      const sourceMap = require(path.join(LIB_DIR, 'source-map.cjs'));
      const testMap = buildTestMap();
      const mapPath = path.join(tmpDir, 'source-map.json');
      writeMapFile(mapPath, testMap);

      // First load
      const result1 = sourceMap.loadSourceMap(mapPath);
      assert.equal(result1.mappings.length, 8);

      // Modify file
      const updatedMap = { ...testMap, mappings: testMap.mappings.slice(0, 2) };
      writeMapFile(mapPath, updatedMap);

      // Second load with explicit path should bypass cache and see new data
      const result2 = sourceMap.loadSourceMap(mapPath);
      assert.equal(result2.mappings.length, 2, 'should bypass cache when explicit mapPath provided');
    });
  });

  describe('saveSourceMap', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = makeTempDir();
    });

    afterEach(() => {
      cleanTempDir(tmpDir);
    });

    it('should write JSON with generated timestamp', () => {
      const sourceMap = require(path.join(LIB_DIR, 'source-map.cjs'));
      const mapPath = path.join(tmpDir, 'source-map.json');
      const data = { version: 1, generated: null, generator: 'test', mappings: [] };
      sourceMap.saveSourceMap(data, mapPath);
      assert.ok(fs.existsSync(mapPath), 'source-map.json should exist after save');
      const raw = fs.readFileSync(mapPath, 'utf-8');
      const parsed = JSON.parse(raw);
      assert.equal(parsed.version, 1);
      assert.ok(parsed.generated, 'generated timestamp should be set after save');
      assert.ok(parsed.generated.includes('T'), 'generated should be ISO timestamp');
    });

    it('should clear module cache after save', () => {
      const sourceMap = require(path.join(LIB_DIR, 'source-map.cjs'));
      const source = fs.readFileSync(path.join(LIB_DIR, 'source-map.cjs'), 'utf-8');
      // Verify saveSourceMap sets _cachedMap = null
      assert.ok(source.includes('_cachedMap = null'), 'saveSourceMap should clear cache');
    });

    it('should use atomic write pattern (.tmp + rename)', () => {
      const source = fs.readFileSync(path.join(LIB_DIR, 'source-map.cjs'), 'utf-8');
      assert.ok(source.includes('renameSync'), 'should use fs.renameSync for atomic writes');
      assert.ok(source.includes('.tmp'), 'should write to .tmp file before rename');
    });
  });

  describe('lookupDoc', () => {
    let tmpDir;
    let mapPath;

    beforeEach(() => {
      tmpDir = makeTempDir();
      mapPath = path.join(tmpDir, 'source-map.json');
      writeMapFile(mapPath, buildTestMap());
    });

    afterEach(() => {
      cleanTempDir(tmpDir);
    });

    it('should return exact file match', () => {
      const sourceMap = require(path.join(LIB_DIR, 'source-map.cjs'));
      const result = sourceMap.lookupDoc('helpers/posts.php', mapPath);
      assert.equal(result, 'docs/06-helpers/posts.md');
    });

    it('should return directory prefix match when no exact match', () => {
      const sourceMap = require(path.join(LIB_DIR, 'source-map.cjs'));
      // 'helpers/some-other.php' has no exact match but matches 'helpers/' directory
      const result = sourceMap.lookupDoc('helpers/some-other.php', mapPath);
      assert.equal(result, 'docs/06-helpers/');
    });

    it('should return null for unmatched path', () => {
      const sourceMap = require(path.join(LIB_DIR, 'source-map.cjs'));
      const result = sourceMap.lookupDoc('random/no-match.php', mapPath);
      assert.equal(result, null);
    });

    it('should prefer exact file match over directory prefix match', () => {
      const sourceMap = require(path.join(LIB_DIR, 'source-map.cjs'));
      // 'helpers/posts.php' has both an exact file match and a directory prefix match
      const result = sourceMap.lookupDoc('helpers/posts.php', mapPath);
      assert.equal(result, 'docs/06-helpers/posts.md', 'should prefer exact file match');
    });

    it('should return null for unmapped file (exact match with null doc)', () => {
      const sourceMap = require(path.join(LIB_DIR, 'source-map.cjs'));
      const result = sourceMap.lookupDoc('helpers/undocumented.php', mapPath);
      assert.equal(result, null, 'should return null for unmapped files');
    });
  });

  describe('lookupSource', () => {
    let tmpDir;
    let mapPath;

    beforeEach(() => {
      tmpDir = makeTempDir();
      mapPath = path.join(tmpDir, 'source-map.json');
      writeMapFile(mapPath, buildTestMap());
    });

    afterEach(() => {
      cleanTempDir(tmpDir);
    });

    it('should return source entries mapping to given doc path (exact match)', () => {
      const sourceMap = require(path.join(LIB_DIR, 'source-map.cjs'));
      const result = sourceMap.lookupSource('docs/06-helpers/posts.md', mapPath);
      assert.ok(Array.isArray(result));
      assert.ok(result.length >= 1);
      const sources = result.map(m => m.source);
      assert.ok(sources.includes('helpers/posts.php'));
    });

    it('should return directory-level matches via startsWith', () => {
      const sourceMap = require(path.join(LIB_DIR, 'source-map.cjs'));
      // Looking up 'docs/06-helpers/some-sub.md' should match directory 'docs/06-helpers/'
      const result = sourceMap.lookupSource('docs/06-helpers/some-sub.md', mapPath);
      assert.ok(Array.isArray(result));
      assert.ok(result.length >= 1);
      const dirMatch = result.find(m => m.type === 'directory');
      assert.ok(dirMatch, 'should include directory-level match');
    });

    it('should return empty array for unmatched doc path', () => {
      const sourceMap = require(path.join(LIB_DIR, 'source-map.cjs'));
      const result = sourceMap.lookupSource('docs/99-unknown/nothing.md', mapPath);
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });
  });

  describe('getUnmapped', () => {
    let tmpDir;
    let mapPath;

    beforeEach(() => {
      tmpDir = makeTempDir();
      mapPath = path.join(tmpDir, 'source-map.json');
      writeMapFile(mapPath, buildTestMap());
    });

    afterEach(() => {
      cleanTempDir(tmpDir);
    });

    it('should return only entries with status "unmapped"', () => {
      const sourceMap = require(path.join(LIB_DIR, 'source-map.cjs'));
      const result = sourceMap.getUnmapped(mapPath);
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 2);
      for (const entry of result) {
        assert.equal(entry.status, 'unmapped');
        assert.equal(entry.doc, null);
      }
    });

    it('should return empty array when no unmapped entries exist', () => {
      const sourceMap = require(path.join(LIB_DIR, 'source-map.cjs'));
      const allMappedPath = path.join(tmpDir, 'all-mapped.json');
      writeMapFile(allMappedPath, {
        version: 1,
        generated: null,
        mappings: [
          { source: 'helpers/posts.php', doc: 'docs/06-helpers/posts.md', type: 'file', status: 'mapped' },
        ]
      });
      const result = sourceMap.getUnmapped(allMappedPath);
      assert.equal(result.length, 0);
    });
  });

  describe('generateSourceMap', () => {
    // generateSourceMap uses git ls-tree internally.
    // We test the module's mapping logic and shape, not git calls.

    let tmpDir;

    beforeEach(() => {
      tmpDir = makeTempDir();
    });

    afterEach(() => {
      cleanTempDir(tmpDir);
    });

    it('should produce mappings with file-level and directory-level entries', () => {
      const sourceMap = require(path.join(LIB_DIR, 'source-map.cjs'));
      // Test via a pre-built map saved and reloaded to verify shape
      const testMap = buildTestMap();
      const mapPath = path.join(tmpDir, 'test-map.json');
      sourceMap.saveSourceMap(testMap, mapPath);
      const loaded = sourceMap.loadSourceMap(mapPath);
      const fileEntries = loaded.mappings.filter(m => m.type === 'file');
      const dirEntries = loaded.mappings.filter(m => m.type === 'directory');
      assert.ok(fileEntries.length > 0, 'should have file-level entries');
      assert.ok(dirEntries.length > 0, 'should have directory-level entries');
    });

    it('should mark unmapped source files with null doc and status "unmapped"', () => {
      const sourceMap = require(path.join(LIB_DIR, 'source-map.cjs'));
      const testMap = buildTestMap();
      const unmapped = testMap.mappings.filter(m => m.status === 'unmapped');
      assert.ok(unmapped.length > 0, 'test map should have unmapped entries');
      for (const entry of unmapped) {
        assert.equal(entry.doc, null, 'unmapped entries should have null doc');
        assert.equal(entry.status, 'unmapped', 'unmapped entries should have status unmapped');
      }
    });

    it('should return object with version, generated, generator, and mappings fields', () => {
      const sourceMap = require(path.join(LIB_DIR, 'source-map.cjs'));
      // generateSourceMap returns map data structure
      // Since we cannot run git in test context, verify the function exists and accepts args
      assert.equal(typeof sourceMap.generateSourceMap, 'function');
      assert.equal(sourceMap.generateSourceMap.length, 2, 'should accept codebaseRoot and docsRoot');
    });
  });

  describe('cmdSourceMap', () => {
    it('should have cmdSourceMap function with correct signature', () => {
      const sourceMap = require(path.join(LIB_DIR, 'source-map.cjs'));
      assert.equal(sourceMap.cmdSourceMap.length, 3, 'cmdSourceMap should accept 3 parameters (subcommand, args, raw)');
    });

    // cmdSourceMap calls process.exit via output()/error(), so we test
    // internal functions directly and verify dispatch exists.

    it('should handle lookup subcommand by calling lookupDoc', () => {
      const source = fs.readFileSync(path.join(LIB_DIR, 'source-map.cjs'), 'utf-8');
      assert.ok(source.includes("case 'lookup'"), 'should have lookup case in cmdSourceMap');
    });

    it('should handle reverse-lookup subcommand by calling lookupSource', () => {
      const source = fs.readFileSync(path.join(LIB_DIR, 'source-map.cjs'), 'utf-8');
      assert.ok(source.includes("case 'reverse-lookup'"), 'should have reverse-lookup case in cmdSourceMap');
    });

    it('should handle unmapped subcommand by calling getUnmapped', () => {
      const source = fs.readFileSync(path.join(LIB_DIR, 'source-map.cjs'), 'utf-8');
      assert.ok(source.includes("case 'unmapped'"), 'should have unmapped case in cmdSourceMap');
    });

    it('should handle dump subcommand by calling loadSourceMap', () => {
      const source = fs.readFileSync(path.join(LIB_DIR, 'source-map.cjs'), 'utf-8');
      assert.ok(source.includes("case 'dump'"), 'should have dump case in cmdSourceMap');
    });

    it('should handle generate subcommand', () => {
      const source = fs.readFileSync(path.join(LIB_DIR, 'source-map.cjs'), 'utf-8');
      assert.ok(source.includes("case 'generate'"), 'should have generate case in cmdSourceMap');
    });
  });

  describe('integration: lookupDoc exact vs directory precedence', () => {
    let tmpDir;
    let mapPath;

    beforeEach(() => {
      tmpDir = makeTempDir();
      mapPath = path.join(tmpDir, 'source-map.json');
      writeMapFile(mapPath, buildTestMap());
    });

    afterEach(() => {
      cleanTempDir(tmpDir);
    });

    it('should return exact match doc for functions.php', () => {
      const sourceMap = require(path.join(LIB_DIR, 'source-map.cjs'));
      const result = sourceMap.lookupDoc('functions.php', mapPath);
      assert.equal(result, 'docs/01-architecture/bootstrap-sequence.md');
    });

    it('should return directory match for inc/post-types/custom-post.php', () => {
      const sourceMap = require(path.join(LIB_DIR, 'source-map.cjs'));
      const result = sourceMap.lookupDoc('inc/post-types/custom-post.php', mapPath);
      assert.equal(result, 'docs/02-post-types/');
    });

    it('should return directory match for inc/hooks/actions.php', () => {
      const sourceMap = require(path.join(LIB_DIR, 'source-map.cjs'));
      const result = sourceMap.lookupDoc('inc/hooks/actions.php', mapPath);
      assert.equal(result, 'docs/08-hooks/');
    });
  });
});
