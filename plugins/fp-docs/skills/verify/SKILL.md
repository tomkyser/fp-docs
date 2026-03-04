---
description: Run the 10-point verification checklist on documentation files without making changes. Reports pass/fail for each check.
argument-hint: "optional scope like docs/06-helpers/"
context: fork
agent: orchestrate
---

Engine: validate
Operation: verify
Instruction: framework/instructions/validate/verify.md

User scope: $ARGUMENTS
