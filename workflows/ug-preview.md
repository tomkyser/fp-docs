<purpose>
Start a local Hugo dev server or trigger a preview deploy for the user guide on the current
branch. Admin operation -- no pipeline, no git commit. Handles scaffold bootstrap if the
user-guide structure doesn't exist yet. Delegates to fp-docs-system for Hugo server management
and deploy workflow triggering.
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
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init admin-op ug-preview "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```
Parse JSON for: operation context, paths, system state.

Check for flags:
- `--local`: Start local Hugo dev server (default if no flag specified)
- `--deploy`: Trigger preview deploy via GitHub Actions workflow
- `--stop`: Stop running local Hugo server
</step>

<step name="verify-scaffold">
## 2. Verify User Guide Scaffold
```bash
DOCS_ROOT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" paths docs-root)
```

Check if `{docs-root}/user-guide/` exists:
- If missing: bootstrap from scaffold
  ```bash
  node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" scaffold check user-guide
  ```
  If scaffold check reports missing, the session-start hook should have bootstrapped it.
  If still missing, report error: "User guide scaffold not found. Run /fp-docs:setup to initialize."
- If exists: verify `hugo.toml` or `hugo.yaml` is present in `user-guide/`
</step>

<step name="execute">
## 3. Execute Preview Action
```bash
SYSTEM_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-system --raw)
```
Spawn system agent:
```
Agent(
  prompt="Execute ug-preview operation.
    Action: {--local | --deploy | --stop}
    Docs root: {docs-root}
    User guide path: {docs-root}/user-guide/

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
    </files_to_read>

    ### If --local (or default):
    1. Check if Hugo is installed: `which hugo`
       If not found: report error with install instructions
    2. Check if a Hugo server is already running on port 1313:
       `lsof -ti:1313`
       If running: report existing server URL and stop
    3. Start Hugo dev server in background:
       ```bash
       cd {docs-root}/user-guide && hugo server --port 1313 --bind 0.0.0.0 --navigateToChanged &
       ```
    4. Wait 3 seconds, verify server started by checking port
    5. Report: 'User guide dev server running at http://localhost:1313/'

    ### If --deploy:
    1. Check if `gh` CLI is available: `which gh`
       If not found: report error with install instructions
    2. Detect current branch: `git -C {docs-root} branch --show-current`
    3. Trigger deploy workflow:
       ```bash
       gh workflow run deploy-user-guide-preview.yml --ref {branch}
       ```
       If workflow file not found: report that preview deploys are not configured
    4. Report: 'Preview deploy triggered for branch {branch}. Check GitHub Actions for status.'

    ### If --stop:
    1. Find Hugo server process: `lsof -ti:1313`
    2. If found: kill it
       ```bash
       kill $(lsof -ti:1313)
       ```
    3. If not found: report 'No Hugo server running on port 1313'
    4. Report: 'Hugo dev server stopped.'

    Admin operation -- no pipeline, no git commit.",
  agent="fp-docs-system",
  model="${SYSTEM_MODEL}"
)
```
</step>

</process>

<success_criteria>
- [ ] User guide scaffold verified (bootstrapped if missing)
- [ ] Correct action executed based on flag (--local, --deploy, --stop)
- [ ] For --local: Hugo server running and URL reported
- [ ] For --deploy: GitHub Actions workflow triggered
- [ ] For --stop: Hugo server process terminated
- [ ] Error reported with guidance if Hugo or gh CLI not available
- [ ] No pipeline execution (admin operation)
- [ ] No git commit (admin operation)
</success_criteria>
