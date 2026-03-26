# Update Example CLAUDE.md — Instruction

## Inputs
- Preloaded modules: mod-standards, mod-project, mod-index

## Steps

1. Read the current project CLAUDE.md (from codebase, not plugin).
2. Read the current plugin manifest at `{plugin-root}/framework/manifest.md`.
3. Read the current skill inventory from `{plugin-root}/skills/*/SKILL.md`.
4. Regenerate the skills table, documentation links, and project configuration sections.
5. Write the updated CLAUDE.md.

**Pipeline context:** When invoked as pipeline stage 7, the CJS pipeline engine handles skip logic (`node {plugin-root}/fp-tools.cjs pipeline run-stage 7`). This instruction file is used when the index engine runs the actual update after CJS determines it is needed.

## Output
Report: sections updated, skills listed.
