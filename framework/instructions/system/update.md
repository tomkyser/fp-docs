# Update — Instruction

## Inputs
- Preloaded modules: mod-standards
- CLI: `node {plugin-root}/fp-tools.cjs update <check|status|run>`

## Steps

### Step 1: Check for Updates

Run the update check synchronously to get the latest release information:

```bash
node {plugin-root}/fp-tools.cjs update check --sync
```

Then read the current update status:

```bash
node {plugin-root}/fp-tools.cjs update status
```

Parse the JSON output. Key fields:
- `update_available` (boolean) — whether a newer version exists
- `current_version` — the currently installed version
- `latest_version` — the newest available version
- `release_notes` — changelog/release notes from GitHub
- `release_url` — link to the GitHub release page

If `update_available` is `false`, report:

```
fp-docs is up to date (v{current_version}).
```

Stop here — no further steps needed.

If `update_available` is `true`, continue to Step 2.

### Step 2: Display Changelog

Format and display the update information:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 fp-docs > UPDATE AVAILABLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current version: v{current_version}
Latest version:  v{latest_version}

## Release Notes

{release_notes}

GitHub: {release_url}
```

If `--check-only` flag is present, stop here after displaying the changelog. Do not proceed to confirmation or execution.

### Step 3: Confirm with User

Ask the user to confirm the update:

```
Update fp-docs from v{current_version} to v{latest_version}?

This will:
1. Fetch the latest release from the plugin repository
2. Check out the release tag
3. Require a Claude Code restart to take effect

Proceed? (yes/no)
```

If the user declines, report:

```
Update cancelled. You can update later with /fp-docs:update.
```

Stop here.

If the user confirms, continue to Step 4.

If `--force` flag is present, skip this confirmation step entirely and proceed directly to Step 4.

### Step 4: Execute Update

1. Get the plugin root path:
   ```bash
   node {plugin-root}/fp-tools.cjs paths plugin-root --raw
   ```

2. Fetch the latest from remote:
   ```bash
   git -C {plugin-root} fetch origin
   ```

3. Check out the target version tag. Try without `v` prefix first (the tag format used by fp-docs):
   ```bash
   git -C {plugin-root} checkout {latest_version}
   ```
   If that fails, try with `v` prefix as fallback:
   ```bash
   git -C {plugin-root} checkout v{latest_version}
   ```

4. Clear the update cache so the statusline stops showing the nudge:
   ```bash
   node {plugin-root}/fp-tools.cjs update run --clear-cache
   ```

### Step 5: Report

Display the completion report:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 fp-docs > UPDATE COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Updated: v{current_version} → v{latest_version}

IMPORTANT: Restart Claude Code now for the update to take effect.
Close this session and start a new one.
```

## Delegated Mode Note

Update always runs standalone through the system engine. It is not a document operation and does not trigger the 8-stage pipeline. The orchestrator classifies it as type `admin` and delegates directly to the system engine without pipeline phases.

## Flag Handling

| Flag | Behavior |
|------|----------|
| `--check-only` | Stop after Step 2 (check and display only, no confirmation or execution) |
| `--force` | Skip Step 3 confirmation (execute immediately after displaying changelog) |

## Output

Update report containing:
- Version comparison (current vs latest)
- Release notes / changelog from GitHub
- Update execution status (success/failure)
- Restart reminder
