'use strict';

/**
 * Config -- JSON config loading, caching, and querying for fp-docs.
 *
 * Loads config.json (the single source of truth per D-08/D-09) and provides
 * dot-notation access to config values. Replaces the old markdown config files
 * (system-config.md, project-config.md) with a single JSON file.
 *
 * The config file has three top-level sections:
 *   - system: feature flags, thresholds, citation/api-ref/verbosity scope tables
 *   - project: FP-specific paths, source-to-docs mappings, repo configuration
 *   - pipeline: 8-stage pipeline definition with phase/agent/skip rules
 *
 * Zero external dependencies -- Node.js built-ins only (D-15).
 */

const path = require('path');
const { safeReadFile, safeJsonParse, output, error } = require('./core.cjs');
const { getPluginRoot } = require('./paths.cjs');

// ── Module-level cache ──────────────────────────────────────────────────────

let _cachedConfig = null;

// ── Default config (used when config.json is missing or corrupt) ────────────

const DEFAULT_CONFIG = {
  system: {},
  project: {},
  pipeline: { stages: [] },
};

// ── Config Loading ──────────────────────────────────────────────────────────

/**
 * Load and parse config.json from the plugin root.
 *
 * If configPath is not provided, computes it from getPluginRoot().
 * Caches the result in a module-level variable for repeated calls.
 * Returns DEFAULT_CONFIG if the file is missing or corrupt.
 *
 * @param {string} [configPath] - Optional explicit path to config.json
 * @returns {object} The parsed config object with system, project, pipeline sections
 */
function loadConfig(configPath) {
  // Return cache if available and no explicit path override
  if (_cachedConfig && !configPath) {
    return _cachedConfig;
  }

  const resolvedPath = configPath || path.join(getPluginRoot(), 'config.json');
  const raw = safeReadFile(resolvedPath);

  if (!raw) {
    if (!configPath) _cachedConfig = DEFAULT_CONFIG;
    return DEFAULT_CONFIG;
  }

  const result = safeJsonParse(raw);

  if (!result.ok) {
    if (!configPath) _cachedConfig = DEFAULT_CONFIG;
    return DEFAULT_CONFIG;
  }

  const config = result.data;

  // Ensure top-level sections exist
  if (!config.system) config.system = {};
  if (!config.project) config.project = {};
  if (!config.pipeline) config.pipeline = { stages: [] };

  if (!configPath) _cachedConfig = config;
  return config;
}

// ── Config Querying ─────────────────────────────────────────────────────────

/**
 * Get a config value by dot-notation key path.
 *
 * Examples:
 *   getConfigValue('system.citations.enabled') => true
 *   getConfigValue('project.identity.name') => 'Foreign Policy'
 *   getConfigValue('pipeline.stages') => [array of 8 stages]
 *   getConfigValue('nonexistent.path') => undefined
 *
 * @param {string} keyPath - Dot-separated path to the config value
 * @returns {any} The config value, or undefined if path doesn't exist
 */
function getConfigValue(keyPath) {
  const config = loadConfig();
  const keys = keyPath.split('.');
  let current = config;

  for (const key of keys) {
    if (current === undefined || current === null || typeof current !== 'object') {
      return undefined;
    }
    current = current[key];
  }

  return current;
}

/**
 * Get the cached loaded config object.
 * Calls loadConfig() if not yet loaded.
 *
 * @returns {object} The full config object
 */
function getConfig() {
  return loadConfig();
}

// ── CLI Handler ─────────────────────────────────────────────────────────────

/**
 * CLI handler for `fp-tools config <subcommand>`.
 *
 * Subcommands:
 *   get <key>      - Get a specific config value by dot-notation path
 *   section <name> - Get an entire top-level section (system, project, pipeline)
 *   dump           - Get the entire config object
 *
 * @param {string} subcommand - The config subcommand
 * @param {string[]} args - Additional arguments
 * @param {boolean} raw - Whether to use raw output mode
 */
function cmdConfig(subcommand, args, raw) {
  if (!subcommand) {
    error('Usage: fp-tools config <get|section|dump> [args]');
  }

  switch (subcommand) {
    case 'get': {
      const keyPath = args[0];
      if (!keyPath) {
        error('Usage: fp-tools config get <key.path>');
      }
      const value = getConfigValue(keyPath);
      if (value === undefined) {
        error(`Config key not found: ${keyPath}`);
      }
      output(value, raw, typeof value === 'object' ? JSON.stringify(value) : String(value));
      break;
    }

    case 'section': {
      const sectionName = args[0];
      if (!sectionName) {
        error('Usage: fp-tools config section <system|project|pipeline>');
      }
      const config = loadConfig();
      const section = config[sectionName];
      if (!section) {
        error(`Unknown config section: ${sectionName}`);
      }
      output(section, raw, JSON.stringify(section, null, 2));
      break;
    }

    case 'dump': {
      const config = loadConfig();
      output(config, raw, JSON.stringify(config, null, 2));
      break;
    }

    default:
      error(`Unknown config subcommand: ${subcommand}. Use: get, section, dump`);
  }
}

module.exports = { loadConfig, getConfigValue, getConfig, cmdConfig };
