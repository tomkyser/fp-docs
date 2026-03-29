# fp-docs Usage and Workflows Research

<!-- Updated 2026-03-29: Phase 16 — 5-phase delegation, --plan-only and --no-research flags, plan file persistence -->
<!-- Updated 2026-03-28: Phase 13 — MCP reference confirmed, command count aligned -->

> **Updated 2026-03-29**: Phase 16 -- 5-phase delegation model (Research -> Plan -> Write -> Review -> Finalize), `--plan-only` and `--no-research` flags, plan file persistence at `.fp-docs/plans/`. Researcher (opus) and planner (sonnet) engines added.
>
> Previously (2026-03-28): Phase 13 -- MCP `.mcp.json` reference confirmed in installation and visual verification sections. Plugin compliance validated.
>
> Previously (2026-03-28): Phase 11 -- Fixed pipeline init/next sequence. System engine now routes `update` operation. Update instruction fields aligned with update.cjs output.
>
> Previously (2026-03-26): Phase 10 -- Version reset to 1.0.0 for independent repo era. Added `/fp-docs:update` command and "Updating fp-docs" workflow. Setup extended with Phase 7 (statusline hook installation).
>
> Previously (2026-03-25): Phase 8 -- Pipeline finalization is CJS-managed (no manual git commands needed). Setup Phase 5 installs drift hooks via `fp-tools drift install`. Setup Phase 6 installs shell integration via `fp-tools drift shell-install`.
>
> Previously (2026-03-25): Phase 7 -- added drift detection system: Workflow H (Drift Detection), extended `/fp-docs:setup` with Phases 5-6 (git hooks + shell integration), 3 new gotchas, staleness.json and drift-pending.json data files.
>
> Previously (2026-03-24): Phase 6.1 -- added `/fp-docs:remediate` command, "Audit and Remediate" workflow (Workflow G), `--batch-mode` and `--use-agent-team` flags, actionable audit output with per-issue command recommendations, plan staleness gotcha.
>
> Previously (2026-03-23): Added meta-commands `/fp-docs:do` and `/fp-docs:help` to command reference (§4) and new Discovery workflow (§3). Previously: Added ephemeral WP-CLI `fp-locals` tool documentation.

> Research compiled from reading all 23 skill files, 9 engine agents, hooks, scripts, configuration files, instruction files, and the manifest. This document covers installation, setup, daily workflows, command reference, branch sync, configuration, best practices, and gotchas.

---

## 1. Installation Methods

### Method A: Marketplace Install (Production)

fp-docs is distributed through the `fp-tools` marketplace, defined in the container repo's `.claude-plugin/marketplace.json`:

```json
{
  "name": "fp-tools",
  "plugins": [
    {
      "name": "fp-docs",
      "source": "./fp-docs",
      "description": "Documentation management system for the Foreign Policy WordPress codebase"
    }
  ]
}
```

To install from the marketplace:
```
/plugin marketplace add tomkyser/fp-tools
/plugin install fp-docs@fp-tools
```

### Method B: Local Development (--plugin-dir)

For plugin development or testing local changes:
```bash
claude --plugin-dir ~/cc-plugins/fp-docs
```

**Path note**: Point `--plugin-dir` at the `fp-docs/` directory (the submodule root). This IS the plugin root containing agents, skills, modules, hooks, etc. The parent directory (`cc-plugins/`) is the marketplace wrapper.

### Plugin Identity

From `.claude-plugin/plugin.json`:
- Name: `fp-docs`
- Version: `1.0.0`
- License: MIT
- Repository: `https://github.com/tomkyser/fp-docs`
- All 23 user commands are namespaced as `/fp-docs:*` (21 routing-table + 2 meta-commands)

### Default Permissions

From `settings.json`:
```json
{
  "permissions": {
    "allow": ["Read", "Grep", "Glob"]
  }
}
```

Only Read, Grep, and Glob are auto-allowed. Write, Edit, and Bash require user approval per-session (these are used by the `modify` and `system` engines but not auto-approved at the plugin level).

### MCP Server (Auto-Loaded)

The plugin's `.mcp.json` file configures the Playwright MCP server for visual verification. Claude Code automatically starts this server when the plugin is loaded -- no manual configuration needed. The server provides browser automation tools (`browser_navigate`, `browser_snapshot`, `browser_take_screenshot`) used by the `--visual` flag and `/fp-docs:test visual` scope.

---

## 2. First-Time Setup Process

### Running Setup

```
/fp-docs:setup
```

This command routes to the `system` engine and runs a 6-phase verification and installation:

#### Phase 1: Plugin Structure Verification
- Checks all required directories exist (agents/, skills/, hooks/, lib/, framework/)
- Validates `plugin.json` manifest has required fields
- Verifies all 11 engine agent files exist
- Verifies all 23 user skill files + 11 shared modules
- Checks `hooks.json` is valid JSON and references existing scripts

#### Phase 2: Docs Repo Setup
- Detects codebase root via `git rev-parse --show-toplevel`
- Checks if docs repo exists at `{codebase-root}/themes/foreign-policy-2017/docs/.git`
- If NOT found: asks user whether to clone from `https://github.com/tomkyser/docs-foreignpolicy-com`
- If found: verifies remote URL and branch state

#### Phase 3: Codebase Gitignore Check
- Checks if `themes/foreign-policy-2017/docs/` is in the codebase repo's `.gitignore`
- If NOT present: warns user and offers to add it
- If present: confirms

#### Phase 4: Branch Sync
- If docs repo is set up: detects codebase branch and docs branch
- If mismatched: offers to run sync
- Reports overall three-repo health

#### Phase 5: Git Hook Installation
- Detects codebase root via `git rev-parse --show-toplevel`
- Checks if `.git/hooks/post-merge` already exists; backs up if so (`post-merge.backup-fp-docs`)
- Runs `fp-tools drift install --codebase-root {codebase-root}` to install post-merge and post-rewrite hooks
- Verifies both hooks are installed and executable
- Report: "Git hooks installed. Drift analysis will run automatically after git pull/merge."

#### Phase 6: Shell Prompt Integration
- Runs `fp-tools drift shell-install --codebase-root {codebase-root}` to generate a shell integration script
- Outputs the source line for the user to add to their `.zshrc`: `source "{codebase-root}/.fp-docs-shell.zsh"`
- Informs user: "Add the line above to your .zshrc to see drift notifications in your terminal."

#### Setup Output
A structured report with per-phase pass/fail and installation health status (including git hook and shell integration results):
- **HEALTHY**: All components present and configured
- **DEGRADED**: Optional components missing
- **BROKEN**: Critical components missing

### What Happens Automatically on Session Start

Three hooks fire on every SessionStart:

1. **inject-manifest** (`handleInjectManifest`): Injects the plugin root path and manifest content into the session context, so all engines know where to find their files.

2. **branch-sync** (`handleBranchSyncCheck`): Detects codebase and docs branches, compares them. If mismatched, emits a `stopMessage` warning the user to run `/fp-docs:sync`. If docs repo is not found, emits advice to run `/fp-docs:setup`.

3. **drift-nudge** (`handleDriftNudge`): Merges any pending drift signals from git hooks (drift-pending.json) into the staleness tracker (staleness.json), then formats a nudge if stale docs exist. Example nudge: "5 docs may need attention. Top 3: 06-helpers/posts (3 source files changed), 08-hooks/actions (2 files), 09-api/rest-api (1 file). Run /fp-docs:auto-revise to update affected docs, or /fp-docs:drift status for details." Silent when no signals exist.

---

## 3. Typical Daily Workflows

### Workflow: Discovery -- "What can fp-docs do?"

Two meta-commands help new and experienced users discover and access fp-docs capabilities:

**Command Reference**: `/fp-docs:help`

Displays all 21 routing-table commands organized by type (write/read/admin/batch) in formatted markdown tables with descriptions and engine assignments. The output is generated from CJS routing data, so it never drifts from the actual command inventory.

```
/fp-docs:help
```

**Natural Language Router**: `/fp-docs:do "what you want to do"`

Describe your intent in plain English and the smart router matches it to the appropriate fp-docs command. Useful when you know what you want but do not remember the exact command name.

```
/fp-docs:do "check if my docs are up to date"
/fp-docs:do "I added a new helper and need to create docs for it"
/fp-docs:do "find any hallucinations in the posts helper docs"
/fp-docs:do "sync my branches"
```

If the intent is ambiguous, the router presents 2-3 candidate commands and asks you to choose. After matching, it displays a routing banner and auto-dispatches the chosen command with your original input.

### Workflow A: "I changed some code and need to update the docs"

**Command**: `/fp-docs:auto-update`
**Argument hint**: `"optional scope restriction"`
**Engine**: modify

**What it does**:
1. Automatically runs `git diff --name-only HEAD~5` to detect recently changed source files
2. Filters to documentation-relevant files (removes docs/, node_modules/, vendor/, etc.)
3. Maps each changed source file to its documentation target using `source-map.json` via `lib/source-map.cjs` (e.g., `helpers/posts.php` maps to `docs/06-helpers/posts.md`)
4. Reads the current source code and existing documentation
5. Updates docs to reflect code changes; creates new docs for new files; adds REMOVED notices for deleted files
6. Runs the full 8-stage post-modification pipeline (finalization stages 6-8 are CJS-managed via `fp-tools.cjs pipeline` -- no manual git commands needed)
7. Commits to the docs repo via CJS git operations

**Examples**:
```
/fp-docs:auto-update
/fp-docs:auto-update "only helpers/"
/fp-docs:auto-update "just the posts helper"
```

### Workflow B: "I know this doc is wrong"

**Command**: `/fp-docs:revise "description of what to fix"`
**Argument hint**: `"description of what to fix"`
**Engine**: modify

**What it does**:
1. Parses the user's description to identify which doc files need revision
2. Reads the doc and corresponding source code
3. Compares and identifies specific discrepancies
4. Makes targeted edits to correct discrepancies while preserving accurate content
5. Checks appendix cross-references if the revision touches hooks, shortcodes, REST routes, constants, ACF groups, or feature templates
6. Runs the full 8-stage pipeline
7. Commits to docs repo

**Examples**:
```
/fp-docs:revise "fix the posts helper documentation"
/fp-docs:revise "the ad insertion shortcode docs say it defaults to 'sidebar' but it actually defaults to 'inline'"
/fp-docs:revise "update the newsletter taxonomy docs to reflect the new 'frequency' term meta field"
```

### Workflow C: "I added new code with no docs"

**Command**: `/fp-docs:add "description of new code to document"`
**Argument hint**: `"description of new code to document"`
**Engine**: modify

**What it does**:
1. Identifies what new code was added and which docs section it belongs in
2. Reads PROJECT-INDEX.md to discover existing files in the target directory
3. Finds a sibling doc in the same section and reads it as a format template
4. Reads the new source code files
5. Creates complete documentation following the sibling's format
6. Uses `[NEEDS INVESTIGATION]` for anything unclear rather than guessing
7. Updates parent `_index.md` and `About.md` links
8. Runs the full 8-stage pipeline
9. Commits to docs repo

**Examples**:
```
/fp-docs:add "document the new meilisearch helper"
/fp-docs:add "new podcast post type at inc/post-types/podcast.php"
/fp-docs:add "the new paywall feature at features/paywall/"
```

### Workflow D: "I want to check doc accuracy"

Three levels of checking, from broad to deep:

#### Quick/Standard/Deep Audit
**Command**: `/fp-docs:audit --depth quick|standard|deep [scope]`
**Engine**: validate (read-only)

- **quick**: Checks file existence, cross-references source-to-doc mapping (via `source-map.json`), validates markdown links
- **standard** (default): Includes quick + checks git changes from last 30 days and flags discrepancies
- **deep**: Includes standard + reads every doc and source file, compares all claims, checks citation coverage

```
/fp-docs:audit --depth quick
/fp-docs:audit --depth deep docs/06-helpers/
/fp-docs:audit --depth standard --section 02
```

#### 10-Point Verification Checklist
**Command**: `/fp-docs:verify [scope]`
**Engine**: validate (read-only)

Runs 10 specific checks:
1. File Existence
2. Orphan Check
3. Index Completeness
4. Appendix Spot-Check
5. Link Validation
6. Changelog Check
7. Citation Format Validation
8. API Reference Provenance Validation
9. Locals Contracts Completeness
10. Verbosity Compliance

```
/fp-docs:verify
/fp-docs:verify docs/06-helpers/
/fp-docs:verify docs/02-post-types/article.md
```

#### Zero-Tolerance Sanity Check
**Command**: `/fp-docs:sanity-check "scope"`
**Engine**: validate (read-only)

Cross-references every factual claim against source code:
- Function signatures, hook names/priorities, file paths, meta keys
- REST routes, shortcode attributes, defaults, constants
- Classifies each claim: VERIFIED, MISMATCH, HALLUCINATION, UNVERIFIABLE
- Checks related docs for contradictions
- Returns confidence level (HIGH/LOW)

```
/fp-docs:sanity-check docs/06-helpers/posts.md
/fp-docs:sanity-check docs/09-api/
```

### Workflow E: "I removed a feature"

**Command**: `/fp-docs:deprecate "description of deprecated code"`
**Argument hint**: `"description of deprecated code"`
**Engine**: modify

**What it does**:
For deprecated code (still in codebase):
- Adds `[LEGACY]` to doc title
- Adds deprecation notice with date and replacement info
- Updates parent `_index.md` and `About.md` entries

For removed code (deleted from codebase):
- Adds REMOVED notice at top of doc
- Removes entries from `_index.md` and `About.md`
- Updates cross-references across other docs
- Updates relevant appendices

```
/fp-docs:deprecate "the AMP integration was removed"
/fp-docs:deprecate "the legacy gallery shortcode is deprecated, replaced by the new media-grid component"
```

### Workflow F: "I want to update citations/API refs"

#### Citations
**Command**: `/fp-docs:citations generate|update|verify|audit [scope]`
**Engine**: citations

- `generate`: Create new citations for docs that don't have them
- `update`: Refresh stale citations (e.g., after source code changed)
- `verify`: Check citation format compliance
- `audit`: Deep accuracy check of existing citations

```
/fp-docs:citations generate docs/06-helpers/posts.md
/fp-docs:citations update docs/06-helpers/
/fp-docs:citations verify
/fp-docs:citations audit docs/06-helpers/
```

#### API Reference
**Command**: `/fp-docs:api-ref generate|audit [scope]`
**Engine**: api-refs

- `generate`: Extract function signatures from source and create formatted reference tables
- `audit`: Check existing API reference sections for accuracy

```
/fp-docs:api-ref generate docs/06-helpers/posts.md
/fp-docs:api-ref audit docs/06-helpers/
```

### Workflow G: "I want to fix all audit findings at once"

**Commands**: `/fp-docs:audit` followed by `/fp-docs:remediate`
**Engines**: validate (audit), orchestrate (remediate dispatches to specialists)

**What it does**:
1. Run an audit to identify issues: `/fp-docs:audit --depth deep`
2. Review the Remediation Summary at the end of the audit report
3. Either remediate immediately or save a plan for later:
   - **Immediate**: `/fp-docs:remediate` -- dispatches to specialist engines based on audit output
   - **Plan first**: `/fp-docs:remediate --plan-only` -- saves a plan, then `/clear` to free context, then `/fp-docs:remediate` to execute from the saved plan

**Examples**:
```
/fp-docs:audit --depth deep docs/06-helpers/
/fp-docs:remediate
```

```
/fp-docs:audit --depth deep
/fp-docs:remediate --plan-only
/clear
/fp-docs:remediate
```

The remediation plan orders issues by severity within dependency tiers: accuracy issues first (HALLUCINATION, STALE), then enrichment (citations, API refs), then structural (MISSING, BROKEN, ORPHAN). This prevents cascading re-work.

### Workflow H: "I pulled code and want to know what docs need updating"

**How drift detection works**:

Drift detection runs automatically after `git pull` or `git merge` via git hooks installed by `/fp-docs:setup`. No manual action needed to trigger it.

**Automatic flow**:
1. You run `git pull` (or `git merge`, `git rebase`) in the codebase repo
2. The post-merge (or post-rewrite) git hook fires automatically
3. The hook runs `fp-tools drift analyze`, which maps changed source files to affected docs using `source-map.json` (via `lib/source-map.cjs`)
4. Drift signals are written to `.fp-docs/drift-pending.json`
5. Next time you start a Claude Code session, the SessionStart drift-nudge hook merges pending signals into `.fp-docs/staleness.json` and shows a nudge

**What the SessionStart nudge looks like**:
```
5 docs may need attention. Top 3: 06-helpers/posts (3 source files changed),
08-hooks/actions (2 files), 09-api/rest-api (1 file).
Run /fp-docs:auto-revise to update affected docs, or /fp-docs:drift status for details.
```

**What the shell prompt notification looks like** (outside Claude Code, if shell integration is installed):
```
[fp-docs] 5 docs may need attention. Run Claude Code and use /fp-docs:drift status
```

**Acting on drift signals**:
- Run `/fp-docs:auto-revise` to batch-update all affected docs
- Run `/fp-docs:drift status` to see full details of all staleness signals
- Run `/fp-docs:drift clear docs/06-helpers/posts.md` to dismiss a false positive
- Staleness signals auto-clear after successful doc operations -- no manual cleanup needed for resolved docs

**Checking drift status**:
```
/fp-docs:drift status      # Full staleness details
/fp-docs:drift list         # Signal summaries
/fp-docs:drift clear        # Clear all signals
/fp-docs:drift clear docs/06-helpers/posts.md   # Clear specific doc
```

### Workflow I: "I want to verify docs against the live rendered site"

**When:** You want to verify documentation accuracy against the live rendered site, or gather visual context before/during documentation changes.

**Steps:**
1. Ensure ddev is running: `ddev start` (if not already running)
2. Run visual tests: `/fp-docs:test visual`
3. Review the test report -- each page/component gets a pass/fail with screenshot evidence
4. For targeted revision with visual context: `/fp-docs:revise {description} --visual`
5. Screenshots saved to `.fp-docs/screenshots/` for review

**Prerequisites:** ddev running, Playwright MCP server active (auto-started with plugin)

### Workflow J: "I want to update fp-docs to the latest version"

**When:** You see an update notification in the statusline, or you want to check for new versions.

**Steps:**
1. Check for updates: `/fp-docs:update --check`
2. If an update is available, install it: `/fp-docs:update`
3. The command queries the GitHub Releases API, displays the changelog from release notes, and asks for confirmation
4. On confirmation, it executes `git fetch origin && git checkout <tag>` in the plugin directory
5. Restart your Claude Code session to pick up the new version

**How the update awareness works:**
- A SessionStart hook spawns a background process that checks for updates (writes to `.fp-docs/update-cache.json`)
- The statusline hook (installed by `/fp-docs:setup`) reads the cache and displays an update nudge
- Neither the background check nor the statusline blocks session startup

---

## 4. Complete Command Reference

All 23 commands route through the **orchestrate** engine (`agent: orchestrate`). The 21 routing-table commands delegate to specialist engines; the 2 meta-commands are handled directly by the orchestrate engine.

### Meta-Commands (handled directly by orchestrate)

| Command | Arguments | Description |
|---------|-----------|-------------|
| `/fp-docs:do` | `"natural language description"` | Route natural language to the right fp-docs command. The smart router evaluates your intent against a routing rules table, disambiguates when needed, and auto-dispatches the matched command. |
| `/fp-docs:help` | (none) | Display all 21 routing-table commands grouped by type (write/read/admin/batch) with descriptions and engines. CJS-generated from routing data. |

### Routing-Table Commands (21 commands)

The "Engine" column refers to the specialist engine that receives the delegation. Write operations use 3+ agents (orchestrate + specialist + validate); read-only operations use a 2-agent fast path with actionable output.

### Documentation Modification Commands (modify engine via orchestrate)

| Command | Arguments | Description |
|---------|-----------|-------------|
| `/fp-docs:revise` | `"description of what to fix"` | Fix specific documentation you know is wrong or outdated |
| `/fp-docs:add` | `"description of new code to document"` | Create documentation for new code that has no docs yet |
| `/fp-docs:auto-update` | `"optional scope restriction"` | Auto-detect code changes since last docs update and update all affected docs |
| `/fp-docs:auto-revise` | `"optional flags like --dry-run"` | Batch-process all items in the needs-revision-tracker |
| `/fp-docs:deprecate` | `"description of deprecated code"` | Mark documentation as deprecated when code is removed or replaced |

### Documentation Validation Commands (validate engine via orchestrate, read-only fast path)

| Command | Arguments | Description |
|---------|-----------|-------------|
| `/fp-docs:audit` | `--depth quick\|standard\|deep [scope]` | Compare docs against source code, report discrepancies |
| `/fp-docs:verify` | `"optional scope"` | Run 10-point verification checklist (read-only) |
| `/fp-docs:sanity-check` | `"scope like docs/06-helpers/posts.md"` | Zero-tolerance claim validation against source code |
| `/fp-docs:test` | `"rest-api\|cli\|templates\|visual"` | Execute runtime validations against local dev environment. `visual` scope navigates to foreignpolicy.local pages, captures screenshots, and verifies docs against rendered site. |

### Specialized Feature Commands

| Command | Arguments | Engine | Description |
|---------|-----------|--------|-------------|
| `/fp-docs:citations` | `generate\|update\|verify\|audit [scope]` | citations | Manage code citations in documentation |
| `/fp-docs:api-ref` | `generate\|audit [scope]` | api-refs | Generate/update API Reference sections |
| `/fp-docs:locals` | `annotate\|contracts\|cross-ref\|validate\|shapes\|coverage [scope]` | locals | Manage locals contract documentation for WordPress template components |
| `/fp-docs:verbosity-audit` | `--depth quick\|standard\|deep [scope]` | verbosity | Scan for verbosity gaps (missing items, summarization, unexpanded enumerables) |

### System/Maintenance Commands

| Command | Arguments | Engine | Description |
|---------|-----------|--------|-------------|
| `/fp-docs:setup` | (none) | system | Initialize or verify plugin installation (7 phases: structure, docs repo, gitignore, branch sync, git hooks, shell integration, update notification) |
| `/fp-docs:sync` | `[merge] [--force]` | system | Synchronize docs repo branch with codebase branch |
| `/fp-docs:update` | `[--check]` | system | Check for and install plugin updates via GitHub Releases API. `--check` for version check only. |
| `/fp-docs:update-index` | `update\|full` | index | Refresh the PROJECT-INDEX.md codebase reference |
| `/fp-docs:update-claude` | (none) | index | Regenerate the CLAUDE.md template with current skill inventory |
| `/fp-docs:update-skills` | (none) | system | Regenerate all plugin skills from prompt definitions |

### Remediation Command

| Command | Arguments | Engine | Description |
|---------|-----------|--------|-------------|
| `/fp-docs:remediate` | `[plan-path \| plan-number \| --plan-only]` | orchestrate | Resolve audit findings by dispatching to specialist engines. Takes audit output or a saved remediation plan and orchestrates batch remediation. Use `--plan-only` to save a plan for later execution (enables audit -> clear -> remediate workflow). |

### Orchestration Command

| Command | Arguments | Engine | Description |
|---------|-----------|--------|-------------|
| `/fp-docs:parallel` | `operation scope flags` | orchestrate | Run docs operations in parallel across multiple files using Agent Teams. The orchestrator handles batch operations natively using the `--batch-mode` flag system. |

**Note**: `/fp-docs:parallel` requires the `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` environment variable to be enabled. Falls back to sequential execution for small scopes (<3 files) or if teams are unavailable.

### Common Flags for Modification Commands

| Flag | Effect |
|------|--------|
| `--no-citations` | Skip citation generation/update pipeline stage |
| `--no-sanity-check` | Skip sanity-check pipeline stage |
| `--no-verbosity` | Skip verbosity enforcement pipeline stage |
| `--no-api-ref` | Skip API reference sync pipeline stage |
| `--no-index` | Skip PROJECT-INDEX update pipeline stage |
| `--mode plan` | Show plan of what would change without executing |
| `--mode audit+plan` | Audit first, then plan changes |
| `--dry-run` | (auto-revise) Preview what would be processed without making changes |
| `--batch-mode subagent\|team\|sequential` | Control execution mode (default: subagent). Team mode requires confirmation. |
| `--use-agent-team` | Shorthand for `--batch-mode team`, bypasses confirmation prompt |
| `--plan-only` | Stop after Plan Phase. Display plan summary. Do not execute Write/Review/Finalize phases. Available on all operations (remediate: save remediation plan without executing). |
| `--no-research` | Skip the Research Phase entirely. Planner works without source analysis. Useful for quick operations when latency matters. |
| `--visual` | Enable visual verification via browser automation (Playwright MCP). Available on modify operations. |

---

## 5. Branch Sync System

### Three-Repo Architecture

fp-docs operates across three independent git repositories:

| Repo | Git Root | Purpose |
|------|----------|---------|
| **Codebase** | `wp-content/` | FP WordPress source code. Gitignores the `docs/` directory. |
| **Docs** | `themes/foreign-policy-2017/docs/` | Nested inside codebase workspace but tracked independently. |
| **Plugin** | Plugin install location | The fp-docs plugin itself, distributed via marketplace. |

### Branch Mirroring Rules

- Docs `master` = canonical docs for codebase `origin/master`
- Feature branches in docs mirror codebase feature branches by exact name
- When you create `feature/new-search` in the codebase, the docs repo should have a matching `feature/new-search` branch

### Automatic Branch Detection (SessionStart)

The `branch-sync-check.sh` hook runs on every session start:
1. Finds the codebase root via `git rev-parse --show-toplevel`
2. Checks if docs repo exists at `{codebase-root}/themes/foreign-policy-2017/docs/.git`
3. If docs repo not found: injects context saying "Run /fp-docs:setup"
4. If found: compares codebase branch to docs branch
5. Reads the sync watermark file (`.sync-watermark`) to check if codebase has new commits since last docs sync
6. If branches match AND watermark is current: injects "Repos synced" context
7. If branches match BUT watermark is stale: injects context noting N new codebase commits since last sync (suggests running `/fp-docs:sync`)
8. If branches mismatch: emits a `stopMessage` warning the user to run `/fp-docs:sync`

### Manual Sync Operations

**Default sync** (no args): `/fp-docs:sync`
1. Fetches and pulls latest from docs remote (Phase 1 — Remote sync)
2. Detects codebase and docs branches (Phase 2 — Branch alignment)
3. If no matching docs branch exists: creates it from docs `master`
4. If matching branch exists but docs is on wrong branch: switches to it
5. Reads the sync watermark to determine codebase changes since last sync (Phase 3 — Change detection)
6. If changes detected: generates a diff report at `docs/diffs/{YYYY-MM-DD}_{branch}_diff_report.md`
7. Updates the watermark file with the current codebase HEAD
8. Commits watermark and diff report to the docs repo

Phase 3 always runs, even when branches already matched. This ensures that codebase changes pulled to the current branch (e.g., new commits merged to master) are detected.

**Merge sync**: `/fp-docs:sync merge`
1. Switches docs repo to master
2. Merges the current docs feature branch into master
3. Pushes docs master
4. Deletes the merged feature branch (cleanup)

**Force sync**: `/fp-docs:sync --force`
- Forces branch switch even with uncommitted docs changes

### Diff Reports

Generated during sync when codebase changes are detected, diff reports contain:
- **Sync baseline**: which codebase commit the diff is computed from (watermark → HEAD)
- **Commits since last sync**: how many codebase commits happened since the last sync
- **LIKELY STALE** files: source file was modified, doc may not reflect changes
- **POSSIBLY STALE** files: source file in same directory was modified
- **STRUCTURAL CHANGES**: new/deleted source files affecting doc structure
- Recommended actions checklist

Reports accumulate in `docs/diffs/` as historical records.

### Sync Watermark

The sync command maintains a watermark file (`.sync-watermark`) in the docs repo that records the codebase commit hash from the last successful sync. This enables cross-repo change detection — without it, the system cannot tell whether the codebase has changed when both repos are on the same branch (e.g., both on `master`). The watermark is committed to the docs repo and persists across machines and sessions.

---

## 6. Configuration Options

### Project Configuration (`framework/config/project-config.md`)

This file contains FP-specific settings:

- **Project identity**: Theme root, docs root, WP-CLI prefix (`ddev wp`), local URL (`https://foreignpolicy.local/`)
- **Source-to-Documentation Mapping**: **Extracted to `source-map.json`** (accessed via `lib/source-map.cjs`; project-config.md retains reference pointer only)
- **Appendix Cross-References**: 7 appendix mappings for hooks, shortcodes, REST routes, constants, etc.
- **Feature Enables**: Citations, API References, Locals contracts, Verbosity enforcement, Sanity-check (all enabled by default)
- **Repository Configuration**: Git roots, remotes, branch strategies, path resolution rules, diff report location

### System Configuration (`framework/config/system-config.md`)

This file controls thresholds, defaults, and feature flags:

#### Citations Configuration
| Setting | Default | Description |
|---------|---------|-------------|
| `citations.enabled` | `true` | Whether citations are mandatory |
| `citations.full_body_max_lines` | `15` | Line count threshold for Full tier |
| `citations.signature_max_lines` | `100` | Line count threshold for Signature tier |
| `citations.include_line_numbers` | `true` | Include L{start}-{end} in citations |

#### Sanity Check Configuration
| Setting | Default | Description |
|---------|---------|-------------|
| `sanity_check.default_enabled` | `true` | Whether sanity-check runs by default |
| `sanity_check.multi_agent_threshold_docs` | `5` | Trigger multi-agent review above this doc count |

#### API Reference Configuration
| Setting | Default | Description |
|---------|---------|-------------|
| `api_ref.enabled` | `true` | Whether API Reference sections are required |
| `api_ref.provenance_values` | `PHPDoc, Verified, Authored` | Valid Src column values |

#### Verbosity Engine Configuration
| Setting | Default | Description |
|---------|---------|-------------|
| `verbosity.enabled` | `true` | Master switch for verbosity enforcement |
| `verbosity.gap_tolerance` | `0` | Zero tolerance for gaps between source and docs |

#### Chunk Delegation Thresholds
| Setting | Default | Description |
|---------|---------|-------------|
| `chunk_delegation.max_docs_per_agent` | `8` | Max docs per single agent |
| `chunk_delegation.max_functions_per_agent` | `50` | Max functions per single agent |
| `chunk_delegation.delegation_trigger_docs` | `8` | Auto-delegate above this doc count |

#### Orchestration Configuration (system-config.md §6)
| Setting | Default | Description |
|---------|---------|-------------|
| `orchestration.enabled` | `true` | Master switch for multi-agent orchestration |
| `orchestration.max_concurrent_subagents` | `5` | Maximum concurrent subagent spawns in fan-out |
| `orchestration.max_teammates` | `5` | Maximum concurrent teammates in a team |
| `orchestration.max_files_per_batch` | `5` | Maximum files per subagent batch or teammate |
| `orchestration.default_batch_mode` | `subagent` | Default execution mode (subagent, team, sequential) |
| `orchestration.git_serialization` | `true` | Only orchestrator commits in delegated mode |
| `orchestration.fast_path_read_only` | `true` | Read-only commands skip full delegation |

#### Visual Verification Settings
| Setting | Default | Description |
|---------|---------|-------------|
| `visual.enabled` | `true` | Master switch for visual verification capabilities |
| `visual.default_screenshot_dir` | `.fp-docs/screenshots` | Transient screenshot storage |
| `visual.docs_screenshot_dir` | `media/screenshots` | Persistent doc screenshots |
| `visual.local_url` | `https://foreignpolicy.local` | Local dev environment URL |

#### Agent Model Configuration (system-config §9, Phase 16)
| Setting | Default | Description |
|---------|---------|-------------|
| `researcher.model` | `opus` | Model for the researcher agent. Deep code analysis benefits from strongest reasoning (D-12). |
| `researcher.enabled` | `true` | Master switch for pre-operation Research Phase. When false, equivalent to always passing `--no-research`. |
| `planner.model` | `sonnet` | Model for the planner agent. Planning is structured/formulaic, Sonnet is appropriate (D-12). |
| `planner.enabled` | `true` | Master switch for pre-operation Plan Phase. When false, orchestrator uses legacy 3-phase direct delegation. |
| `plans.auto_prune` | `true` | Whether to auto-prune completed plans older than retention period |
| `plans.retention_days` | `30` | Days to retain completed plan files before auto-pruning |
| `plans.max_plans` | `200` | Maximum plan files to retain (oldest completed plans pruned first) |

### How to Customize Behavior

To customize fp-docs behavior:
1. Modify `framework/config/system-config.md` to change thresholds and feature flags
2. Modify `framework/config/project-config.md` to change paths or feature enables; use `fp-tools source-map generate` to refresh source-to-doc mappings in `source-map.json`
3. Use per-command flags (`--no-citations`, `--no-sanity-check`, etc.) for one-off overrides

---

## 7. The Post-Modification Pipeline

Every doc-modifying operation runs an 8-stage pipeline after the core work. Under the multi-agent orchestration architecture, these stages are split into 3 phases: **Write Phase** (primary op + stages 1-3, assigned to specialist), **Review Phase** (stages 4-5, assigned to validate engine), and **Finalize Phase** (stages 6-8, handled by orchestrator). Only the orchestrator commits to git in delegated mode.

Under the 5-phase delegation model (Phase 16), all operations proceed through Research Phase (researcher engine pre-analyzes source code) and Plan Phase (planner engine creates execution strategy) before the 8 pipeline stages. The `--no-research` flag skips the Research Phase; `--plan-only` stops after the Plan Phase.

| Stage | Name | Description | Skippable? |
|-------|------|-------------|------------|
| 1 | Verbosity Enforcement | Count source items, verify 100% doc coverage, ban summarization | Yes (`verbosity.enabled = false`) |
| 2 | Citation Generation/Update | Generate or refresh code citations | Yes (`citations.enabled = false`) |
| 3 | API Reference Sync | Verify/update API reference tables | Yes (`api_ref.enabled = false`) |
| 4 | Sanity Check | Cross-reference every claim against source code | Yes (`--no-sanity-check` flag) |
| 5 | Verification | Run 10-point checklist | Never |
| 6 | Changelog Update | Append entry to `docs/changelog.md` | Never |
| 7 | Index Update | Update PROJECT-INDEX.md (only on structural changes) | Auto (only when needed) |
| 8 | Docs Repo Commit | `git -C {docs-root} add -A && commit` | Never (skips if no docs repo) |

Pipeline completion is validated by the `post-modify-check.sh` SubagentStop hook, which checks for changelog update confirmation in the transcript.

---

## 8. Needs-Revision Tracker System

The docs repo maintains a `docs/needs-revision-tracker.md` file with items that need attention. The `/fp-docs:auto-revise` command processes this tracker:

- Reads all items listed under the Pending section
- Processes each item by executing the revise instruction
- Moves completed items from Pending to Completed with date
- Leaves failed items in Pending with failure notes

**Usage**:
```
/fp-docs:auto-revise                    # Process all pending items
/fp-docs:auto-revise --item 3           # Process only item #3
/fp-docs:auto-revise --item "posts"     # Process item matching "posts"
/fp-docs:auto-revise --range 1-5        # Process items 1 through 5
/fp-docs:auto-revise --dry-run          # Preview without making changes
```

---

## 9. Locals Contract System

For WordPress template components, the `/fp-docs:locals` command provides specialized documentation:

| Subcommand | Description | Needs CLI |
|------------|-------------|:---------:|
| `annotate` | Add `@locals` PHPDoc blocks to component source files | Yes |
| `contracts` | Generate `## Locals Contracts` sections in component docs | Yes |
| `cross-ref` | Trace caller→callee chains and generate `## Data Flow` sections | Yes |
| `validate` | Compare `@locals` PHPDoc against actual code usage | Yes |
| `shapes` | List shared shapes from `_locals-shapes.md` (reads docs only) | No |
| `coverage` | Report `@locals` annotation coverage across all components | Yes |

### Ephemeral WP-CLI Tool

The locals engine uses an ephemeral WP-CLI command (`wp fp-locals`) for ground-truth extraction. The PHP source lives in the plugin at `framework/tools/class-locals-cli.php` and uses `token_get_all()` to achieve 100% accurate extraction of `$locals` keys, types, required/optional status, and default values from all 447 component files.

**Lifecycle**: Before any CLI-dependent subcommand, the instruction file runs the setup script which copies the PHP file to the theme and registers it in `functions.php`. After the operation completes (success or failure), the teardown script removes both the file and the registration. A SubagentStop safety-net hook auto-cleans orphaned artifacts if teardown was missed.

**CLI capabilities** (beyond what regex/AI can do):
- Type inference from wrapping functions (`esc_url` → string, `intval` → int, `absint` → int, `boolval` → bool)
- Type inference from cast operators (`(int)`, `(string)`, `(bool)`, `(array)`)
- Default value capture from `??` coalesce operators
- Guard detection (`isset()`, `empty()`, `array_key_exists()`) for Required/Optional classification
- De-duplication with Required upgrade (if any unguarded access exists, the key is Required)
- Cross-reference: tokenizes entire theme to find all `get_template_part()` callers with passed keys

**Fallback**: When ddev is unavailable (environment not running, ddev not installed), instruction files fall back to manual extraction using Read/Grep tools. This fallback is less accurate.

---

## 10. Live Environment Testing

The `/fp-docs:test` command can validate documentation against a running local dev environment:

```
/fp-docs:test rest-api     # Test REST endpoint docs against live API
/fp-docs:test cli          # Test CLI docs against actual WP-CLI output
/fp-docs:test templates    # Verify template files exist at documented paths
/fp-docs:test visual       # Navigate to foreignpolicy.local pages, capture screenshots, verify docs against rendered site
```

**Prerequisites**:
- Local URL accessible: `https://foreignpolicy.local/`
- WP-CLI available via: `ddev wp`
- Self-signed SSL (uses `curl -sk`)

---

## 11. Best Practices

### Getting Started
1. Run `/fp-docs:help` to see all available commands grouped by type
2. Run `/fp-docs:setup` to verify everything is configured correctly
3. Run `/fp-docs:sync` to ensure docs branch matches your codebase branch
4. Run `/fp-docs:audit --depth quick` to get a baseline of documentation health
5. Use `/fp-docs:do "what you want"` anytime you are not sure which command to use

### Daily Development Workflow
1. Start a Claude Code session in your codebase workspace
2. The SessionStart hooks automatically check branch sync and inject plugin context
3. If branch mismatch warning appears, run `/fp-docs:sync` before doing doc work
4. After making code changes, run `/fp-docs:auto-update` to catch up docs
5. For known issues, use `/fp-docs:revise` with a specific description
6. Periodically run `/fp-docs:audit --depth standard` to find stale docs

### Before Merging a Feature Branch
1. Run `/fp-docs:audit --depth deep` to find all discrepancies in your branch
2. Fix any issues found with `/fp-docs:revise` or `/fp-docs:auto-update`
3. Run `/fp-docs:verify` to confirm the 10-point checklist passes
4. Run `/fp-docs:sync merge` to merge docs branch into docs master

### Documentation Quality Checks
- Use `/fp-docs:sanity-check` for zero-tolerance accuracy verification on critical docs
- Use `/fp-docs:verbosity-audit` to find summarization language and missing enumerations
- Use `/fp-docs:citations audit` to verify citation accuracy
- Use `/fp-docs:test` to validate docs against the live environment

### When Adding New Code
1. Write your code first
2. Run `/fp-docs:add "description of new code"` to generate initial docs
3. Review the generated docs for accuracy
4. Run `/fp-docs:sanity-check` on the new doc to verify all claims

### Pre-Execution Control (Phase 16)
- Use `--no-research` for quick operations when latency matters -- skips the Research Phase. The planner will create a strategy without pre-analyzed source context, which is fine for simple operations.
- Use `--plan-only` to preview what an operation will do before executing -- stops after the Plan Phase and displays the execution plan. Run the same command without `--plan-only` to execute.
- Plan files persist at `.fp-docs/plans/` and auto-prune after 30 days (configurable via `plans.retention_days`).

### Batch Operations
- Use `/fp-docs:auto-revise` to process the needs-revision tracker in bulk
- Use `/fp-docs:parallel` for large-scope operations across many files (requires Agent Teams)
- The orchestrator handles batch operations natively via teams when scope exceeds configured thresholds
- The chunk delegation system auto-triggers when scope exceeds 8 docs or 50 functions
- All batch/parallel operations benefit from the orchestrator's git serialization: a single atomic commit covers all changes

---

## 12. Common Gotchas and Things to Watch Out For

### Git Repo Confusion
The biggest pitfall is confusing the three git repos. The docs directory is a SEPARATE git repo nested inside the codebase workspace:
- **Codebase git**: `git -C {wp-content-root}`
- **Docs git**: `git -C {themes/foreign-policy-2017/docs/}`
- The codebase repo MUST gitignore `themes/foreign-policy-2017/docs/`
- Never run `git add` in the codebase repo expecting to capture doc changes
- Never run `git -C {docs-root}` expecting to operate on codebase files

### Branch Sync
- Always check branch sync status at the start of a session
- If you switch codebase branches, run `/fp-docs:sync` to create/switch the matching docs branch
- Diff reports accumulate in `docs/diffs/` and are committed to the docs repo — do not clean them up

### Pipeline Always Runs
- Every doc-modifying command runs the full 8-stage pipeline
- The pipeline ALWAYS writes to `changelog.md` (stage 6) and attempts a docs commit (stage 8)
- The SubagentStop hook validates that the changelog was updated; missing it triggers a warning
- You can skip individual stages with flags (`--no-citations`, etc.) but verify and changelog never skip

### Verbosity Zero Tolerance
- The verbosity engine has gap_tolerance of 0 by default
- Summarization language is actively banned (e.g., "and more", "etc.", "various", "several")
- If the source has 12 helper functions, the docs MUST document all 12 — no "and 5 more"

### Read-Only vs Write Engines
- The `validate` engine has `disallowedTools: [Write, Edit]` — it NEVER modifies files
- Use `/fp-docs:audit`, `/fp-docs:verify`, `/fp-docs:sanity-check`, `/fp-docs:test` for safe read-only checks
- Use `/fp-docs:revise`, `/fp-docs:add`, `/fp-docs:auto-update` for actual modifications

### [NEEDS INVESTIGATION] Markers
- Engines use `[NEEDS INVESTIGATION]` for anything they cannot verify from source code
- This is preferable to guessing or fabricating information
- Review these markers in generated docs and resolve them manually or with `/fp-docs:revise`

### Permission Model
- The plugin only auto-allows Read, Grep, and Glob
- Write, Edit, and Bash will prompt for user approval
- This means validation commands run without permission prompts, but modification commands will ask

### Multi-Agent Orchestration
- All 23 commands route through the orchestrate engine, which is a pure dispatcher (D-06) that never executes operations directly
- All operations proceed through a 5-phase model: Research (researcher) -> Plan (planner) -> Write/Read/Admin (specialist) -> Review (validate) -> Finalize (orchestrator)
- Write operations use 5 agents: orchestrate + researcher + planner + specialist + validate
- Read-only operations use a 4-agent path: orchestrate + researcher + planner + specialist (with actionable output)
- Only the orchestrator commits to git in delegated mode -- specialist engines do not execute git operations
- The orchestrator extracts only summary metrics from delegation results (D-09) to keep context lean
- Use `--no-research` for quick operations when latency matters (skips Research Phase)
- Use `--plan-only` to preview what an operation will do before executing (stops after Plan Phase)

### Execution Mode (`--batch-mode`)
- `--batch-mode subagent` (default): Smart subagent spawning. 1 file = single call, 2-8 = parallel, 9+ = batched waves.
- `--batch-mode team` (or `--use-agent-team`): Agent Teams with confirmation prompt. Teammates work directly as specialists.
- `--batch-mode sequential`: One-at-a-time for operations requiring strict ordering.

### Parallel Operations
- `/fp-docs:parallel` requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` environment variable
- The orchestrator handles batch operations natively using the `--batch-mode` flag system
- Batch size limit is 5 files per team batch
- TeammateIdle and TaskCompleted hooks validate team member phase completion and task outputs

### Remediation Plan Staleness
- If you save a remediation plan (`--plan-only`), then modify the affected files before running `/fp-docs:remediate`, the plan may be stale
- The remediate command checks for file changes since plan creation and warns if files have been modified
- You can force execution on a stale plan, but re-running the audit is recommended to get accurate findings

### Drift Detection
- Git hooks only fire on merge/rebase operations (post-merge, post-rewrite), not on individual commits to your own branch
- Shell integration requires manually adding a `source` line to your `.zshrc` -- `/fp-docs:setup` generates the script but does not modify your shell config
- Drift signals auto-clear after successful doc operations (revise, auto-update, auto-revise, etc.) -- no manual cleanup needed for docs you have already updated
- The `staleness.json` and `drift-pending.json` files live in `.fp-docs/` inside the docs repo directory, not in the codebase repo
- If git hooks are not installed, drift detection is passive-only (no automatic analysis on pull) -- run `/fp-docs:setup` to install hooks

### Model Allocation
- The `orchestrate`, `modify`, `validate`, `citations`, `api-refs`, `locals`, and `researcher` engines use Opus (the most capable model)
- The `verbosity`, `index`, `system`, and `planner` engines use Sonnet (sufficient for their structured tasks)
- All engines inherit the user's configured model via `model: inherit` or `model: opus`/`model: sonnet`
- Researcher uses opus for deep code analysis (D-12); planner uses sonnet since planning is structured/formulaic (D-12)

### Visual Verification SSL Errors
- The plugin configures triple-layer SSL bypass for ddev's self-signed certificates (CLI flag, Chromium launch arg, browser context option)
- If SSL errors still occur, verify `.mcp.json` is loaded by Claude Code and the Playwright MCP server is running
- Check with a manual navigation attempt: the `browser_navigate` tool should be available as a callable tool

### Visual Tests Skip with "ddev not running"
- Visual scope requires the local WordPress environment
- Run `ddev start` in the codebase directory before running `/fp-docs:test visual`
- The visual scope checks all three prerequisites (visual.enabled config, MCP tool availability, ddev running) before proceeding

### Screenshots and Token Budgets
- Use `browser_snapshot` (accessibility tree) for structural verification -- this is the primary verification tool
- Screenshots are for visual evidence where snapshot alone is insufficient (e.g., styling, positioning, visual hierarchy)
- The visual scope prioritizes snapshots over screenshots to minimize token usage

---

## 13. Source-to-Documentation Mapping

Source-to-doc mapping is managed by `source-map.json` at the plugin root, accessed through `lib/source-map.cjs`. This is the single source of truth for all source-to-doc mapping -- no competing tables exist in config files, modules, or instruction files.

**CLI commands** (run via Bash tool):
```bash
# Look up doc target for a source file
node {plugin-root}/fp-tools.cjs source-map lookup <source-path>

# Reverse lookup: find source entries for a doc
node {plugin-root}/fp-tools.cjs source-map reverse-lookup <doc-path>

# List all unmapped source files
node {plugin-root}/fp-tools.cjs source-map unmapped

# Regenerate mapping from codebase/docs scan
node {plugin-root}/fp-tools.cjs source-map generate

# Dump full source-map.json
node {plugin-root}/fp-tools.cjs source-map dump
```

**Representative mappings** (full mapping in source-map.json, 30+ directory entries):

| Source Path | Documentation Target |
|------------|---------------------|
| `inc/post-types/` | `docs/02-post-types/` |
| `helpers/` | `docs/06-helpers/` |
| `components/` | `docs/05-components/` |
| `inc/hooks/` | `docs/08-hooks/` |
| `inc/rest-api/` | `docs/09-api/rest-api/` |

---

## 14. Key Project Files (in the docs repo, not the plugin)

| File | Purpose |
|------|---------|
| `docs/changelog.md` | Documentation changelog (written to by every modification) |
| `docs/needs-revision-tracker.md` | Queue of items needing revision (consumed by auto-revise) |
| `docs/About.md` | Documentation hub / table of contents |
| `docs/claude-code-docs-system/PROJECT-INDEX.md` | Master codebase reference index |
| `docs/diffs/{date}_{branch}_diff_report.md` | Branch diff reports (accumulated history) |
| `docs/.fp-docs/staleness.json` | Persistent staleness tracker (drift signals from git hooks, audits, manual sources) |
| `docs/.fp-docs/drift-pending.json` | Temporary drift signals from git hooks (merged into staleness.json on session start, then deleted) |
