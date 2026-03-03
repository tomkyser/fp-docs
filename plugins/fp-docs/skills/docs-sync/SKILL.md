---
name: docs-sync
description: Synchronize the docs repo branch with the codebase branch. Creates or switches docs branches, generates diff reports, and optionally merges docs branches.
argument-hint: "[merge] [--force]"
context: fork
agent: docs-system
---

Operation: sync

Read the git sync rules at `framework/algorithms/git-sync-rules.md` and follow the sync flow.

Context about current branch state is available in your session context (injected by SessionStart hook).

Subcommands:
- (no args): Detect branches, create/switch docs branch to match codebase, generate diff report
- merge: Merge current docs feature branch into docs master, push, clean up
- --force: Force branch switch even if there are uncommitted docs changes

$ARGUMENTS
