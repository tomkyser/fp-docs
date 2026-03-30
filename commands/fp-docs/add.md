---
name: fp-docs:add
description: Create documentation for entirely new code that doesn't have docs yet. Describe the new code and the engine will analyze it and generate complete documentation.
argument-hint: "description of new code to document"
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
Create new documentation for undocumented code. The workflow analyzes the source code,
finds sibling docs for format templates, creates complete documentation, and runs the
full pipeline enforcement.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/workflows/add.md
@${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
@${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
@${CLAUDE_PLUGIN_ROOT}/references/pipeline-enforcement.md
</execution_context>

<context>
Arguments: $ARGUMENTS
Operation type: write (full pipeline required)
</context>

<process>
Execute the add workflow from @${CLAUDE_PLUGIN_ROOT}/workflows/add.md end-to-end.
Preserve all pipeline gates (verbosity, citations, API refs, sanity-check, verification,
changelog, index, docs commit).
</process>

<success_criteria>
- [ ] New documentation file created at correct path
- [ ] All content derived from actual source code
- [ ] Pipeline enforcement stages completed
- [ ] Parent index updated
- [ ] Docs committed and pushed
</success_criteria>
