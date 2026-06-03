---
command: api-ref
engine: api-refs
operation: (subcommand)
workflow: workflows/api-ref.md
agent: fp-docs-api-refs
type: write
pipeline_stages: varies
subcommands: generate, audit
flags: none
---

# /fp-docs:api-ref - Behavioral Specification

## Routing Path

1. User invokes `/fp-docs:api-ref "generate|audit [scope]"`
2. Command file loads workflow `workflows/api-ref.md` via `@-reference`
3. Workflow classifies based on subcommand:
   - `generate`: write operation with pipeline stages 1, 2, 4-8
   - `audit`: read operation with no pipeline stages

### Write subcommand (generate)

4. Orchestrate delegates to api-refs engine with Write Phase (stages 1-2 + operation)
5. Orchestrate delegates Review Phase (stages 4-5) to validate engine
6. Orchestrate handles Finalize Phase (stages 6-8) itself

### Read subcommand (audit)

4. Orchestrate delegates to api-refs engine (2-agent fast path)
5. No pipeline stages triggered

## Pipeline Stages

- Write subcommand (generate): stages 1, 2, 4, 5, 6, 7, 8
- Read subcommand (audit): none

## Expected Markers

### Write subcommand (generate)
- Pipeline completion: `Pipeline complete: [verbosity: ...] [citations: ...] ...`
- Changelog: `changelog updated` or `updated changelog`
- Delegation: `delegation result` or `agents used`

### Read subcommand (audit)
- No `Pipeline complete:` marker
- No `changelog updated` marker

## Files Typically Touched

### Write subcommand
- Target documentation file(s) with API reference sections
- .fp-docs-branch/changelog.md (stage 6)

### Read subcommand
- No files modified (read-only)

## Error Paths

- Invalid subcommand: engine reports valid options (generate, audit)
- Source code has no public API surface: engine reports nothing to reference
- Function signatures cannot be parsed: engine uses `[NEEDS INVESTIGATION]` tag

## Edge Cases

- API-ref generate on PHP files with mixed visibility: engine filters to public/protected
- API-ref audit when source signatures have changed since last generation
