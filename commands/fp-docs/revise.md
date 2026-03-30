---
name: fp-docs:revise
description: Fix specific documentation you know is wrong or outdated. Provide a description of what needs fixing and the engine will locate, update, and validate the affected docs.
argument-hint: "description of what to fix"
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
Locate, update, and validate documentation that the user identifies as wrong or outdated.
The workflow handles research, planning, modification, pipeline enforcement (verbosity,
citations, API refs, sanity-check, verification), changelog, index update, and git commit.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/workflows/revise.md
@${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
@${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
@${CLAUDE_PLUGIN_ROOT}/references/pipeline-enforcement.md
</execution_context>

<context>
Arguments: $ARGUMENTS
Operation type: write (full pipeline required)
</context>

<process>
Execute the revise workflow from @${CLAUDE_PLUGIN_ROOT}/workflows/revise.md end-to-end.
Preserve all pipeline gates (verbosity, citations, API refs, sanity-check, verification,
changelog, index, docs commit).
</process>

<success_criteria>
- [ ] Target documentation identified and updated
- [ ] All claims verified against source code
- [ ] Pipeline enforcement stages completed
- [ ] Changelog entry added
- [ ] Docs committed and pushed
</success_criteria>
