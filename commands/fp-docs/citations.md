---
name: fp-docs:citations
description: "Manage code citations in documentation files. Subcommands: generate (create new), update (refresh stale), verify (check format), audit (deep accuracy check)."
argument-hint: "generate|update|verify|audit [scope]"
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
Manage code citations in documentation files. Supports four subcommands: generate (create
new citations), update (refresh stale citations), verify (check citation format), and
audit (deep accuracy check against source code).
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/workflows/citations.md
@${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
@${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
@${CLAUDE_PLUGIN_ROOT}/references/citation-rules.md
@${CLAUDE_PLUGIN_ROOT}/references/pipeline-enforcement.md
</execution_context>

<context>
Arguments: $ARGUMENTS
Parse the first word as the subcommand (generate|update|verify|audit).
Pass remaining arguments as scope.
Operation type: write for generate/update, read-only for verify/audit
</context>

<process>
Execute the citations workflow from @${CLAUDE_PLUGIN_ROOT}/workflows/citations.md end-to-end.
For write subcommands (generate, update): full pipeline enforcement.
For read subcommands (verify, audit): report only, no file modifications.
</process>

<success_criteria>
- [ ] Subcommand correctly parsed and routed
- [ ] Citations managed per subcommand intent
- [ ] Write operations: pipeline completed, docs committed
- [ ] Read operations: report generated, no files modified
</success_criteria>
