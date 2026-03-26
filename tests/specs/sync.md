---
command: sync
engine: system
operation: sync
instruction: framework/instructions/system/sync.md
agent: orchestrate
context: fork
type: admin
pipeline_stages: none
subcommands: merge
flags: --force
---

# /fp-docs:sync - Behavioral Specification

## Routing Path

1. User invokes `/fp-docs:sync "[merge] [--force]"`
2. Skill SKILL.md passes `$ARGUMENTS` to orchestrate engine (references git-sync-rules.md algorithm)
3. Orchestrate classifies as admin operation (engine: system)
4. Orchestrate delegates directly to system engine
5. No pipeline triggered -- admin operation with direct execution

## Pipeline Stages

None. Admin operations execute directly without the 8-stage pipeline.

## Expected Markers

- No `Pipeline complete:` marker (admin operation)
- Branch sync status markers in engine output

## Files Typically Touched

- No documentation files modified directly
- Git branch state changes in docs repo

## Error Paths

- Docs repo not found: engine reports missing docs repo
- Uncommitted changes in docs repo (without --force): engine halts and reports
- Merge conflicts: engine reports conflict and asks user to resolve
- Remote not configured: engine skips push

## Edge Cases

- Sync with no args: detects branches, creates/switches docs branch to match codebase
- Sync merge: merges current docs feature branch into docs master, pushes, cleans up
- Sync --force: forces branch switch even with uncommitted docs changes
- Sync when branches already match: reports already in sync
