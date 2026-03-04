---
description: Generate or update API Reference sections in documentation files. Extracts function signatures from source code and creates formatted reference tables.
argument-hint: "generate|audit [scope]"
context: fork
agent: orchestrate
---

Engine: api-refs
Operation: (subcommand)
Instruction: framework/instructions/api-refs/{subcommand}.md

$ARGUMENTS

Parse the first word as the subcommand (generate|audit).
Pass remaining arguments as scope.
