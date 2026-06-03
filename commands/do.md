---
name: fp-docs:do
description: "Route natural language to the right fp-docs command. Describe what you want to do and the system matches your intent to the best command."
argument-hint: "what you want to do"
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
@${CLAUDE_PLUGIN_ROOT}/workflows/do.md
</workflow>

<context>
Arguments: $ARGUMENTS
Operation type: meta (inline routing, no agent spawning)
</context>

Execute the workflow from @${CLAUDE_PLUGIN_ROOT}/workflows/do.md starting at Step 1.
Follow every step sequentially. Do not skip, reorder, or improvise.
