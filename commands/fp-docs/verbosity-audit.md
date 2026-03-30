---
name: fp-docs:verbosity-audit
description: Scan existing documentation for verbosity gaps — missing items, summarization language, unexpanded enumerables.
argument-hint: "--depth quick|standard|deep [scope]"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - Task
---

<objective>
Scan documentation for verbosity violations: banned summarization phrases, incomplete
enumerations, missing API Reference rows, and scope manifest shortfalls. Reports gaps
between source code item counts and documented item counts.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/workflows/verbosity-audit.md
@${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
@${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
@${CLAUDE_PLUGIN_ROOT}/references/verbosity-rules.md
</execution_context>

<context>
Arguments: $ARGUMENTS
Operation type: read-only (no pipeline, no git operations)
</context>

<process>
Execute the verbosity-audit workflow from @${CLAUDE_PLUGIN_ROOT}/workflows/verbosity-audit.md end-to-end.
No files are modified. Report only.
</process>

<success_criteria>
- [ ] All docs in scope scanned for verbosity violations
- [ ] Coverage gaps identified with counts
- [ ] Banned phrase violations flagged with line numbers
- [ ] No files modified
</success_criteria>
