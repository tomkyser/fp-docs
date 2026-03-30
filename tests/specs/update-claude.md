---
command: update-claude
engine: index
operation: update-example-claude
workflow: workflows/update-claude.md
agent: fp-docs-indexer
type: admin
pipeline_stages: none
subcommands: none
flags: none
---

# /fp-docs:update-claude - Behavioral Specification

## Routing Path

1. User invokes `/fp-docs:update-claude`
2. Command file loads workflow `workflows/update-claude.md` via `@-reference`
3. Workflow initializes via `fp-tools init admin-op`
4. Workflow spawns fp-docs-indexer for CLAUDE.md regeneration
5. No full pipeline triggered -- admin operation with direct execution

## Pipeline Stages

None. Admin operations execute directly without the 8-stage pipeline.

## Expected Markers

- No `Pipeline complete:` marker (admin operation skips full pipeline)
- CLAUDE.md update markers in engine output

## Files Typically Touched

- Project CLAUDE.md (Documentation Skills section regenerated)
- Reads plugin.json and routing table for current plugin state

## Error Paths

- CLAUDE.md not found: engine reports missing file
- Manifest not found: engine reports missing manifest
- Skills inventory has changed: engine reports what was added/removed

## Edge Cases

- Update-claude when no skills have changed: engine reports no changes needed
- Update-claude when CLAUDE.md has custom sections: engine preserves non-generated sections
