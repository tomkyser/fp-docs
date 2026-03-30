---
name: fp-docs:verbosity-audit
description: Scan existing documentation for verbosity gaps — missing items, summarization language, unexpanded enumerables.
argument-hint: "--depth quick|standard|deep [scope]"
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
@${CLAUDE_PLUGIN_ROOT}/workflows/verbosity-audit.md
</workflow>

<context>
Arguments: $ARGUMENTS
Operation type: read (no pipeline, no git operations)
</context>

Execute the workflow from @${CLAUDE_PLUGIN_ROOT}/workflows/verbosity-audit.md starting at Step 1.
Follow every step sequentially. Do not skip, reorder, or improvise.
