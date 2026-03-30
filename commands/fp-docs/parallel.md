---
name: fp-docs:parallel
description: Run documentation operations in parallel across multiple files using Agent Teams. Opt-in feature — falls back to sequential if teams are disabled.
argument-hint: "operation scope flags"
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
Run documentation operations in parallel across multiple files. Parses the operation,
scope, and flags, then uses Agent Teams for parallel execution. Falls back to sequential
processing if teams are not available.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/workflows/parallel.md
@${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
@${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
@${CLAUDE_PLUGIN_ROOT}/references/pipeline-enforcement.md
</execution_context>

<context>
Arguments: $ARGUMENTS
Parse arguments: operation (first word), scope (target files/sections), flags (remaining)
Operation type: batch (parallel execution)
</context>

<process>
Execute the parallel workflow from @${CLAUDE_PLUGIN_ROOT}/workflows/parallel.md end-to-end.
Requires CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS enabled.
</process>

<success_criteria>
- [ ] Operation and scope parsed from arguments
- [ ] Files partitioned into batches
- [ ] All batches processed (parallel or sequential fallback)
- [ ] Results aggregated
- [ ] Pipeline enforcement completed for write operations
</success_criteria>
