'use strict';

/**
 * Agent Map -- canonical agent name registry and pipeline phase authority.
 *
 * Single source of truth for:
 * 1. GSD agent name -> canonical (legacy) name mapping
 * 2. Agent name -> pipeline phase authority mapping
 *
 * Consolidates the previously independent AGENT_NAME_MAP (fp-docs-subagent-stop.js)
 * and STAGE_AUTHORITY_MAP (enforcement.cjs) into one module to prevent silent divergence.
 *
 * Zero external dependencies -- Node.js built-ins only.
 */

// ── Canonical Agent Registry ────────────────────────────────────────────────

/**
 * Maps GSD-style agent names (fp-docs-*) to their canonical short names.
 * Used by hooks to normalize agent_type before routing to handlers.
 */
const AGENT_NAME_MAP = {
  'fp-docs-modifier':            'modify',
  'fp-docs-validator':           'validate',
  'fp-docs-citations':           'citations',
  'fp-docs-api-refs':            'api-refs',
  'fp-docs-locals':              'locals',
  'fp-docs-researcher':          'researcher',
  'fp-docs-planner':             'planner',
  'fp-docs-verbosity':           'verbosity',
  'fp-docs-verbosity-enforcer':  'verbosity-enforcer',
  'fp-docs-indexer':             'index',
  'fp-docs-system':              'system',
};

/**
 * Maps agent names to their authorized pipeline phase.
 * Supports both GSD (fp-docs-*) and canonical short names.
 *
 * Agents not listed here (system, indexer, verbosity) are
 * administrative/standalone -- no phase authority mapping needed.
 */
const STAGE_AUTHORITY_MAP = {
  // GSD-style agent names
  'fp-docs-researcher':          'research',
  'fp-docs-planner':             'plan',
  'fp-docs-modifier':            'write',
  'fp-docs-citations':           'write',
  'fp-docs-api-refs':            'write',
  'fp-docs-locals':              'write',
  'fp-docs-verbosity-enforcer':  'write',
  'fp-docs-validator':           'review',

  // Canonical short names (used by hooks after normalization)
  researcher:            'research',
  planner:               'plan',
  modify:                'write',
  citations:             'write',
  'api-refs':            'write',
  locals:                'write',
  'verbosity-enforcer':  'write',
  validate:              'review',
  orchestrate:           'finalize',
};

// ── Lookup Functions ────────────────────────────────────────────────────────

/**
 * Resolve a GSD agent name to its canonical short name.
 * Returns the input unchanged if it's already canonical or unknown.
 *
 * @param {string} agentName - Agent name (e.g., 'fp-docs-modifier' or 'modify')
 * @returns {string} Canonical short name (e.g., 'modify')
 */
function getCanonicalName(agentName) {
  if (!agentName || typeof agentName !== 'string') return '';
  return AGENT_NAME_MAP[agentName] || agentName;
}

/**
 * Look up the authorized pipeline phase for an agent.
 *
 * @param {string} agentName - Agent name (GSD or canonical)
 * @returns {string|undefined} Pipeline phase ('research', 'plan', 'write', 'review', 'finalize') or undefined
 */
function getPhaseAuthority(agentName) {
  if (!agentName || typeof agentName !== 'string') return undefined;
  return STAGE_AUTHORITY_MAP[agentName];
}

/**
 * Check if a given name is a known GSD-style agent name (fp-docs-* prefix).
 *
 * @param {string} name - Name to check
 * @returns {boolean}
 */
function isGsdAgentName(name) {
  return AGENT_NAME_MAP.hasOwnProperty(name);
}

/**
 * Get all known GSD agent names.
 *
 * @returns {string[]}
 */
function getGsdAgentNames() {
  return Object.keys(AGENT_NAME_MAP);
}

/**
 * Get all known canonical short names.
 *
 * @returns {string[]}
 */
function getCanonicalNames() {
  return Object.values(AGENT_NAME_MAP);
}

module.exports = {
  AGENT_NAME_MAP,
  STAGE_AUTHORITY_MAP,
  getCanonicalName,
  getPhaseAuthority,
  isGsdAgentName,
  getGsdAgentNames,
  getCanonicalNames,
};
