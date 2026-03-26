---
command: verify
engine: validate
operation: verify
instruction: framework/instructions/validate/verify.md
agent: orchestrate
context: fork
type: read
pipeline_stages: none
subcommands: none
flags: none
---

# /fp-docs:verify - Behavioral Specification

## Routing Path

1. User invokes `/fp-docs:verify "optional scope like docs/06-helpers/"`
2. Skill SKILL.md passes `$ARGUMENTS` to orchestrate engine
3. Orchestrate classifies as read operation (engine: validate)
4. Orchestrate delegates to validate engine (2-agent fast path)
5. No pipeline stages triggered -- read operations skip full pipeline

## Pipeline Stages

None. Read operations use the fast path without triggering the 8-stage pipeline.

## Expected Markers

- No `Pipeline complete:` marker (read operations skip full pipeline)
- No `changelog updated` marker
- Agents used marker: `2 agents used` (orchestrator + validate)

## Files Typically Touched

- No files modified (read-only operation)
- Reads target documentation files for 10-point verification checklist

## Error Paths

- Scope resolves to no files: engine reports empty scope
- Documentation file malformed: engine reports parse errors per check

## Edge Cases

- Verify with no scope: runs against all docs files
- Verify on a single file: produces focused 10-point report
- Verify when docs repo not initialized: engine can still verify local files
