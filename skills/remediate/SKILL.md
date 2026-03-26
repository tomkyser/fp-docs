---
description: "Resolve audit findings by dispatching to the right specialist engines. Takes audit output or a saved plan and orchestrates batch remediation."
argument-hint: "[plan-path | plan-number | --plan-only]"
context: fork
agent: orchestrate
---

Engine: orchestrate
Operation: remediate
Instruction: framework/instructions/orchestrate/remediate.md

User request: $ARGUMENTS
