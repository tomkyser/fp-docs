# Setup — Instruction

## Inputs
- Preloaded modules: mod-standards, mod-project

## Steps

### Phase 1: Plugin Structure Verification
1. Verify all required directories exist:
   - `agents/` — should contain 9 engine files
   - `skills/` — should contain 23 user skill directories (21 routing-table commands + 2 meta-commands)
   - `modules/` — should contain 11 shared module directories
   - `hooks/` — should contain `hooks.json`
   - `lib/` — should contain CJS modules (hooks, locals-cli, git, pipeline, etc.)
   - `framework/config/` — should contain `system-config.md`, `project-config.md`
   - `framework/instructions/` — should contain instruction directories
   - `framework/algorithms/` — should contain on-demand algorithm files

2. Validate `.claude-plugin/plugin.json` manifest has required fields (name, version, description).

> **Note:** The plugin manifest (name, version, description) lives in `.claude-plugin/plugin.json`. Runtime configuration lives in `framework/config/system-config.md` and `framework/config/project-config.md`. Do NOT look for or create a root-level `config.json` — it does not exist.

3. Verify all 9 engine agent files exist:
   - `agents/orchestrate.md`
   - `agents/modify.md`
   - `agents/validate.md`
   - `agents/citations.md`
   - `agents/api-refs.md`
   - `agents/locals.md`
   - `agents/verbosity.md`
   - `agents/index.md`
   - `agents/system.md`

4. Verify all user skill files exist (23 directories in `skills/`) and all 11 shared modules exist.

5. Verify `hooks/hooks.json` is valid JSON and references existing CJS handler functions.

### Phase 2: Docs Repo Setup
1. Detect codebase root: `git rev-parse --show-toplevel`
2. Check if docs repo exists at `{codebase-root}/themes/foreign-policy-2017/docs/.git`
3. If NOT found: advise user to clone docs repo
4. If found: verify remote URL and branch state

### Phase 3: Codebase Gitignore Check
1. Check if `themes/foreign-policy-2017/docs/` is in the codebase repo's `.gitignore`
2. If NOT present: warn user and offer to add it
3. If present: confirm

### Phase 4: Branch Sync
1. If docs repo is set up: detect codebase branch and docs branch
2. If mismatched: offer to run sync
3. Report overall three-repo health

### Phase 5: Git Hook Installation
1. Detect codebase root via `git rev-parse --show-toplevel`
2. Check if `.git/hooks/post-merge` already exists
   - If exists: inform user it will be backed up to `post-merge.backup-fp-docs`
3. Run `node {plugin-root}/fp-tools.cjs drift install --codebase-root {codebase-root}`
4. Verify both hooks installed:
   - `.git/hooks/post-merge` exists and is executable
   - `.git/hooks/post-rewrite` exists and is executable
5. Report: "Git hooks installed. Drift analysis will run automatically after git pull/merge."

### Phase 6: Shell Prompt Integration
1. Run `node {plugin-root}/fp-tools.cjs drift shell-install --codebase-root {codebase-root}`
2. Verify the baked output file has NO remaining placeholders:
   - Read the output file at `{codebase-root}/.fp-docs-shell.zsh`
   - Check that it does NOT contain the literal strings `__CODEBASE_ROOT__`, `__FP_DOCS_DIR__`, or `__DOCS_ROOT__`
   - If any placeholder strings remain, report ERROR: "Shell integration file contains unbaked placeholders. Installation failed."
3. Verify the baked output file contains the merged precmd function:
   - Check that it contains `_fp_docs_precmd()` (the combined drift + RPROMPT hook)
   - Check that it contains `add-zsh-hook precmd _fp_docs_precmd`
   - If missing, report ERROR: "Shell integration file is missing precmd hook registration."
4. Output the source line for the user to add to their `.zshrc`:
   - `source "{codebase-root}/.fp-docs-shell.zsh"`
5. Warn the user: if they previously had a separate `source` line for `fp-docs-prompt.zsh`, they should REMOVE it. The merged file replaces both.
6. Inform user: "Add the source line above to your .zshrc. This provides:
   - Drift notifications (once per terminal session when stale docs detected)
   - Branch sync status (append `${_FP_DOCS_PROMPT}` to your RPROMPT)"

### Phase 7: Update Notification Setup

This phase installs the statusline hook for passive update notifications per D-06.

1. Check if `~/.claude/hooks/fp-docs-statusline.js` already exists. If yes, skip to step 3.
2. Copy the statusline template from the plugin:
   ```bash
   cp "{plugin-root}/framework/templates/fp-docs-statusline.js" ~/.claude/hooks/fp-docs-statusline.js
   ```
3. Check if the user's `~/.claude/settings.json` already references `fp-docs-statusline.js` in a hooks entry. If yes, skip to step 5.
4. Inform the user they need to add the statusline hook to their settings. There are two options:
   - **Option A (separate hook):** Add to `~/.claude/settings.json` hooks:
     ```json
     {
       "hooks": {
         "Notification": [
           {
             "hooks": [{
               "type": "command",
               "command": "node ~/.claude/hooks/fp-docs-statusline.js"
             }]
           }
         ]
       }
     }
     ```
   - **Option B (integrate into existing statusline):** If they already have a statusline hook (e.g., GSD's `gsd-statusline.js`), they can add the fp-docs cache check directly into that file. Show the relevant code snippet from the template.
5. Report: "Statusline hook installed. Update notifications will appear in your statusline when a new version is available."

## Output

Setup report with per-phase pass/fail status and recommended actions. Phases 5-7 report git hook, shell integration, and update notification installation status.

### CLAUDE.md Integration Check

After completing all phases, check if the codebase-root `CLAUDE.md` file contains `fp-docs` configuration content. If the user has NOT previously run `/fp-docs:update-claude`, include a prominent warning in the setup report:

> **WARNING: CLAUDE.md not configured for fp-docs.** Local dev environment workflows (locals extraction, visual verification, live testing) will not work correctly and the fp-docs system will not be as reliable or consistent. Run `/fp-docs:update-claude` to configure.
