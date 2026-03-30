---
name: fp-docs:help
description: "Display all fp-docs commands grouped by type with descriptions. Quick reference for discovering available documentation operations."
argument-hint: ""
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
---

<objective>
Display a formatted command reference for all fp-docs commands grouped by category
(write, read, enrichment, admin, meta, batch) with descriptions and flags.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/workflows/help.md
@${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
@${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
</execution_context>

<context>
Arguments: $ARGUMENTS
Operation type: meta (inline display, no agent spawning)
</context>

<process>
Execute the help workflow from @${CLAUDE_PLUGIN_ROOT}/workflows/help.md end-to-end.
Display the grouped command reference directly to the user.
</process>

<success_criteria>
- [ ] All 23 commands displayed with descriptions
- [ ] Commands grouped by category
- [ ] Common flags listed
</success_criteria>
