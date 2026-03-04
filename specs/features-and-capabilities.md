# fp-docs Features and Capabilities Research

> **Updated 2026-03-04**: Added multi-agent orchestration architecture (orchestrate engine, mod-orchestration module, 3-phase pipeline delegation, delegation/standalone modes).

## What fp-docs Is

fp-docs is a Claude Code plugin that provides a complete documentation management system for the Foreign Policy (FP) WordPress codebase. It automates the creation, maintenance, validation, and deprecation of developer documentation by reading actual source code and producing structured, citation-backed docs that stay in sync with the codebase.

The plugin is distributed via the `fp-tools` marketplace and operates entirely through Claude Code's native plugin primitives: subagents (engines), skills (commands), hooks (lifecycle events), and modules (shared rule sets).

**Version**: 2.7.1
**Author**: Tom Kyser
**License**: MIT

---

## Problems fp-docs Solves

1. **Documentation drift**: Code changes but docs do not. fp-docs detects git diffs and auto-updates affected documentation.
2. **Inaccurate documentation**: Docs claim things that are not true about the code. fp-docs sanity-checks every factual claim against actual source code with zero-tolerance verification.
3. **Incomplete documentation**: LLMs naturally summarize and truncate. fp-docs enforces anti-compression rules that ban summarization phrases and require exhaustive enumeration of every function, parameter, hook, and constant.
4. **Missing citations**: Docs make claims without evidence. fp-docs generates verifiable code citations with file paths, symbol names, line ranges, and verbatim code excerpts.
5. **Stale API references**: Function signatures change but reference tables do not. fp-docs extracts actual signatures from source code and tracks provenance.
6. **Undocumented data contracts**: WordPress template components pass `$locals` arrays between files without formal contracts. fp-docs annotates source code with `@locals` PHPDoc blocks and generates contract tables.
7. **Branch mismatch**: The docs repo and codebase repo can get out of sync on different branches. fp-docs detects this and synchronizes branches.
8. **No documentation lifecycle**: Most codebases lack a systematic process from creation through maintenance to deprecation. fp-docs provides the full lifecycle.
9. **Multi-agent coordination complexity**: Documentation operations involve multiple concerns (writing, validation, citations, git commits) that benefit from specialized agents. fp-docs uses a universal orchestrator that delegates to specialist engines, coordinates pipeline phases across agents, and serializes git commits — enabling multi-agent execution for every command by default.

---

## Complete Command Catalog (19 Commands)

All commands are namespaced as `/fp-docs:*` and run in isolated subagent contexts (`context: fork`). Every command routes through the **orchestrate** engine, which classifies the command and delegates to the appropriate specialist engine. Write operations use 3+ agents (orchestrate + specialist + validate); read-only operations use a 2-agent fast path (orchestrate + specialist).

### Documentation Creation & Modification (5 commands)

These commands route to the **modify** engine and execute the full 8-stage post-modification pipeline after their primary operation.

| Command | Description | Engine |
|---------|-------------|--------|
| `/fp-docs:add` | Create documentation for entirely new code that does not have docs yet. Describe the new code and the engine analyzes it and generates complete documentation. | modify |
| `/fp-docs:revise` | Fix specific documentation you know is wrong or outdated. Provide a description of what needs fixing and the engine locates, updates, and validates the affected docs. | modify |
| `/fp-docs:auto-update` | Auto-detect code changes since last documentation update. Scans `git diff` from the last 5 commits, identifies affected docs, and updates them automatically. | modify |
| `/fp-docs:auto-revise` | Batch-process all items listed in the needs-revision-tracker. Reads the tracker, processes each item, and marks them complete. | modify |
| `/fp-docs:deprecate` | Mark documentation as deprecated when code has been removed or replaced. Updates the doc with a deprecation notice and updates trackers. | modify |

### Validation & Auditing (4 commands)

These commands route to the **validate** engine and are strictly read-only (Write and Edit tools are disallowed).

| Command | Description | Engine |
|---------|-------------|--------|
| `/fp-docs:audit` | Compare documentation against source code and report discrepancies. Supports quick, standard, and deep audit depths. | validate |
| `/fp-docs:verify` | Run the 10-point verification checklist on documentation files without making changes. Reports pass/fail for each check. | validate |
| `/fp-docs:sanity-check` | Validate that documentation claims match actual source code. Zero-tolerance mode flags any discrepancy. | validate |
| `/fp-docs:test` | Execute runtime validations against the local development environment. Tests REST endpoints, WP-CLI commands, and template rendering. | validate |

### Citation Management (1 command with 4 subcommands)

Routes to the dedicated **citations** engine.

| Command | Subcommands | Description | Engine |
|---------|-------------|-------------|--------|
| `/fp-docs:citations` | `generate`, `update`, `verify`, `audit` | Manage code citations in documentation files. Generate creates new citation blocks, update refreshes stale ones, verify checks format validity, audit performs deep semantic accuracy checks. | citations |

### API Reference Management (1 command with 2 subcommands)

Routes to the dedicated **api-refs** engine.

| Command | Subcommands | Description | Engine |
|---------|-------------|-------------|--------|
| `/fp-docs:api-ref` | `generate`, `audit` | Generate or update API Reference sections in documentation files. Extracts function signatures from source code and creates formatted reference tables with provenance tracking. | api-refs |

### Locals Contract Management (1 command with 6 subcommands)

Routes to the dedicated **locals** engine.

| Command | Subcommands | Description | Engine |
|---------|-------------|-------------|--------|
| `/fp-docs:locals` | `annotate`, `contracts`, `cross-ref`, `validate`, `shapes`, `coverage` | Manage `$locals` variable contract documentation for WordPress template components. Annotate adds `@locals` PHPDoc blocks to source code, contracts generates tables in docs, cross-ref traces caller chains, validate checks contracts against code, shapes manages shared data structures, coverage reports documentation coverage metrics. | locals |

### Verbosity Auditing (1 command)

Routes to the dedicated **verbosity** engine (read-only, Write and Edit disallowed).

| Command | Description | Engine |
|---------|-------------|--------|
| `/fp-docs:verbosity-audit` | Scan existing documentation for verbosity gaps: missing items, summarization language, unexpanded enumerables. Supports quick, standard, and deep depths. | verbosity |

### Index & Metadata Management (2 commands)

Route to the **index** engine.

| Command | Description | Engine |
|---------|-------------|--------|
| `/fp-docs:update-index` | Refresh the PROJECT-INDEX.md codebase reference. Supports update (incremental) and full (complete regeneration) modes. | index |
| `/fp-docs:update-claude` | Regenerate the CLAUDE.md template with current skill inventory, documentation links, and project configuration. | index |

### System & Maintenance (4 commands)

Route to the **system** engine.

| Command | Description | Engine |
|---------|-------------|--------|
| `/fp-docs:setup` | Initialize or verify the fp-docs plugin installation. Checks plugin structure, docs repo setup, codebase gitignore, and branch sync state across four phases. | system |
| `/fp-docs:sync` | Synchronize the docs repo branch with the codebase branch. Creates or switches docs branches, generates diff reports, and optionally merges docs branches. | system |
| `/fp-docs:update-skills` | Regenerate all plugin skills from current prompt definitions. Syncs skill files with source-of-truth prompts. | system |
| `/fp-docs:parallel` | Run documentation operations in parallel across multiple files using Agent Teams. Batches files into groups of up to 5 and assigns each batch to a teammate. Falls back to sequential if Agent Teams are disabled or scope is small (<3 files). Requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` env variable. | system |

---

## The 9 Engines

Each engine is a subagent definition with a specific domain, tool permissions, and preloaded modules. All 9 engines can operate in **Delegation Mode** (orchestrator-coordinated, executing assigned pipeline phases) or **Standalone Mode** (self-contained, full pipeline).

### 1. orchestrate (color: white)
- **Domain**: Universal command routing, multi-agent delegation, pipeline phase coordination
- **Operations**: All 19 commands route through orchestrate; delegates to specialist engines
- **Tools**: Read, Write, Edit, Grep, Glob, Bash (full write access for Finalize Phase)
- **Modules**: mod-standards, mod-project, mod-orchestration
- **Model**: opus, maxTurns: 100
- **Key behavior**: The universal entry point for all commands. Parses routing metadata from skills, classifies commands (write vs read-only), delegates to specialist engines with pipeline phase assignments, coordinates Review Phase via the validate engine, and handles the Finalize Phase (changelog, index, git commit) itself. Only the orchestrator commits to git in delegated mode. For read-only commands, uses a fast-path 2-agent delegation. For batch operations exceeding thresholds, creates Agent Teams with specialist teammates.

### 2. modify (color: green)
- **Domain**: Documentation creation and modification
- **Operations**: revise, add, auto-update, auto-revise, deprecate
- **Tools**: Read, Write, Edit, Grep, Glob, Bash (full write access)
- **Modules**: mod-standards, mod-project, mod-pipeline, mod-changelog, mod-index
- **Model**: opus, maxTurns: 75
- **Key behavior**: The only engine that executes the full 8-stage post-modification pipeline. Always reads actual source code before writing docs. Uses `[NEEDS INVESTIGATION]` instead of guessing.

### 3. validate (color: cyan)
- **Domain**: Documentation validation and accuracy verification
- **Operations**: audit, verify, sanity-check, test
- **Tools**: Read, Grep, Glob, Bash (Write and Edit disallowed)
- **Modules**: mod-standards, mod-project, mod-validation
- **Model**: opus, maxTurns: 75
- **Key behavior**: Strictly read-only. Classifies issues by severity (CRITICAL, HIGH, MEDIUM, LOW). For sanity-check, zero tolerance: every factual claim must be verified. For test, executes against the live local dev environment.

### 4. citations (color: yellow)
- **Domain**: Code citation generation, maintenance, and verification
- **Operations**: generate, update, verify, audit
- **Tools**: Read, Write, Edit, Grep, Glob, Bash
- **Modules**: mod-standards, mod-project, mod-citations
- **Model**: opus, maxTurns: 75
- **Key behavior**: Three citation tiers based on function length (Full for <=15 lines, Signature for 16-100, Reference for >100). Tracks citation freshness (Fresh, Stale, Drifted, Broken, Missing). Generate/update run a subset of the pipeline; verify/audit are read-only.

### 5. api-refs (color: yellow)
- **Domain**: API Reference table generation and auditing
- **Operations**: generate, audit
- **Tools**: Read, Write, Edit, Grep, Glob, Bash
- **Modules**: mod-standards, mod-project, mod-api-refs
- **Model**: opus, maxTurns: 75
- **Key behavior**: Extracts actual function signatures from PHP/JS source. Mandatory provenance tracking (PHPDoc, Verified, Authored). Covers 7 layers: helpers, components, hooks, shortcodes, rest-api, cli, integrations. Audit is read-only.

### 6. locals (color: magenta)
- **Domain**: `$locals` variable contract documentation
- **Operations**: annotate, contracts, cross-ref, validate, shapes, coverage
- **Tools**: Read, Write, Edit, Grep, Glob, Bash
- **Modules**: mod-standards, mod-project, mod-locals
- **Model**: opus, maxTurns: 75
- **Key behavior**: WordPress-specific engine for documenting the data shapes passed between PHP template components. Classifies keys as Required (bare `$locals['key']` access) vs Optional (guarded with `isset`/`??`/`empty`). Uses `token_get_all()` via WP-CLI for precise variable tracking. Supports both named keys and integer-indexed `$locals[0]` patterns.

### 7. verbosity (color: red)
- **Domain**: Anti-brevity enforcement and verbosity gap detection
- **Operations**: audit
- **Tools**: Read, Grep, Glob, Bash (Write and Edit disallowed)
- **Modules**: mod-standards, mod-project, mod-verbosity
- **Model**: opus, maxTurns: 50
- **Key behavior**: Read-only scanner. Enforces a banned phrase list (e.g., "etc.", "and more", "various") and banned regex patterns. Reports violations at HIGH (banned phrases), MEDIUM (incomplete lists), LOW (style issues) severity. Deep scans also check scope manifests.

### 8. index (color: blue)
- **Domain**: Documentation index maintenance and metadata synchronization
- **Operations**: update-project-index, update-doc-links, update-example-claude
- **Tools**: Read, Write, Edit, Grep, Glob, Bash
- **Modules**: mod-standards, mod-project, mod-index
- **Model**: opus, maxTurns: 50
- **Key behavior**: Uses `git ls-files` as source of truth, not filesystem listing. Supports incremental (update), quick, and full regeneration modes. CLAUDE.md regeneration only touches documentation sections.

### 9. system (color: blue)
- **Domain**: Plugin self-maintenance and configuration
- **Operations**: update-skills, setup, sync, parallel
- **Tools**: Read, Write, Edit, Grep, Glob, Bash
- **Modules**: mod-standards, mod-project
- **Model**: opus, maxTurns: 50
- **Key behavior**: Setup runs 4 phases (plugin verification, docs repo setup, gitignore check, branch sync). Sync manages the three-repo branch mirroring model. Update-skills regenerates skill files while preserving customizations.

---

## The 11 Shared Modules

Modules are preloaded into engines via the `skills:` frontmatter field. They are not user-invocable. Each rule lives in exactly one module (no duplication).

| Module | Domain | Preloaded By |
|--------|--------|-------------|
| mod-standards | File naming, directory structure, document templates (10 types), content rules, depth requirements, cross-reference requirements, integrity rules | All 9 engines |
| mod-project | FP-specific paths, source-to-doc mapping (30+ directories), appendix cross-references, environment settings | All 9 engines |
| mod-pipeline | 8-stage post-modification pipeline definition, trigger matrix, skip conditions, completion markers | modify |
| mod-changelog | Changelog entry format (date, files changed, summary), append-only rules | modify |
| mod-index | PROJECT-INDEX.md update modes (quick/update/full), git consistency rules | modify, index |
| mod-citations | Citation block format (3 tiers), marker grammar, placement rules, freshness model (5 states), excerpt rules | modify, citations |
| mod-api-refs | API Reference table format (5 columns), provenance rules, scope by doc type, completeness rule, ordering | modify, api-refs |
| mod-locals | @locals PHPDoc format, @controller format (HTMX), contract table columns, Required/Optional classification, shared shapes, ground truth engine | modify, locals |
| mod-verbosity | Anti-compression directives, banned phrases (15+), banned patterns (4 regex), scope manifest format, self-audit protocol, context window management tiers | modify, verbosity |
| mod-validation | 10-point verification checklist, sanity-check algorithm (zero-tolerance), confidence levels (HIGH/LOW), severity classification (CRITICAL/HIGH/MEDIUM/LOW) | modify, validate |
| mod-orchestration | Orchestration rules: delegation thresholds, pipeline phase assignments (Write/Review/Finalize), team protocol, git serialization rules, read-only fast-path classification, specialist-to-phase mapping | orchestrate |

---

## The Post-Modification Pipeline (8 Stages)

This is the core quality enforcement mechanism. It runs after every doc-modifying operation.

Under the multi-agent orchestration architecture, the pipeline is split into **3 phases** for delegation across specialist agents: **Write Phase** (primary op + stages 1-3, assigned to specialist engine), **Review Phase** (stages 4-5, assigned to validate engine), and **Finalize Phase** (stages 6-8, handled by orchestrator). In Standalone Mode, a single engine executes all 8 stages as before.

| Stage | Name | What It Does | Skip Condition |
|-------|------|-------------|----------------|
| 1 | Verbosity Enforcement | Builds scope manifest (counts every enumerable in source), checks output coverage, scans for banned phrases, fixes gaps | `verbosity.enabled = false` |
| 2 | Citation Generation/Update | For new docs: generates all citations. For revisions: updates stale citations, generates missing ones | `citations.enabled = false` |
| 3 | API Reference Sync | Verifies API Ref section exists (for applicable doc types), updates table rows, ensures provenance column populated | `api_ref.enabled = false` |
| 4 | Sanity Check | Cross-references every factual claim against source. Classifies as VERIFIED, MISMATCH, HALLUCINATION, or UNVERIFIED. LOW confidence blocks progression | `--no-sanity-check` flag |
| 5 | Verification | 10-point checklist: file existence, orphan check, index completeness, appendix spot-check, link validation, changelog check, citation format, API ref provenance, locals contracts, verbosity compliance | Never skipped |
| 6 | Changelog Update | Appends entry to `docs/changelog.md` listing every file changed and why | Never skipped |
| 7 | Index Update | Updates PROJECT-INDEX.md when structural changes occurred (new sections, major reorganization) | Skipped for content-only changes |
| 8 | Docs Repo Commit | `git -C {docs-root} add -A && git -C {docs-root} commit -m "fp-docs: {operation} -- {summary}"` | Never skipped (attempts if docs repo exists) |

The pipeline outputs a completion marker checked by the SubagentStop hook:
```
Pipeline complete: [verbosity: PASS] [citations: PASS] [sanity: HIGH] [verify: PASS] [changelog: updated] [docs-commit: committed|skipped]
```

---

## The Documentation Lifecycle

fp-docs enables a complete documentation lifecycle:

### 1. Create
- `/fp-docs:add` -- Generate documentation for entirely new code
- `/fp-docs:setup` -- Initialize the docs repo and plugin

### 2. Maintain
- `/fp-docs:revise` -- Fix known issues in specific docs
- `/fp-docs:auto-update` -- Detect and apply changes from recent commits
- `/fp-docs:auto-revise` -- Batch-process the needs-revision tracker
- `/fp-docs:citations update` -- Refresh stale citations
- `/fp-docs:api-ref generate` -- Update API Reference tables
- `/fp-docs:locals annotate` -- Add/update @locals annotations
- `/fp-docs:locals contracts` -- Regenerate contract tables
- `/fp-docs:update-index` -- Keep the master index current
- `/fp-docs:update-claude` -- Keep CLAUDE.md in sync
- `/fp-docs:sync` -- Keep docs and codebase branches aligned

### 3. Validate
- `/fp-docs:audit` -- Compare docs against source code
- `/fp-docs:verify` -- Run 10-point verification checklist
- `/fp-docs:sanity-check` -- Zero-tolerance claim validation
- `/fp-docs:test` -- Test against live local environment
- `/fp-docs:verbosity-audit` -- Detect summarization and incomplete enumeration
- `/fp-docs:citations verify` -- Check citation format validity
- `/fp-docs:citations audit` -- Deep semantic citation accuracy check
- `/fp-docs:api-ref audit` -- Audit API Reference completeness and accuracy
- `/fp-docs:locals validate` -- Verify contracts match code
- `/fp-docs:locals coverage` -- Report documentation coverage percentage

### 4. Deprecate
- `/fp-docs:deprecate` -- Mark docs as deprecated with notices, update trackers

---

## Batch and Parallel Capabilities

### Multi-Agent Orchestration (Default)
Every command now uses multi-agent execution by default via the orchestrate engine:
- **Write operations** use 3+ agents: orchestrate (coordinator) + specialist engine (Write Phase) + validate engine (Review Phase)
- **Read-only operations** use 2 agents: orchestrate (coordinator) + specialist engine (fast path)
- The orchestrator handles all git commits (Finalize Phase), ensuring atomic documentation updates

### Parallel Operations (`/fp-docs:parallel`)
- Requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` environment variable
- The orchestrator handles batch operations natively when scope exceeds configured thresholds
- Groups target files into batches of up to 5
- Creates Agent Team teammates for each batch, each running the appropriate specialist engine
- TeammateIdle and TaskCompleted hooks validate team member phase completion and task outputs
- Orchestrator handles Finalize Phase (changelog, index, single atomic git commit) for all batches
- Aggregates results into a unified report
- Falls back to sequential execution if teams are unavailable or scope < 3 files

### Auto-Batch Operations
- `/fp-docs:auto-update` -- Scans git diff of last 5 commits, processes all affected docs
- `/fp-docs:auto-revise` -- Processes all items in the needs-revision tracker

### Chunk-and-Delegate (Context Management)
- When scope exceeds 50 functions or 8 doc files, the engine automatically delegates to sub-agents
- Max 8 docs per agent, max 50 functions per agent
- Context pressure (>75% usage) triggers checkpoint-and-continue

---

## The Three-Repo Git Model

fp-docs operates across three separate git repositories:

| Repo | Location | Purpose |
|------|----------|---------|
| Codebase | `wp-content/` (git root) | FP WordPress source code. Gitignores `docs/` |
| Docs | `themes/foreign-policy-2017/docs/` | Nested git repo inside codebase. Branch-mirrors the codebase |
| Plugin | This repository | Distributed via fp-tools marketplace |

Key rules:
- Docs repo is a separate `.git` nested inside the codebase workspace
- Always use `git -C {docs-root}` for docs operations, never the codebase git
- Branch mirroring: when codebase is on branch `feature/xyz`, docs should mirror to the same branch name
- `/fp-docs:sync` detects mismatches and handles branch creation/switching
- Diff reports accumulate at `docs/diffs/` with date/branch naming

---

## Hook System

fp-docs uses 5 hook events across 7 scripts:

| Event | Script | Purpose |
|-------|--------|---------|
| SessionStart | `inject-manifest.sh` | Injects the plugin root path and manifest into the session context so engines can locate their instruction files |
| SessionStart | `branch-sync-check.sh` | Detects if the codebase and docs repo are on different branches and warns the user |
| SubagentStop (modify) | `post-modify-check.sh` | Validates that the modify engine completed its full pipeline by checking for the completion marker |
| SubagentStop (orchestrate) | `post-orchestrate-check.sh` | Validates that the orchestrate engine completed its full delegation cycle, including pipeline phase coordination and git commit serialization |
| TeammateIdle | `teammate-idle-check.sh` | Validates that teammates completed their assigned pipeline phases before going idle |
| TaskCompleted | `task-completed-check.sh` | Validates task outputs — checks for empty modifications, missing pipeline markers, and incomplete phase handoffs |

Additionally, `docs-commit.sh` handles the git commit to the docs repo.

---

## Noteworthy Design Choices

### 1. Engine-Skill Separation
Skills are thin routers with no logic. They declare which engine to invoke and which instruction file to read. All behavior lives in engine agents and instruction files. This makes the system composable: new commands only need a SKILL.md file and an instruction file.

### 2. Read-Only Validation
The validate and verbosity engines explicitly disallow Write and Edit tools via `disallowedTools`. This makes it impossible for validation operations to accidentally modify documentation. Audit/verify results are reports only.

### 3. Anti-Compression Philosophy
The verbosity system is philosophically opposed to LLM summarization tendencies. It maintains banned phrase lists and regex patterns, scope manifests that count every enumerable item, and zero-tolerance gap checking. "Length is not a concern. Completeness is the only concern."

### 4. Citation-as-Evidence
Every documentable code claim requires a citation block linking to the exact source file, symbol, and line range. Citations have a freshness model (Fresh, Stale, Drifted, Broken, Missing) with staleness detection. Three tiers (Full, Signature, Reference) scale verbatim code inclusion by function length.

### 5. Provenance Tracking
API Reference table rows include a `Src` column tracking how each entry was created: `PHPDoc` (extracted from docblocks), `Verified` (hand-verified against source), or `Authored` (manually written). This creates an audit trail for reference accuracy.

### 6. Module Deduplication
Each rule lives in exactly one module. Engines preload modules, but modules do not know about engines. This prevents rule conflicts and makes it clear where to modify any given rule.

### 7. Pipeline-as-Quality-Gate
The 8-stage pipeline is not optional. Verification and changelog stages never skip. The SubagentStop hook validates completion. This ensures every doc modification goes through the full quality process.

### 8. On-Demand Algorithm Loading
Six algorithm files in `framework/algorithms/` are loaded during pipeline stages, distinct from modules that are preloaded. This keeps engine context smaller until the algorithm is actually needed.

### 9. Memory Management
Every engine includes memory management instructions: update agent memory when discovering recurring patterns, frequently-changing files, common false positives, and codebase-specific conventions. This enables learning across sessions.

### 10. WordPress-Specific Locals Contracts
The locals engine addresses a WordPress-specific pattern where template components communicate via `$locals` arrays without formal type contracts. The engine annotates source code, generates contract tables, traces caller chains, and reports coverage -- solving a real problem specific to the FP codebase's architecture.

### 11. Universal Multi-Agent Orchestration
All 19 commands route through the orchestrate engine, which acts as a universal dispatcher. Write operations use a 3-phase pipeline delegation (Write Phase to specialist, Review Phase to validate engine, Finalize Phase handled by orchestrator). Read-only operations use a 2-agent fast path. Only the orchestrator commits to git in delegated mode, preventing commit conflicts. Engines support both Delegation Mode (orchestrator-coordinated) and Standalone Mode (self-contained) for backward compatibility.

---

## Configuration System

### system-config.md
Controls configurable behavior for the plugin:
- **Citations** (§1): Enabled/disabled, tier line thresholds (15/100 lines), line number inclusion, excerpt comment limit
- **Sanity Check** (§2): Default enabled, multi-agent review thresholds (5 docs / 3 sections)
- **API Reference** (§3): Enabled/disabled, valid provenance values, scope by doc type
- **Verbosity** (§4): Enabled/disabled, gap tolerance (0 = zero tolerance), chunk-and-delegate thresholds, complete banned phrase and pattern lists
- **Verification** (§5): 10-check count
- **Orchestration** (§6): Enabled/disabled, delegation thresholds (docs and stages), max team size, git serialization mode, fast-path read-only classification, phase assignment rules

### project-config.md
FP-specific configuration:
- Project identity (theme root, docs root, WP-CLI prefix, local URL)
- Source-to-documentation mapping (30+ source directories to doc targets)
- Appendix cross-references (7 appendix categories)
- Key paths (changelog, revision tracker, index, shapes, flagged concerns)
- Repository configuration (codebase repo, docs repo, plugin repo)
- Feature enables (all 5 features enabled)

### settings.json
Default tool permissions: Read, Grep, Glob are auto-allowed for all operations.

---

## Document Format Templates

fp-docs defines 10 document type templates in mod-standards:

1. **Post Type Doc**: Overview, Source File, Registration, Fields/Meta Keys, Hooks, Templates, Admin UI, Related Docs
2. **Taxonomy Doc**: Overview, Source File, Registration Args, Term Meta, Admin UI, Query Modifications, Related Docs
3. **Helper Doc**: Overview, Source File, Namespace, Functions (table), Related Docs
4. **Hook Doc**: Overview, Hooks (table), Dependencies, Related Docs
5. **Shortcode Doc**: Overview, per-shortcode sections with Attributes table, Output HTML, Example, Related Docs
6. **REST Endpoint Doc**: Overview, Route, Method, Parameters, Response Shape, Authentication, Related Docs
7. **Component Doc**: Overview, Files, Variables/Context, Callers, Related Docs
8. **JavaScript Doc**: Overview, Source File, Exports, Event Listeners, DOM Dependencies, Imports, Related Docs
9. **ACF Field Group Doc**: Overview, Sync Method, Fields, Location Rules, Related Docs
10. **Integration Doc**: Overview, Service, API, Credentials, Data Flow, Error Handling, Related Docs

---

## The 10-Point Verification Checklist

1. **File Existence** -- Every link in About.md resolves to an actual file
2. **Orphan Check** -- Every .md file in docs/ is linked from About.md or its parent _index.md
3. **Index Completeness** -- Every _index.md links all its sibling .md files
4. **Appendix Spot-Check** -- Operations touching hooks/shortcodes/REST/constants trigger appendix verification
5. **Link Validation** -- All relative markdown links in modified docs resolve to real files
6. **Changelog Check** -- changelog.md has an entry for today's date
7. **Citation Format Validation** -- All citation blocks match the grammar, cited files exist, cited symbols exist
8. **API Reference Provenance** -- API Ref sections exist where required, every row has valid Src value
9. **Locals Contracts Completeness** -- Component docs have Locals Contracts sections covering every component file
10. **Verbosity Compliance** -- Sample source function counts match API Reference row counts, no banned phrases

---

## Flags and Operation Modifiers

### Skip Flags (used with modify and related engines)
- `--no-citations` -- Skip citation generation/update stage
- `--no-sanity-check` -- Skip sanity-check stage
- `--no-verbosity` -- Skip verbosity enforcement stage
- `--no-api-ref` -- Skip API Reference sync stage
- `--no-index` -- Skip index update stage

### Mode Flags
- `--mode plan` -- Generate a plan without executing
- `--mode audit+plan` -- Audit first, then generate a plan
- `--dry-run` -- Report what would change without making modifications

### Depth Flags (for audit and verbosity operations)
- `--depth quick` -- Fast scan, limited scope
- `--depth standard` -- Default depth
- `--depth deep` -- Comprehensive scan including scope manifests

### Sync Subcommands
- `(no args)` -- Detect branches, create/switch docs branch to match, generate diff report
- `merge` -- Merge current docs feature branch into docs master, push, clean up
- `--force` -- Force branch switch even with uncommitted changes

### Citation Tiers
- `--tier micro|standard|comprehensive` -- Override auto-tier selection

### API Ref Layers
- `--layer helpers|components|hooks|shortcodes|rest-api|cli|all` -- Target specific code layer
