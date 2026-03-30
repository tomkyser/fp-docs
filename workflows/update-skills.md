<purpose>
Regenerate plugin command inventory from current definitions.
Validates all command files, checks agent references, compares against README,
and updates the README commands table if discrepancies are found.
Admin operation -- no pipeline.
</purpose>

<required_reading>
Read all files referenced by the invoking command's execution_context.
</required_reading>

<process>

<step name="initialize" priority="first">
## 1. Initialize

```bash
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init admin-op update-skills "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```
</step>

<step name="discover">
## 2. Discover Commands

1. Read the plugin README.md
2. List all command files: glob `${CLAUDE_PLUGIN_ROOT}/commands/fp-docs/*.md`
3. For each command file:
   a. Read the YAML frontmatter
   b. Verify `name`, `description`, and `allowed-tools` fields exist
   c. Verify the referenced workflow exists in `${CLAUDE_PLUGIN_ROOT}/workflows/`
   d. Check that `argument-hint` is present
</step>

<step name="validate-references">
## 3. Validate References

1. For each command: verify `@-reference` paths in `<execution_context>` resolve to existing files
2. For each referenced agent: verify agent file exists in `${CLAUDE_PLUGIN_ROOT}/agents/`
3. For each referenced workflow: verify workflow file exists in `${CLAUDE_PLUGIN_ROOT}/workflows/`
</step>

<step name="compare">
## 4. Compare and Update

1. Compare discovered commands against README Commands table
   - Missing from README -> report as "unregistered command"
   - In README but file missing -> report as "orphaned README entry"
2. If differences found: update README.md with regenerated commands table
</step>

</process>

<success_criteria>
- [ ] All command files discovered and validated
- [ ] All @-reference paths resolve
- [ ] All agent and workflow references valid
- [ ] README commands table matches actual inventory
</success_criteria>
