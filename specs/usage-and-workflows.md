# fp-docs Usage and Workflows Research

> Research compiled from reading all 19 skill files, 8 engine agents, hooks, scripts, configuration files, instruction files, and the manifest. This document covers installation, setup, daily workflows, command reference, branch sync, configuration, best practices, and gotchas.

---

## 1. Installation Methods

### Method A: Marketplace Install (Production)

fp-docs is distributed through the `fp-tools` marketplace, defined in `fp-docs/.claude-plugin/marketplace.json`:

```json
{
  "name": "fp-tools",
  "plugins": [
    {
      "name": "fp-docs",
      "source": "./plugins/fp-docs",
      "description": "Documentation management system for the Foreign Policy WordPress codebase"
    }
  ]
}
```

To install from the marketplace:
```
/plugin marketplace add tomkyser/fp-docs
/plugin install fp-docs@fp-tools
```

### Method B: Local Development (--plugin-dir)

For plugin development or testing local changes:
```bash
claude --plugin-dir ~/cc-plugins/fp-docs/plugins/fp-docs
```

**Critical path distinction**: Point `--plugin-dir` at `plugins/fp-docs/`, NOT the repo root. The repo root is the marketplace wrapper; `plugins/fp-docs/` is the actual plugin directory containing agents, skills, modules, hooks, etc.

### Plugin Identity

From `plugins/fp-docs/.claude-plugin/plugin.json`:
- Name: `fp-docs`
- Version: `2.7.0`
- License: MIT
- Repository: `https://github.com/tomkyser/fp-docs`
- All 19 user commands are namespaced as `/fp-docs:*`

### Default Permissions

From `plugins/fp-docs/settings.json`:
```json
{
  "permissions": {
    "allow": ["Read", "Grep", "Glob"]
  }
}
```

Only Read, Grep, and Glob are auto-allowed. Write, Edit, and Bash require user approval per-session (these are used by the `modify` and `system` engines but not auto-approved at the plugin level).

---

## 2. First-Time Setup Process

### Running Setup

```
/fp-docs:setup
```

This command routes to the `system` engine and runs a 4-phase verification:

#### Phase 1: Plugin Structure Verification
- Checks all required directories exist (agents/, skills/, hooks/, scripts/, framework/)
- Validates `plugin.json` manifest has required fields
- Verifies all 8 engine agent files exist
- Verifies all 19 user skill files + 10 shared modules
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

#### Setup Output
A structured report with per-phase pass/fail and installation health status:
- **HEALTHY**: All components present and configured
- **DEGRADED**: Optional components missing
- **BROKEN**: Critical components missing

### What Happens Automatically on Session Start

Two hooks fire on every SessionStart:

1. **inject-manifest.sh**: Injects the plugin root path and manifest content into the session context, so all engines know where to find their files.

2. **branch-sync-check.sh**: Detects codebase and docs branches, compares them. If mismatched, emits a `stopMessage` warning the user to run `/fp-docs:sync`. If docs repo is not found, emits advice to run `/fp-docs:setup`.

---

## 3. Typical Daily Workflows

### Workflow A: "I changed some code and need to update the docs"

**Command**: `/fp-docs:auto-update`
**Argument hint**: `"optional scope restriction"`
**Engine**: modify

**What it does**:
1. Automatically runs `git diff --name-only HEAD~5` to detect recently changed source files
2. Filters to documentation-relevant files (removes docs/, node_modules/, vendor/, etc.)
3. Maps each changed source file to its documentation target using the source-to-docs mapping table (e.g., `helpers/posts.php` maps to `docs/06-helpers/posts.md`)
4. Reads the current source code and existing documentation
5. Updates docs to reflect code changes; creates new docs for new files; adds REMOVED notices for deleted files
6. Runs the full 8-stage post-modification pipeline
7. Commits to the docs repo

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

- **quick**: Checks file existence, cross-references source-to-doc mapping, validates markdown links
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

---

## 4. Complete Command Reference

### Documentation Modification Commands (modify engine)

| Command | Arguments | Description |
|---------|-----------|-------------|
| `/fp-docs:revise` | `"description of what to fix"` | Fix specific documentation you know is wrong or outdated |
| `/fp-docs:add` | `"description of new code to document"` | Create documentation for new code that has no docs yet |
| `/fp-docs:auto-update` | `"optional scope restriction"` | Auto-detect code changes since last docs update and update all affected docs |
| `/fp-docs:auto-revise` | `"optional flags like --dry-run"` | Batch-process all items in the needs-revision-tracker |
| `/fp-docs:deprecate` | `"description of deprecated code"` | Mark documentation as deprecated when code is removed or replaced |

### Documentation Validation Commands (validate engine)

| Command | Arguments | Description |
|---------|-----------|-------------|
| `/fp-docs:audit` | `--depth quick\|standard\|deep [scope]` | Compare docs against source code, report discrepancies |
| `/fp-docs:verify` | `"optional scope"` | Run 10-point verification checklist (read-only) |
| `/fp-docs:sanity-check` | `"scope like docs/06-helpers/posts.md"` | Zero-tolerance claim validation against source code |
| `/fp-docs:test` | `"rest-api\|cli\|templates"` | Execute runtime validations against local dev environment |

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
| `/fp-docs:setup` | (none) | system | Initialize or verify plugin installation |
| `/fp-docs:sync` | `[merge] [--force]` | system | Synchronize docs repo branch with codebase branch |
| `/fp-docs:update-index` | `update\|full` | index | Refresh the PROJECT-INDEX.md codebase reference |
| `/fp-docs:update-claude` | (none) | index | Regenerate the CLAUDE.md template with current skill inventory |
| `/fp-docs:update-skills` | (none) | system | Regenerate all plugin skills from prompt definitions |

### Orchestration Command

| Command | Arguments | Engine | Description |
|---------|-----------|--------|-------------|
| `/fp-docs:parallel` | `operation scope flags` | (orchestrator) | Run docs operations in parallel across multiple files using Agent Teams |

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
5. If matched: injects "Repos synced" context
6. If mismatched: emits a `stopMessage` warning the user to run `/fp-docs:sync`

### Manual Sync Operations

**Default sync** (no args): `/fp-docs:sync`
1. Detects codebase and docs branches
2. If no matching docs branch exists: creates it from docs `master`
3. If matching branch exists but docs is on wrong branch: switches to it
4. Generates a diff report at `docs/diffs/{YYYY-MM-DD}_{branch}_diff_report.md`

**Merge sync**: `/fp-docs:sync merge`
1. Switches docs repo to master
2. Merges the current docs feature branch into master
3. Pushes docs master
4. Deletes the merged feature branch (cleanup)

**Force sync**: `/fp-docs:sync --force`
- Forces branch switch even with uncommitted docs changes

### Diff Reports

Generated during sync, diff reports contain:
- **LIKELY STALE** files: source file was modified, doc may not reflect changes
- **POSSIBLY STALE** files: source file in same directory was modified
- **STRUCTURAL CHANGES**: new/deleted source files affecting doc structure
- Recommended actions checklist

Reports accumulate in `docs/diffs/` as historical records.

---

## 6. Configuration Options

### Project Configuration (`framework/config/project-config.md`)

This file contains FP-specific settings:

- **Project identity**: Theme root, docs root, WP-CLI prefix (`ddev wp`), local URL (`https://foreignpolicy.local/`)
- **Source-to-Documentation Mapping**: 17 mapping rules (e.g., `helpers/` maps to `docs/06-helpers/`)
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

### How to Customize Behavior

To customize fp-docs behavior:
1. Modify `framework/config/system-config.md` to change thresholds and feature flags
2. Modify `framework/config/project-config.md` to change source-to-docs mappings, paths, or feature enables
3. Use per-command flags (`--no-citations`, `--no-sanity-check`, etc.) for one-off overrides

---

## 7. The Post-Modification Pipeline

Every doc-modifying operation runs an 8-stage pipeline after the core work:

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

| Subcommand | Description |
|------------|-------------|
| `annotate` | Add locals annotations to template components |
| `contracts` | Generate locals contract documentation |
| `cross-ref` | Cross-reference locals across templates and consumers |
| `validate` | Validate locals contracts against actual usage |
| `shapes` | Document the shape/structure of locals data |
| `coverage` | Report locals documentation coverage |

---

## 10. Live Environment Testing

The `/fp-docs:test` command can validate documentation against a running local dev environment:

```
/fp-docs:test rest-api     # Test REST endpoint docs against live API
/fp-docs:test cli          # Test CLI docs against actual WP-CLI output
/fp-docs:test templates    # Verify template files exist at documented paths
```

**Prerequisites**:
- Local URL accessible: `https://foreignpolicy.local/`
- WP-CLI available via: `ddev wp`
- Self-signed SSL (uses `curl -sk`)

---

## 11. Best Practices

### Getting Started
1. Run `/fp-docs:setup` first to verify everything is configured correctly
2. Run `/fp-docs:sync` to ensure docs branch matches your codebase branch
3. Run `/fp-docs:audit --depth quick` to get a baseline of documentation health

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

### Batch Operations
- Use `/fp-docs:auto-revise` to process the needs-revision tracker in bulk
- Use `/fp-docs:parallel` for large-scope operations across many files (requires Agent Teams)
- The chunk delegation system auto-triggers when scope exceeds 8 docs or 50 functions

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

### Parallel Operations
- `/fp-docs:parallel` requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` environment variable
- Falls back to sequential for scopes under 3 files
- Batch size limit is 5 files per team batch

### Model Allocation
- The `modify`, `validate`, `citations`, `api-refs`, and `locals` engines use Opus (the most capable model)
- The `verbosity`, `index`, and `system` engines use Sonnet (sufficient for their simpler tasks)
- All engines inherit the user's configured model via `model: inherit` or `model: opus`/`model: sonnet`

---

## 13. Source-to-Documentation Mapping Quick Reference

This is the core mapping that determines which source files correspond to which docs:

| Source Path | Documentation Target |
|------------|---------------------|
| `functions.php` | `docs/01-architecture/bootstrap-sequence.md` |
| `inc/post-types/` | `docs/02-post-types/` |
| `inc/taxonomies/` | `docs/03-taxonomies/` |
| `inc/custom-fields/` | `docs/04-custom-fields/` |
| `components/` | `docs/05-components/` |
| `helpers/` | `docs/06-helpers/` |
| `inc/shortcodes/` | `docs/07-shortcodes/` |
| `inc/hooks/` | `docs/08-hooks/` |
| `inc/rest-api/` | `docs/09-api/rest-api/` |
| `inc/endpoints/` | `docs/09-api/custom-endpoints/` |
| `layouts/` | `docs/10-layouts/` |
| `features/` | `docs/11-features/` |
| `lib/autoloaded/` | `docs/12-integrations/` |
| `inc/cli/` | `docs/16-cli/` |
| `inc/admin-settings/` | `docs/17-admin/` |
| `assets/src/scripts/` | `docs/18-frontend-assets/js/` |
| `assets/src/styles/` | `docs/18-frontend-assets/css/` |
| `build/` | `docs/00-getting-started/build-system.md` |
| `inc/roles/` | `docs/20-exports-notifications/` |

---

## 14. Key Project Files (in the docs repo, not the plugin)

| File | Purpose |
|------|---------|
| `docs/changelog.md` | Documentation changelog (written to by every modification) |
| `docs/needs-revision-tracker.md` | Queue of items needing revision (consumed by auto-revise) |
| `docs/About.md` | Documentation hub / table of contents |
| `docs/claude-code-docs-system/PROJECT-INDEX.md` | Master codebase reference index |
| `docs/diffs/{date}_{branch}_diff_report.md` | Branch diff reports (accumulated history) |
