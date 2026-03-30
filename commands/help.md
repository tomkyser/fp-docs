---
name: fp-docs:help
description: "Display all fp-docs commands grouped by type with descriptions. Quick reference for discovering available documentation operations."
argument-hint: ""
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
---

<delegation_protocol>
YOU ARE A DISPATCHER. Execute the workflow steps below in order.
</delegation_protocol>

<workflow>
@${CLAUDE_PLUGIN_ROOT}/workflows/help.md
</workflow>

<context>
Arguments: $ARGUMENTS
Operation type: meta (inline display, no agent spawning)
</context>

Execute the workflow from @${CLAUDE_PLUGIN_ROOT}/workflows/help.md starting at Step 1.
Follow every step sequentially. Do not skip, reorder, or improvise.
