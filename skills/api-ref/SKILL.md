---
name: api-ref
description: Generate or update API Reference sections in documentation files. Extracts function signatures from source code and creates formatted reference tables.
argument-hint: "generate|audit [scope]"
context: fork
agent: docs-api-refs
---

$ARGUMENTS

Parse the first word as the subcommand (generate|audit).
Read the instruction file at `framework/instructions/api-refs/{subcommand}.md` and follow it exactly.
Pass remaining arguments as scope.
