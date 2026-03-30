---
name: fp-docs:remediate
description: "Resolve audit findings by dispatching to the right specialist engines. Takes audit output or a saved plan and orchestrates batch remediation."
argument-hint: "[plan-path | plan-number | --plan-only]"
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
Resolve audit findings by dispatching to the right specialist agents. Takes audit output
or a saved plan and orchestrates batch remediation of all identified issues.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/workflows/remediate.md
@${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
@${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
@${CLAUDE_PLUGIN_ROOT}/references/pipeline-enforcement.md
</execution_context>

<context>
Arguments: $ARGUMENTS
Operation type: write (batch remediation with full pipeline)
</context>

<process>
Execute the remediate workflow from @${CLAUDE_PLUGIN_ROOT}/workflows/remediate.md end-to-end.
Preserve all pipeline gates for each remediation action.
</process>

<success_criteria>
- [ ] Audit findings loaded (from plan or prior audit)
- [ ] Issues dispatched to appropriate specialist agents
- [ ] Pipeline enforcement completed per remediation
- [ ] Changelog entry added
- [ ] Docs committed and pushed
</success_criteria>
