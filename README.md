# fp-docs

Documentation management system for the Foreign Policy WordPress codebase. fp-docs is a Claude Code plugin that automates the creation, revision, validation, and maintenance of technical documentation by reading your source code directly and keeping docs in sync with every change.

fp-docs enforces zero-tolerance verbosity (every source item must be documented), cross-references every claim against actual code, manages citations with provenance tracking, and maintains a separate docs git repo that branch-mirrors your codebase. It ships 23 commands, 10 specialized agents (fp-docs-* prefix), workflows that orchestrate multi-agent execution, and an automated 8-stage post-modification pipeline that runs after every documentation change.

### What Problems It Solves

- **Documentation drift**: Code changes but docs don't. fp-docs detects git diffs and auto-updates affected documentation.
- **Inaccurate documentation**: Docs claim things that aren't true. fp-docs sanity-checks every factual claim against actual source code with zero-tolerance verification.
- **Incomplete documentation**: LLMs naturally summarize and truncate. fp-docs enforces anti-compression rules that ban summarization phrases ("etc.", "and more", "various") and require exhaustive enumeration of every function, parameter, hook, and constant.
- **Missing citations**: Docs make claims without evidence. fp-docs generates verifiable code citations with file paths, symbol names, line ranges, and verbatim code excerpts.
- **Stale API references**: Function signatures change but reference tables don't. fp-docs extracts actual signatures from source and tracks provenance (PHPDoc, Verified, Authored).
- **Undocumented data contracts**: WordPress template components pass `$locals` arrays between files without formal contracts. fp-docs annotates source code with `@locals` PHPDoc blocks and generates contract tables.
- **Branch mismatch**: The docs repo and codebase repo can drift to different branches. fp-docs detects this on session start and synchronizes branches.
- **No documentation lifecycle**: Most codebases lack a systematic process from creation through maintenance to deprecation. fp-docs provides the full lifecycle: create, maintain, validate, deprecate.

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Updating fp-docs](#updating-fp-docs)
- [Command Reference](#command-reference)
- [Common Workflows](#common-workflows)
- [Architecture](#architecture)
- [Development Guide](#development-guide)
- [Configuration Reference](#configuration-reference)
- [Troubleshooting](#troubleshooting)
- [Version Management](#version-management)

---

## Installation

### Marketplace Install (Production)

```
/plugin marketplace add tomkyser/fp-tools
/plugin install fp-docs@fp-tools
```

### Local Development

```bash
claude --plugin-dir ~/cc-plugins/fp-docs
```

**Path note**: Point `--plugin-dir` at the `fp-docs/` directory. This IS the plugin root. The parent directory (`cc-plugins/`) is the marketplace wrapper (`fp-tools`).

### Default Permissions

The plugin auto-allows Read, Grep, and Glob. Write, Edit, and Bash operations will prompt for user approval per-session. Validation commands run without permission prompts; modification commands will ask.

---

## Quick Start

1. **Install the plugin** using one of the methods above.

2. **Run setup** to verify your environment:

   ```
   /fp-docs:setup
   ```

   Setup checks plugin structure, detects the docs repo, verifies the codebase `.gitignore` includes the docs directory, and confirms branch sync status. It reports overall health as HEALTHY, DEGRADED, or BROKEN.

3. **Sync branches** if prompted:

   ```
   /fp-docs:sync
   ```

4. **Try your first command** -- run a quick audit to see the state of your docs:

   ```
   /fp-docs:audit --depth quick
   ```

5. **Update docs after code changes**:

   ```
   /fp-docs:auto-update
   ```

From here, the SessionStart hooks handle branch detection and plugin context injection automatically on every new session.

---

## Updating fp-docs

### Check for Updates

```
/fp-docs:update --check
```

This compares your installed version against the latest release on GitHub and reports whether an update is available.

### Install an Update

```
/fp-docs:update
```

If an update is available, this pulls the latest version from the marketplace and applies it.

### Background Update Checking

fp-docs checks for updates automatically in the background on every session start. The SessionStart hook spawns a background process that queries the GitHub Releases API and writes the result to `.fp-docs/update-cache.json` with a 1-hour TTL. This means update checks never block your session startup, and repeated checks within an hour use the cached result.

If an update is available, you will see a notification in the statusline (installed by `/fp-docs:setup`).

### Manual Fallback

If the `/fp-docs:update` command does not work as expected, you can update manually:

1. Navigate to the local marketplace clone:

   ```bash
   cd ~/.claude/plugins/marketplaces/<marketplace-name>
   ```

2. Pull the latest changes:

   ```bash
   git pull origin master
   ```

3. Reinstall the plugin:

   ```
   /plugin install fp-docs@fp-tools
   ```

See [Plugin Not Updating to Latest Version](#plugin-not-updating-to-latest-version) in Troubleshooting for more details on edge cases.

---

## Command Reference

### Summary Table

| Command | Agent | Description |
|---------|-------|-------------|
| `/fp-docs:revise` | fp-docs-modifier | Fix specific documentation you know is wrong |
| `/fp-docs:add` | fp-docs-modifier | Create docs for new code |
| `/fp-docs:auto-update` | fp-docs-modifier | Auto-detect code changes and update affected docs |
| `/fp-docs:auto-revise` | fp-docs-modifier | Batch-process the needs-revision tracker |
| `/fp-docs:deprecate` | fp-docs-modifier | Mark docs as deprecated or removed |
| `/fp-docs:audit` | fp-docs-validator | Compare docs against source code |
| `/fp-docs:verify` | fp-docs-validator | Run 10-point verification checklist |
| `/fp-docs:sanity-check` | fp-docs-validator | Zero-tolerance claim validation |
| `/fp-docs:test` | fp-docs-validator | Runtime tests against local dev environment |
| `/fp-docs:citations` | fp-docs-citations | Manage code citations (generate/update/verify/audit) |
| `/fp-docs:api-ref` | fp-docs-api-refs | Generate or audit API Reference sections |
| `/fp-docs:locals` | fp-docs-locals | Manage locals contract documentation |
| `/fp-docs:verbosity-audit` | fp-docs-verbosity | Scan for verbosity gaps and summarization |
| `/fp-docs:update-index` | fp-docs-indexer | Refresh PROJECT-INDEX.md |
| `/fp-docs:update-claude` | fp-docs-indexer | Regenerate CLAUDE.md template |
| `/fp-docs:update-skills` | fp-docs-system | Regenerate command files from definitions |
| `/fp-docs:setup` | fp-docs-system | Initialize or verify installation |
| `/fp-docs:sync` | fp-docs-system | Synchronize docs branch with codebase branch |
| `/fp-docs:parallel` | fp-docs-system | Run operations in parallel across files |
| `/fp-docs:remediate` | (varies) | Resolve audit findings via batch remediation |
| `/fp-docs:do` | (none) | Smart router: natural language to command |
| `/fp-docs:help` | (none) | Grouped command reference |
| `/fp-docs:update` | fp-docs-system | Check for and install plugin updates |

All commands route through workflows that orchestrate agent spawning and pipeline execution. Write operations use 5 agents (workflow + researcher + planner + specialist + validator). Read-only operations use 4 agents (workflow + researcher + planner + specialist).

### Documentation Lifecycle Commands

#### `/fp-docs:revise`

Fix documentation you know is wrong or outdated. Reads the doc and its corresponding source code, identifies discrepancies, and makes targeted corrections.

```
/fp-docs:revise "fix the posts helper documentation"
/fp-docs:revise "the ad insertion shortcode docs say it defaults to 'sidebar' but it actually defaults to 'inline'"
/fp-docs:revise "update the newsletter taxonomy docs to reflect the new 'frequency' term meta field"
```

#### `/fp-docs:add`

Create documentation for new code that has no docs yet. Finds a sibling doc in the same section as a format template, reads the new source code, and generates complete documentation.

```
/fp-docs:add "document the new meilisearch helper"
/fp-docs:add "new podcast post type at inc/post-types/podcast.php"
/fp-docs:add "the new paywall feature at features/paywall/"
```

#### `/fp-docs:auto-update`

Auto-detect recent code changes (via `git diff`) and update all affected docs. Maps changed source files to documentation targets using `source-map.json` (via `lib/source-map.cjs`), then updates each affected doc.

```
/fp-docs:auto-update
/fp-docs:auto-update "only helpers/"
/fp-docs:auto-update "just the posts helper"
```

#### `/fp-docs:auto-revise`

Batch-process items from the `needs-revision-tracker.md` file. Moves completed items to the Completed section with timestamps.

```
/fp-docs:auto-revise                    # Process all pending items
/fp-docs:auto-revise --item 3           # Process only item #3
/fp-docs:auto-revise --item "posts"     # Process item matching "posts"
/fp-docs:auto-revise --range 1-5        # Process items 1 through 5
/fp-docs:auto-revise --dry-run          # Preview without making changes
```

#### `/fp-docs:deprecate`

Handle deprecated or removed code. For deprecated code still in the codebase, adds `[LEGACY]` markers and deprecation notices. For removed code, adds REMOVED notices and cleans up cross-references.

```
/fp-docs:deprecate "the AMP integration was removed"
/fp-docs:deprecate "the legacy gallery shortcode is deprecated, replaced by the new media-grid component"
```

### Validation Commands

These commands are read-only -- they never modify files.

#### `/fp-docs:audit`

Compare docs against source code at three depth levels:

- **quick**: File existence, source-to-doc cross-references (via `source-map.json`), markdown link validation
- **standard** (default): Quick checks plus git change detection from the last 30 days
- **deep**: Standard checks plus full content comparison of every doc against its source

```
/fp-docs:audit --depth quick
/fp-docs:audit --depth deep docs/06-helpers/
/fp-docs:audit --depth standard --section 02
```

#### `/fp-docs:verify`

Run the 10-point verification checklist: file existence, orphan check, index completeness, appendix spot-check, link validation, changelog check, citation format, API reference provenance, locals contracts, verbosity compliance.

```
/fp-docs:verify
/fp-docs:verify docs/06-helpers/
/fp-docs:verify docs/02-post-types/article.md
```

#### `/fp-docs:sanity-check`

Cross-reference every factual claim in a doc against source code. Classifies each claim as VERIFIED, MISMATCH, HALLUCINATION, or UNVERIFIABLE. Returns an overall confidence level (HIGH or LOW).

```
/fp-docs:sanity-check docs/06-helpers/posts.md
/fp-docs:sanity-check docs/09-api/
```

#### `/fp-docs:test`

Validate documentation against a running local dev environment. Requires `https://foreignpolicy.local/` to be accessible and `ddev wp` for WP-CLI.

```
/fp-docs:test rest-api     # Test REST endpoint docs against live API
/fp-docs:test cli          # Test CLI docs against actual WP-CLI output
/fp-docs:test templates    # Verify template files exist at documented paths
```

### Citations and References

#### `/fp-docs:citations`

Manage code citations embedded in documentation. Subcommands:

| Subcommand | Description |
|------------|-------------|
| `generate` | Create new citation blocks for docs that lack them |
| `update` | Refresh stale citations after source code changed |
| `verify` | Check citation format compliance |
| `audit` | Deep accuracy check of existing citations |

```
/fp-docs:citations generate docs/06-helpers/posts.md
/fp-docs:citations update docs/06-helpers/
/fp-docs:citations verify
/fp-docs:citations audit docs/06-helpers/
```

#### `/fp-docs:api-ref`

Generate or audit API Reference table sections in documentation.

| Subcommand | Description |
|------------|-------------|
| `generate` | Extract function signatures from source and create reference tables |
| `audit` | Check existing API reference sections for accuracy |

```
/fp-docs:api-ref generate docs/06-helpers/posts.md
/fp-docs:api-ref audit docs/06-helpers/
```

### Component Contracts

#### `/fp-docs:locals`

Manage `$locals` contract documentation for WordPress template components.

| Subcommand | Description |
|------------|-------------|
| `annotate` | Add `@locals` PHPDoc annotations to template source files |
| `contracts` | Generate locals contract tables in documentation |
| `cross-ref` | Cross-reference locals across templates and consumers |
| `validate` | Validate contracts against actual code usage |
| `shapes` | Document shared shape definitions |
| `coverage` | Report locals documentation coverage |

```
/fp-docs:locals annotate components/
/fp-docs:locals contracts docs/05-components/
/fp-docs:locals validate
/fp-docs:locals coverage
```

#### `/fp-docs:verbosity-audit`

Scan documentation for verbosity gaps: missing items, summarization language, unexpanded enumerables.

```
/fp-docs:verbosity-audit --depth quick
/fp-docs:verbosity-audit --depth deep docs/06-helpers/
```

### Index and System Commands

#### `/fp-docs:update-index`

Refresh the PROJECT-INDEX.md codebase reference. Modes: `update` (incremental) or `full` (rebuild).

```
/fp-docs:update-index update
/fp-docs:update-index full
```

#### `/fp-docs:update-claude`

Regenerate the CLAUDE.md template with the current command inventory.

#### `/fp-docs:update-skills`

Regenerate all plugin command files from their prompt definitions.

#### `/fp-docs:setup`

Initialize or verify the plugin installation. Runs a 7-phase check: plugin structure, docs repo, codebase gitignore, branch sync, git hooks, shell integration, and update notification.

#### `/fp-docs:sync`

Synchronize the docs repo branch with the codebase branch.

```
/fp-docs:sync                 # Create or switch to matching docs branch
/fp-docs:sync merge           # Merge docs feature branch into docs master
/fp-docs:sync --force         # Force switch even with uncommitted changes
```

#### `/fp-docs:parallel`

Run any docs operation in parallel across multiple files using Agent Teams. Requires the `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` environment variable. Falls back to sequential execution for scopes under 3 files.

```
/fp-docs:parallel auto-update docs/06-helpers/
/fp-docs:parallel audit --depth deep docs/
```

### The Documentation Lifecycle

The commands above map to a full documentation lifecycle:

1. **Create**: `/fp-docs:add` generates docs for new code; `/fp-docs:setup` initializes the environment
2. **Maintain**: `/fp-docs:revise`, `/fp-docs:auto-update`, `/fp-docs:auto-revise` keep docs current; citations, api-ref, locals, and index commands maintain specific subsystems
3. **Validate**: `/fp-docs:audit`, `/fp-docs:verify`, `/fp-docs:sanity-check`, `/fp-docs:test`, and `/fp-docs:verbosity-audit` check accuracy without modifying anything
4. **Deprecate**: `/fp-docs:deprecate` handles removed or replaced code with proper notices and tracker updates

### Common Flags

These flags work with modification commands (revise, add, auto-update, auto-revise, deprecate):

| Flag | Effect |
|------|--------|
| `--no-citations` | Skip citation generation/update |
| `--no-sanity-check` | Skip sanity-check stage |
| `--no-verbosity` | Skip verbosity enforcement |
| `--no-api-ref` | Skip API reference sync |
| `--no-index` | Skip PROJECT-INDEX update |
| `--mode plan` | Show what would change without executing |
| `--mode audit+plan` | Audit first, then show planned changes |

---

## Common Workflows

### Code Changed, Docs Need Updating

The most common scenario. You have made code changes and need docs to reflect them.

1. Start a session. The SessionStart hooks automatically check branch sync.
2. Run auto-update to detect and fix all affected docs:

   ```
   /fp-docs:auto-update
   ```

3. The command diffs recent commits, maps changed source files to their docs, updates each affected doc, and runs the full pipeline (verbosity, citations, sanity-check, verification, changelog, commit).

For a targeted fix where you know exactly what is wrong:

```
/fp-docs:revise "the posts helper now returns WP_Post objects instead of arrays"
```

### Writing Docs for New Code

You wrote new code and need documentation from scratch.

1. Make sure your code is committed (or at least saved).
2. Run add with a description:

   ```
   /fp-docs:add "new podcast post type at inc/post-types/podcast.php"
   ```

3. The agent finds a sibling doc in the same section for format guidance, reads your source code, generates complete documentation, and runs the full pipeline.
4. Review the output. If anything is marked `[NEEDS INVESTIGATION]`, resolve it with:

   ```
   /fp-docs:revise "clarify the podcast post type thumbnail sizes"
   ```

### Auditing Documentation Accuracy

You want to check how accurate your docs are without changing anything.

**Quick health check:**
```
/fp-docs:audit --depth quick
```

**Standard check** (includes recent git changes):
```
/fp-docs:audit --depth standard
```

**Deep check** (reads every doc and source file):
```
/fp-docs:audit --depth deep docs/06-helpers/
```

**Zero-tolerance claim verification** on a specific file:
```
/fp-docs:sanity-check docs/06-helpers/posts.md
```

**Full 10-point checklist:**
```
/fp-docs:verify
```

### Preparing Docs Before Merging a PR

Before merging a feature branch, make sure docs are complete and accurate.

1. Deep audit to find all discrepancies:

   ```
   /fp-docs:audit --depth deep
   ```

2. Fix issues found:

   ```
   /fp-docs:auto-update
   /fp-docs:revise "fix specific issue from audit"
   ```

3. Verify the 10-point checklist passes:

   ```
   /fp-docs:verify
   ```

4. Merge the docs branch into docs master:

   ```
   /fp-docs:sync merge
   ```

### Batch Processing Multiple Files

For large-scope operations across many files:

**Process all items in the revision tracker:**
```
/fp-docs:auto-revise
```

**Parallel operations** (requires Agent Teams):
```
/fp-docs:parallel auto-update docs/06-helpers/
/fp-docs:parallel audit --depth deep docs/
```

The chunk delegation system auto-triggers when scope exceeds 8 docs or 50 functions per agent.

---

## Architecture

fp-docs uses a **command-workflow-agent** architecture. User commands are thin routing files that reference workflows. Workflows orchestrate multi-agent execution. Agents are domain-specialized workers (modifier, validator, citations, etc.).

```
User invokes /fp-docs:revise → Command routes to workflow → Workflow spawns agents → Pipeline enforces quality
```

Key architectural concepts:

- **10 agents** with domain-specific knowledge (fp-docs-modifier, fp-docs-validator, fp-docs-citations, etc.)
- **16 references** (10 rule files + 6 algorithm files) loaded via `@-reference` by commands and workflows
- **8-stage post-modification pipeline** (verbosity, citations, API refs, sanity-check, verification, changelog, index, docs commit)
- **Three independent git repos** (codebase, docs, plugin) with branch mirroring
- **Hook system** (SessionStart, PreToolUse, SubagentStop, TeammateIdle, TaskCompleted) for lifecycle enforcement

> For full architectural details, see the **specs/** directory:
> - **[specs/architecture.md](specs/architecture.md)** -- Repository layout, routing, agents, references, pipeline internals, hook system, git model, configuration
> - **[specs/features-and-capabilities.md](specs/features-and-capabilities.md)** -- All 23 commands, 10 agents, pipeline stages, design philosophy, reference system
> - **[specs/usage-and-workflows.md](specs/usage-and-workflows.md)** -- Installation, workflows, configuration, troubleshooting, source-to-doc mapping

---

## Development Guide

### Adding a New Command

1. Create the command file at `commands/fp-docs/{name}.md` with YAML frontmatter and XML body:

   ```yaml
   ---
   name: "fp-docs:{name}"
   description: "What the command does"
   argument-hint: "expected arguments"
   allowed-tools:
     - Read
     - Grep
     - Glob
     - Bash
   ---
   ```

   The XML body includes `<objective>`, `<execution_context>` (with `@-reference` to workflow, doc-standards.md, fp-project.md), `<context>`, `<process>`, and `<success_criteria>`.

2. Create a workflow at `workflows/{name}.md` with the orchestration steps (or use an existing workflow if the command fits a known pattern).

3. Add the command to the ROUTING_TABLE in `lib/routing.cjs`.

### Adding a New Reference

1. Create the reference file at `references/{name}.md` with the rule or algorithm content.

2. Add it as an `@-reference` in the execution context of any command or workflow that needs it.

3. Follow the deduplication rules: each rule lives in exactly one reference; FP-specific values go in `fp-project.md`; domain rules go in domain-specific references; universal rules go in `doc-standards.md`.

### Adding a New Agent

1. Create the agent file at `agents/fp-docs-{name}.md` with GSD-style YAML frontmatter and XML system prompt:

   ```yaml
   ---
   name: "fp-docs-{name}"
   description: "What this agent does"
   tools:
     - Read
     - Grep
     - Glob
     - Bash
   model: opus
   maxTurns: 75
   ---
   ```

2. For read-only agents, add `disallowedTools: [Write, Edit]` to the frontmatter.

3. Update workflows that need to spawn this agent.

### Configuration Files

| File | Scope | What to Change |
|------|-------|----------------|
| `config.json` | Plugin-wide | Model profiles, feature flags, thresholds, pipeline settings |
| `source-map.json` | FP-specific | Source-to-documentation path mappings |

Use per-command flags (`--no-citations`, `--no-sanity-check`, etc.) for one-off overrides instead of changing config files.

---

## Configuration Reference

### Feature Flags (config.json)

| Setting | Default | Description |
|---------|---------|-------------|
| `citations.enabled` | `true` | Whether citations are required in docs |
| `citations.full_body_max_lines` | `15` | Line threshold for Full citation tier |
| `citations.signature_max_lines` | `100` | Line threshold for Signature citation tier |
| `api_ref.enabled` | `true` | Whether API Reference sections are required |
| `api_ref.provenance_values` | `PHPDoc, Verified, Authored` | Valid source column values |
| `verbosity.enabled` | `true` | Master switch for verbosity enforcement |
| `verbosity.gap_tolerance` | `0` | Zero tolerance for gaps between source and docs |
| `sanity_check.default_enabled` | `true` | Whether sanity-check runs by default |
| `sanity_check.multi_agent_threshold_docs` | `5` | Doc count that triggers multi-agent sanity review |
| `chunk_delegation.max_docs_per_agent` | `8` | Max docs a single agent processes |
| `chunk_delegation.max_functions_per_agent` | `50` | Max functions a single agent processes |
| `orchestration.enabled` | `true` | Master switch for multi-agent orchestration |
| `orchestration.parallel_threshold_files` | `3` | Fan-out threshold for parallel Agent spawns |
| `orchestration.team_threshold_files` | `8` | Team creation threshold for batched teammates |
| `orchestration.max_teammates` | `5` | Max concurrent teammates |
| `orchestration.validation_retry_limit` | `1` | Max retries on LOW validation confidence |
| `orchestration.single_commit` | `true` | Aggregate changes into one git commit |

### Source-to-Documentation Mapping (source-map.json)

Source-to-doc mapping is managed by `source-map.json` at the plugin root, accessed through `lib/source-map.cjs`. Use the CLI for lookups:

```bash
# Look up doc target for a source file
node fp-tools.cjs source-map lookup <source-path>

# Reverse lookup: doc to source
node fp-tools.cjs source-map reverse-lookup <doc-path>

# Regenerate mapping
node fp-tools.cjs source-map generate

# Dump full mapping
node fp-tools.cjs source-map dump
```

Representative mappings (full mapping in source-map.json, 30+ directory entries):

| Source Path | Documentation Target |
|-------------|---------------------|
| `inc/post-types/` | `docs/02-post-types/` |
| `helpers/` | `docs/06-helpers/` |
| `components/` | `docs/05-components/` |
| `inc/hooks/` | `docs/08-hooks/` |
| `inc/rest-api/` | `docs/09-api/rest-api/` |

---

## Troubleshooting

### Three-Repo Git Confusion

The most common pitfall. The docs directory is a separate git repo nested inside the codebase workspace.

- **Codebase git**: `git -C {wp-content-root}` -- tracks source code
- **Docs git**: `git -C {docs-root}` -- tracks documentation
- The codebase repo MUST gitignore `themes/foreign-policy-2017/docs/`
- Never run `git add` in the codebase repo expecting to capture doc changes
- Never run docs git commands expecting to see codebase files

If `/fp-docs:setup` reports issues with the gitignore, let it fix the configuration.

### Branch Sync Warnings on Session Start

If you see a branch mismatch warning when starting a session, it means your docs repo is on a different branch than your codebase. Run:

```
/fp-docs:sync
```

This creates or switches to the matching docs branch. If you recently switched codebase branches, always sync before doing any doc work.

### Permission Prompts

Modification commands (revise, add, auto-update, etc.) will prompt for Write/Edit/Bash permissions because the plugin only auto-allows Read, Grep, and Glob. This is by design -- validation commands run without prompts.

Approve these permissions when prompted. They apply to the current session only.

### Pipeline Changelog Warning

If you see a warning from the `handlePostModifyCheck` hook about a missing changelog update, it means the fp-docs-modifier agent did not complete its pipeline. This can happen if the agent ran out of turns or encountered an error. Re-run the command.

### `[NEEDS INVESTIGATION]` Markers

Agents use `[NEEDS INVESTIGATION]` for anything they cannot verify from source code. This is intentional -- it is better than guessing. Search for these markers in generated docs and resolve them with:

```
/fp-docs:revise "clarify the [NEEDS INVESTIGATION] item in posts.md"
```

### Verbosity Failures

The fp-docs-verbosity agent has zero tolerance by default. If a source file has 12 functions, the docs must document all 12. Summarization language like "and more", "etc.", "various", or "several" is actively banned. If verbosity enforcement fails, the pipeline blocks until all items are documented.

### Parallel Operations Not Working

`/fp-docs:parallel` requires the `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` environment variable to be set. Without it, the command falls back to sequential execution. It also falls back for scopes under 3 files.

### Plugin Not Updating to Latest Version

Claude Code's plugin update mechanism may not pull the latest version due to stale local cache or marketplace clones. The `plugin update` command sometimes does not fetch the latest commit from the remote repository before checking for updates.

**Manual git pull in the marketplace directory** (recommended workaround):

1. Navigate to the local marketplace clone in your terminal:

   ```bash
   cd ~/.claude/plugins/marketplaces/<marketplace-name>
   ```

   Replace `<marketplace-name>` with the marketplace that hosts the plugin. For fp-docs, this is the `fp-tools` marketplace directory (check `~/.claude/plugins/marketplaces/` for the exact folder name).

2. Pull the latest changes:

   ```bash
   git pull origin master
   ```

   Use `main` instead of `master` if the repository's default branch is `main`.

3. After pulling, run the plugin update command again or reinstall the plugin to apply the changes:

   ```
   /plugin update fp-docs
   ```

   If that still does not pick up the new version, reinstall:

   ```
   /plugin install fp-docs@fp-tools
   ```

This is a known Claude Code issue — the marketplace clone is a local git repository, and the update command does not always run `git fetch` before comparing versions.

### Docs Repo Not Found

If agents report they cannot find the docs repo, run:

```
/fp-docs:setup
```

Setup will detect whether the docs repo exists at `{codebase-root}/themes/foreign-policy-2017/docs/.git` and offer to clone it if missing.

### Key Files in the Docs Repo

| File | Purpose |
|------|---------|
| `docs/changelog.md` | Written to by every modification operation |
| `docs/needs-revision-tracker.md` | Queue consumed by `/fp-docs:auto-revise` |
| `docs/About.md` | Documentation hub and table of contents |
| `docs/claude-code-docs-system/PROJECT-INDEX.md` | Master codebase reference index |
| `docs/diffs/` | Accumulated branch diff reports (do not clean up) |

---

## Version Management

### Current Version

**1.0.0** -- Clean break for the independent repository era. The version was reset from 2.8.0 when fp-docs was extracted as a standalone submodule.

### Source of Truth

The canonical version is declared in `fp-docs/.claude-plugin/plugin.json`. All other version references (manifest, specs, CHANGELOG, README) must match this file.

### Versioning Governance

Plugin versions are bumped by the maintainer only. Tooling (including GSD and Claude) is never allowed to automatically increment version numbers, create git tags, or publish releases. All version changes require explicit human instruction.

### Release Flow

```
feature/task branch -> dev -> tag + dev release -> merge dev into master -> tag + master release
```

- **Feature/task branches**: Development work for specific phases or fixes
- **dev branch**: Integration testing; tagged as `D.{major}.{minor}.{patch}`
- **master branch**: Production releases; tagged as `{major}.{minor}.{patch}`
- Tags and releases are human-created via explicit instruction

### Tag Naming

| Branch | Tag Format | Example |
|--------|-----------|---------|
| master | `{major}.{minor}.{patch}` | `1.0.0` |
| dev | `D.{major}.{minor}.{patch}` | `D.1.0.0` |
