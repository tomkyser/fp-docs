# Phase Status Board

> Team: wave2-migration-wiki
> Started: 2026-04-09T23:49:30.613Z
> Status: init

---
## Current Phase: 2 -- Implementation
**Status**: in-progress
**Started**: 2026-04-09T23:56:17.591Z

### Task Claims
| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 14 | Fix needsMigration() detection gaps | Engineer | COMPLETE | GAP-1, GAP-2, GAP-3 all fixed, tested |
| 15 | Add migration nudge to SessionStart | Engineer | COMPLETE | GAP-4 fixed — new handler + hook integration |
| 16 | Add --dry-run flag to migrate run | Engineer | COMPLETE | Preview mode, no filesystem changes |
| 18 | Create Hugo config (hugo.toml + go.mod) | Architect | COMPLETE | Full config with Book theme, contentDir=".", ignoreFiles |
| 19 | Create render hook for .md link rewriting | Architect | COMPLETE | Handles .md stripping + _index.md → section root |
| 20 | Create GitHub Actions deploy workflow | Architect | COMPLETE | Hugo + Go + Pages deploy, path-ignore for internal dirs |
| 21 | Create root _index.md homepage | Architect | COMPLETE | Section table, quick start, relref links |
| 22 | Update PHASE-STATUS.md | Architect | COMPLETE | This update |

### Discoveries
- All 4 gaps from Phase 1 audit are now fixed
- Dry-run reuses needsMigration() — no duplication of detection logic
- Hugo `contentDir = "."` allows docs at repo root without restructuring
- Render hook handles both `*.md` → `*/` AND `*/_index.md` → `*/` rewrites
- Hugo Book theme search uses Fuse.js (client-side) — meets user's "no external services" requirement
- GitHub Actions workflow uses `paths-ignore` to skip builds when only internal dirs change

### Phase Completion Summary (Engineer)
- **Files modified**: `lib/migrate.cjs` (detection gaps + dry-run), `lib/hooks.cjs` (migration nudge handler), `hooks/fp-docs-session-start.js` (nudge integration)
- **Files created**: none
- **Files deleted**: none
- **Decisions made**: Dry-run uses needsMigration() rather than a separate preview function
- **Issues discovered**: none — all changes tested via simulation
- **Items for Lead review**: 3 modified files (migrate.cjs, hooks.cjs, fp-docs-session-start.js)

### Phase Completion Summary (Architect)
- **Files created** (in docs repo `tomkyser/docs-foreignpolicy-com`):
  - `hugo.toml` — Hugo configuration (Book theme, contentDir=".", ignoreFiles, search, markup settings)
  - `go.mod` — Go module file for Hugo module dependency management
  - `layouts/_default/_markup/render-link.html` — Render hook for .md → clean URL rewriting
  - `.github/workflows/deploy-wiki.yml` — GitHub Actions: Hugo build + Pages deployment
  - `_index.md` — Root homepage with section table and quick start links
- **Files modified** (in docs repo):
  - `.gitignore` — Added Hugo build artifacts (`public/`, `resources/_gen/`, `go.sum`)
- **Decisions made**:
  - Hugo Book theme (clean, lightweight, Fuse.js search) over Docsy (too heavy for private dev docs)
  - `contentDir = "."` to serve docs from repo root without restructuring
  - Hugo modules over git submodule for theme (cleaner, no submodule management)
  - `relref` shortcodes in homepage for robust cross-references
  - `paths-ignore` in Actions workflow to skip rebuilds for internal-only changes
- **Issues discovered**: None — all Phase 1 review notes addressed
- **Items for Lead review**: 5 new files + 1 modified file in docs repo

### Lead Review
- **Result**: PASS WITH NOTES
- **Reviewer**: team-lead-2
- **Date**: 2026-04-09

#### Migration Fixes (Engineer) — PASS
All 3 modified files reviewed via `git diff`:
- `lib/migrate.cjs`: GAP-1/2/3 detection fixes are clean, follow existing patterns. `--dry-run` reuses `needsMigration()` — good design, no duplication.
- `lib/hooks.cjs`: `handleMigrationNudge()` follows Category A handler pattern exactly. Lazy-requires `migrate.cjs`, proper null guards on `getCodebaseRoot()`/`getDocsRoot()`, silent failure via try/catch.
- `hooks/fp-docs-session-start.js`: Adds 4th handler matching pattern of handlers 1-3. Clean integration.

#### Wiki Implementation (Architect) — PASS WITH NOTES
All 6 files reviewed (5 new + 1 modified in docs repo):

Phase 1 review notes addressed:
1. ~~GitHub Pages private repo~~ — user-facing, can't resolve in code (acknowledged)
2. `_index.md` link rewriting — ADDRESSED: render-link.html lines 12-14 strip `/_index` suffix
3. `About.md` coordination — ADDRESSED: `_index.md` line 52-55 links About.md with migration note
4. `.fp-docs-branch/` in ignoreFiles — ADDRESSED: hugo.toml line 22
5. Hugo Book over Docsy — ADDRESSED: hugo-book throughout

File-by-file:
- `hugo.toml`: Good config. `contentDir = "."` is clever. Minor: `theme` key at line 6 is redundant with `[module.imports]` at line 89-91 — not a blocker.
- `go.mod`: `v0.0.0` placeholder is fine — `hugo mod get` resolves it.
- `render-link.html`: Correctly handles `.md` stripping AND `_index.md` → section root. External links get `target="_blank" rel="noopener"`. Clean.
- `deploy-wiki.yml`: Actions versions current (checkout@v4, setup-go@v5, actions-hugo@v3, configure-pages@v5, deploy-pages@v4). Go setup included for Hugo modules. `paths-ignore` correctly skips internal dirs. Pinned Hugo version (0.145.0).
- `_index.md`: Complete section table (24 sections + appendices). `relref` shortcodes for robust links. Migration coordination note.
- `.gitignore`: Covers Hugo build artifacts (`public/`, `resources/_gen/`, `go.sum`).

Notes for second pass:
1. Remove redundant `theme` key from hugo.toml (line 6) — `[module.imports]` at line 89-91 is sufficient
2. Wiki won't deploy until GitHub Pages is enabled on the docs repo and plan supports private repos

- **Commit**: included in wave2 commit below

---


## Current Phase: 1 -- Research & Design
**Status**: both-complete
**Started**: 2026-04-09T23:49:30.614Z

### Task Claims
| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 2 | Migration Audit | Engineer | COMPLETE | Full audit findings in `migration-audit-findings.md` |
| 3 | Research SSG candidates | Architect | COMPLETE | Evaluated 6 SSGs against 10 criteria |
| 5 | Analyze docs repo structure | Architect | COMPLETE | ~200+ files, _index.md convention, no frontmatter |
| 6 | Design GitHub Actions pipeline | Architect | COMPLETE | Full workflow + Hugo config designed |
| 7 | Produce recommendation report | Architect | COMPLETE | Hugo recommended — report in `wiki-research-report.md` |

### Discoveries (Engineer)
- GAP-1: `needsMigration()` doesn't detect `About.md` at old location
- GAP-2: `needsMigration()` doesn't detect `PROJECT-INDEX.md` at old location
- GAP-3: Global state detection only checks `state.json`, misses other items
- GAP-4 (HIGH): SessionStart hook has NO migration nudge — spec claims it does
- EDGE-1: Orphaned `changelog.md` when both old and new exist
- VERIFIED: Migration is idempotent and safe for re-runs
- VERIFIED: All consumer modules use new paths via `paths.cjs`
- VERIFIED: `.claude/.fp-docs-project/` is spec-only, no code uses it

### Discoveries (Architect)
- Hugo is the ONLY SSG that natively supports `_index.md` as section landing pages — decisive factor
- Docs have zero YAML frontmatter — eliminates Jekyll (requires frontmatter for nav ordering)
- Relative links use `../` with `.md` extensions — solvable in Hugo with a 5-line render hook
- Internal dirs (FLAGGED CONCERNS, diffs, claude-code-docs-system) must be excluded from wiki
- Private repo GitHub Pages requires GitHub Pro/Team/Enterprise — open question for user
- About.md serves as root TOC, should map to Hugo homepage

### Phase Completion Summary (Engineer)
- **Files created**: `.claude/team-state/migration-audit-findings.md`
- **Decisions made**: 3 must-fix items + 2 should-fix items for Phase 2
- **Issues discovered**: 4 gaps (1 high, 2 medium, 1 low), 4 edge cases

### Phase Completion Summary (Architect)
- **Files created**: `.claude/team-state/wiki-research-report.md`
- **Decisions made**: Hugo recommended over MkDocs Material, Jekyll, Docusaurus, VitePress, mdBook
- **Issues discovered**: Private repo needs paid GitHub plan for Pages; `_index.md` is decisive differentiator
- **Items for Lead review**: `wiki-research-report.md` — recommendation + implementation plan + 5 open questions

### Lead Review
- **Result**: PASS WITH NOTES
- **Reviewer**: team-lead-2
- **Date**: 2026-04-09

#### V: Migration Audit — PASS
Thorough audit with verified findings, concrete code fixes, and complete path map.
- GAP-1/2/3 confirmed by code review; already fixed by Engineer (task #14) — diff is clean
- GAP-4 confirmed: `fp-docs-session-start.js` has no migration handler
- Idempotency verified: copy-verify-delete and skip-if-exists patterns are sound
- Consumer audit verified: no hooks/init/workflows trigger migration

Phase 2 notes:
1. GAP-3 fix could also warn about non-standard files in old `.fp-docs/`
2. Add `tests/specs/migrate.md` behavioral spec
3. `--dry-run` flag is a good addition

#### N: Wiki Research — PASS
Comprehensive 6-candidate evaluation with clear winner and implementation plan.
- Hugo `_index.md` native support is decisive — verified unique among candidates
- GitHub Actions workflow is complete and uses current actions (v4)
- Render hook for `.md` link rewriting is correct

Phase 2 notes:
1. CRITICAL: Private repo GitHub Pages needs Pro/Team/Enterprise — must confirm before implementation
2. Render hook must also handle `_index.md` references (not just `.md`)
3. `About.md` → homepage mapping must coordinate with migration's `About.md → README.md` rename
4. `ignoreFiles` should also exclude `.fp-docs-branch/`
5. Hugo Book theme preferred over Docsy for private dev docs

- **Commit**: proceeding

---

