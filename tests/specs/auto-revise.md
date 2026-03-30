---
command: auto-revise
engine: modify
operation: auto-revise
workflow: workflows/auto-revise.md
agent: fp-docs-modifier
type: write
pipeline_stages: [1, 2, 3, 4, 5, 6, 7, 8]
subcommands: none
flags: none
---

# /fp-docs:auto-revise - Behavioral Specification

## Routing Path

1. User invokes `/fp-docs:auto-revise "optional flags like --dry-run"`
2. Command file loads workflow `workflows/auto-revise.md` via `@-reference`
3. Workflow initializes via `fp-tools init write-op`
4. Workflow reads needs-revision-tracker.md, selects items to process
5. Workflow spawns fp-docs-modifier for Write Phase (operation + stages 1-3)
6. Workflow spawns fp-docs-validator for Review Phase (stages 4-5)
7. Workflow handles Finalize Phase (stages 6-8) via pipeline callback loop
8. Workflow updates tracker status for processed items

## Pipeline Stages

- Stage 1: Verbosity Enforcement (reads verbosity-algorithm.md)
- Stage 2: Citation Generation/Update (reads citation-algorithm.md)
- Stage 3: API Reference Sync (reads api-ref-algorithm.md)
- Stage 4: Sanity-Check (reads validation-algorithm.md)
- Stage 5: 10-Point Verification (reads validation-algorithm.md)
- Stage 6: Changelog Update (uses mod-changelog)
- Stage 7: Index Update (conditional, uses mod-index)
- Stage 8: Docs Repo Commit (docs-commit.sh)

## Expected Markers

- Pipeline completion: `Pipeline complete: [verbosity: PASS] [citations: ...] ...`
- Changelog: `changelog updated` or `updated changelog`
- Delegation: `delegation result` or `agents used` or `pipeline validation`

## Files Typically Touched

- Multiple documentation files from needs-revision tracker
- docs/changelog.md (stage 6, batch entry)
- docs/needs-revision-tracker.md (items marked complete)
- Possibly docs/PROJECT-INDEX.md (stage 7)

## Error Paths

- Needs-revision tracker not found: engine reports missing tracker
- Tracker is empty: engine reports nothing to revise
- Individual item revision fails: engine logs and continues to next item

## Edge Cases

- Auto-revise with `--dry-run` flag: reports what would be revised without making changes
- Auto-revise when docs repo not initialized: stage 8 skips
- Auto-revise when tracker contains items referencing deleted source files
