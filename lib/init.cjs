'use strict';

/**
 * Init -- Workflow bootstrapping commands for fp-docs.
 *
 * Returns JSON context payloads that workflows need to initialize.
 * Each init subcommand gathers config, routing, feature flags, paths,
 * and operation-specific data into a single payload.
 *
 * CLI: fp-tools init <write-op|read-op|admin-op|parallel|remediate> <command> [args...]
 *
 * Uses @file: protocol (via core.cjs output) for large payloads.
 * Zero external dependencies -- Node.js built-ins only.
 */

const { output, error } = require('./core.cjs');
const { getPluginRoot, getCodebaseRoot, getDocsRoot, getAllPaths } = require('./paths.cjs');
const { loadConfig, getConfigValue } = require('./config.cjs');
const { lookupRoute } = require('./routing.cjs');
const { resolveModel } = require('./model-profiles.cjs');

// ── Init Helpers ────────────────────────────────────────────────────────────

/**
 * Build the common context payload shared by all init types.
 *
 * @param {string} command - Command name (without /fp-docs: prefix)
 * @returns {object} Common context fields
 */
function buildCommonContext(command) {
  const route = lookupRoute(command);
  const paths = getAllPaths();
  const pluginRoot = getPluginRoot();

  return {
    command,
    route: route || { agent: null, workflow: null, operation: null, type: null },
    paths: {
      pluginRoot,
      codebaseRoot: paths.codebaseRoot,
      docsRoot: paths.docsRoot,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Gather feature flags from config relevant to pipeline enforcement.
 *
 * @returns {object} Feature flag states
 */
function getFeatureFlags() {
  return {
    citations: getConfigValue('system.citations.enabled') !== false,
    apiRef: getConfigValue('system.api_ref.enabled') !== false,
    verbosity: getConfigValue('system.verbosity.enabled') !== false,
    sanityCheck: getConfigValue('system.sanity_check.default_enabled') !== false,
    orchestration: getConfigValue('system.orchestration.enabled') !== false,
    localsCli: getConfigValue('system.locals.cli_enabled') !== false,
    remotePull: getConfigValue('system.remote.pull_before_commit') !== false,
    push: getConfigValue('system.push.enabled') !== false,
  };
}

/**
 * Get pipeline configuration for a given command.
 *
 * @param {string} command - Command name
 * @returns {object} Pipeline stages, trigger matrix entry, skip conditions
 */
function getPipelineConfig(command) {
  const stages = getConfigValue('pipeline.stages') || [];
  const triggerMatrix = getConfigValue('pipeline.triggerMatrix') || {};
  const skipConditions = getConfigValue('pipeline.skipConditions') || {};

  return {
    stages,
    triggeredStages: triggerMatrix[command] || [],
    skipConditions,
  };
}

/**
 * Get user guide pipeline configuration.
 *
 * @returns {object} User guide pipeline stages and settings
 */
function getUserGuidePipelineConfig() {
  const stages = getConfigValue('user_guide_pipeline.stages') || [];
  const playwrightRequired = getConfigValue('user_guide_pipeline.playwright_required') || false;
  const playwrightPreferred = getConfigValue('user_guide_pipeline.playwright_preferred') !== false;
  const stalenessDays = getConfigValue('user_guide_pipeline.screenshot_staleness_days') || 30;

  return {
    stages,
    playwrightRequired,
    playwrightPreferred,
    screenshotStalenessDays: stalenessDays,
  };
}

/**
 * Get user guide content configuration.
 *
 * @returns {object} User guide sections, page types, screenshot settings
 */
function getUserGuideConfig() {
  return {
    enabled: getConfigValue('user_guide.enabled') !== false,
    scaffoldName: getConfigValue('user_guide.scaffold_name') || 'user-guide',
    contentDir: getConfigValue('user_guide.content_dir') || 'user-guide/content',
    templatesDir: getConfigValue('user_guide.templates_dir') || 'user-guide/templates',
    sections: getConfigValue('user_guide.sections') || [],
    pageTypes: getConfigValue('user_guide.page_types') || [],
    screenshot: getConfigValue('user_guide.screenshot') || {},
    playwright: getConfigValue('user_guide.playwright') || {},
  };
}

/**
 * Check user-guide scaffold existence and auto-bootstrap if missing.
 *
 * @param {object} pathsObj - Paths object from getAllPaths()
 * @returns {{ scaffoldReady: boolean, bootstrapped: boolean, detail: string }}
 */
function checkUserGuideScaffold(pathsObj) {
  if (!pathsObj.docsRoot) {
    return { scaffoldReady: false, bootstrapped: false, detail: 'Docs root unavailable -- scaffold check skipped' };
  }

  try {
    const { checkScaffold, bootstrap } = require('./scaffold.cjs');
    const scaffoldName = getConfigValue('user_guide.scaffold_name') || 'user-guide';
    const status = checkScaffold(scaffoldName, pathsObj.docsRoot);

    if (status.exists) {
      return { scaffoldReady: true, bootstrapped: false, detail: `User guide scaffold exists at ${status.targetPath}` };
    }

    // Auto-bootstrap
    const result = bootstrap(scaffoldName, pathsObj.docsRoot);
    if (result.success) {
      return { scaffoldReady: true, bootstrapped: true, detail: `Auto-bootstrapped user guide scaffold to ${result.targetPath}` };
    }

    return { scaffoldReady: false, bootstrapped: false, detail: `Scaffold bootstrap failed: ${result.error || 'unknown error'}` };
  } catch (e) {
    return { scaffoldReady: false, bootstrapped: false, detail: `Scaffold check error: ${e.message}` };
  }
}

// ── Init Subcommands ────────────────────────────────────────────────────────

/**
 * Initialize context for a write operation.
 *
 * Write operations get full pipeline config, feature flags, agent model
 * resolution, and source-map lookup capability.
 *
 * @param {string} command - Command name (revise, add, auto-update, etc.)
 * @param {string[]} args - User arguments
 * @param {boolean} raw - Raw output mode
 */
function initWriteOp(command, args, raw) {
  const common = buildCommonContext(command);
  const route = common.route;

  if (route.type !== 'write') {
    error(`Command '${command}' is not a write operation (type: ${route.type})`);
  }

  const agentName = route.agent;

  const result = {
    ...common,
    operationType: 'write',
    agent: agentName,
    model: resolveModel(agentName),
    userArgs: args.join(' '),
    featureFlags: getFeatureFlags(),
    pipeline: getPipelineConfig(command),
    orchestration: {
      parallelThreshold: getConfigValue('system.orchestration.parallel_threshold_files') || 3,
      teamThreshold: getConfigValue('system.orchestration.team_threshold_files') || 8,
      maxTeammates: getConfigValue('system.orchestration.max_teammates') || 5,
      validationRetryLimit: getConfigValue('system.orchestration.validation_retry_limit') || 1,
    },
    validatorAgent: 'fp-docs-validator',
    validatorModel: resolveModel('fp-docs-validator'),
  };

  output(result, raw);
}

/**
 * Initialize context for a read operation.
 *
 * Read operations get validation config but no pipeline (no write phases).
 *
 * @param {string} command - Command name (audit, verify, sanity-check, test, verbosity-audit)
 * @param {string[]} args - User arguments
 * @param {boolean} raw - Raw output mode
 */
function initReadOp(command, args, raw) {
  const common = buildCommonContext(command);
  const route = common.route;

  if (route.type !== 'read') {
    error(`Command '${command}' is not a read operation (type: ${route.type})`);
  }

  const agentName = route.agent;

  const result = {
    ...common,
    operationType: 'read',
    agent: agentName,
    model: resolveModel(agentName),
    userArgs: args.join(' '),
    featureFlags: getFeatureFlags(),
    validation: {
      totalChecks: getConfigValue('system.verify.total_checks') || 10,
      sanityCheckEnabled: getConfigValue('system.sanity_check.default_enabled') !== false,
      multiAgentThresholdDocs: getConfigValue('system.sanity_check.multi_agent_threshold_docs') || 5,
      multiAgentThresholdSections: getConfigValue('system.sanity_check.multi_agent_threshold_sections') || 3,
    },
    scopeAssess: {
      enabled: getConfigValue('system.scope_assess.enabled') !== false,
    },
  };

  output(result, raw);
}

/**
 * Initialize context for an admin operation.
 *
 * Admin operations get system state info and paths.
 *
 * @param {string} command - Command name (setup, sync, update, update-skills, etc.)
 * @param {string[]} args - User arguments
 * @param {boolean} raw - Raw output mode
 */
function initAdminOp(command, args, raw) {
  const common = buildCommonContext(command);
  const route = common.route;

  if (route.type !== 'admin') {
    error(`Command '${command}' is not an admin operation (type: ${route.type})`);
  }

  const agentName = route.agent;

  const result = {
    ...common,
    operationType: 'admin',
    agent: agentName,
    model: resolveModel(agentName),
    userArgs: args.join(' '),
    featureFlags: getFeatureFlags(),
    system: {
      remotePull: getConfigValue('system.remote.pull_on_session_start') !== false,
      pushEnabled: getConfigValue('system.push.enabled') !== false,
      localsCli: getConfigValue('system.locals.cli_enabled') !== false,
    },
    scopeAssess: {
      enabled: getConfigValue('system.scope_assess.enabled') !== false,
    },
  };

  output(result, raw);
}

/**
 * Initialize context for a parallel batch operation.
 *
 * @param {string[]} args - User arguments (target files/operations)
 * @param {boolean} raw - Raw output mode
 */
function initParallel(args, raw) {
  const common = buildCommonContext('parallel');

  const result = {
    ...common,
    operationType: 'batch',
    userArgs: args.join(' '),
    featureFlags: getFeatureFlags(),
    batch: {
      maxTeammates: getConfigValue('system.orchestration.max_teammates') || 5,
      maxFilesPerTeammate: getConfigValue('system.orchestration.max_files_per_teammate') || 5,
      teamThreshold: getConfigValue('system.orchestration.team_threshold_files') || 8,
    },
  };

  output(result, raw);
}

/**
 * Initialize context for a remediation operation.
 *
 * @param {string[]} args - User arguments (remediation plan reference)
 * @param {boolean} raw - Raw output mode
 */
function initRemediate(args, raw) {
  const common = buildCommonContext('remediate');

  const result = {
    ...common,
    operationType: 'write',
    userArgs: args.join(' '),
    featureFlags: getFeatureFlags(),
    pipeline: getPipelineConfig('remediate'),
  };

  output(result, raw);
}

/**
 * Initialize context for a user guide write operation.
 *
 * Like initWriteOp but loads user_guide_pipeline config instead of the
 * dev docs pipeline. Also includes user guide content config and
 * scaffold auto-check.
 *
 * @param {string} command - Command name (ug-generate, ug-update, ug-screenshot)
 * @param {string[]} args - User arguments
 * @param {boolean} raw - Raw output mode
 */
function initUserGuideWriteOp(command, args, raw) {
  const common = buildCommonContext(command);
  const route = common.route;

  if (route.type !== 'write') {
    error(`Command '${command}' is not a write operation (type: ${route.type})`);
  }

  const agentName = route.agent;
  const allPaths = getAllPaths();
  const scaffold = checkUserGuideScaffold(allPaths);

  const result = {
    ...common,
    operationType: 'write',
    agent: agentName,
    model: resolveModel(agentName),
    userArgs: args.join(' '),
    userGuide: getUserGuideConfig(),
    pipeline: getUserGuidePipelineConfig(),
    scaffold,
    validatorAgent: 'fp-docs-ug-validator',
    validatorModel: resolveModel('fp-docs-ug-validator'),
  };

  output(result, raw);
}

/**
 * Initialize context for a user guide read operation.
 *
 * Like initReadOp but includes user-guide-specific validation config
 * (jargon patterns, completeness matrix, staleness threshold).
 *
 * @param {string} command - Command name (ug-validate, ug-audit, ug-status)
 * @param {string[]} args - User arguments
 * @param {boolean} raw - Raw output mode
 */
function initUserGuideReadOp(command, args, raw) {
  const common = buildCommonContext(command);
  const route = common.route;

  if (route.type !== 'read') {
    error(`Command '${command}' is not a read operation (type: ${route.type})`);
  }

  const agentName = route.agent;
  const allPaths = getAllPaths();
  const scaffold = checkUserGuideScaffold(allPaths);

  const result = {
    ...common,
    operationType: 'read',
    agent: agentName,
    model: resolveModel(agentName),
    userArgs: args.join(' '),
    userGuide: getUserGuideConfig(),
    validation: {
      jargonPatterns: getConfigValue('user_guide_pipeline.jargon_banned_patterns') || [],
      requiredSections: getConfigValue('user_guide_pipeline.required_sections_by_type') || {},
      screenshotStalenessDays: getConfigValue('user_guide_pipeline.screenshot_staleness_days') || 30,
    },
    scaffold,
  };

  output(result, raw);
}

// ── CLI Router ──────────────────────────────────────────────────────────────

/**
 * CLI handler for `fp-tools init <subcommand> <command> [args...]`.
 *
 * @param {string} subcmd - Init subcommand (write-op, read-op, admin-op, parallel, remediate)
 * @param {string[]} args - Remaining CLI arguments
 * @param {boolean} raw - Raw output mode
 */
function cmdInit(subcmd, args, raw) {
  if (!subcmd) {
    error('Usage: fp-tools init <write-op|read-op|admin-op|parallel|remediate|ug-write-op|ug-read-op> <command> [args...]');
  }

  const command = args[0];
  const restArgs = args.slice(1);

  switch (subcmd) {
    case 'write-op':
      if (!command) error('Usage: fp-tools init write-op <command> [args...]');
      initWriteOp(command, restArgs, raw);
      break;

    case 'read-op':
      if (!command) error('Usage: fp-tools init read-op <command> [args...]');
      initReadOp(command, restArgs, raw);
      break;

    case 'admin-op':
      if (!command) error('Usage: fp-tools init admin-op <command> [args...]');
      initAdminOp(command, restArgs, raw);
      break;

    case 'parallel':
      initParallel(args, raw);
      break;

    case 'remediate':
      initRemediate(args, raw);
      break;

    case 'ug-write-op':
      if (!command) error('Usage: fp-tools init ug-write-op <command> [args...]');
      initUserGuideWriteOp(command, restArgs, raw);
      break;

    case 'ug-read-op':
      if (!command) error('Usage: fp-tools init ug-read-op <command> [args...]');
      initUserGuideReadOp(command, restArgs, raw);
      break;

    default:
      error(`Unknown init subcommand: ${subcmd}. Use: write-op, read-op, admin-op, parallel, remediate, ug-write-op, ug-read-op`);
  }
}

module.exports = { cmdInit, initWriteOp, initReadOp, initAdminOp, initParallel, initRemediate, initUserGuideWriteOp, initUserGuideReadOp };
