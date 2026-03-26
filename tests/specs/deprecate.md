---
command: deprecate
engine: modify
operation: deprecate
instruction: framework/instructions/modify/deprecate.md
agent: orchestrate
context: fork
type: write
pipeline_stages: [1, 2, 3, 4, 5, 6, 7, 8]
subcommands: none
flags: none
---

# /fp-docs:deprecate - Behavioral Specification

## Routing Path

1. User invokes `/fp-docs:deprecate "description of deprecated code"`
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

- Target documentation file (deprecation notice added)
- docs/changelog.md (stage 6, deprecation entry)
- docs/needs-revision-tracker.md (if tracking deprecation)
- Possibly docs/PROJECT-INDEX.md (stage 7, structural change)

## Error Paths

- Target doc not found: engine reports missing documentation
- Code still actively used: engine warns about premature deprecation
- Validation failure: sanity-check flags issues in deprecation notice

## Edge Cases

- Deprecate with `--no-sanity-check` flag: stages 4-5 can be bypassed
- Deprecate when docs repo not initialized: stage 8 skips
- Deprecate when the doc was already deprecated
