# Setup — Instruction

## Inputs
- Preloaded modules: docs-mod-standards, docs-mod-project

## Steps

### Phase 1: Plugin Structure Verification
1. Verify all required directories exist:
   - `agents/` — should contain 8 engine files
   - `skills/` — should contain 19 user skill directories
   - `modules/` — should contain 10 shared module directories
   - `hooks/` — should contain `hooks.json`
   - `scripts/` — should contain hook scripts
   - `framework/config/` — should contain `system-config.md`, `project-config.md`
   - `framework/instructions/` — should contain instruction directories
   - `framework/modules/` — should contain on-demand modules

2. Validate `plugin.json` manifest has required fields (name, version, description).

3. Verify all 8 engine agent files exist:
   - `agents/docs-modify.md`
   - `agents/docs-validate.md`
   - `agents/docs-citations.md`
   - `agents/docs-api-refs.md`
   - `agents/docs-locals.md`
   - `agents/docs-verbosity.md`
   - `agents/docs-index.md`
   - `agents/docs-system.md`

4. Verify all 19 user skill files and 10 shared modules exist.

5. Verify `hooks/hooks.json` is valid JSON and references existing scripts.

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

## Output

Setup report with per-phase pass/fail status and recommended actions.
