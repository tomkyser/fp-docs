---
command: update-skills
engine: system
operation: update-skills
workflow: workflows/update-skills.md
agent: fp-docs-system
type: admin
pipeline_stages: none
subcommands: none
flags: none
---

# /fp-docs:update-skills - Behavioral Specification

## Routing Path

1. User invokes `/fp-docs:update-skills`
2. Command file loads workflow `workflows/update-skills.md` via `@-reference`
3. Workflow initializes via `fp-tools init admin-op`
4. Workflow spawns fp-docs-system for command file regeneration
5. No pipeline triggered -- admin operation with direct execution

## Pipeline Stages

None. Admin operations execute directly without the 8-stage pipeline.

## Expected Markers

- No `Pipeline complete:` marker (admin operation)
- Skills regeneration report in engine output

## Files Typically Touched

- commands/*.md files (regenerated from current definitions)
- Preserves customizations in existing command files

## Error Paths

- Prompt definitions not found: engine reports missing source
- Skill file write failure: engine reports file system error

## Edge Cases

- Update-skills when all skills are already current: engine reports no changes
- Update-skills when a new prompt has been added: engine creates new skill file
- Update-skills preserves any manual customizations in existing SKILL.md files
