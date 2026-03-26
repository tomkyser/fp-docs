'use strict';

// Tests for lib/update.cjs
// TDD RED phase: These tests define the behavior of the update checking module.

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const LIB_DIR = path.resolve(__dirname, '..', '..', 'lib');

// ── Test Helpers ──────────────────────────────────────────────────────────────

let update;
try {
  update = require(path.join(LIB_DIR, 'update.cjs'));
} catch (e) {
  // Module doesn't exist yet -- tests will fail (RED phase)
  update = {};
}

/**
 * Create a unique temp directory for isolated cache file I/O.
 */
function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fp-update-test-'));
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
 * Write a cache file at the expected path within a temp dir.
 */
function writeCacheFile(tmpDir, data) {
  const fpDocsDir = path.join(tmpDir, '.fp-docs');
  fs.mkdirSync(fpDocsDir, { recursive: true });
  const cachePath = path.join(fpDocsDir, 'update-cache.json');
  fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf-8');
  return cachePath;
}

// ── Module Tests ──────────────────────────────────────────────────────────────

describe('lib/update.cjs', () => {
  it('should be requireable', () => {
    const mod = require(path.join(LIB_DIR, 'update.cjs'));
    assert.ok(mod);
  });

  it('should export compareVersions, readUpdateCache, isCacheStale, parseGitHubRelease, getInstalledVersion, spawnBackgroundCheck, cmdUpdate', () => {
    const mod = require(path.join(LIB_DIR, 'update.cjs'));
    assert.equal(typeof mod.compareVersions, 'function');
    assert.equal(typeof mod.readUpdateCache, 'function');
    assert.equal(typeof mod.isCacheStale, 'function');
    assert.equal(typeof mod.parseGitHubRelease, 'function');
    assert.equal(typeof mod.getInstalledVersion, 'function');
    assert.equal(typeof mod.spawnBackgroundCheck, 'function');
    assert.equal(typeof mod.cmdUpdate, 'function');
  });

  describe('compareVersions', () => {
    it('should return 1 when first version is greater (1.0.1 > 1.0.0)', () => {
      assert.equal(update.compareVersions('1.0.1', '1.0.0'), 1);
    });

    it('should return 0 when versions are equal (1.0.0 == 1.0.0)', () => {
      assert.equal(update.compareVersions('1.0.0', '1.0.0'), 0);
    });

    it('should return -1 when first version is less (1.0.0 < 1.0.1)', () => {
      assert.equal(update.compareVersions('1.0.0', '1.0.1'), -1);
    });

    it('should handle major version differences (2.0.0 > 1.9.9)', () => {
      assert.equal(update.compareVersions('2.0.0', '1.9.9'), 1);
    });

    it('should handle minor version differences (1.2.0 > 1.1.9)', () => {
      assert.equal(update.compareVersions('1.2.0', '1.1.9'), 1);
    });

    it('should handle versions with different segment counts (1.0 vs 1.0.0)', () => {
      assert.equal(update.compareVersions('1.0', '1.0.0'), 0);
    });
  });

  describe('readUpdateCache', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = makeTempDir();
    });

    afterEach(() => {
      cleanTempDir(tmpDir);
    });

    it('should return null when cache file does not exist', () => {
      const nonExistentPath = path.join(tmpDir, 'nonexistent', '.fp-docs', 'update-cache.json');
      const result = update.readUpdateCache(nonExistentPath);
      assert.equal(result, null);
    });

    it('should return parsed JSON when cache file exists', () => {
      const cacheData = {
        update_available: true,
        installed: '1.0.0',
        latest: '1.1.0',
        checked: Math.floor(Date.now() / 1000)
      };
      const cachePath = writeCacheFile(tmpDir, cacheData);
      const result = update.readUpdateCache(cachePath);
      assert.ok(result);
      assert.equal(result.update_available, true);
      assert.equal(result.installed, '1.0.0');
      assert.equal(result.latest, '1.1.0');
    });

    it('should return null when cache file contains invalid JSON', () => {
      const fpDocsDir = path.join(tmpDir, '.fp-docs');
      fs.mkdirSync(fpDocsDir, { recursive: true });
      const cachePath = path.join(fpDocsDir, 'update-cache.json');
      fs.writeFileSync(cachePath, 'not valid json {{{', 'utf-8');
      const result = update.readUpdateCache(cachePath);
      assert.equal(result, null);
    });
  });

  describe('isCacheStale', () => {
    it('should return true when cache.checked is more than 3600 seconds ago', () => {
      const staleCache = { checked: Math.floor(Date.now() / 1000) - 7200 };
      assert.equal(update.isCacheStale(staleCache), true);
    });

    it('should return false when cache.checked is within 3600 seconds', () => {
      const freshCache = { checked: Math.floor(Date.now() / 1000) - 60 };
      assert.equal(update.isCacheStale(freshCache), false);
    });

    it('should return true when cache has no checked timestamp', () => {
      assert.equal(update.isCacheStale({}), true);
    });

    it('should accept custom TTL', () => {
      const cache = { checked: Math.floor(Date.now() / 1000) - 120 };
      assert.equal(update.isCacheStale(cache, 60), true);
      assert.equal(update.isCacheStale(cache, 300), false);
    });
  });

  describe('parseGitHubRelease', () => {
    it('should extract tag_name, body, html_url from API response', () => {
      const response = {
        tag_name: 'v1.2.0',
        body: 'Release notes here',
        html_url: 'https://github.com/tomkyser/fp-docs/releases/tag/v1.2.0'
      };
      const result = update.parseGitHubRelease(response);
      assert.ok(result);
      assert.equal(result.version, '1.2.0');
      assert.equal(result.release_notes, 'Release notes here');
      assert.equal(result.release_url, 'https://github.com/tomkyser/fp-docs/releases/tag/v1.2.0');
    });

    it('should strip leading v from tag_name (v1.0.1 -> 1.0.1)', () => {
      const response = {
        tag_name: 'v1.0.1',
        body: 'Notes',
        html_url: 'https://example.com'
      };
      const result = update.parseGitHubRelease(response);
      assert.equal(result.version, '1.0.1');
    });

    it('should handle tag_name without v prefix', () => {
      const response = {
        tag_name: '1.0.1',
        body: 'Notes',
        html_url: 'https://example.com'
      };
      const result = update.parseGitHubRelease(response);
      assert.equal(result.version, '1.0.1');
    });

    it('should return null for invalid/empty response', () => {
      assert.equal(update.parseGitHubRelease(null), null);
      assert.equal(update.parseGitHubRelease({}), null);
      assert.equal(update.parseGitHubRelease(undefined), null);
    });

    it('should return null when tag_name is missing', () => {
      const response = { body: 'Notes', html_url: 'https://example.com' };
      assert.equal(update.parseGitHubRelease(response), null);
    });
  });

  describe('getInstalledVersion', () => {
    it('should return a version string', () => {
      const version = update.getInstalledVersion();
      assert.ok(typeof version === 'string');
      assert.ok(/^\d+\.\d+\.\d+$/.test(version), `Expected semver format, got: ${version}`);
    });
  });

  describe('spawnBackgroundCheck', () => {
    it('should be a function that accepts optional cachePath', () => {
      assert.equal(typeof update.spawnBackgroundCheck, 'function');
    });

    it('should contain detached spawn pattern in source code', () => {
      const source = fs.readFileSync(path.join(LIB_DIR, 'update.cjs'), 'utf-8');
      assert.ok(source.includes('detached: true'), 'should use detached spawn');
      assert.ok(source.includes('child.unref()'), 'should unref the child process');
      assert.ok(source.includes('api.github.com'), 'should reference GitHub API');
      assert.ok(source.includes('update-cache.json'), 'should reference cache file name');
    });
  });

  describe('cmdUpdate', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = makeTempDir();
    });

    afterEach(() => {
      cleanTempDir(tmpDir);
    });

    it('should have cmdUpdate function with correct signature', () => {
      assert.equal(typeof update.cmdUpdate, 'function');
      assert.equal(update.cmdUpdate.length, 3, 'cmdUpdate should accept 3 parameters (subcommand, args, raw)');
    });
  });

  describe('source code patterns', () => {
    it('should contain GitHub API configuration constants', () => {
      const source = fs.readFileSync(path.join(LIB_DIR, 'update.cjs'), 'utf-8');
      assert.ok(source.includes('tomkyser'), 'should reference GitHub owner');
      assert.ok(source.includes('fp-docs'), 'should reference GitHub repo');
      assert.ok(source.includes('3600') || source.includes('CACHE_TTL'), 'should have TTL constant');
    });

    it('should use stdio ignore for background process', () => {
      const source = fs.readFileSync(path.join(LIB_DIR, 'update.cjs'), 'utf-8');
      assert.ok(source.includes("stdio: 'ignore'") || source.includes('stdio: "ignore"'), 'should set stdio to ignore');
    });
  });
});
