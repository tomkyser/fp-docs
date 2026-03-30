---
name: fp-docs:update-skills
description: Regenerate all plugin skills from the current prompt definitions. Syncs skill files with the source-of-truth prompts.
argument-hint: ""
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - Task
---

<objective>
Regenerate command files from current definitions. Verifies all commands are properly
registered and reports any stale or orphaned command files.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/workflows/update-skills.md
@${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
@${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
</execution_context>

<context>
Arguments: $ARGUMENTS
Operation type: admin (system maintenance)
</context>

<process>
Execute the update-skills workflow from @${CLAUDE_PLUGIN_ROOT}/workflows/update-skills.md end-to-end.
</process>

<success_criteria>
- [ ] Command files regenerated from definitions
- [ ] All commands properly registered
- [ ] Stale or orphaned files reported
</success_criteria>
