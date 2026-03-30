---
command: update-index
engine: index
operation: update-project-index
workflow: workflows/update-index.md
agent: fp-docs-indexer
type: admin
pipeline_stages: none
subcommands: update, full
flags: none
---

# /fp-docs:update-index - Behavioral Specification

## Routing Path

1. User invokes `/fp-docs:update-index "update|full"`
2. Command file loads workflow `workflows/update-index.md` via `@-reference`
3. Workflow initializes via `fp-tools init admin-op`
4. Workflow spawns fp-docs-indexer for index generation
5. No full pipeline triggered -- admin operation with direct execution

## Pipeline Stages

None. Admin operations execute directly without the 8-stage pipeline.

## Expected Markers

- No `Pipeline complete:` marker (admin operation skips full pipeline)
- Index update markers in engine output

## Files Typically Touched

- docs/PROJECT-INDEX.md (primary output)
- Source files scanned for index entries

## Error Paths

- Docs root not found: engine reports missing docs directory
- Source files inaccessible: engine reports read errors

## Edge Cases

- Update-index with `update` mode: incremental index refresh
- Update-index with `full` mode: complete index regeneration
- Update-index when PROJECT-INDEX.md does not exist: engine creates it
