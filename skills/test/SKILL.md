---
description: Execute runtime validations against the local development environment. Tests REST endpoints, WP-CLI commands, template rendering, and visual verification via browser automation.
argument-hint: "test scope like rest-api|cli|templates|visual"
context: fork
agent: orchestrate
---

Engine: validate
Operation: test
Instruction: framework/instructions/validate/test.md

User scope: $ARGUMENTS
