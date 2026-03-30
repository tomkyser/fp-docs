---
name: fp-docs:do
description: "Route natural language to the right fp-docs command. Describe what you want to do and the system matches your intent to the best command."
argument-hint: "what you want to do"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
---

<objective>
Smart router that matches freeform natural language input to the most appropriate fp-docs
command. This is a dispatcher -- it never does the work itself.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/workflows/do.md
@${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
@${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
</execution_context>

<context>
Arguments: $ARGUMENTS
Operation type: meta (inline routing, no agent spawning)
</context>

<process>
Execute the do workflow from @${CLAUDE_PLUGIN_ROOT}/workflows/do.md end-to-end.
Match user intent to a command, display routing banner, auto-dispatch.
</process>

<success_criteria>
- [ ] User intent matched to correct fp-docs command
- [ ] Routing banner displayed
- [ ] Dispatched command executed
</success_criteria>
