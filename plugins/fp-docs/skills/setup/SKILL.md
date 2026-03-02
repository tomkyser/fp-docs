---
name: setup
description: Initialize or verify the fp-docs plugin installation. Checks plugin structure, docs repo setup, codebase gitignore, and branch sync state.
argument-hint: ""
context: fork
agent: docs-system
---

Operation: setup

Verify AND initialize the fp-docs system:

### Phase 1: Plugin Verification
1. Check all required directories exist (agents/, skills/, hooks/, scripts/, framework/)
2. Validate plugin.json manifest
3. Verify all 8 engine agent files exist
4. Verify all 19 user skill files exist + 10 shared modules
5. Verify hooks.json and hook scripts are executable

### Phase 2: Docs Repo Setup
1. Detect codebase root: `git rev-parse --show-toplevel`
2. Check if docs repo exists at {codebase-root}/themes/foreign-policy-2017/docs/.git
3. If docs repo NOT found:
   a. Ask user: "The docs repo is not set up. Clone it now? (requires git access to https://github.com/tomkyser/docs-foreignpolicy-com)"
   b. If yes: `git clone https://github.com/tomkyser/docs-foreignpolicy-com {codebase-root}/themes/foreign-policy-2017/docs`
   c. If no: note as "docs repo not configured" and continue
4. If docs repo found: verify remote URL and branch state

### Phase 3: Codebase Gitignore Check
1. Check if `themes/foreign-policy-2017/docs/` is in the codebase repo's .gitignore
2. If NOT present: warn user and offer to add it
3. If present: confirm

### Phase 4: Branch Sync
1. If docs repo is set up: detect codebase branch and docs branch
2. If mismatched: offer to run sync
3. Report overall three-repo health

$ARGUMENTS
