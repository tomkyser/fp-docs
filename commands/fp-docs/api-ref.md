---
name: fp-docs:api-ref
description: Generate or update API Reference sections in documentation files. Extracts function signatures from source code and creates formatted reference tables.
argument-hint: "generate|audit [scope]"
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
Manage API Reference sections in documentation files. Supports two subcommands: generate
(create/update API reference tables from source code) and audit (verify existing tables
match source code).
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/workflows/api-ref.md
@${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
@${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
@${CLAUDE_PLUGIN_ROOT}/references/api-ref-rules.md
@${CLAUDE_PLUGIN_ROOT}/references/pipeline-enforcement.md
</execution_context>

<context>
Arguments: $ARGUMENTS
Parse the first word as the subcommand (generate|audit).
Pass remaining arguments as scope.
Operation type: write for generate, read-only for audit
</context>

<process>
Execute the api-ref workflow from @${CLAUDE_PLUGIN_ROOT}/workflows/api-ref.md end-to-end.
For generate: full pipeline enforcement.
For audit: report only, no file modifications.
</process>

<success_criteria>
- [ ] Subcommand correctly parsed and routed
- [ ] API Reference tables managed per subcommand intent
- [ ] Write operations: pipeline completed, docs committed
- [ ] Read operations: report generated, no files modified
</success_criteria>
