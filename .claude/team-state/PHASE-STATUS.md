# Phase Status Board

> Team: wave1-fp-docs-reorg
> Started: 2026-04-09T17:03:45.192Z
> Status: init

---
## Current Phase: 3 -- Merge System & Integration
**Status**: in-progress
**Started**: 2026-04-09T17:27:09.166Z

### Task Claims
| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|

### Discoveries

### Phase Completion Summary
- **Files created**:
- **Files modified**:
- **Files deleted**:
- **Decisions made**:
- **Issues discovered**:
- **Items for Lead review**:

### Lead Review
- **Result**: pass
- **Notes**: Clean pass
- **Commit**: pending

---

## Current Phase: 2 -- Implementation
**Status**: in-progress
**Started**: 2026-04-09T17:12:13.539Z

### Task Claims
| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 9 | Create merge-intel.cjs specification | Architect | COMPLETE | `.fp-docs/spec-merge-intel.md` |
| 10 | Design global state data model and migration logic | Architect | COMPLETE | `.fp-docs/spec-migration-and-state.md` |
| 22 | Spec updates plan for Phase 3 | Architect | COMPLETE | `.fp-docs/spec-updates-plan.md` |
| 24 | Merge detection algorithm design | Architect | COMPLETE | Covered by tasks 9+10 |
| 14 | Execute cleanup -- stale artifacts | Engineer | COMPLETE | |
| 15 | Harmonize complexity tier naming | Engineer | COMPLETE | |
| 17 | Update About.md references to README.md | Engineer | COMPLETE | |
| 18 | Update claude-code-docs-system/PROJECT-INDEX.md paths | Engineer | COMPLETE | |
| 26 | Implement lib/merge-intel.cjs | Engineer | COMPLETE | 9 exports, CLI registered |
| 27 | Implement lib/migrate.cjs | Engineer | COMPLETE | 8 exports, CLI registered |
| 28 | Execute spec file updates | Architect | COMPLETE | 6 spec files updated |
| 29 | Verify integration | Architect | COMPLETE | Zero stale references in operational code |
| 30 | Fix Phase 2 review items #1-5 | Engineer | COMPLETE | All 5 resolved |

### Discoveries
- Impact matrix updated with Lead's review feedback (missing files added)
- Squash merge handling added to detection algorithm design
- Spec updates deferred to Phase 3 (need implementation done first)

### Phase 2 Completion Summary (Architect portion)
- **Files created**: `.fp-docs/spec-merge-intel.md`, `.fp-docs/spec-migration-and-state.md`, `.fp-docs/spec-updates-plan.md`
- **Files modified**: `.fp-docs/design-wave1-phase1.md` (impact matrix expanded, squash merge handling added)
- **Files deleted**: none
- **Decisions made**: (1) merge-intel.cjs API surface: 7 exported functions + CLI (2) Migration is user-triggered not automatic (3) Spec updates wait for implementation
- **Issues discovered**: none

### Phase 3 Completion Summary
- **Files created**: `lib/merge-intel.cjs` (9 exports + CLI), `lib/migrate.cjs` (8 exports + CLI)
- **Files modified**: `fp-tools.cjs` (2 new CLI commands), 6 spec files, 8+ test spec files, `workflows/auto-update.md`, `workflows/sync.md`, `lib/pipeline.cjs`, `specs/patterns/tracker-doc.md` (4 tier fixes)
- **Total wave impact**: 56 files changed, 362 insertions, 5,899 deletions

### Lead Review (Phase 2)
- **Result**: pass_with_notes
- **Notes**: All 5 items addressed in Phase 3
- **Commit**: pending

### Lead Review (Phase 3 -- FINAL)
- **Result**: PASS
- **Notes**:
  - All Phase 2 review items #1-5 resolved: tracker-doc.md tier examples fixed, auto-update/sync workflow paths fixed, pipeline.cjs changelog path fixed, test spec paths fixed
  - `merge-intel.cjs`: 9 exports, correct squash merge fallback (line 180-183), atomic writes, proper SKIP_BRANCHES filter, clean partition into auto_merge/needs_review
  - `migrate.cjs`: 8 exports, copy-verify-remove strategy, rename with fallback to copy+delete, idempotent (skips if dest exists), cleans empty dirs
  - `fp-tools.cjs`: both merge-intel and migrate CLI commands registered correctly
  - `specs/architecture.md`: layout tree updated with both new modules
  - 6 spec files updated with 71 insertions across all three spec categories
  - Integration verification: zero stale `About.md`, `claude-code-docs-system`, `docs/diffs/`, `docs/changelog.md` references in operational code
  - Zero MINOR items. Clean PASS.
- **Commit**: pending

---


## Current Phase: 1 -- Research & Design
**Status**: in-progress
**Started**: 2026-04-09T17:03:45.193Z

### Task Claims
| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 4 | Design file system reorg, merge detection, git exclusion | Architect | COMPLETE | Full design at `.fp-docs/design-wave1-phase1.md` |
| 6 | Inventory contents of folders being renamed/moved | Architect | COMPLETE | Incorporated into design doc |
| 1 | Find stale framework/ references in CLAUDE.md | Engineer | IN PROGRESS | |
| 2 | Find complexity tier naming mismatch locations | Engineer | IN PROGRESS | |
| 7 | Audit cleanup targets and map file references for renames | Engineer | PENDING | |

### Discoveries
- `{docs-root}/.fp-docs/` currently holds 7 different data types (state, staleness, drift, trackers, remediation-plans, plans, analyses) -- all are operational state that should persist across branches
- `{codebase-root}/.fp-docs/` only holds update-cache.json -- can merge into new global location
- `docs/FLAGGED CONCERNS/` has spaces in the name -- normalize to `flagged-concerns/` in move
- `.sync-watermark` at docs root is branch-scoped data that belongs in `.fp-docs-branch/`
- The `docs/claude-code-docs-system/` folder only provides PROJECT-INDEX.md -- can be dropped after promotion
- `lib/paths.cjs` has no global state root function -- needs `getGlobalStateRoot()` to centralize path resolution
- 8 CJS modules, 5+ test files, 8+ reference/workflow files, and 3 spec files need path updates

### Phase Completion Summary
- **Files created**: `.fp-docs/design-wave1-phase1.md` (full design document)
- **Files modified**: `.claude/team-state/PHASE-STATUS.md`
- **Files deleted**: none
- **Decisions made**: (1) No separate git repo for global state -- flat JSON files (2) No SQLite -- zero-dependency constraint (3) Use `.git/info/exclude` not `.gitignore` for exclusions (4) Three-tier directory structure: global, branch, project-cache
- **Issues discovered**: Migration path needed for existing `.fp-docs/` data at docs root
- **Items for Lead review**: Design document at `.fp-docs/design-wave1-phase1.md`

### Lead Review
- **Result**: pass_with_notes
- **Notes**: All 6 items addressed in Phase 2
- **Commit**: pending

---

