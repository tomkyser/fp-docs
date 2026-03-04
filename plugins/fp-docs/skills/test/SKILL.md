---
description: Execute runtime validations against the local development environment. Tests REST endpoints, WP-CLI commands, and template rendering.
argument-hint: "test scope like rest-api|cli|templates"
context: fork
agent: orchestrate
---

Engine: validate
Operation: test
Instruction: framework/instructions/validate/test.md

User scope: $ARGUMENTS
