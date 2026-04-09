# Retrospective: wave1-fp-docs-reorg

> Date: 2026-04-09T18:34:41.696Z
> Duration: 1h 30m
> Phases completed: 3

## What Went Well
- Front-loaded design docs as living contracts — everyone referenced the same artifact, zero ambiguity
- Non-blocking review pattern worked perfectly — devs never stalled waiting for Lead reviews
- Quality improved each phase: 6 minor items → 5 → 0 (progressive refinement)
- Parallel Phase 1 audit (Engineer) + design (Architect) produced comprehensive results quickly
- Three-tier directory design held through implementation without revision
- Implementation specs with exact function signatures eliminated back-and-forth
- Lead pre-read codebase during wait time → instant reviews when unblocked
- Grep-based stale reference verification caught real misses (tracker-doc.md JSON examples, pipeline.cjs)

## What Could Improve
- Tier harmonization missed JSON examples — grep for bare strings AND strings inside quotes/JSON contexts
- Impact matrix was incomplete on first draft (Lead caught 7 missing files) — do systematic grep before declaring complete
- Architect had idle stretch between Phase 2 completion and Phase 3 unblock — could pick up unowned tasks
- Message delivery lag created confusion — shared state files more reliable than async messages for status
- Lead should publish review checklist upfront so devs know quality gate before submitting
- Lead logged some Phase 2 items that were intentionally deferred to Phase 3 — should ask first
- Pre-existing test failures from commands/ flatten created noise in verification

## Patterns Discovered
- Design doc as contract pattern (`.fp-docs/spec-*.md` with frontmatter) is reusable for future waves
- `copy-verify-delete` is the right default for any file relocation in this project
- `.git/info/exclude` over `.gitignore` for tooling that some branches may not have — establish as convention
- `resolveDocsRoot()` → shared `getGlobalStateRoot()` refactor pattern repeated across state/plans/drift modules
- Test files that construct temp directories need updating when storage paths change — easy to miss

## Labor Division Notes
- Architect: 3 design docs, 3 implementation specs, spec updates, integration verification
- Engineer: Full audit, 42+ file implementation across U/D/E, 2 new CJS modules (merge-intel + migrate), second-pass fixes
- Lead: 3 phase reviews (PASS WITH NOTES → PASS WITH NOTES → PASS), second-pass curation, retrospective
- Effective parallel: Architect designed while Engineer audited (Phase 1), Architect spec'd while Engineer implemented (Phase 2)

## Gotchas for Next Time
- `fs.writeFileSync` fails silently when parent dir doesn't exist — always `ensureDir` first
- `replace_all` is powerful but dangerous for common strings — verify semantic context before bulk replace
- `migrate.cjs` intentionally references old paths for detection — exclude migration code from future stale-reference audits
- 23 route validation mismatches from commands/ flatten (commit 378d840) — pre-existing, address in future wave
- Tier naming mismatches hide in JSON examples — always grep example blocks too

## Metrics
| Phase | Review Result | Minor Items | Resolved |
|-------|---------------|-------------|----------|
| 1: Research & Design | PASS WITH NOTES | 6 | All in Phase 2 |
| 2: Implementation | PASS WITH NOTES | 5 | All in Phase 3 |
| 3: Merge System & Integration | PASS | 3 (second pass) | All resolved |

**Totals:** ~56 files changed, 362 insertions, 5,899 deletions, 2 new CJS modules, 8 stale files removed
