---
name: fp-docs:sync
description: Synchronize the docs repo branch with the codebase branch. Creates or switches docs branches, generates diff reports, and optionally merges docs branches.
argument-hint: "[merge] [--force]"
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
Synchronize the docs repo branch with the codebase branch. Detects current branches,
creates or switches docs branch to match codebase, generates diff reports, and optionally
merges docs feature branches.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/workflows/sync.md
@${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
@${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
@${CLAUDE_PLUGIN_ROOT}/references/git-sync-rules.md
</execution_context>

<context>
Arguments: $ARGUMENTS
Operation type: admin (system maintenance)
Subcommands: (no args) = detect and sync, merge = merge docs branch, --force = force switch
</context>

<process>
Execute the sync workflow from @${CLAUDE_PLUGIN_ROOT}/workflows/sync.md end-to-end.
Follow git sync rules from the referenced algorithm.
</process>

<success_criteria>
- [ ] Branch states detected for codebase and docs repos
- [ ] Docs branch matched to codebase branch
- [ ] Diff report generated
- [ ] No uncommitted changes lost
</success_criteria>
