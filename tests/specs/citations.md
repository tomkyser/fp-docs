---
command: citations
engine: citations
operation: (subcommand)
workflow: workflows/citations.md
agent: fp-docs-citations
type: write
pipeline_stages: varies
subcommands: generate, update, verify, audit
flags: none
---

# /fp-docs:citations - Behavioral Specification

## Routing Path

1. User invokes `/fp-docs:citations "generate|update|verify|audit [scope]"`
2. Command file loads workflow `workflows/citations.md` via `@-reference`
3. Workflow classifies based on subcommand:
   - `generate` / `update`: write operation with pipeline stages 4-8
   - `verify` / `audit`: read operation with no pipeline stages

### Write subcommands (generate, update)

4. Orchestrate delegates to citations engine with Write Phase (stages 1-3 N/A, starts at citation work)
5. Orchestrate delegates Review Phase (stages 4-5) to validate engine
6. Orchestrate handles Finalize Phase (stages 6-8) itself

### Read subcommands (verify, audit)

4. Orchestrate delegates to citations engine (2-agent fast path)
5. No pipeline stages triggered

## Pipeline Stages

- Write subcommands (generate, update): stages 4, 5, 6, 7, 8
- Read subcommands (verify, audit): none

## Expected Markers

### Write subcommands (generate, update)
- Pipeline completion: `Pipeline complete: [verbosity: ...] [citations: ...] ...`
- Changelog: `changelog updated` or `updated changelog`
- Delegation: `delegation result` or `agents used`

### Read subcommands (verify, audit)
- No `Pipeline complete:` marker
- No `changelog updated` marker

## Files Typically Touched

### Write subcommands
- Target documentation file(s) with citation sections
- docs/changelog.md (stage 6)

### Read subcommands
- No files modified (read-only)

## Error Paths

- Invalid subcommand: engine reports valid options (generate, update, verify, audit)
- Citation source file not found: engine flags citation as broken
- Scope resolves to no files: engine reports empty scope

## Edge Cases

- Citations generate on a file with no code references: engine reports nothing to cite
- Citations verify finds stale line numbers: engine reports specific stale citations
- Citations audit with deep source comparison
