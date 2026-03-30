<purpose>
Regenerate the codebase CLAUDE.md from current plugin state.
Reads plugin manifest, skill inventory, and project configuration,
then regenerates the skills table, documentation links, and project config sections.
Write operation -- triggers pipeline.
</purpose>

<required_reading>
Read all files referenced by the invoking command's execution_context.
</required_reading>

<process>

<step name="initialize" priority="first">
## 1. Initialize

```bash
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init admin-op update-claude "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```
</step>

<step name="gather">
## 2. Gather Current State

1. Read the current project CLAUDE.md (from codebase root, not plugin)
2. Read the plugin manifest at `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json`
3. Read the current command inventory: glob `${CLAUDE_PLUGIN_ROOT}/commands/fp-docs/*.md`
4. Extract command names, descriptions, and argument hints from each command's frontmatter
</step>

<step name="regenerate">
## 3. Regenerate Sections

1. Regenerate the skills/commands table from discovered inventory
2. Update documentation links to match current doc structure
3. Update project configuration sections from current config
4. Preserve any user-customized sections (marked with comments)
5. Write the updated CLAUDE.md
</step>

<step name="pipeline">
## 4. Pipeline Enforcement

### Write Phase (Stages 1-2)
Run verbosity enforcement and citation updates.

### Review Phase (Stages 4-5)
```bash
VALIDATOR_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-validator --raw)
```
Spawn validator agent for sanity-check and 10-point verification.

### Finalize Phase (Stages 6-8)
```bash
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline run-stage 6  # changelog
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline run-stage 7  # index
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline run-stage 8  # docs commit
```
</step>

</process>

<success_criteria>
- [ ] Current CLAUDE.md read from codebase root
- [ ] Plugin manifest and skill inventory gathered
- [ ] Skills table regenerated from current inventory
- [ ] Documentation links updated
- [ ] Pipeline stages completed
</success_criteria>
