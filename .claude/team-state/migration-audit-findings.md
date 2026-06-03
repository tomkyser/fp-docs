# Migration Audit Findings — Phase 1

> Author: Engineer (team-engineer)
> Date: 2026-04-09
> Scope: `lib/migrate.cjs` completeness, edge cases, and enhancement needs

---

## Executive Summary

The migration module is **solid for the happy path** — it correctly migrates all three tiers (global state, branch data, docs reorg), is idempotent, and handles partial migration gracefully. However, there are **3 detection gaps** and **1 missing integration** that should be addressed in Phase 2.

---

## What Works Well

1. **Core migration logic**: All 3 migration functions (`migrateGlobalState`, `migrateBranchData`, `migrateDocsReorg`) correctly move files to new locations
2. **Idempotency**: Re-running migration is safe — skips already-migrated items, no data loss
3. **Copy-verify-delete pattern**: `migrateGlobalState` copies first, verifies, then deletes originals
4. **Rename-with-fallback**: `migrateBranchData` tries `renameSync` first, falls back to `cpSync + rmSync` for cross-device moves
5. **CLI surface**: `fp-tools migrate <check|run|status>` works correctly with proper error messages
6. **Error reporting**: Each step returns `{migrated, skipped, errors}` — clear reporting
7. **Plugin version tracking**: `writePluginVersion()` stamps `.fp-docs-branch/plugin-version.json` after migration
8. **Consumer modules**: All lib modules (`git.cjs`, `state.cjs`, `drift.cjs`, `plans.cjs`, etc.) already use new paths via `paths.cjs` — no stale old-path references

## Verified via Simulation

Full end-to-end simulation with mock old layout confirmed:
- Detection identifies 5 old-layout markers
- Migration moves all items correctly
- Post-migration detection returns `{needed: false}`
- Re-run produces only no-op skips

---

## Findings: Detection Gaps in `needsMigration()`

### GAP-1: `About.md` not detected (Severity: Medium)

`needsMigration()` does NOT check for `About.md` at docs root. The migration function `migrateDocsReorg()` handles the rename to `README.md`, but `migrate check` won't report it as needing migration.

**Impact**: `fp-tools migrate check` reports "no migration needed" while `About.md` still exists at the old location. Running `migrate run` would still fix it, but the user wouldn't know to run it.

**Fix**: Add check in `needsMigration()`:
```javascript
if (fs.existsSync(path.join(docsRoot, 'About.md')) && !fs.existsSync(path.join(docsRoot, 'README.md'))) {
  reasons.push('About.md at docs root (rename to README.md)');
}
```

### GAP-2: `PROJECT-INDEX.md` old location not detected (Severity: Medium)

Same issue — `claude-code-docs-system/PROJECT-INDEX.md` not checked in `needsMigration()` but migrated by `migrateDocsReorg()`.

**Fix**: Add check:
```javascript
const oldIndex = path.join(docsRoot, 'claude-code-docs-system', 'PROJECT-INDEX.md');
if (fs.existsSync(oldIndex) && !fs.existsSync(path.join(docsRoot, 'PROJECT-INDEX.md'))) {
  reasons.push('PROJECT-INDEX.md in claude-code-docs-system/ (promote to docs root)');
}
```

### GAP-3: Global state detection only checks `state.json` (Severity: Low)

`needsMigration()` only checks if `{docs-root}/.fp-docs/state.json` exists. If someone had an old layout with `staleness.json`, `trackers/`, `plans/`, etc. but NO `state.json`, migration would not be detected.

**Fix**: Check for the old `.fp-docs/` directory itself at docs root, not just `state.json`:
```javascript
const oldFpDocsAtDocs = path.join(docsRoot, '.fp-docs');
if (fs.existsSync(oldFpDocsAtDocs) && fs.statSync(oldFpDocsAtDocs).isDirectory()) {
  // Check if any GLOBAL_STATE_ITEMS exist there
  const hasOldItems = GLOBAL_STATE_ITEMS.some(item => fs.existsSync(path.join(oldFpDocsAtDocs, item)));
  if (hasOldItems) {
    reasons.push('old .fp-docs/ directory at docs root with state items');
  }
}
```

---

## Findings: Missing Integration

### GAP-4: SessionStart hook has no migration nudge (Severity: High)

The spec (`features-and-capabilities.md` line 537) states: "Migration is user-triggered (SessionStart nudges but does not auto-migrate)." However, the `fp-docs-session-start.js` hook does NOT call `needsMigration()` or provide any nudge to the user.

**Impact**: Users on old layouts will silently encounter broken state paths. No warning, no guidance to run `fp-tools migrate run`.

**Fix**: Add a 4th handler in `fp-docs-session-start.js`:
```javascript
try {
  // 4. Migration nudge
  const { needsMigration } = require('../lib/migrate.cjs');
  const docsRoot = ...; // from paths
  const codebaseRoot = ...; // from paths
  if (docsRoot && codebaseRoot) {
    const check = needsMigration(docsRoot, codebaseRoot);
    if (check.needed) {
      parts.push(`⚠️ Old data layout detected: ${check.reasons.join(', ')}. Run \`fp-tools migrate run\` to update.`);
    }
  }
} catch {
  // Silent failure -- non-critical
}
```

---

## Findings: Edge Cases

### EDGE-1: `changelog.md` detection is conditional (Severity: Low)

`needsMigration()` checks for `changelog.md` at docs root but ONLY flags it if `.fp-docs-branch/changelog.md` doesn't already exist. This is correct behavior (avoids flagging if both exist), but worth noting: if both exist, the old one is orphaned and never cleaned up.

### EDGE-2: No cleanup of orphaned old items (Severity: Low)

If `{docs-root}/.fp-docs/` contains items NOT in `GLOBAL_STATE_ITEMS` (e.g., user-created files), they're left behind. The empty-directory cleanup only removes `.fp-docs/` if completely empty.

### EDGE-3: `.claude/.fp-docs-project/` tier (Severity: Info)

The spec defines a third tier at `.claude/.fp-docs-project/` for plugin cache. No code reads from or writes to this path — it exists only in the spec. No migration needed since there's nothing to migrate.

### EDGE-4: Cross-device rename failure (Severity: Info)

`migrateBranchData()` handles this correctly with the rename-then-fallback-to-copy pattern. No action needed.

---

## Complete Old-to-New Path Map

| # | Old Path | New Path | Detected? | Migrated? |
|---|----------|----------|-----------|-----------|
| 1 | `{docs}/.fp-docs/state.json` | `{codebase}/.fp-docs/state.json` | YES | YES |
| 2 | `{docs}/.fp-docs/staleness.json` | `{codebase}/.fp-docs/staleness.json` | NO* | YES |
| 3 | `{docs}/.fp-docs/drift-pending.json` | `{codebase}/.fp-docs/drift-pending.json` | NO* | YES |
| 4 | `{docs}/.fp-docs/trackers/` | `{codebase}/.fp-docs/trackers/` | NO* | YES |
| 5 | `{docs}/.fp-docs/remediation-plans/` | `{codebase}/.fp-docs/remediation-plans/` | NO* | YES |
| 6 | `{docs}/.fp-docs/plans/` | `{codebase}/.fp-docs/plans/` | NO* | YES |
| 7 | `{docs}/.fp-docs/analyses/` | `{codebase}/.fp-docs/analyses/` | NO* | YES |
| 8 | `{docs}/diffs/` | `{docs}/.fp-docs-branch/diffs/` | YES | YES |
| 9 | `{docs}/FLAGGED CONCERNS/` | `{docs}/.fp-docs-branch/flagged-concerns/` | YES | YES |
| 10 | `{docs}/changelog.md` | `{docs}/.fp-docs-branch/changelog.md` | YES** | YES |
| 11 | `{docs}/.sync-watermark` | `{docs}/.fp-docs-branch/.sync-watermark` | YES | YES |
| 12 | `{docs}/About.md` | `{docs}/README.md` | **NO** | YES |
| 13 | `{docs}/claude-code-docs-system/PROJECT-INDEX.md` | `{docs}/PROJECT-INDEX.md` | **NO** | YES |
| 14 | `.claude/.fp-docs/` | `.claude/.fp-docs-project/` | NO | NO*** |

\* Only `state.json` checked; other items in `.fp-docs/` are migrated but not individually detected
\** Only detected if `.fp-docs-branch/changelog.md` doesn't already exist
\*** Spec-only concept, no implementation uses this path

---

## Phase 2 Recommendations

### Must Fix (Phase 2)
1. **Add docs reorg detection to `needsMigration()`** — GAP-1 and GAP-2
2. **Add SessionStart migration nudge** — GAP-4
3. **Broaden global state detection** — GAP-3

### Should Fix (Phase 2)
4. Add `--dry-run` flag to `migrate run` for preview without changes
5. Add `migrate run --verbose` for detailed per-item output

### Consider (Future)
6. Orphan cleanup: warn about non-standard files in old `.fp-docs/` at docs root
7. Rollback mechanism (low priority — copy-verify-delete pattern is already safe)
