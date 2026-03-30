---
name: fp-docs:auto-revise
description: Batch-process all items listed in the needs-revision-tracker. Reads the tracker, processes each item, and marks them complete.
argument-hint: "optional flags like --dry-run"
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
Process the needs-revision tracker, selecting pending items and executing revise operations
for each. Each item gets its own revise cycle with pipeline enforcement.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/workflows/auto-revise.md
@${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
@${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
@${CLAUDE_PLUGIN_ROOT}/references/pipeline-enforcement.md
</execution_context>

<context>
Arguments: $ARGUMENTS
Operation type: write (full pipeline required)
</context>

<process>
Execute the auto-revise workflow from @${CLAUDE_PLUGIN_ROOT}/workflows/auto-revise.md end-to-end.
Preserve all pipeline gates (verbosity, citations, API refs, sanity-check, verification,
changelog, index, docs commit).
</process>

<success_criteria>
- [ ] Selected tracker items processed
- [ ] Each item revised with pipeline enforcement
- [ ] Tracker updated (completed/failed items)
- [ ] Changelog entry added
- [ ] Docs committed and pushed
</success_criteria>
