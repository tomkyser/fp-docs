'use strict';

/**
 * Model Profiles -- Model resolution for fp-docs agents.
 *
 * Reads the model_profile section from config.json and resolves
 * the appropriate model for a given agent type and profile tier.
 *
 * CLI: fp-tools resolve-model <agent-name> [--profile <quality|balanced|budget>]
 *
 * Zero external dependencies -- Node.js built-ins only.
 */

const { output, error } = require('./core.cjs');
const { getConfigValue } = require('./config.cjs');

// ── Model Resolution ────────────────────────────────────────────────────────

/**
 * Resolve the model name for a given agent and profile tier.
 *
 * Lookup order:
 *   1. config.json model_profile.agents[agentName][profile]
 *   2. Falls back to 'opus' if agent or profile not found
 *
 * @param {string} agentName - Agent identifier (e.g., 'fp-docs-modifier')
 * @param {string} [profileOverride] - Profile tier override (quality|balanced|budget)
 * @returns {string} Model name (e.g., 'opus', 'sonnet')
 */
function resolveModel(agentName, profileOverride) {
  const defaultProfile = getConfigValue('model_profile.default') || 'quality';
  const profile = profileOverride || defaultProfile;

  const agentConfig = getConfigValue(`model_profile.agents.${agentName}`);
  if (!agentConfig) {
    return 'opus'; // fallback for unknown agents
  }

  return agentConfig[profile] || agentConfig['quality'] || 'opus';
}

/**
 * List all agent model mappings for a given profile tier.
 *
 * @param {string} [profile] - Profile tier (defaults to config default)
 * @returns {object} Map of agentName -> modelName
 */
function listModels(profile) {
  const defaultProfile = getConfigValue('model_profile.default') || 'quality';
  const tier = profile || defaultProfile;
  const agents = getConfigValue('model_profile.agents') || {};
  const result = {};

  for (const [name, config] of Object.entries(agents)) {
    result[name] = config[tier] || config['quality'] || 'opus';
  }

  return result;
}

// ── CLI Handler ─────────────────────────────────────────────────────────────

/**
 * CLI handler for `fp-tools resolve-model <agent-name> [--profile <tier>]`.
 *
 * @param {string[]} args - CLI arguments after 'resolve-model'
 * @param {boolean} raw - Whether to use raw output mode
 */
function cmdResolveModel(args, raw) {
  if (!args || args.length === 0) {
    error('Usage: fp-tools resolve-model <agent-name> [--profile <quality|balanced|budget>]\n       fp-tools resolve-model --list [--profile <tier>]');
  }

  // Handle --list flag
  if (args[0] === '--list') {
    const profileIdx = args.indexOf('--profile');
    const profile = profileIdx !== -1 ? args[profileIdx + 1] : undefined;
    const models = listModels(profile);
    output(models, raw, JSON.stringify(models, null, 2));
    return;
  }

  const agentName = args[0];

  // Extract --profile flag
  const profileIdx = args.indexOf('--profile');
  const profile = profileIdx !== -1 ? args[profileIdx + 1] : undefined;

  const model = resolveModel(agentName, profile);
  output({ agent: agentName, model, profile: profile || getConfigValue('model_profile.default') || 'quality' }, raw, model);
}

module.exports = { resolveModel, listModels, cmdResolveModel };
