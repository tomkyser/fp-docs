---
name: fp-docs:update-index
description: Refresh the PROJECT-INDEX.md codebase reference. Scans source files and updates the master index.
argument-hint: "update|full"
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
Refresh PROJECT-INDEX.md and source-map.json. Scans source files via git ls-tree and
updates the master index. Supports quick, update (default), and full modes.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/workflows/update-index.md
@${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
@${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
@${CLAUDE_PLUGIN_ROOT}/references/index-rules.md
</execution_context>

<context>
Arguments: $ARGUMENTS
Operation type: admin (system maintenance)
Mode: update (default) | quick | full
</context>

<process>
Execute the update-index workflow from @${CLAUDE_PLUGIN_ROOT}/workflows/update-index.md end-to-end.
</process>

<success_criteria>
- [ ] PROJECT-INDEX.md updated from git ls-tree
- [ ] source-map.json regenerated if structural changes
- [ ] Branch name recorded in index header
- [ ] File counts match git output
</success_criteria>
