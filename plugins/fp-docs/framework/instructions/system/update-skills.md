# Update Skills — Instruction

## Inputs
- Preloaded modules: docs-mod-standards, docs-mod-project

## Steps

1. Read the plugin manifest at `{plugin-root}/framework/manifest.md`.

2. List all skill files: glob `{plugin-root}/skills/*/SKILL.md`.

3. For each skill file:
   a. Read the YAML frontmatter
   b. Verify `name`, `description`, `agent`, and `context: fork` fields exist
   c. Verify the referenced agent exists in `{plugin-root}/agents/`
   d. Check that `argument-hint` is present for user-facing skills

4. Compare discovered skills against the manifest's Commands table.
   - Missing from manifest → report as "unregistered skill"
   - In manifest but file missing → report as "orphaned manifest entry"

5. List all module files: glob `{plugin-root}/modules/*/SKILL.md`.

6. For each module:
   a. Verify `disable-model-invocation: true` and `user-invocable: false`
   b. Check which engine(s) preload it (from manifest Shared Modules table)

7. Regenerate the manifest Commands table and Shared Modules table from discovered files.

8. If differences found: update `framework/manifest.md` with regenerated tables.

## Output

Report: skills discovered, modules discovered, manifest changes applied (if any).
