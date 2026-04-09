# Spec Updates Plan — Wave 1

> Author: Architect
> Date: 2026-04-09
> Status: Ready for Phase 3 execution
> Purpose: Detailed change list for spec file updates after implementation

---

## specs/architecture.md

No `.fp-docs` or path references found in current architecture spec. However, needs:

1. **Section 1 (Repository Layout)**: Add `.fp-docs-branch/` to the docs repo layout tree
2. **New section or subsection**: Document the three-tier directory structure (global state, branch data, project cache)
3. **Sync workflow section**: Add merge intelligence step description
4. **Hook system**: Document migration check in SessionStart
5. **New module entry**: `lib/merge-intel.cjs` and `lib/migrate.cjs`

## specs/features-and-capabilities.md

### Line-specific changes:

| Approx Line | Current | New | Notes |
|-------------|---------|-----|-------|
| 225 | `.fp-docs/plans/` | `{project-root}/.fp-docs/plans/` | Planner agent description |
| 308 | `docs/changelog.md` | `.fp-docs-branch/changelog.md` | Pipeline stage 6 |
| 423 | `.fp-docs/screenshots/` | `.fp-docs/screenshots/` | No change (already at project root) |
| 443 | `docs/diffs/` | `.fp-docs-branch/diffs/` | Sync feature description |
| 519 | (drift-related) | Update staleness.json path | Drift feature description |
| 580 | `About.md` | `README.md` | Verification check 1 |
| 581 | `About.md` | `README.md` | Verification check 2 |
| 585 | `changelog.md` | `.fp-docs-branch/changelog.md` | Verification check 6 |

### New content needed:

- **Merge Intelligence**: New feature entry describing branch merge detection in sync
- **Three-tier data layout**: Brief mention in the architecture overview section
- **New commands/CLI**: `fp-tools merge-intel` and `fp-tools migrate` entries

## specs/usage-and-workflows.md

### Line-specific changes:

| Approx Line | Current | New | Notes |
|-------------|---------|-----|-------|
| 115 | `.fp-docs-shell.zsh` | `.fp-docs-shell.zsh` | No change (at codebase root) |
| 220 | `About.md` | `README.md` | Add workflow step |
| 297 | `About.md` | `README.md` | Auto-update workflow |
| 301 | `About.md` | `README.md` | Deprecate workflow |
| 377 | `.fp-docs/drift-pending.json` | `{project-root}/.fp-docs/drift-pending.json` | Drift signal path |
| 378 | `.fp-docs/staleness.json` | `{project-root}/.fp-docs/staleness.json` | Staleness path |
| 415 | `.fp-docs/screenshots/` | `.fp-docs/screenshots/` | No change |
| 431 | `.fp-docs/update-cache.json` | `{project-root}/.fp-docs/update-cache.json` | Update cache path |
| 550 | `.sync-watermark` | `.fp-docs-branch/.sync-watermark` | Watermark location |
| 563 | `docs/diffs/{...}` | `.fp-docs-branch/diffs/{...}` | Diff report path |
| 588 | `docs/diffs/` | `.fp-docs-branch/diffs/` | Historical records |
| 592 | `.sync-watermark` in docs repo | `.fp-docs-branch/.sync-watermark` | Watermark description |
| 660 | `.fp-docs/screenshots` | `.fp-docs/screenshots` | No change |
| 697 | `docs/changelog.md` | `.fp-docs-branch/changelog.md` | Pipeline stage 6 |
| 836 | `.fp-docs/plans/` | `{project-root}/.fp-docs/plans/` | Plan persistence |
| 860 | `docs/diffs/` | `.fp-docs-branch/diffs/` | Gotcha about not cleaning up |
| 864 | `changelog.md` | `.fp-docs-branch/changelog.md` | Pipeline always writes |
| 920 | staleness/drift in `.fp-docs/` inside docs repo | `{project-root}/.fp-docs/` | Correct location description |
| 989 | `docs/changelog.md` | `.fp-docs-branch/changelog.md` | Source-to-doc mapping |
| 991 | `docs/About.md` | `docs/README.md` | Hub file |
| 992 | `docs/claude-code-docs-system/PROJECT-INDEX.md` | `docs/PROJECT-INDEX.md` | Promoted to root |
| 993 | `docs/diffs/{...}` | `.fp-docs-branch/diffs/{...}` | Diff reports |
| 994 | `docs/.fp-docs/staleness.json` | `{project-root}/.fp-docs/staleness.json` | Staleness tracker |
| 995 | `docs/.fp-docs/drift-pending.json` | `{project-root}/.fp-docs/drift-pending.json` | Pending drift |

### New content needed:

- **Sync workflow section**: Add merge intelligence subsection describing detection, staleness assessment, auto-merge vs user review
- **Setup section**: Add git exclude configuration and migration steps
- **Gotchas**: Add gotcha about old vs new data layout and migration
- **Configuration table**: Add merge-intel and migration config entries if any
- **Source-to-doc mapping table**: Update to reflect .fp-docs-branch/ paths

## README.md (plugin root)

Grep the current README for affected references.

Changes needed:
- `docs/diffs/` -> `.fp-docs-branch/diffs/`
- `About.md` -> `README.md` (if referenced)
- `docs/changelog.md` -> `.fp-docs-branch/changelog.md` (if referenced)
- Any `framework/` stale references (cleanup item U)
- Document the three-tier directory structure
- Add merge intelligence feature description

## CLAUDE.md (repo root at cc-plugins/)

Changes needed:
- Repository layout tree: add `.fp-docs-branch/`, show new global state location
- Remove stale `framework/` references (cleanup item U)
- Update any `.fp-docs/` path references

---

## Execution Order

1. Wait for Engineer to complete file system changes (Task #12) and CJS path updates (Task #16)
2. Verify the changes are correct by reading updated files
3. Apply spec updates in order: architecture.md, features-and-capabilities.md, usage-and-workflows.md
4. Update README.md
5. Coordinate with Lead on CLAUDE.md updates (may need separate cleanup pass)

---

## Validation After Updates

After all spec changes:
1. Grep all three specs for old paths: `.fp-docs/staleness`, `docs/diffs/`, `docs/changelog.md`, `About.md`, `claude-code-docs-system`, `.sync-watermark` at root level
2. Verify no internal contradictions between the three spec files
3. Verify spec descriptions match actual file locations
