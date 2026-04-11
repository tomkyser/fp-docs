---
command: ug-update
engine: ug-writer
operation: ug-update
workflow: workflows/ug-update.md
agent: fp-docs-ug-writer
type: write
pipeline_stages: [ug-ui-verify, ug-screenshots, ug-tone, ug-completeness, ug-commit]
subcommands: none
flags: --refresh-screenshots, --no-tone-check
---

# /fp-docs:ug-update - Behavioral Specification

## Routing Path

1. User invokes `/fp-docs:ug-update "page path or feature name" [--refresh-screenshots] [--no-tone-check]`
2. Command file loads workflow `workflows/ug-update.md` via `@-reference`
3. Workflow initializes via `fp-tools init write-op ug-update`
4. Workflow resolves target to specific `user-guide/content/` page(s)
5. Workflow runs diff analysis: `git log --since={last_verified}` on source files from `source_features` frontmatter
6. Workflow spawns fp-docs-ug-writer for Write Phase (update affected sections + stages 1-2)
7. Workflow spawns fp-docs-ug-validator for Finalize Phase (stages 3-4)
8. Workflow handles stage 5 (changelog + commit) via orchestrator

## Pipeline Stages

User guide pipeline (5 stages, 2 phases):

- Stage 1: UI Behavior Verification — re-verify documented nav paths against current UI state, flag BROKEN/PARTIAL/STALE paths
- Stage 2: Screenshot Currency — check `last_verified` against source modification dates, verify file references, refresh screenshots if `--refresh-screenshots` or staleness detected
- Stage 3: Jargon & Tone Check — scan updated sections for banned patterns (skippable with `--no-tone-check`)
- Stage 4: Completeness Check — verify page still has all required sections after edits, structural quality intact
- Stage 5: Changelog + Commit — update `last_verified` to today, update `screenshot_count` if changed, commit to docs repo

## Expected Markers

- Pipeline completion: `Pipeline complete: [ui-verify: PASS] [screenshots: ...] [tone: ...] [completeness: ...] [commit: ...]`
- Changelog: `last_verified updated` or `frontmatter updated`
- Delegation: `delegation result` or `agents used`
- Git: `docs commit` or `committed to docs repo`

## Files Typically Touched

- Existing page file: `user-guide/content/{section}/{page-name}/index.md` (modified)
- Screenshots: `user-guide/content/{section}/{page-name}/{NN}-{slug}.png` (replaced if --refresh-screenshots)

## Error Paths

- Target page not found: reports error, suggests valid page paths or `ug-generate` for new pages
- No source changes since `last_verified`: reports page is current, optionally runs full validation anyway
- Source file removed from codebase: flags affected sections as potentially stale, uses `[NEEDS VERIFICATION]`
- Playwright unavailable with `--refresh-screenshots`: falls back to code-based verification, warns screenshots could not be refreshed

## Edge Cases

- Update with `--refresh-screenshots`: forces screenshot recapture even if not stale
- Update with `--no-tone-check`: skips stage 3 jargon scan
- Update when `source_features` is empty: no diff analysis possible, runs full page validation instead
- Update with no code changes but stale `last_verified`: re-verifies content, updates date if everything passes
- Multiple pages matched by feature name: updates all matching pages, reports each separately
- Page with structural changes needed (e.g., new field added to feature): writer adds new content while preserving existing sections
