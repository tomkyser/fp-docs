---
description: Initialize or verify the fp-docs plugin installation. Checks plugin structure, docs repo setup, codebase gitignore, and branch sync state.
argument-hint: ""
context: fork
agent: orchestrate
---

Engine: system
Operation: setup
Instruction: framework/instructions/system/setup.md

Verify AND initialize the fp-docs system:

### Phase 1: Plugin Verification
1. Check all required directories exist (agents/, skills/, hooks/, lib/, framework/)
2. Validate `.claude-plugin/plugin.json` manifest
3. Verify all 9 engine agent files exist
4. Verify all user skill files exist (at least 20 directories in skills/) + 11 shared modules
5. Verify hooks.json references CJS handlers and lib/ modules exist

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

### Phase 5: Git Hook Installation
1. Detect codebase root: `git rev-parse --show-toplevel`
2. Check if `.git/hooks/post-merge` already exists -- inform user of backup if so
3. Run: `node {plugin-root}/fp-tools.cjs drift install --codebase-root {codebase-root}`
4. Verify `.git/hooks/post-merge` and `.git/hooks/post-rewrite` exist and are executable

### Phase 6: Shell Prompt Integration
1. Run: `node {plugin-root}/fp-tools.cjs drift shell-install --codebase-root {codebase-root}`
2. Output the source line for user's .zshrc: `source "{codebase-root}/.fp-docs-shell.zsh"`
3. Inform user to add the source line to their .zshrc

### Important: CLAUDE.md Integration
After completing all phases, check if codebase CLAUDE.md contains fp-docs configuration. If not, include in setup report: "WARNING: CLAUDE.md not configured for fp-docs. Run `/fp-docs:update-claude` to configure."

$ARGUMENTS
