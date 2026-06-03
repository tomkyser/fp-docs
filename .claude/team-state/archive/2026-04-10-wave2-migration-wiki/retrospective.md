# Retrospective: wave2-migration-wiki

> Date: 2026-04-10T00:07:22.960Z
> Duration: 17m
> Phases completed: 2

## What Went Well
- Hugo `_index.md` discovery collapsed SSG evaluation from 6 candidates to 1 — research that eliminates is more valuable than research that compares
- Audit-first approach (Engineer): reading all code before writing meant surgical, clean fixes
- Lead prep time was productive — found GAP-4 independently before Engineer's report confirmed it
- Parallel Phase 1 (wiki research + migration audit) had zero blocking dependencies
- Phase 1 research was comprehensive enough that Phase 2 implementation had no design decisions left
- Devs started Phase 2 without waiting for review — parallelism saved significant time
- Lead committed after reviews (Wave 1 lesson applied successfully)

## What Could Improve
- No FP codebase on dev machine limited CLI testing to error paths and mocks — integration testing would catch more
- Spec claimed SessionStart nudged for migration but it wasn't implemented — spec-to-code audit checklist would help
- Review task blocking was on umbrella tasks, not actual sub-tasks — blocking should be more granular
- Deliverables landed on disk late — devs worked in task descriptions until final step. Earlier file output enables incremental review
- Redundant `theme` key was copy-paste artifact from research into implementation — review caught it but should have been caught before submission
- `relref` shortcodes in `_index.md` but plain markdown elsewhere — inconsistent, plain links would have been simpler

## Patterns Discovered
- `contentDir = "."` in Hugo: serves docs from repo root, zero restructuring needed
- Hugo modules over git submodules for themes: cleaner CI, no submodule checkout
- Lazy `require()` in hooks (inside handler function): avoids circular deps, keeps startup fast
- Hugo render hooks are the right abstraction for link rewriting — small, declarative, no build plugins
- When evaluating SSGs: check existing file conventions FIRST (index naming, frontmatter, dir structure), then filter
- copy-verify-delete migration pattern is reusable for any file-moving operations
- `needsMigration()` as reusable detection enables both SessionStart nudge AND `--dry-run` without duplication

## Labor Division Notes
- Architect: Wiki research (6 SSG evaluation, Hugo recommendation), wiki implementation (6 files in docs repo)
- Engineer: Migration audit (4 gaps found), migration fixes (3 detection gaps + SessionStart nudge + dry-run flag)
- Lead: Codebase prep during wait, Phase 1+2 reviews, two-repo commits, second-pass curation
- Clean parallel: migration and wiki workstreams had zero dependencies on each other

## Gotchas for Next Time
- `needsMigration()` and `runFullMigration()` must stay symmetric — any migration addition needs both updated in lockstep
- `.claude/.fp-docs-project/` exists in spec but has zero code backing — spec debt
- Hugo modules require Go in CI — easy to forget since Hugo itself is a single binary. Actions needs `setup-go`
- Private repo GitHub Pages is a paid-plan gate invisible until you try to enable it — validate early
- Docs repo path has `wordpress/` level that's easy to miss: `foreignpolicy.com/wordpress/themes/foreign-policy-2017/docs/`
- `theme` key vs `[module.imports]` in Hugo are redundant — pick one

## Metrics
| Phase | Review Result | Notes |
|-------|---------------|-------|
| 1: Research & Design | PASS WITH NOTES | Migration audit + wiki research complete |
| 2: Implementation | PASS WITH NOTES | Migration fixes + Hugo wiki (6 files) |

**Totals:** 2 workstreams (V + N), 9 files changed/created, 4 migration gaps fixed, 1 complete wiki setup
