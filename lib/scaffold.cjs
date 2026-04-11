'use strict';

/**
 * Scaffold -- Auto-bootstrap docs repo structures from bundled scaffolds.
 *
 * When a workflow needs a structure that doesn't exist in the docs repo
 * (e.g., user-guide/), this module detects the absence and copies from
 * bundled scaffold assets in {plugin-root}/scaffolds/.
 *
 * Design principle: the plugin bootstraps docs repo structures automatically.
 * Users never manually copy files between repos.
 *
 * Scaffold directory naming:
 *   scaffolds/{name}/              -> {docs-root}/{name}/
 *   scaffolds/{name}/.github-workflows/  -> {docs-root}/.github/workflows/
 *     (special case: GH Actions must live at repo root, not inside subdirectory)
 *
 * Zero external dependencies -- Node.js built-ins only (D-15).
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { output, error } = require('./core.cjs');
const paths = require('./paths.cjs');

// ── File Copy Utilities ────────────────────────────────────────────────────

/**
 * Recursively copy a directory, creating parent directories as needed.
 * Skips the special .github-workflows/ directory (handled separately).
 *
 * @param {string} src - Source directory
 * @param {string} dest - Destination directory
 * @param {string[]} created - Array to push created file paths into
 */
function copyDirRecursive(src, dest, created) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // Skip the special .github-workflows directory -- handled by copyWorkflows()
    if (entry.name === '.github-workflows') continue;

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath, created);
    } else {
      // Only copy if destination doesn't exist (don't overwrite user modifications)
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
        created.push(destPath);
      }
    }
  }
}

/**
 * Copy GitHub Actions workflow files from scaffold's .github-workflows/
 * to the docs repo root's .github/workflows/ directory.
 *
 * @param {string} scaffoldDir - Path to the scaffold (e.g., scaffolds/user-guide/)
 * @param {string} docsRoot - Path to the docs repo root
 * @param {string[]} created - Array to push created file paths into
 */
function copyWorkflows(scaffoldDir, docsRoot, created) {
  const workflowSrc = path.join(scaffoldDir, '.github-workflows');
  if (!fs.existsSync(workflowSrc)) return;

  const workflowDest = path.join(docsRoot, '.github', 'workflows');
  if (!fs.existsSync(workflowDest)) {
    fs.mkdirSync(workflowDest, { recursive: true });
  }

  const files = fs.readdirSync(workflowSrc);
  for (const file of files) {
    const srcPath = path.join(workflowSrc, file);
    const destPath = path.join(workflowDest, file);
    if (!fs.existsSync(destPath)) {
      fs.copyFileSync(srcPath, destPath);
      created.push(destPath);
    }
  }
}

// ── Post-Bootstrap Steps ───────────────────────────────────────────────────

/**
 * Patch the dev wiki's hugo.toml to exclude a scaffold directory from its build.
 *
 * The dev wiki uses `contentDir = "."` which means new subdirectories in the
 * docs repo get rendered by the dev wiki unless added to ignoreFiles.
 *
 * @param {string} docsRoot - Docs repo root
 * @param {string} scaffoldName - Directory name to exclude (e.g., 'user-guide')
 * @returns {string|null} Description of what was done, or null if not needed
 */
function patchDevWikiIgnoreFiles(docsRoot, scaffoldName) {
  const hugoToml = path.join(docsRoot, 'hugo.toml');
  if (!fs.existsSync(hugoToml)) return null;

  const content = fs.readFileSync(hugoToml, 'utf-8');
  const pattern = `'${scaffoldName}/'`;

  // Already excluded
  if (content.includes(scaffoldName)) return null;

  // Find ignoreFiles array and append
  const ignoreMatch = content.match(/ignoreFiles\s*=\s*\[([^\]]*)\]/);
  if (ignoreMatch) {
    const existing = ignoreMatch[0];
    const newEntry = `  "${scaffoldName.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&')}/"`;
    const patched = existing.replace(/\]/, `,\n${newEntry}\n]`);
    fs.writeFileSync(hugoToml, content.replace(existing, patched), 'utf-8');
    return `Patched dev wiki hugo.toml: added ${scaffoldName}/ to ignoreFiles`;
  }

  // No ignoreFiles array exists — append one
  const addition = `\n# Exclude scaffolded directories from dev wiki build\nignoreFiles = [\n  "${scaffoldName}/"\n]\n`;
  fs.writeFileSync(hugoToml, content + addition, 'utf-8');
  return `Added ignoreFiles to dev wiki hugo.toml: excludes ${scaffoldName}/`;
}

/**
 * Initialize Git LFS in the docs repo if the scaffold includes .gitattributes
 * with LFS tracking rules.
 *
 * @param {string} docsRoot - Docs repo root
 * @param {string} targetPath - Scaffold target path in docs repo
 * @returns {string|null} Description of what was done, or null if not needed
 */
function initGitLfs(docsRoot, targetPath) {
  const gitattributes = path.join(targetPath, '.gitattributes');
  if (!fs.existsSync(gitattributes)) return null;

  const content = fs.readFileSync(gitattributes, 'utf-8');
  if (!content.includes('filter=lfs')) return null;

  try {
    execFileSync('git', ['lfs', 'install'], {
      cwd: docsRoot,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    return 'Initialized Git LFS in docs repo';
  } catch {
    return 'Git LFS install skipped (git-lfs not available — install with: brew install git-lfs)';
  }
}

/**
 * Resolve Hugo module dependencies if the scaffold includes a go.mod file.
 * Runs `hugo mod get` in the scaffold target directory.
 *
 * @param {string} targetPath - Scaffold target path (e.g., {docs-root}/user-guide/)
 * @returns {string|null} Description of what was done, or null if not needed
 */
function resolveHugoModules(targetPath) {
  const goMod = path.join(targetPath, 'go.mod');
  if (!fs.existsSync(goMod)) return null;

  try {
    execFileSync('hugo', ['mod', 'get'], {
      cwd: targetPath,
      stdio: 'pipe',
      encoding: 'utf-8',
      timeout: 60000,
    });
    return 'Resolved Hugo modules (go.sum created)';
  } catch {
    return 'Hugo module resolution skipped (hugo not available — install with: brew install hugo)';
  }
}

// ── Bootstrap ──────────────────────────────────────────────────────────────

/**
 * Check if a scaffold target exists in the docs repo.
 *
 * @param {string} scaffoldName - Name of the scaffold (e.g., 'user-guide')
 * @param {string|null} [docsRoot] - Docs root override
 * @returns {{ exists: boolean, targetPath: string|null, docsRoot: string|null }}
 */
function checkScaffold(scaffoldName, docsRoot) {
  if (!docsRoot) {
    const codebaseRoot = paths.getCodebaseRoot();
    const docsInfo = paths.getDocsRoot(codebaseRoot);
    docsRoot = docsInfo.path;
  }

  if (!docsRoot) {
    return { exists: false, targetPath: null, docsRoot: null };
  }

  const targetPath = path.join(docsRoot, scaffoldName);
  return {
    exists: fs.existsSync(targetPath),
    targetPath,
    docsRoot,
  };
}

/**
 * Bootstrap a scaffold into the docs repo.
 *
 * Copies all files from {plugin-root}/scaffolds/{name}/ to {docs-root}/{name}/,
 * with special handling for .github-workflows/ -> {docs-root}/.github/workflows/.
 *
 * Only creates files that don't already exist (safe for re-runs).
 *
 * @param {string} scaffoldName - Name of the scaffold (e.g., 'user-guide')
 * @param {object} [opts] - Options
 * @param {string} [opts.docsRoot] - Docs root override
 * @param {string} [opts.pluginRoot] - Plugin root override
 * @returns {{ bootstrapped: boolean, created: string[], skipped: string, targetPath: string|null, error: string|null }}
 */
function bootstrap(scaffoldName, opts = {}) {
  const pluginRoot = opts.pluginRoot || paths.getPluginRoot();
  const scaffoldDir = path.join(pluginRoot, 'scaffolds', scaffoldName);

  // Verify scaffold exists in plugin
  if (!fs.existsSync(scaffoldDir)) {
    return {
      bootstrapped: false,
      created: [],
      skipped: null,
      targetPath: null,
      error: `Scaffold not found: scaffolds/${scaffoldName}/`,
    };
  }

  // Resolve docs root
  let docsRoot = opts.docsRoot;
  if (!docsRoot) {
    const codebaseRoot = paths.getCodebaseRoot();
    const docsInfo = paths.getDocsRoot(codebaseRoot);
    docsRoot = docsInfo.path;
  }

  if (!docsRoot) {
    return {
      bootstrapped: false,
      created: [],
      skipped: null,
      targetPath: null,
      error: 'Docs root not available. Set $FP_CODEBASE_ROOT or run from within the FP codebase.',
    };
  }

  const targetPath = path.join(docsRoot, scaffoldName);

  // Check if target already exists
  if (fs.existsSync(targetPath)) {
    return {
      bootstrapped: false,
      created: [],
      skipped: `${scaffoldName}/ already exists at ${targetPath}`,
      targetPath,
      error: null,
    };
  }

  // Copy scaffold to docs repo
  const created = [];
  const postSteps = [];
  copyDirRecursive(scaffoldDir, targetPath, created);

  // Handle GitHub Actions workflows (special placement at docs repo root)
  copyWorkflows(scaffoldDir, docsRoot, created);

  // Post-bootstrap: patch dev wiki ignoreFiles
  const patchResult = patchDevWikiIgnoreFiles(docsRoot, scaffoldName);
  if (patchResult) postSteps.push(patchResult);

  // Post-bootstrap: initialize Git LFS if .gitattributes has LFS rules
  const lfsResult = initGitLfs(docsRoot, targetPath);
  if (lfsResult) postSteps.push(lfsResult);

  // Post-bootstrap: resolve Hugo modules if go.mod exists
  const hugoResult = resolveHugoModules(targetPath);
  if (hugoResult) postSteps.push(hugoResult);

  return {
    bootstrapped: true,
    created,
    postSteps,
    skipped: null,
    targetPath,
    error: null,
  };
}

/**
 * List available scaffolds in the plugin.
 *
 * @param {string} [pluginRoot] - Plugin root override
 * @returns {{ scaffolds: Array<{ name: string, fileCount: number, hasWorkflows: boolean }> }}
 */
function listScaffolds(pluginRoot) {
  pluginRoot = pluginRoot || paths.getPluginRoot();
  const scaffoldsDir = path.join(pluginRoot, 'scaffolds');

  if (!fs.existsSync(scaffoldsDir)) {
    return { scaffolds: [] };
  }

  const entries = fs.readdirSync(scaffoldsDir, { withFileTypes: true });
  const scaffolds = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const scaffoldPath = path.join(scaffoldsDir, entry.name);
    const hasWorkflows = fs.existsSync(path.join(scaffoldPath, '.github-workflows'));

    // Count files recursively
    let fileCount = 0;
    function countFiles(dir) {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory()) {
          countFiles(path.join(dir, item.name));
        } else {
          fileCount++;
        }
      }
    }
    countFiles(scaffoldPath);

    scaffolds.push({ name: entry.name, fileCount, hasWorkflows });
  }

  return { scaffolds };
}

// ── CLI Handler ────────────────────────────────────────────────────────────

/**
 * CLI handler for `fp-tools scaffold <subcommand>`.
 *
 * Subcommands:
 *   list                    - List available scaffolds
 *   check <name>            - Check if scaffold target exists in docs repo
 *   bootstrap <name>        - Bootstrap scaffold into docs repo
 *
 * @param {string} subcommand - The scaffold subcommand
 * @param {string[]} args - Additional arguments
 * @param {boolean} raw - Whether to use raw output mode
 */
function cmdScaffold(subcommand, args, raw) {
  if (!subcommand) {
    error('Usage: fp-tools scaffold <list|check|bootstrap> [name]');
  }

  switch (subcommand) {
    case 'list': {
      const result = listScaffolds();
      output(result, raw, JSON.stringify(result, null, 2));
      break;
    }

    case 'check': {
      const name = args[0];
      if (!name) error('Usage: fp-tools scaffold check <name>');
      const result = checkScaffold(name);
      output(result, raw, result.exists ? 'exists' : 'missing');
      break;
    }

    case 'bootstrap': {
      const name = args[0];
      if (!name) error('Usage: fp-tools scaffold bootstrap <name>');
      const result = bootstrap(name);
      if (result.error) {
        error(result.error);
      }
      output(result, raw, result.bootstrapped
        ? `Bootstrapped ${result.created.length} files to ${result.targetPath}`
        : result.skipped);
      break;
    }

    default:
      error(`Unknown scaffold subcommand: ${subcommand}. Use: list, check, bootstrap`);
  }
}

module.exports = { checkScaffold, bootstrap, listScaffolds, cmdScaffold };
