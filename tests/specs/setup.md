---
command: setup
engine: system
operation: setup
instruction: framework/instructions/system/setup.md
agent: orchestrate
context: fork
type: admin
pipeline_stages: none
subcommands: none
flags: none
---

# /fp-docs:setup - Behavioral Specification

## Routing Path

1. User invokes `/fp-docs:setup`
2. Skill SKILL.md passes context to orchestrate engine (includes 4-phase verification plan)
3. Orchestrate classifies as admin operation (engine: system)
4. Orchestrate delegates directly to system engine
5. No pipeline triggered -- admin operation with direct execution

## Pipeline Stages

None. Admin operations execute directly without the 8-stage pipeline.

## Expected Markers

- No `Pipeline complete:` marker (admin operation)
- Phase completion markers for each of 4 setup phases

## Files Typically Touched

- No docs files modified directly
- May clone docs repo at `{codebase-root}/themes/foreign-policy-2017/docs/`
- May modify codebase `.gitignore` (if docs path not ignored)

## Error Paths

- Plugin structure invalid: engine reports missing directories or files
- Docs repo clone fails: engine reports git access error
- Codebase not a git repo: engine reports missing git initialization

## Edge Cases

- Setup when everything is already configured: engine reports all checks pass
- Setup when docs repo exists but remote URL is wrong: engine reports URL mismatch
- Setup when codebase branch and docs branch are mismatched: offers sync
- Setup requires interactive user confirmation for docs repo cloning
