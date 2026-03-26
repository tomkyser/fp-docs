---
command: update-claude
engine: index
operation: update-example-claude
instruction: framework/instructions/index/update-example-claude.md
agent: orchestrate
context: fork
type: write
pipeline_stages: none
subcommands: none
flags: none
---

# /fp-docs:update-claude - Behavioral Specification

## Routing Path

1. User invokes `/fp-docs:update-claude`
2. Skill SKILL.md passes context to orchestrate engine (reads project CLAUDE.md and manifest)
3. Orchestrate classifies as admin/write operation (engine: index)
4. Orchestrate delegates directly to index engine
5. No full pipeline triggered -- admin operation with direct execution

## Pipeline Stages

None. Admin operations execute directly without the 8-stage pipeline.

## Expected Markers

- No `Pipeline complete:` marker (admin operation skips full pipeline)
- CLAUDE.md update markers in engine output

## Files Typically Touched

- Project CLAUDE.md (Documentation Skills section regenerated)
- Reads framework/manifest.md for current plugin state

## Error Paths

- CLAUDE.md not found: engine reports missing file
- Manifest not found: engine reports missing manifest
- Skills inventory has changed: engine reports what was added/removed

## Edge Cases

- Update-claude when no skills have changed: engine reports no changes needed
- Update-claude when CLAUDE.md has custom sections: engine preserves non-generated sections
