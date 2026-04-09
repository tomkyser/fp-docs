# Implementation Spec: Migration Logic and Global State Data Model

> Author: Architect
> Date: 2026-04-09
> Status: Implementation-ready
> Depends on: design-wave1-phase1.md (sections D, Migration Considerations)

---

## Overview

This spec defines:
1. The `getGlobalStateRoot()` function in `lib/paths.cjs`
2. The `getBranchDataRoot()` function in `lib/paths.cjs`
3. The migration module `lib/migrate.cjs` that handles old-to-new layout transitions
4. The `plugin-version.json` schema and version tracking logic
5. Integration with SessionStart hook for automatic migration

---

## 1. New Path Functions in lib/paths.cjs

### getGlobalStateRoot(codebaseRoot)

```javascript
/**
 * Get the global fp-docs state directory.
 * Location: {codebase-root}/.fp-docs/
 *
 * This is the single source of truth for all cross-branch operational state:
 * state.json, staleness.json, trackers/, plans/, analyses/, remediation-plans/,
 * update-cache.json, merge-intel/.
 *
 * @param {string|null} [codebaseRoot] - Override codebase root (for testing)
 * @returns {string|null} Absolute path to .fp-docs/, or null if codebase unavailable
 */
function getGlobalStateRoot(codebaseRoot) {
  const root = codebaseRoot || getCodebaseRoot();
  if (!root) return null;
  return path.join(root, '.fp-docs');
}
```

### getBranchDataRoot(docsRoot)

```javascript
/**
 * Get the branch-scoped data directory within the docs repo.
 * Location: {docs-root}/.fp-docs-branch/
 *
 * Contains branch-specific artifacts: diffs/, flagged-concerns/,
 * changelog.md, .sync-watermark, plugin-version.json.
 *
 * @param {string|null} [docsRoot] - Override docs root path
 * @returns {string|null} Absolute path to .fp-docs-branch/, or null if docs unavailable
 */
function getBranchDataRoot(docsRoot) {
  if (docsRoot) {
    return path.join(docsRoot, '.fp-docs-branch');
  }
  const codebaseRoot = getCodebaseRoot();
  const docsInfo = getDocsRoot(codebaseRoot);
  if (!docsInfo.path || !docsInfo.exists) return null;
  return path.join(docsInfo.path, '.fp-docs-branch');
}
```

### Updated getAllPaths()

```javascript
function getAllPaths() {
  const pluginRoot = getPluginRoot();
  const codebaseRoot = getCodebaseRoot();
  const docsRoot = getDocsRoot(codebaseRoot);
  const globalStateRoot = getGlobalStateRoot(codebaseRoot);
  const branchDataRoot = docsRoot.path ? getBranchDataRoot(docsRoot.path) : null;

  return { pluginRoot, codebaseRoot, docsRoot, globalStateRoot, branchDataRoot };
}
```

### Updated exports

Add to module.exports: `getGlobalStateRoot`, `getBranchDataRoot`

---

## 2. Module Path Updates

Each module that currently constructs `path.join(docsRoot, '.fp-docs', ...)` must switch to using `getGlobalStateRoot()`. Here is the exact change pattern for each:

### lib/state.cjs

```
BEFORE: path.join(docsRoot, '.fp-docs', 'state.json')
AFTER:  path.join(getGlobalStateRoot(codebaseRoot), 'state.json')

BEFORE: path.join(docsRoot, '.fp-docs', 'remediation-plans')
AFTER:  path.join(getGlobalStateRoot(codebaseRoot), 'remediation-plans')
```

The `resolveDefaultStatePath()` and `resolveDocsRoot()` functions need reworking:

```javascript
// BEFORE
function resolveDefaultStatePath() {
  const codebaseRoot = getCodebaseRoot();
  const docsInfo = getDocsRoot(codebaseRoot);
  if (!docsInfo.path || !docsInfo.exists) return null;
  return path.join(docsInfo.path, '.fp-docs', 'state.json');
}

// AFTER
function resolveDefaultStatePath() {
  const stateRoot = getGlobalStateRoot();
  if (!stateRoot) return null;
  return path.join(stateRoot, 'state.json');
}
```

Same pattern for `saveRemediationPlan`, `loadRemediationPlan`, `listRemediationPlans`.

### lib/drift.cjs

```
BEFORE: path.join(docsRoot, '.fp-docs', 'staleness.json')
AFTER:  path.join(getGlobalStateRoot(), 'staleness.json')

BEFORE: path.join(docsRoot, '.fp-docs', 'drift-pending.json')
AFTER:  path.join(getGlobalStateRoot(), 'drift-pending.json')
```

Internal `resolveDocsRoot()` in drift.cjs should be replaced with:
```javascript
function resolveStateRoot() {
  return getGlobalStateRoot();
}
```

### lib/tracker.cjs

```
BEFORE: path.join(docsInfo.path, FP_DOCS_DIR, TRACKERS_DIR)
AFTER:  path.join(getGlobalStateRoot(), TRACKERS_DIR)

BEFORE (fallback): path.join(getPluginRoot(), FP_DOCS_DIR, TRACKERS_DIR)
AFTER (fallback): path.join(getPluginRoot(), '.fp-docs', TRACKERS_DIR)  // unchanged, this is the plugin fallback
```

### lib/plans.cjs

```
BEFORE: path.join(docsRoot, '.fp-docs', PLANS_DIR)
AFTER:  path.join(getGlobalStateRoot(), PLANS_DIR)

BEFORE: path.join(docsRoot, '.fp-docs', ANALYSES_DIR)
AFTER:  path.join(getGlobalStateRoot(), ANALYSES_DIR)
```

### lib/update.cjs

```
BEFORE: path.join(baseDir, '.fp-docs', CACHE_FILENAME)
AFTER:  path.join(getGlobalStateRoot() || path.join(getPluginRoot(), '.fp-docs'), CACHE_FILENAME)
```

### lib/git.cjs

Watermark moves to branch-scoped:

```
BEFORE: path.join(docsRoot, '.sync-watermark')
AFTER:  path.join(docsRoot, '.fp-docs-branch', '.sync-watermark')
```

The `readWatermark()` and `writeWatermark()` functions need the path updated. Use `getBranchDataRoot(docsRoot)` for clarity:

```javascript
function readWatermark(docsRoot) {
  const branchDir = path.join(docsRoot, '.fp-docs-branch');
  const watermarkPath = path.join(branchDir, '.sync-watermark');
  // ... rest unchanged
}

function writeWatermark(docsRoot, branch, commitHash) {
  const branchDir = path.join(docsRoot, '.fp-docs-branch');
  ensureDir(branchDir);
  const watermarkPath = path.join(branchDir, '.sync-watermark');
  // ... rest unchanged
}
```

---

## 3. Migration Module: lib/migrate.cjs

### Purpose

Detect old-layout data and migrate to new layout on first run. Designed to be called from the SessionStart hook (branch-sync-check handler) or from `/fp-docs:setup`.

### Constants

```javascript
const MIGRATION_VERSION = 1; // Bump when adding new migration steps
```

### Schema: plugin-version.json

Located at `{docs-root}/.fp-docs-branch/plugin-version.json`:

```json
{
  "version": "1.1.0",
  "last_used": "2026-04-09T12:00:00Z",
  "compatible_since": "1.0.0",
  "migration_version": 1
}
```

### Exported Functions

#### needsMigration(docsRoot, codebaseRoot)

```javascript
/**
 * Check if the project needs migration from old layout to new.
 *
 * Detection heuristics:
 * 1. Old global state: {docs-root}/.fp-docs/state.json exists AND
 *    {codebase-root}/.fp-docs/state.json does NOT exist
 * 2. Old branch data: docs/diffs/ exists at docs root level (not in .fp-docs-branch/)
 * 3. Old watermark: {docs-root}/.sync-watermark exists (not in .fp-docs-branch/)
 * 4. Old changelog: {docs-root}/changelog.md exists at root level
 *
 * @param {string} docsRoot
 * @param {string} codebaseRoot
 * @returns {{ needed: boolean, reasons: string[] }}
 */
```

#### migrateGlobalState(docsRoot, codebaseRoot)

```javascript
/**
 * Migrate operational state from {docs-root}/.fp-docs/ to {codebase-root}/.fp-docs/.
 *
 * Migrates: state.json, staleness.json, drift-pending.json, trackers/, 
 * remediation-plans/, plans/, analyses/
 *
 * Strategy: COPY then verify then remove originals.
 * If new location already has data, skip (don't overwrite).
 *
 * @param {string} docsRoot
 * @param {string} codebaseRoot
 * @returns {{ migrated: string[], skipped: string[], errors: string[] }}
 */
```

Implementation notes:
- Use `fs.cpSync(src, dest, { recursive: true })` for directories (Node 16.7+)
- For files: `fs.copyFileSync(src, dest)` with `fs.constants.COPYFILE_EXCL` (don't overwrite)
- After copy, verify dest exists and is valid JSON where applicable
- Only remove originals after all copies verified
- If {docs-root}/.fp-docs/ becomes empty after migration, remove it

#### migrateBranchData(docsRoot)

```javascript
/**
 * Migrate branch-scoped data into {docs-root}/.fp-docs-branch/.
 *
 * Migrates:
 * - docs/diffs/ -> .fp-docs-branch/diffs/
 * - docs/FLAGGED CONCERNS/ -> .fp-docs-branch/flagged-concerns/
 * - docs/changelog.md -> .fp-docs-branch/changelog.md
 * - docs/.sync-watermark -> .fp-docs-branch/.sync-watermark
 *
 * @param {string} docsRoot
 * @returns {{ migrated: string[], skipped: string[], errors: string[] }}
 */
```

Implementation notes:
- `FLAGGED CONCERNS` -> `flagged-concerns` (normalize spaces and case)
- Ensure `.fp-docs-branch/` directory exists before moving
- Use rename (mv) where possible (atomic on same filesystem), fall back to copy+delete
- Create `plugin-version.json` with current plugin version after migration

#### migrateDocsReorg(docsRoot)

```javascript
/**
 * Execute docs root reorganization.
 *
 * - docs/About.md -> docs/README.md
 * - docs/claude-code-docs-system/PROJECT-INDEX.md -> docs/PROJECT-INDEX.md
 * - Remove docs/claude-code-docs-system/ (after contents moved)
 *
 * @param {string} docsRoot
 * @returns {{ migrated: string[], skipped: string[], errors: string[] }}
 */
```

Implementation notes:
- Check if About.md references exist in other docs (update links: `About.md` -> `README.md`)
- Check if PROJECT-INDEX.md has relative links that break when moved (unlikely -- it's an index)
- Only remove `claude-code-docs-system/` if empty after promotion

#### runFullMigration(docsRoot, codebaseRoot)

```javascript
/**
 * Run all migration steps and return a consolidated report.
 *
 * Steps:
 * 1. migrateGlobalState (if old state at docs-root)
 * 2. migrateBranchData (if branch data at docs root level)
 * 3. migrateDocsReorg (About.md, claude-code-docs-system)
 * 4. Write plugin-version.json
 * 5. Migrate update-cache.json if at old codebase-root location
 *
 * @param {string} docsRoot
 * @param {string} codebaseRoot
 * @returns {{ success: boolean, steps: Array<{name: string, result: object}> }}
 */
```

#### readPluginVersion(docsRoot) / writePluginVersion(docsRoot, version)

```javascript
/**
 * Read plugin-version.json from .fp-docs-branch/.
 * Returns null if not found.
 */

/**
 * Write/update plugin-version.json in .fp-docs-branch/.
 * Creates .fp-docs-branch/ directory if needed.
 */
```

### CLI Handler

```javascript
function cmdMigrate(subcommand, args, raw) {
  switch (subcommand) {
    case 'check':  // Run needsMigration, report status
    case 'run':    // Run runFullMigration
    case 'status': // Read plugin-version.json
  }
}
```

CLI: `fp-tools migrate <check|run|status>`

---

## 4. SessionStart Hook Integration

The `handleBranchSyncCheck()` in `lib/hooks.cjs` should be extended:

```javascript
// After existing sync check logic, before returning:

// Migration check (silent, non-blocking)
const migrate = require('./migrate.cjs');
const migrationCheck = migrate.needsMigration(docsRoot, codebaseRoot);
if (migrationCheck.needed) {
  // Append migration nudge to additionalContext
  additionalContext += '\n\nfp-docs: Data layout migration available. ' +
    'Run /fp-docs:setup or `fp-tools migrate run` to migrate. ' +
    'Reasons: ' + migrationCheck.reasons.join(', ');
}
```

The migration itself is NOT automatic -- it nudges the user. This avoids silent file system changes that could confuse git status. The user triggers migration explicitly via `/fp-docs:setup` or `fp-tools migrate run`.

---

## 5. fp-tools.cjs Integration

Add to fp-tools.cjs switch:

```javascript
case 'migrate': {
  const migrate = require('./lib/migrate.cjs');
  migrate.cmdMigrate(args[1], args.slice(2), raw);
  break;
}
```

Update the header comment to include:
```
 *   migrate    - Data layout migration (check, run, status)
```

---

## 6. Setup Workflow Integration

`workflows/setup.md` should include migration as part of setup:

```xml
<step name="migrate-check" priority="after-git-check">
## N. Data Layout Migration

1. Run: `node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" migrate check`
2. If migration needed:
   a. Display what will be migrated and why
   b. Run: `node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" migrate run`
   c. Report results
3. If no migration needed:
   a. Display "Data layout is current"
</step>
```

---

## 7. Test Plan

### Unit Tests: lib/migrate.cjs

| Test | Setup | Expected |
|------|-------|----------|
| needsMigration detects old state.json | Create {tmp}/.fp-docs/state.json (simulating docs-root) | `{ needed: true, reasons: ['global state at docs root'] }` |
| needsMigration returns false when current | Create state at global root | `{ needed: false }` |
| migrateGlobalState copies all files | Create old layout with state, staleness, trackers | All files at new location, originals removed |
| migrateGlobalState skips existing | Both old and new have state.json | Skipped, no overwrite |
| migrateBranchData normalizes FLAGGED CONCERNS | Create `FLAGGED CONCERNS/` dir | Moved to `flagged-concerns/` |
| migrateBranchData moves watermark | Create `.sync-watermark` at docs root | Moved to `.fp-docs-branch/.sync-watermark` |
| migrateDocsReorg renames About.md | Create About.md | Renamed to README.md |
| migrateDocsReorg promotes PROJECT-INDEX.md | Create claude-code-docs-system/PROJECT-INDEX.md | Moved to docs root, old dir removed |
| runFullMigration end-to-end | Full old layout | All steps complete, plugin-version.json written |
| readPluginVersion / writePluginVersion | Write then read | Round-trip matches |

---

## 8. Rollback Safety

If migration fails partway:
- Global state: originals only removed after copy verification -- partial failure leaves both copies
- Branch data: each move is independent -- partial failure leaves unmoved files in old locations
- Docs reorg: each rename is independent -- partial failure is safe
- `runFullMigration` reports per-step results so the user knows what succeeded and what didn't

No destructive operations without verification. The worst case is duplicate data (old + new both exist), which `needsMigration` handles by reporting what still needs migration.
