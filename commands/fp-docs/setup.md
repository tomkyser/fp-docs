---
name: fp-docs:setup
description: Initialize or verify the fp-docs plugin installation. Checks plugin structure, docs repo setup, codebase gitignore, and branch sync state.
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
Initialize or verify the fp-docs plugin installation. Runs through plugin verification,
docs repo setup, codebase gitignore check, branch sync, git hook installation, shell prompt
integration, and update notification setup.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/workflows/setup.md
@${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
@${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
</execution_context>

<context>
Arguments: $ARGUMENTS
Operation type: admin (system maintenance)
</context>

<process>
Execute the setup workflow from @${CLAUDE_PLUGIN_ROOT}/workflows/setup.md end-to-end.
</process>

<success_criteria>
- [ ] Plugin structure verified
- [ ] Docs repo checked and configured
- [ ] Branch sync state assessed
- [ ] Setup report generated
</success_criteria>
