---
name: fp-docs:update
description: "Check for and install fp-docs plugin updates. Shows changelog from GitHub release notes, confirms before updating."
argument-hint: "[--check-only | --force]"
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
Check for and install fp-docs plugin updates. Shows changelog from GitHub release notes
and confirms before updating. Supports check-only mode and force mode.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/workflows/update.md
@${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
@${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
</execution_context>

<context>
Arguments: $ARGUMENTS
Operation type: admin (system maintenance)
</context>

<process>
Execute the update workflow from @${CLAUDE_PLUGIN_ROOT}/workflows/update.md end-to-end.
</process>

<success_criteria>
- [ ] Current version checked against latest release
- [ ] Changelog displayed if update available
- [ ] Update applied if confirmed (or check-only reported)
- [ ] Health check passes after update
</success_criteria>
