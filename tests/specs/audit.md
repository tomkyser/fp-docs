---
command: audit
engine: validate
operation: audit
instruction: framework/instructions/validate/audit.md
agent: orchestrate
context: fork
type: read
pipeline_stages: none
subcommands: none
flags: --depth quick|standard|deep
---

# /fp-docs:audit - Behavioral Specification

## Routing Path

1. User invokes `/fp-docs:audit "--depth quick|standard|deep [scope]"`
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
- Reads target documentation files and corresponding source files

## Error Paths

- Invalid depth value: engine reports error and suggests valid options
- Scope resolves to no files: engine reports empty scope
- Source file missing for a documented claim: engine classifies as UNVERIFIED

## Edge Cases

- Audit with `--depth deep` produces exhaustive claim-by-claim verification
- Audit with `--depth quick` produces high-level coverage check
- Audit when docs repo not initialized: engine can still audit local files
