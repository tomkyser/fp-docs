---
command: auto-revise
engine: modify
operation: auto-revise
instruction: framework/instructions/modify/auto-revise.md
agent: orchestrate
context: fork
type: write
pipeline_stages: [1, 2, 3, 4, 5, 6, 7, 8]
subcommands: none
flags: none
---

# /fp-docs:auto-revise - Behavioral Specification

## Routing Path

1. User invokes `/fp-docs:auto-revise "optional flags like --dry-run"`
2. Skill SKILL.md passes `$ARGUMENTS` to orchestrate engine
3. Orchestrate classifies as write operation (engine: modify)
4. Orchestrate delegates Write Phase (operation + stages 1-3) to modify engine
5. Orchestrate delegates Review Phase (stages 4-5) to validate engine
6. Orchestrate handles Finalize Phase (stages 6-8) itself

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
