'use strict';

/**
 * Update -- Version checking, background update detection, and self-update for fp-docs.
 *
 * Background check pattern adapted from GSD's gsd-check-update.js.
 * Uses GitHub Releases API (D-03) with detached spawn (D-04).
 * CLI surface: fp-tools update <check|status|run> (D-05).
 *
 * Zero external dependencies -- Node.js built-ins only.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { output, error, safeReadFile, safeJsonParse } = require('./core.cjs');
const { getPluginRoot, getCodebaseRoot } = require('./paths.cjs');

// ── Constants ─────────────────────────────────────────────────────────────────

const GITHUB_OWNER = 'tomkyser';
const GITHUB_REPO = 'fp-docs';
const CACHE_TTL_SECONDS = 3600; // 1 hour
const CACHE_FILENAME = 'update-cache.json';

// ── Version Comparison ─────────────────────────────────────────────────────────

/**
 * Compare two semver version strings.
 *
 * @param {string} a - First version string (e.g., '1.0.1')
 * @param {string} b - Second version string (e.g., '1.0.0')
 * @returns {number} 1 if a > b, 0 if equal, -1 if a < b
 */
function compareVersions(a, b) {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  const maxLen = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < maxLen; i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }

  return 0;
}

// ── Cache Management ─────────────────────────────────────────────────────────

/**
 * Resolve the default cache file path.
 *
 * Looks for .fp-docs/update-cache.json relative to the codebase root.
 * Falls back to plugin root if codebase root is unavailable.
 *
 * @returns {string} Absolute path to the cache file
 */
function getDefaultCachePath() {
  const codebaseRoot = getCodebaseRoot();
  const baseDir = codebaseRoot || getPluginRoot();
  return path.join(baseDir, '.fp-docs', CACHE_FILENAME);
}

/**
 * Read and parse the update cache file.
 *
 * @param {string} [cachePath] - Optional explicit path to cache file
 * @returns {object|null} Parsed cache object, or null if missing/invalid
 */
function readUpdateCache(cachePath) {
  const resolvedPath = cachePath || getDefaultCachePath();
  const raw = safeReadFile(resolvedPath);
  if (!raw) return null;

  const result = safeJsonParse(raw);
  if (!result.ok) return null;

  return result.data;
}

/**
 * Check if a cache entry is stale based on TTL.
 *
 * @param {object} cache - Cache object with .checked timestamp (epoch seconds)
 * @param {number} [ttlSeconds=3600] - Time-to-live in seconds
 * @returns {boolean} True if cache is stale or has no checked timestamp
 */
function isCacheStale(cache, ttlSeconds) {
  const ttl = ttlSeconds !== undefined ? ttlSeconds : CACHE_TTL_SECONDS;
  if (!cache || !cache.checked) return true;
  const now = Math.floor(Date.now() / 1000);
  return (now - cache.checked) > ttl;
}

// ── GitHub Release Parsing ───────────────────────────────────────────────────

/**
 * Parse a GitHub Releases API response into a structured release object.
 * Strips leading 'v' from tag_name (e.g., 'v1.0.1' -> '1.0.1').
 *
 * @param {object} responseData - Raw GitHub API response JSON
 * @returns {{ version: string, release_notes: string, release_url: string }|null}
 */
function parseGitHubRelease(responseData) {
  if (!responseData || !responseData.tag_name) return null;

  const tagName = responseData.tag_name;
  const version = tagName.startsWith('v') ? tagName.slice(1) : tagName;

  return {
    version,
    release_notes: responseData.body || '',
    release_url: responseData.html_url || '',
  };
}

// ── Installed Version ────────────────────────────────────────────────────────

/**
 * Read the installed plugin version from plugin.json.
 *
 * @returns {string} Version string (e.g., '2.8.0')
 */
function getInstalledVersion() {
  const pluginRoot = getPluginRoot();
  const pluginJsonPath = path.join(pluginRoot, '.claude-plugin', 'plugin.json');
  const content = safeReadFile(pluginJsonPath);
  if (!content) return '0.0.0';

  const result = safeJsonParse(content);
  if (!result.ok || !result.data.version) return '0.0.0';

  return result.data.version;
}

// ── Background Check ─────────────────────────────────────────────────────────

/**
 * Spawn a detached background process to check for updates.
 *
 * The spawned process:
 * 1. Reads current version from plugin.json
 * 2. Calls GitHub Releases API for latest release
 * 3. Writes result to update-cache.json
 * 4. Handles errors gracefully (timeout, network failure, rate limit)
 *
 * Pattern adapted from GSD's gsd-check-update.js.
 *
 * @param {string} [cachePath] - Optional explicit cache file path
 */
function spawnBackgroundCheck(cachePath) {
  const resolvedCachePath = cachePath || getDefaultCachePath();
  const pluginRoot = getPluginRoot();
  const pluginJsonPath = path.join(pluginRoot, '.claude-plugin', 'plugin.json');

  const child = spawn(process.execPath, ['-e', `
    const fs = require('fs');
    const path = require('path');
    const https = require('https');

    const cachePath = ${JSON.stringify(resolvedCachePath)};
    const pluginJsonPath = ${JSON.stringify(pluginJsonPath)};

    // Read installed version
    let installed = '0.0.0';
    try {
      const pj = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
      installed = pj.version || '0.0.0';
    } catch (e) {}

    // Ensure cache directory exists
    const cacheDir = path.dirname(cachePath);
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    // Call GitHub Releases API
    const options = {
      hostname: 'api.github.com',
      path: '/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest',
      headers: {
        'User-Agent': 'fp-docs-update-check',
        'Accept': 'application/vnd.github.v3+json'
      },
      timeout: 10000
    };

    const req = https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const release = JSON.parse(data);
          const tagName = release.tag_name || '';
          const latest = tagName.startsWith('v') ? tagName.slice(1) : tagName;

          const result = {
            update_available: latest && latest !== installed,
            installed,
            latest: latest || 'unknown',
            release_notes: (release.body || '').slice(0, 500),
            release_url: release.html_url || '',
            checked: Math.floor(Date.now() / 1000)
          };

          fs.writeFileSync(cachePath, JSON.stringify(result, null, 2));
        } catch (e) {
          // Write error cache so we don't retry immediately
          const result = {
            update_available: false,
            installed,
            latest: 'unknown',
            release_notes: '',
            release_url: '',
            checked: Math.floor(Date.now() / 1000),
            error: 'Parse error: ' + e.message
          };
          fs.writeFileSync(cachePath, JSON.stringify(result, null, 2));
        }
      });
    });

    req.on('error', (e) => {
      // Network failure -- write cache with error info
      const result = {
        update_available: false,
        installed,
        latest: 'unknown',
        release_notes: '',
        release_url: '',
        checked: Math.floor(Date.now() / 1000),
        error: 'Network error: ' + e.message
      };
      try {
        const cacheDir = path.dirname(cachePath);
        if (!fs.existsSync(cacheDir)) {
          fs.mkdirSync(cacheDir, { recursive: true });
        }
        fs.writeFileSync(cachePath, JSON.stringify(result, null, 2));
      } catch (writeErr) {}
    });

    req.on('timeout', () => {
      req.destroy();
    });
  `], {
    stdio: 'ignore',
    detached: true,
  });

  child.unref();
}

// ── CLI Handler ───────────────────────────────────────────────────────────────

/**
 * CLI handler for `fp-tools update <subcommand>`.
 *
 * Subcommands:
 *   check   - Spawn background update check (or synchronous with --sync)
 *   status  - Show cached update status
 *   run     - Fetch update info for skill-driven update
 *
 * @param {string} subcommand - The update subcommand
 * @param {string[]} args - Additional arguments
 * @param {boolean} raw - Whether to use raw output mode
 */
function cmdUpdate(subcommand, args, raw) {
  if (!subcommand) {
    error('Usage: fp-tools update <check|status|run> [--force] [--sync]');
  }

  switch (subcommand) {
    case 'check': {
      const force = args.includes('--force');
      const sync = args.includes('--sync');

      const cache = readUpdateCache();
      if (!force && cache && !isCacheStale(cache)) {
        output({ status: 'cache_fresh', ...cache }, raw, 'Cache is fresh');
        break;
      }

      if (sync) {
        // Synchronous check -- fetch directly (for CLI testing)
        const https = require('https');
        const options = {
          hostname: 'api.github.com',
          path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
          headers: {
            'User-Agent': 'fp-docs-update-check',
            'Accept': 'application/vnd.github.v3+json',
          },
          timeout: 10000,
        };

        const cachePath = getDefaultCachePath();
        const installed = getInstalledVersion();

        const req = https.get(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const release = JSON.parse(data);
              const parsed = parseGitHubRelease(release);
              const latest = parsed ? parsed.version : 'unknown';

              const result = {
                update_available: latest !== 'unknown' && latest !== installed,
                installed,
                latest,
                release_notes: parsed ? parsed.release_notes.slice(0, 500) : '',
                release_url: parsed ? parsed.release_url : '',
                checked: Math.floor(Date.now() / 1000),
              };

              // Write cache
              const cacheDir = path.dirname(cachePath);
              if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
              }
              fs.writeFileSync(cachePath, JSON.stringify(result, null, 2));

              output(result, raw, JSON.stringify(result, null, 2));
            } catch (e) {
              output({
                status: 'error',
                installed,
                error: e.message,
              }, raw, `Error: ${e.message}`);
            }
          });
        });

        req.on('error', (e) => {
          output({
            status: 'error',
            installed,
            error: e.message,
          }, raw, `Error: ${e.message}`);
        });

        req.on('timeout', () => {
          req.destroy();
        });
      } else {
        // Background check (non-blocking)
        spawnBackgroundCheck();
        output({ status: 'check_spawned' }, raw, 'Background check spawned');
      }
      break;
    }

    case 'status': {
      const installed = getInstalledVersion();
      const cache = readUpdateCache();

      if (!cache) {
        output({
          status: 'no_cache',
          installed,
          message: 'Run fp-tools update check first',
        }, raw, `Installed: ${installed}. No cache. Run fp-tools update check first.`);
        break;
      }

      const checkedAgo = cache.checked
        ? Math.floor(Date.now() / 1000) - cache.checked
        : null;

      output({
        update_available: cache.update_available || false,
        installed,
        latest: cache.latest || 'unknown',
        checked_ago: checkedAgo,
        release_url: cache.release_url || '',
      }, raw, cache.update_available
        ? `Update available: ${cache.latest} (installed: ${installed})`
        : `Up to date: ${installed}`);
      break;
    }

    case 'run': {
      const installed = getInstalledVersion();
      const cache = readUpdateCache();

      if (cache && cache.update_available) {
        output({
          update_available: true,
          installed,
          latest: cache.latest,
          release_notes: cache.release_notes || '',
          release_url: cache.release_url || '',
        }, raw, `Update available: ${cache.latest}`);
      } else {
        output({
          update_available: false,
          installed,
          message: cache ? 'Already up to date' : 'No cache available. Run fp-tools update check first.',
        }, raw, `Installed: ${installed}. No update available.`);
      }
      break;
    }

    default:
      error(`Unknown update subcommand: ${subcommand}. Use: check, status, run`);
  }
}

module.exports = {
  compareVersions,
  readUpdateCache,
  isCacheStale,
  parseGitHubRelease,
  getInstalledVersion,
  spawnBackgroundCheck,
  cmdUpdate,
};
