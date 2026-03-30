---
name: fp-docs:deprecate
description: Mark documentation as deprecated when code has been removed or replaced. Updates the doc with deprecation notice and updates trackers.
argument-hint: "description of deprecated code"
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
Mark documentation as deprecated or removed. For deprecated code, adds [LEGACY] markers
and deprecation notices. For removed code, adds REMOVED notices and updates indexes.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/workflows/deprecate.md
@${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
@${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
@${CLAUDE_PLUGIN_ROOT}/references/pipeline-enforcement.md
</execution_context>

<context>
Arguments: $ARGUMENTS
Operation type: write (full pipeline required)
</context>

<process>
Execute the deprecate workflow from @${CLAUDE_PLUGIN_ROOT}/workflows/deprecate.md end-to-end.
Preserve all pipeline gates (verbosity, citations, API refs, sanity-check, verification,
changelog, index, docs commit).
</process>

<success_criteria>
- [ ] Documentation marked as deprecated or removed
- [ ] Cross-references updated
- [ ] Pipeline enforcement stages completed
- [ ] Changelog entry added
- [ ] Docs committed and pushed
</success_criteria>
