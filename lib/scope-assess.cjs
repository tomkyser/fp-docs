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

const fs = require('fs');
const path = require('path');
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
 * Extract path-like tokens from natural language text.
 * Matches strings that look like filesystem paths (contain / and path segments).
 *
 * @param {string} text - Natural language input
 * @returns {string[]} Extracted path-like tokens
 */
function extractPathsFromText(text) {
  // Match tokens that look like paths: at least one / with word chars around it
  // Captures: themes/foreign-policy-2017/components/core, inc/post-types/article.php, etc.
  const pathPattern = /(?:^|\s|[:=,"'(])([a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._*?-]+)+\/?)/g;
  const paths = [];
  let match;
  while ((match = pathPattern.exec(text)) !== null) {
    paths.push(match[1].replace(/[,'")\s]+$/, '')); // trim trailing punctuation
  }
  return paths;
}

/**
 * Resolve a path to actual files on disk.
 * If it's a directory, recursively list relevant files (PHP, JS, CSS, MD).
 * If it's a file, return it as-is.
 * Tries both absolute and relative-to-codebase-root resolution.
 *
 * @param {string} target - Path to resolve
 * @param {string|null} codebaseRoot - Codebase root for relative paths
 * @returns {{ files: string[], isDirectory: boolean, resolved: boolean }}
 */
function resolveTarget(target, codebaseRoot) {
  const candidates = [target];
  if (codebaseRoot) {
    // For FP project: codebase root is wp-content, theme is at themes/foreign-policy-2017
    candidates.push(path.join(codebaseRoot, target));
    candidates.push(path.join(codebaseRoot, 'themes', 'foreign-policy-2017', target));
  }

  for (const candidate of candidates) {
    try {
      const stat = fs.statSync(candidate);
      if (stat.isDirectory()) {
        const files = listFilesRecursive(candidate, 0);
        return { files, isDirectory: true, resolved: true, resolvedPath: candidate };
      } else if (stat.isFile()) {
        return { files: [candidate], isDirectory: false, resolved: true, resolvedPath: candidate };
      }
    } catch {
      // candidate doesn't exist, try next
    }
  }

  return { files: [], isDirectory: false, resolved: false, resolvedPath: null };
}

/**
 * Recursively list relevant files in a directory.
 * Limits depth to avoid runaway traversal. Filters to code/doc file types.
 *
 * @param {string} dir - Directory to list
 * @param {number} depth - Current recursion depth
 * @param {number} maxDepth - Max recursion depth (default 5)
 * @returns {string[]}
 */
function listFilesRecursive(dir, depth, maxDepth = 5) {
  if (depth > maxDepth) return [];
  const relevantExts = new Set(['.php', '.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.md', '.json']);
  const skipDirs = new Set(['node_modules', 'vendor', '.git', 'build', 'dist', '__pycache__']);
  const results = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.php') continue;
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) {
          results.push(...listFilesRecursive(fullPath, depth + 1, maxDepth));
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (relevantExts.has(ext)) {
          results.push(fullPath);
        }
      }
    }
  } catch {
    // permission error or similar — skip
  }

  return results;
}

/**
 * Infer targets from natural language when no explicit paths are found.
 * Uses keyword matching against source-map directory seeds and common patterns.
 *
 * @param {string} text - The full user argument text
 * @param {string|null} codebaseRoot - Codebase root
 * @returns {{ files: string[], method: string, inferredPath: string|null }}
 */
function inferTargetsFromDescription(text, codebaseRoot) {
  if (!codebaseRoot) {
    return { files: [], method: 'no-codebase-root', inferredPath: null };
  }

  const lower = text.toLowerCase();
  const themeRoot = path.join(codebaseRoot, 'themes', 'foreign-policy-2017');

  // Keyword-to-directory mapping for common FP codebase areas
  const keywordMap = [
    { keywords: ['post type', 'post-type', 'cpt'], dir: 'inc/post-types' },
    { keywords: ['taxonomy', 'taxonomies'], dir: 'inc/taxonomies' },
    { keywords: ['component', 'components'], dir: 'components' },
    { keywords: ['helper', 'helpers'], dir: 'helpers' },
    { keywords: ['shortcode', 'shortcodes'], dir: 'inc/shortcodes' },
    { keywords: ['hook', 'hooks', 'action', 'filter'], dir: 'inc/hooks' },
    { keywords: ['rest api', 'rest-api', 'endpoint', 'rest route'], dir: 'inc/rest-api' },
    { keywords: ['graphql'], dir: 'inc/graphql' },
    { keywords: ['layout', 'layouts', 'template'], dir: 'layouts' },
    { keywords: ['widget', 'widgets'], dir: 'inc/widgets' },
    { keywords: ['block', 'blocks', 'gutenberg'], dir: 'inc/blocks' },
    { keywords: ['menu', 'menus', 'navigation'], dir: 'inc/menus' },
    { keywords: ['admin'], dir: 'inc/admin' },
    { keywords: ['search'], dir: 'inc/search' },
    { keywords: ['cli', 'wp-cli'], dir: 'inc/cli' },
    { keywords: ['frontend', 'javascript', 'script'], dir: 'assets/src/scripts' },
    { keywords: ['css', 'style', 'stylesheet'], dir: 'assets/src/styles' },
    { keywords: ['htmx'], dir: 'inc/htmx' },
    { keywords: ['integration', 'integrations'], dir: 'inc/integrations' },
    { keywords: ['partial', 'partials'], dir: 'partials' },
  ];

  for (const { keywords, dir } of keywordMap) {
    if (keywords.some(kw => lower.includes(kw))) {
      const fullDir = path.join(themeRoot, dir);
      try {
        if (fs.statSync(fullDir).isDirectory()) {
          const files = listFilesRecursive(fullDir, 0);
          return { files, method: 'keyword-inference', inferredPath: dir };
        }
      } catch {
        // directory doesn't exist
      }
    }
  }

  return { files: [], method: 'no-inference-match', inferredPath: null };
}

/**
 * Parse user arguments to extract file targets.
 * Handles: explicit paths, paths embedded in natural language, directory resolution,
 * keyword-based inference, "all" flag, glob patterns.
 *
 * @param {string[]} args - User arguments (may be a single string of natural language)
 * @returns {{ targets: string[], resolvedFiles: string[], isAll: boolean, hasGlob: boolean, description: string, method: string }}
 */
function parseTargets(args) {
  const resolvedFiles = [];
  let isAll = false;
  let hasGlob = false;
  const flags = [];
  const rawTargets = [];
  let method = 'none';

  // Join all args into full text for NLP extraction
  const fullText = args.join(' ');

  // Check for --all flag
  if (args.some(a => a === 'all' || a === '--all')) {
    isAll = true;
  }

  // Separate flags from content
  for (const arg of args) {
    if (arg.startsWith('--')) {
      flags.push(arg);
    }
  }

  // 1. Extract path-like tokens from the full text
  const extractedPaths = extractPathsFromText(fullText);

  if (extractedPaths.length > 0) {
    const codebaseRoot = getCodebaseRoot();
    for (const p of extractedPaths) {
      const result = resolveTarget(p, codebaseRoot);
      if (result.resolved) {
        resolvedFiles.push(...result.files);
        rawTargets.push(p);
        method = result.isDirectory ? 'path-extraction-directory' : 'path-extraction-file';
      } else {
        // Path found in text but doesn't resolve — keep as raw target for the researcher
        rawTargets.push(p);
        method = 'path-extraction-unresolved';
      }
    }
  }

  // 2. Check for globs in extracted paths
  if (rawTargets.some(t => t.includes('*') || t.includes('?'))) {
    hasGlob = true;
  }

  // 3. If no paths extracted, try keyword inference from the description
  if (extractedPaths.length === 0 && !isAll) {
    const codebaseRoot = getCodebaseRoot();
    const inferred = inferTargetsFromDescription(fullText, codebaseRoot);
    if (inferred.files.length > 0) {
      resolvedFiles.push(...inferred.files);
      rawTargets.push(inferred.inferredPath);
      method = inferred.method;
    }
  }

  return {
    targets: rawTargets,
    resolvedFiles,
    isAll,
    hasGlob,
    description: fullText,
    method,
  };
}

/**
 * Estimate file count for scope analysis.
 * Uses resolved files when available, falls back to source-map for "all" operations.
 *
 * @param {{ targets: string[], resolvedFiles: string[], isAll: boolean, hasGlob: boolean, description: string, method: string }} parsed
 * @param {string} type - Operation type
 * @returns {{ fileCount: number, files: string[], estimationMethod: string, description: string }}
 */
function analyzeFileScope(parsed, type) {
  if (parsed.isAll) {
    try {
      const sourceMap = loadSourceMap();
      const entries = sourceMap ? Object.keys(sourceMap).length : 0;
      return {
        fileCount: Math.max(entries, 10),
        files: [],
        estimationMethod: 'source-map-total',
        description: parsed.description,
      };
    } catch {
      return { fileCount: 20, files: [], estimationMethod: 'default-all-estimate', description: parsed.description };
    }
  }

  if (parsed.hasGlob) {
    return { fileCount: 5, files: parsed.targets, estimationMethod: 'glob-estimate', description: parsed.description };
  }

  // Use resolved files if available (actual filesystem enumeration)
  if (parsed.resolvedFiles.length > 0) {
    return {
      fileCount: parsed.resolvedFiles.length,
      files: parsed.resolvedFiles,
      estimationMethod: parsed.method,
      description: parsed.description,
    };
  }

  // Raw targets found but didn't resolve — pass them through for researcher to figure out
  if (parsed.targets.length > 0) {
    return {
      fileCount: parsed.targets.length,
      files: parsed.targets,
      estimationMethod: parsed.method || 'unresolved-targets',
      description: parsed.description,
    };
  }

  // No targets at all — description-only input. Researcher will need to figure it out.
  return {
    fileCount: 0,
    files: [],
    estimationMethod: 'description-only',
    description: parsed.description,
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

  // description-only input: researcher must assess scope, so treat as medium minimum
  let effectiveFileCount = fileScope.fileCount;
  if (fileScope.estimationMethod === 'description-only' && type === 'write') {
    effectiveFileCount = Math.max(effectiveFileCount, 3); // ensure researcher is spawned
  }

  const complexity = estimateComplexity(effectiveFileCount, type);
  const researcherCount = recommendResearcherCount(complexity, type);
  const strategy = recommendStrategy(complexity, type);
  const needsPlanner = complexity === 'high' || (complexity === 'medium' && type === 'write');
  const trackerRequired = complexity !== 'low';

  return {
    command,
    agent: route.agent,
    type,
    complexity,
    researcherCount,
    strategy,
    needsPlanner,
    trackerRequired,
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
  extractPathsFromText,
  resolveTarget,
  inferTargetsFromDescription,
  cmdScopeAssess,
};
