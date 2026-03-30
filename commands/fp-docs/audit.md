---
name: fp-docs:audit
description: Compare documentation against source code and report discrepancies. Supports quick, standard, and deep audit depths.
argument-hint: "--depth quick|standard|deep [scope]"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - Task
---

<objective>
Compare documentation against source code and report discrepancies. Identifies MISSING,
STALE, BROKEN, and ORPHAN docs. Generates remediation recommendations with specific
command suggestions.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/workflows/audit.md
@${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
@${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
@${CLAUDE_PLUGIN_ROOT}/references/validation-rules.md
</execution_context>

<context>
Arguments: $ARGUMENTS
Operation type: read-only (no pipeline, no git operations)
</context>

<process>
Execute the audit workflow from @${CLAUDE_PLUGIN_ROOT}/workflows/audit.md end-to-end.
No files are modified. Report only.
</process>

<success_criteria>
- [ ] All docs in scope scanned at requested depth
- [ ] Issues categorized (MISSING, STALE, BROKEN, ORPHAN, CITATION)
- [ ] Remediation commands recommended per issue
- [ ] No files modified
</success_criteria>
