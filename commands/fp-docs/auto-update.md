---
name: fp-docs:auto-update
description: Auto-detect code changes since last documentation update and handle everything. Scans git diff, identifies affected docs, and updates them.
argument-hint: "optional scope restriction"
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
Detect documentation affected by recent code changes and update it automatically. Uses git
diff to find changed source files, maps them to documentation targets via source-map, and
updates all affected docs with full pipeline enforcement.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/workflows/auto-update.md
@${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
@${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
@${CLAUDE_PLUGIN_ROOT}/references/pipeline-enforcement.md
</execution_context>

<context>
Arguments: $ARGUMENTS
Operation type: write (full pipeline required)
</context>

<process>
Execute the auto-update workflow from @${CLAUDE_PLUGIN_ROOT}/workflows/auto-update.md end-to-end.
Preserve all pipeline gates (verbosity, citations, API refs, sanity-check, verification,
changelog, index, docs commit).
</process>

<success_criteria>
- [ ] All documentation-relevant code changes identified
- [ ] Affected docs updated to reflect source changes
- [ ] Pipeline enforcement stages completed
- [ ] Changelog entry added
- [ ] Docs committed and pushed
</success_criteria>
