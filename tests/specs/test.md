---
command: test
engine: validate
operation: test
workflow: workflows/test.md
agent: fp-docs-validator
type: read
pipeline_stages: none
subcommands: none
flags: none
---

# /fp-docs:test - Behavioral Specification

## Routing Path

1. User invokes `/fp-docs:test "test scope like rest-api|cli|templates"`
2. Command file loads workflow `workflows/test.md` via `@-reference`
3. Workflow initializes via `fp-tools init read-op`
4. Workflow spawns fp-docs-validator in standalone mode
5. No pipeline stages triggered -- read operations skip full pipeline

## Pipeline Stages

None. Read operations use the fast path without triggering the 8-stage pipeline.

## Expected Markers

- No `Pipeline complete:` marker (read operations skip full pipeline)
- No `changelog updated` marker
- Agents used marker: `2 agents used` (orchestrator + validate)

## Files Typically Touched

- No files modified (read-only operation)
- Reads documentation claims and tests them against local dev environment

## Error Paths

- Local dev environment not running: engine reports ddev/environment error
- REST endpoint returns unexpected status: engine reports test failure
- WP-CLI command fails: engine reports CLI execution error

## Edge Cases

- Test with `rest-api` scope: tests REST endpoint documentation claims
- Test with `cli` scope: tests WP-CLI command documentation claims
- Test with `templates` scope: tests template rendering documentation claims
- Test when ddev is not running: engine cannot reach local environment
