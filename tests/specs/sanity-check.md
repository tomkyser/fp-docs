---
command: sanity-check
engine: validate
operation: sanity-check
instruction: framework/instructions/validate/sanity-check.md
agent: orchestrate
context: fork
type: read
pipeline_stages: none
subcommands: none
flags: none
---

# /fp-docs:sanity-check - Behavioral Specification

## Routing Path

1. User invokes `/fp-docs:sanity-check "scope like docs/06-helpers/posts.md"`
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
- Reads target documentation files and source code files for claim comparison

## Error Paths

- Scope resolves to no files: engine reports empty scope
- Claim-code mismatch found: engine flags as MISMATCH or HALLUCINATION
- Source file missing: engine classifies claim as UNVERIFIED

## Edge Cases

- Sanity-check with zero tolerance: any mismatch is flagged immediately
- Sanity-check on a file with `[NEEDS INVESTIGATION]` tags: engine re-evaluates tagged claims
- Sanity-check when source code has changed since last revision
