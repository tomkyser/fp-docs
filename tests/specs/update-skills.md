---
command: update-skills
engine: system
operation: update-skills
instruction: framework/instructions/system/update-skills.md
agent: orchestrate
context: fork
type: admin
pipeline_stages: none
subcommands: none
flags: none
---

# /fp-docs:update-skills - Behavioral Specification

## Routing Path

1. User invokes `/fp-docs:update-skills`
2. Skill SKILL.md passes context to orchestrate engine
3. Orchestrate classifies as admin operation (engine: system)
4. Orchestrate delegates directly to system engine
5. No pipeline triggered -- admin operation with direct execution

## Pipeline Stages

None. Admin operations execute directly without the 8-stage pipeline.

## Expected Markers

- No `Pipeline complete:` marker (admin operation)
- Skills regeneration report in engine output

## Files Typically Touched

- skills/*/SKILL.md files (regenerated from prompt definitions)
- Preserves customizations in existing skill files

## Error Paths

- Prompt definitions not found: engine reports missing source
- Skill file write failure: engine reports file system error

## Edge Cases

- Update-skills when all skills are already current: engine reports no changes
- Update-skills when a new prompt has been added: engine creates new skill file
- Update-skills preserves any manual customizations in existing SKILL.md files
