<purpose>
First-time setup and configuration for the fp-docs plugin.
Verifies plugin structure, docs repo, codebase gitignore, branch sync,
git hooks, shell prompt integration, and update notifications.
Admin operation -- no pipeline.
</purpose>

<required_reading>
DO NOT read reference files yourself. Each step below specifies which files
its specialist agent will read via files_to_read. You are a dispatcher — pass
arguments and results between steps, nothing more.
</required_reading>

<process>

<step name="initialize" priority="first">
## 1. Initialize

```bash
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init admin-op setup "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON for: operation context, paths, system state.
</step>

<step name="verify-structure">
## 2. Plugin Structure Verification

1. Verify all required directories exist: `agents/`, `commands/`, `workflows/`, `references/`, `templates/`, `hooks/`, `lib/`
2. Validate `.claude-plugin/plugin.json` manifest has required fields (name, version, description)
3. Verify all 10 agent files exist in `agents/`
4. Verify all 23 command files exist in `commands/`
5. Run health check: `node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" health check`
</step>

<step name="docs-repo">
## 3. Docs Repo Setup

1. Detect codebase root: `git rev-parse --show-toplevel`
2. Check if docs repo exists at `{codebase-root}/themes/foreign-policy-2017/docs/.git`
3. If NOT found: advise user to clone docs repo
4. If found: verify remote URL and branch state
</step>

<step name="git-exclusions">
## 4. Git Exclusion Setup

Configure the codebase repo to exclude fp-docs-related paths.
Uses `.git/info/exclude` (per-clone, branch-safe) as the primary method.

1. Read `{codebase-root}/.git/info/exclude`
2. For each required exclusion path, check if already present:
   a. `themes/foreign-policy-2017/docs/` — the docs repo (separate git repo)
   b. `.claude/` — Claude Code working directory
   c. `.fp-docs/` — fp-docs global state directory
3. For each missing entry, append with comment:
   ```
   # fp-docs: exclude documentation repo (separate git repo)
   themes/foreign-policy-2017/docs/
   # fp-docs: exclude Claude Code working directory
   .claude/
   # fp-docs: exclude fp-docs global state
   .fp-docs/
   ```
4. Also check `.gitignore` as a fallback — if any path is already in `.gitignore`, accept it as valid (don't require both methods).
5. If `.git/info/exclude` is not writable, warn user and suggest manual `.gitignore` addition.
6. Report which paths were already excluded and which were added.
</step>

<step name="branch-sync">
## 5. Branch Sync

1. Detect codebase branch and docs branch
2. If mismatched: offer to run sync
3. Report overall three-repo health
</step>

<step name="git-hooks">
## 6. Git Hook Installation

1. Check if `.git/hooks/post-merge` exists (backup if so)
2. Install drift analysis hooks via `node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" drift install --codebase-root {codebase-root}`
3. Verify both hooks installed and executable
</step>

<step name="shell-integration">
## 7. Shell Prompt Integration

1. Run `node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" drift shell-install --codebase-root {codebase-root}`
2. Verify baked output file has no remaining placeholders
3. Verify precmd function and hook registration present
4. Output the source line for user's `.zshrc`
</step>

<step name="update-notifications">
## 8. Update Notification Setup

1. Copy statusline template: `cp "${CLAUDE_PLUGIN_ROOT}/templates/fp-docs-statusline.js" ~/.claude/hooks/fp-docs-statusline.js`
2. Guide user to add hook registration to `~/.claude/settings.json`
</step>

<step name="claude-md-check">
## 9. CLAUDE.md Integration Check

Check if codebase-root CLAUDE.md contains fp-docs configuration.
If not configured, warn: "Run /fp-docs:update-claude to configure."
</step>

</process>

<success_criteria>
- [ ] Plugin structure verified
- [ ] Docs repo detected and healthy
- [ ] Branch sync confirmed
- [ ] Git hooks installed
- [ ] Shell integration configured
- [ ] Setup report with per-phase pass/fail
</success_criteria>
