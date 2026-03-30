---
name: fp-docs:locals
description: "Manage locals contract documentation for WordPress template components. Subcommands: annotate, contracts, cross-ref, validate, shapes, coverage."
argument-hint: "annotate|contracts|cross-ref|validate|shapes|coverage [scope]"
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
Manage $locals contract documentation for WordPress template components. Supports six
subcommands: annotate (add @locals PHPDoc), contracts (generate/update tables), cross-ref
(cross-reference controllers), validate (check accuracy), shapes (document shared shapes),
and coverage (report coverage gaps).
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/workflows/locals.md
@${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
@${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
@${CLAUDE_PLUGIN_ROOT}/references/locals-rules.md
@${CLAUDE_PLUGIN_ROOT}/references/pipeline-enforcement.md
</execution_context>

<context>
Arguments: $ARGUMENTS
Parse the first word as the subcommand (annotate|contracts|cross-ref|validate|shapes|coverage).
Pass remaining arguments as scope.
Operation type: write for annotate/contracts/shapes, read-only for cross-ref/validate/coverage
</context>

<process>
Execute the locals workflow from @${CLAUDE_PLUGIN_ROOT}/workflows/locals.md end-to-end.
For write subcommands: full pipeline enforcement.
For read subcommands: report only, no file modifications.
</process>

<success_criteria>
- [ ] Subcommand correctly parsed and routed
- [ ] Locals contracts managed per subcommand intent
- [ ] Write operations: pipeline completed, docs committed
- [ ] Read operations: report generated, no files modified
</success_criteria>
