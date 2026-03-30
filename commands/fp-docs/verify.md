---
name: fp-docs:verify
description: Run the 10-point verification checklist on documentation files without making changes. Reports pass/fail for each check.
argument-hint: "optional scope like docs/06-helpers/"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - Task
---

<objective>
Run the full 10-point verification checklist against documentation files. Checks file
existence, orphans, index completeness, links, citations, API references, locals contracts,
and verbosity compliance.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/workflows/verify.md
@${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
@${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
@${CLAUDE_PLUGIN_ROOT}/references/validation-rules.md
</execution_context>

<context>
Arguments: $ARGUMENTS
Operation type: read-only (no pipeline, no git operations)
</context>

<process>
Execute the verify workflow from @${CLAUDE_PLUGIN_ROOT}/workflows/verify.md end-to-end.
No files are modified. Report only.
</process>

<success_criteria>
- [ ] All 10 verification checks executed
- [ ] Each check reported as PASS, FAIL, or SKIP
- [ ] Overall PASS/FAIL determination made
- [ ] No files modified
</success_criteria>
