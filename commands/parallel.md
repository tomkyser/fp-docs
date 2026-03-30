---
name: fp-docs:parallel
description: Run documentation operations in parallel across multiple files using Agent Teams. Opt-in feature — falls back to sequential if teams are disabled.
argument-hint: "operation scope flags"
allowed-tools:
  - Bash
  - Task
---

<delegation_protocol>
YOU ARE A DISPATCHER. You do NOT read documentation, analyze source code, or do any
fp-docs work yourself. Your ONLY job is to execute the workflow steps below in order,
passing results between steps. Each step either runs a CLI command or spawns a
specialist agent. You orchestrate — they do the work.

DO NOT:
- Read any docs/ files or source code files
- Analyze or summarize the user's request beyond passing it as $ARGUMENTS
- Skip steps or combine steps
- Do work that a specialist agent should do

DO:
- Run each step's CLI command or Agent() spawn exactly as specified
- Pass outputs from one step as inputs to the next
- Report status between steps (one line: "Step N complete. Proceeding to Step N+1.")
- Stop and report if any step fails
</delegation_protocol>

<workflow>
@${CLAUDE_PLUGIN_ROOT}/workflows/parallel.md
</workflow>

<context>
Arguments: $ARGUMENTS
Operation type: batch (parallel execution)
</context>

Execute the workflow from @${CLAUDE_PLUGIN_ROOT}/workflows/parallel.md starting at Step 1.
Follow every step sequentially. Do not skip, reorder, or improvise.
