---
name: fp-docs:test
description: Execute runtime validations against the local development environment. Tests REST endpoints, WP-CLI commands, template rendering, and visual verification via browser automation.
argument-hint: "test scope like rest-api|cli|templates|visual"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - Task
---

<objective>
Test documentation claims against the live local development environment. Supports testing
REST API endpoints, CLI commands, template file existence, and visual page rendering.
Requires ddev running with foreignpolicy.local accessible.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/workflows/test.md
@${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
@${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
@${CLAUDE_PLUGIN_ROOT}/references/validation-rules.md
</execution_context>

<context>
Arguments: $ARGUMENTS
Operation type: read-only (no pipeline, no git operations)
</context>

<process>
Execute the test workflow from @${CLAUDE_PLUGIN_ROOT}/workflows/test.md end-to-end.
No documentation files are modified. Test commands and screenshots only.
</process>

<success_criteria>
- [ ] Local development environment verified
- [ ] All test scopes executed or skipped with reason
- [ ] Per-scope pass/fail results reported
- [ ] No documentation files modified
</success_criteria>
