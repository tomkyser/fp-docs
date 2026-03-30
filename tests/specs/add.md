---
command: add
engine: modify
operation: add
workflow: workflows/add.md
agent: fp-docs-modifier
type: write
pipeline_stages: [1, 2, 3, 4, 5, 6, 7, 8]
subcommands: none
flags: none
---

# /fp-docs:add - Behavioral Specification

## Routing Path

1. User invokes `/fp-docs:add "description of new code to document"`
2. Command file loads workflow `workflows/add.md` via `@-reference`
3. Workflow initializes via `fp-tools init write-op`
4. Workflow spawns fp-docs-researcher for codebase analysis
5. Workflow spawns fp-docs-planner for change planning
6. Workflow spawns fp-docs-modifier for Write Phase (operation + stages 1-3)
7. Workflow spawns fp-docs-validator for Review Phase (stages 4-5)
8. Workflow handles Finalize Phase (stages 6-8) via pipeline callback loop

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

- New documentation file in docs/ (created by this operation)
- docs/changelog.md (stage 6)
- docs/PROJECT-INDEX.md (stage 7, structural change likely)

## Error Paths

- Source code not found: engine requests user clarification
- Duplicate doc already exists: engine reports conflict
- Validation failure: sanity-check flags issues in new doc

## Edge Cases

- Add with `--no-sanity-check` flag: stages 4-5 can be bypassed
- Add when docs repo not initialized: stage 8 skips
- Add when source is in a non-standard directory structure
