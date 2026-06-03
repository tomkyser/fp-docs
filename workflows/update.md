<purpose>
Check for and install fp-docs plugin updates from the GitHub repository.
Displays changelog, confirms with user, fetches and checks out the new version.
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
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init admin-op update "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse flags: `--check` (display only), `--force` (skip confirmation)
</step>

<step name="check">
## 2. Check for Updates

```bash
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" update check --sync
UPDATE_STATUS=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" update status)
```

Parse: `update_available`, `installed`, `latest`, `release_notes`, `release_url`.

If no update available: report "fp-docs is up to date (v{installed})." and stop.
</step>

<step name="display-changelog">
## 3. Display Changelog

Format and display update information with version comparison and release notes.

If `--check` flag: stop after displaying. Do not proceed to confirmation.
</step>

<step name="confirm">
## 4. Confirm with User

Ask user to confirm the update. Explain what will happen:
1. Fetch latest release from plugin repository
2. Check out the release tag
3. Requires Claude Code restart

If `--force` flag: skip confirmation and proceed directly.
If user declines: report "Update cancelled." and stop.
</step>

<step name="execute">
## 5. Execute Update

1. Get plugin root: `node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" paths plugin-root --raw`
2. Fetch latest: `git -C {plugin-root} fetch origin`
3. Check out target version tag (try without `v` prefix first, then with)
4. Clear update cache: `rm -f {codebase-root}/.fp-docs/update-cache.json`
5. Report completion and remind user to restart Claude Code
</step>

</process>

<success_criteria>
- [ ] Update check completed
- [ ] Changelog displayed (if update available)
- [ ] User confirmation obtained (unless --force)
- [ ] Version tag checked out successfully
- [ ] Restart reminder displayed
</success_criteria>
