---
command: auto-update
engine: modify
operation: auto-update
instruction: framework/instructions/modify/auto-update.md
agent: orchestrate
context: fork
type: write
pipeline_stages: [1, 2, 3, 4, 5, 6, 7, 8]
subcommands: none
flags: none
---

# /fp-docs:auto-update - Behavioral Specification

## Routing Path

1. User invokes `/fp-docs:auto-update "optional scope restriction"`
2. Skill SKILL.md runs `git diff --name-only HEAD~5` to detect changed files, passes result + `$ARGUMENTS` to orchestrate engine
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

- One or more existing documentation files in docs/ (updated based on git diff)
- docs/changelog.md (stage 6)
- Possibly docs/PROJECT-INDEX.md (stage 7, if structural changes detected)

## Error Paths

- No changed files in last 5 commits: engine reports nothing to update
- Changed files have no corresponding docs: engine reports unmapped files
- Source file not found: engine uses `[NEEDS INVESTIGATION]` tag

## Edge Cases

- Auto-update with scope restriction: only processes matching files
- Auto-update when docs repo not initialized: stage 8 skips
- Auto-update when git history is shallow (fewer than 5 commits)
