---
name: fp-docs:update-claude
description: Regenerate the CLAUDE.md template with current skill inventory, documentation links, and project configuration.
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
Regenerate the CLAUDE.md template with current command inventory, documentation links,
and project configuration. Reads current plugin state and updates the template.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/workflows/update-claude.md
@${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
@${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
</execution_context>

<context>
Arguments: $ARGUMENTS
Operation type: admin (system maintenance)
</context>

<process>
Execute the update-claude workflow from @${CLAUDE_PLUGIN_ROOT}/workflows/update-claude.md end-to-end.
</process>

<success_criteria>
- [ ] CLAUDE.md template regenerated with current structure
- [ ] Command inventory reflects all 23 commands
- [ ] Documentation links updated
</success_criteria>
