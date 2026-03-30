'use strict';

/**
 * Scope Assess -- Pre-delegation scope assessment for fp-docs operations.
 *
 * Analyzes an operation + arguments to produce a scope assessment:
 * - Estimated complexity (low / medium / high)
 * - Recommended researcher count (0-3)
 * - File scope analysis (which docs/source files are affected)
 * - Delegation strategy hint (single-agent / multi-agent / team)
 *
 * CLI: fp-tools scope-assess <command> [args...]
 *
 * Used by the orchestration workflow to decide:
 * - How many researchers to spawn
 * - Whether to delegate to a single specialist or create a team
 * - Whether a planner agent is needed
 *
 * Zero external dependencies -- Node.js built-ins only.
 */

const { output, error } = require('./core.cjs');
const { lookupRoute, getRoutingTable } = require('./routing.cjs');
const { getConfigValue } = require('./config.cjs');
const { getCodebaseRoot, getDocsRoot } = require('./paths.cjs');
const { loadSourceMap, reverseLookup } = require('./source-map.cjs');

// ── Complexity Heuristics ───────────────────────────────────────────────────

/**
 * Complexity thresholds derived from orchestration config.
 */
function getThresholds() {
  return {
    parallelThreshold: getConfigValue('system.orchestration.parallel_threshold_files') || 3,
    teamThreshold: getConfigValue('system.orchestration.team_threshold_files') || 8,
    maxTeammates: getConfigValue('system.orchestration.max_teammates') || 5,
  };
}

/**
 * Estimate complexity from file count and operation type.
 *
 * @param {number} fileCount - Number of files in scope
 * @param {string} type - Operation type (write/read/admin/batch/meta)
 * @returns {'low'|'medium'|'high'}
 */
function estimateComplexity(fileCount, type) {
  const thresholds = getThresholds();

  if (type === 'meta' || type === 'admin') return 'low';
  if (type === 'read' && fileCount <= 1) return 'low';

  if (fileCount >= thresholds.teamThreshold) return 'high';
  if (fileCount >= thresholds.parallelThreshold) return 'medium';
  return 'low';
}

/**
 * Recommend researcher count based on complexity and operation type.
 *
 * @param {'low'|'medium'|'high'} complexity
 * @param {string} type - Operation type
 * @returns {number} 0-3
 */
function recommendResearcherCount(complexity, type) {
  if (type === 'meta' || type === 'admin') return 0;
  if (type === 'read') return complexity === 'high' ? 1 : 0;

  // Write operations
  switch (complexity) {
    case 'low': return 1;
    case 'medium': return 2;
    case 'high': return 3;
    default: return 1;
  }
}

/**
 * Determine delegation strategy based on complexity.
 *
 * @param {'low'|'medium'|'high'} complexity
 * @param {string} type
 * @returns {'direct'|'single-agent'|'multi-agent'|'team'}
 */
function recommendStrategy(complexity, type) {
  if (type === 'meta') return 'direct';
  if (type === 'admin') return 'single-agent';

  switch (complexity) {
    case 'low': return 'single-agent';
    case 'medium': return 'multi-agent';
    case 'high': return 'team';
    default: return 'single-agent';
  }
}

// ── File Scope Analysis ─────────────────────────────────────────────────────

/**
 * Parse user arguments to extract file targets.
 * Handles common patterns: file paths, "all", glob-like patterns.
 *
 * @param {string[]} args - User arguments
 * @returns {{ targets: string[], isAll: boolean, hasGlob: boolean }}
 */
function parseTargets(args) {
  const targets = [];
  let isAll = false;
  let hasGlob = false;

  for (const arg of args) {
    if (arg === 'all' || arg === '--all') {
      isAll = true;
    } else if (arg.includes('*') || arg.includes('?')) {
      hasGlob = true;
      targets.push(arg);
    } else if (!arg.startsWith('--')) {
      targets.push(arg);
    }
  }

  return { targets, isAll, hasGlob };
}

/**
 * Estimate file count for scope analysis.
 * Uses source-map for reverse lookups when targets are source files.
 *
 * @param {{ targets: string[], isAll: boolean, hasGlob: boolean }} parsed
 * @param {string} type - Operation type
 * @returns {{ fileCount: number, files: string[], estimationMethod: string }}
 */
function analyzeFileScope(parsed, type) {
  if (parsed.isAll) {
    // "all" operations -- estimate from source map size
    try {
      const sourceMap = loadSourceMap();
      const entries = sourceMap ? Object.keys(sourceMap).length : 0;
      return {
        fileCount: Math.max(entries, 10),
        files: [],
        estimationMethod: 'source-map-total',
      };
    } catch {
      return { fileCount: 20, files: [], estimationMethod: 'default-all-estimate' };
    }
  }

  if (parsed.hasGlob) {
    // Glob patterns -- rough estimate
    return { fileCount: 5, files: parsed.targets, estimationMethod: 'glob-estimate' };
  }

  if (parsed.targets.length === 0) {
    // No explicit targets -- single file assumed
    return { fileCount: 1, files: [], estimationMethod: 'no-targets-default' };
  }

  // Explicit file targets
  return {
    fileCount: parsed.targets.length,
    files: parsed.targets,
    estimationMethod: 'explicit-targets',
  };
}

// ── Main Assessment ─────────────────────────────────────────────────────────

/**
 * Perform scope assessment for a command + arguments.
 *
 * @param {string} command - Command name (without /fp-docs: prefix)
 * @param {string[]} args - User arguments
 * @returns {object} Scope assessment result
 */
function assessScope(command, args) {
  const route = lookupRoute(command);

  if (!route) {
    return {
      command,
      error: 'Unknown command: ' + command,
      complexity: 'low',
      researcherCount: 0,
      strategy: 'direct',
      fileScope: { fileCount: 0, files: [], estimationMethod: 'error' },
    };
  }

  const type = route.type;
  const parsed = parseTargets(args);
  const fileScope = analyzeFileScope(parsed, type);
  const complexity = estimateComplexity(fileScope.fileCount, type);
  const researcherCount = recommendResearcherCount(complexity, type);
  const strategy = recommendStrategy(complexity, type);
  const needsPlanner = complexity === 'high' || (complexity === 'medium' && type === 'write');

  return {
    command,
    agent: route.agent,
    type,
    complexity,
    researcherCount,
    strategy,
    needsPlanner,
    fileScope,
    thresholds: getThresholds(),
  };
}

// ── CLI Handler ─────────────────────────────────────────────────────────────

/**
 * CLI handler for `fp-tools scope-assess <command> [args...]`.
 *
 * @param {string[]} args - CLI arguments (command name + user args)
 * @param {boolean} raw - Raw output mode
 */
function cmdScopeAssess(args, raw) {
  if (!args || args.length === 0) {
    error('Usage: fp-tools scope-assess <command> [args...]');
  }

  const command = args[0];
  const userArgs = args.slice(1);
  const result = assessScope(command, userArgs);

  output(result, raw);
}

module.exports = {
  assessScope,
  estimateComplexity,
  recommendResearcherCount,
  recommendStrategy,
  parseTargets,
  analyzeFileScope,
  cmdScopeAssess,
};
