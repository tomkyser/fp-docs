# fp-docs Features and Capabilities

<!-- Updated 2026-03-29: Full rewrite for GSD command-workflow-agent architecture (Phase 10 conversion) -->

> **Updated 2026-03-29**: Architecture converted from skill-engine-module to GSD command-workflow-agent chain. 23 commands route through workflows that spawn specialized agents. References replace modules and algorithms. Hooks migrated from hooks.json to settings.json with standalone JS files. 10 agents (fp-docs-* prefix) replace 11 engines.

## What fp-docs Is

fp-docs is a Claude Code plugin that provides a complete documentation management system for the Foreign Policy (FP) WordPress codebase. It automates the creation, maintenance, validation, and deprecation of developer documentation by reading actual source code and producing structured, citation-backed docs that stay in sync with the codebase.

The plugin is distributed via the `fp-tools` marketplace and operates through the GSD command-workflow-agent architecture: commands (thin YAML+XML routing files), workflows (orchestrators that spawn agents), agents (domain-specialized workers), and references (shared knowledge loaded via @-reference).

**Version**: 1.0.0
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
9. **Multi-agent coordination complexity**: Documentation operations involve multiple concerns (writing, validation, citations, git commits) that benefit from specialized agents. fp-docs uses workflows that orchestrate agent spawning, coordinate pipeline phases across agents, and serialize git commits -- enabling multi-agent execution for every command by default.
10. **Invisible drift**: Code changes via git pull/merge go unnoticed until someone manually checks. fp-docs installs git hooks (post-merge, post-rewrite) that automatically analyze changed source files, map them to affected docs, and queue staleness signals. SessionStart nudges inside Claude Code and shell prompt notifications outside Claude Code ensure drift is always visible.

---

## Complete Command Catalog (23 Commands)

All 23 commands live in `commands/fp-docs/` as thin YAML+XML routing files. Each command declares its workflow via `@-reference`, which orchestrates agent spawning and pipeline execution. Write operations spawn specialized agents through the write workflow template (6 steps: initialize, research, plan, write phase, review phase, finalize phase). Read operations use the read workflow template (4 steps: initialize, research, plan, execute standalone). Meta commands (`/fp-docs:do` and `/fp-docs:help`) use inline workflows that execute directly without agent spawning.

All 23 commands are managed by the ROUTING_TABLE in `lib/routing.cjs`. Write operations use 5 agents (orchestrator + researcher + planner + specialist + validator); read-only operations use a 4-agent path (orchestrator + researcher + planner + specialist) with actionable output including per-issue command recommendations.

### Documentation Creation & Modification (5 commands)

These commands route to the **fp-docs-modifier** agent via the write workflow and execute the full 8-stage post-modification pipeline after their primary operation.

| Command | Description | Agent |
|---------|-------------|--------|
| `/fp-docs:add` | Create documentation for entirely new code that does not have docs yet. Describe the new code and the agent analyzes it and generates complete documentation. | fp-docs-modifier |
| `/fp-docs:revise` | Fix specific documentation you know is wrong or outdated. Provide a description of what needs fixing and the agent locates, updates, and validates the affected docs. | fp-docs-modifier |
| `/fp-docs:auto-update` | Auto-detect code changes since last documentation update. Scans `git diff` from the last 5 commits, identifies affected docs, and updates them automatically. | fp-docs-modifier |
| `/fp-docs:auto-revise` | Batch-process all items listed in the needs-revision-tracker. Reads the tracker, processes each item, and marks them complete. | fp-docs-modifier |
| `/fp-docs:deprecate` | Mark documentation as deprecated when code has been removed or replaced. Updates the doc with a deprecation notice and updates trackers. | fp-docs-modifier |

### Validation & Auditing (4 commands)

These commands route to the **fp-docs-validator** agent via the read workflow and are strictly read-only (Write and Edit tools are disallowed). All validation commands produce **actionable output** with per-issue command recommendations and a Remediation Summary section grouping findings by the `/fp-docs:` command needed to resolve them.

| Command | Description | Agent |
|---------|-------------|-------|
| `/fp-docs:audit` | Compare documentation against source code and report discrepancies. Supports quick, standard, and deep audit depths. Output includes per-issue command recommendations and a Remediation Summary with severity-tiered execution order. | fp-docs-validator |
| `/fp-docs:verify` | Run the 10-point verification checklist on documentation files without making changes. Reports pass/fail for each check with per-check remediation command recommendations. | fp-docs-validator |
| `/fp-docs:sanity-check` | Validate that documentation claims match actual source code. Zero-tolerance mode flags any discrepancy with per-finding remediation command recommendations. | fp-docs-validator |
| `/fp-docs:test` | Execute runtime validations against the local development environment. Tests REST endpoints, WP-CLI commands, template rendering, and visual verification. Scopes: rest-api, cli, templates, visual. | fp-docs-validator |

### Remediation (1 command)

The workflow dispatches to the appropriate specialist agents based on the remediation plan.

| Command | Description | Agent |
|---------|-------------|-------|
| `/fp-docs:remediate` | Resolve audit findings by dispatching to specialist agents. Takes audit output or a saved remediation plan and orchestrates batch remediation across multiple specialist agents. Supports `--plan-only` mode to save a plan without executing, enabling the audit -> clear -> remediate workflow. | (varies by finding) |

### Citation Management (1 command with 4 subcommands)

Routes to the dedicated **fp-docs-citations** agent.

| Command | Subcommands | Description | Agent |
|---------|-------------|-------------|-------|
| `/fp-docs:citations` | `generate`, `update`, `verify`, `audit` | Manage code citations in documentation files. Generate creates new citation blocks, update refreshes stale ones, verify checks format validity, audit performs deep semantic accuracy checks. | fp-docs-citations |

### API Reference Management (1 command with 2 subcommands)

Routes to the dedicated **fp-docs-api-refs** agent.

| Command | Subcommands | Description | Agent |
|---------|-------------|-------------|-------|
| `/fp-docs:api-ref` | `generate`, `audit` | Generate or update API Reference sections in documentation files. Extracts function signatures from source code and creates formatted reference tables with provenance tracking. | fp-docs-api-refs |

### Locals Contract Management (1 command with 6 subcommands)

Routes to the dedicated **fp-docs-locals** agent.

| Command | Subcommands | Description | Agent |
|---------|-------------|-------------|-------|
| `/fp-docs:locals` | `annotate`, `contracts`, `cross-ref`, `validate`, `shapes`, `coverage` | Manage `$locals` variable contract documentation for WordPress template components. Annotate adds `@locals` PHPDoc blocks to source code, contracts generates tables in docs, cross-ref traces caller chains, validate checks contracts against code, shapes manages shared data structures, coverage reports documentation coverage metrics. | fp-docs-locals |

### Verbosity Auditing (1 command)

Routes to the dedicated **fp-docs-verbosity** agent (read-only, Write and Edit disallowed).

| Command | Description | Agent |
|---------|-------------|-------|
| `/fp-docs:verbosity-audit` | Scan existing documentation for verbosity gaps: missing items, summarization language, unexpanded enumerables. Supports quick, standard, and deep depths. | fp-docs-verbosity |

### Index & Metadata Management (2 commands)

Route to the **fp-docs-indexer** agent.

| Command | Description | Agent |
|---------|-------------|-------|
| `/fp-docs:update-index` | Refresh the PROJECT-INDEX.md codebase reference. Supports update (incremental) and full (complete regeneration) modes. | fp-docs-indexer |
| `/fp-docs:update-claude` | Regenerate the CLAUDE.md template with current command inventory, documentation links, and project configuration. | fp-docs-indexer |

### System & Maintenance (5 commands)

Route to the **fp-docs-system** agent.

| Command | Description | Agent |
|---------|-------------|-------|
| `/fp-docs:setup` | Initialize or verify the fp-docs plugin installation. Runs seven phases: plugin structure verification, docs repo setup, codebase gitignore check, branch sync, git hook installation (post-merge/post-rewrite for drift detection), shell prompt integration, and update notification setup (statusline hook). | fp-docs-system |
| `/fp-docs:sync` | Synchronize the docs repo branch with the codebase branch. Creates or switches docs branches, generates diff reports, and optionally merges docs branches. | fp-docs-system |
| `/fp-docs:update-skills` | Regenerate all plugin command files from current prompt definitions. Syncs command files with source-of-truth prompts. | fp-docs-system |
| `/fp-docs:update` | Check for and install plugin updates. Queries the GitHub Releases API for the latest version, displays the changelog from release notes, confirms with the user, and executes a git-based update (`git fetch && git checkout <tag>`). Supports `--check` flag for version check only. | fp-docs-system |
| `/fp-docs:parallel` | Run documentation operations in parallel across multiple files using Agent Teams. Batches files into groups of up to 5 and assigns each batch to a teammate. Falls back to sequential if Agent Teams are disabled or scope is small (<3 files). Requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` env variable. | fp-docs-system |

### Meta-Commands (2 commands)

These commands use inline meta workflows that execute directly without agent spawning. They appear in the ROUTING_TABLE with type `meta`.

| Command | Description | How It Works |
|---------|-------------|-------------|
| `/fp-docs:do` | Route natural language to the right fp-docs command. Describe what you want in plain English and the smart router matches your intent to the appropriate operation. | Uses the do workflow (`workflows/do.md`) containing a routing rules table. Evaluates user input against rules top-to-bottom, disambiguates via AskUserQuestion for ambiguous intents, displays a routing banner, and auto-dispatches the matched command. |
| `/fp-docs:help` | Display all fp-docs commands grouped by type (write/read/admin/batch/meta) with descriptions and agents. Quick reference for discovering available operations. | Runs `fp-tools.cjs help grouped --raw` to generate markdown tables from CJS routing data. CJS-generated output means help never drifts from the routing table. The help workflow requires no agent -- this is a display-only operation. |

---

## The 10 Agents

Each agent is defined in `agents/` with GSD-style YAML frontmatter (name, description, tools, model) and an XML system prompt body. Agents load shared knowledge via `@-reference` to files in `references/`. All agents use CJS tooling (`fp-tools.cjs`) for git operations, pipeline sequencing, state management, and configuration access. Workflows contain literal `fp-tools.cjs` commands to prevent agent improvisation.

### 1. fp-docs-modifier
- **Domain**: Documentation creation and modification
- **Operations**: revise, add, auto-update, auto-revise, deprecate
- **Tools**: Read, Write, Edit, Grep, Glob, Bash (full write access)
- **References**: doc-standards.md, fp-project.md, pipeline-enforcement.md, changelog-rules.md, index-rules.md
- **Model**: opus, maxTurns: 75
- **Key behavior**: The primary write agent. Executes the Write Phase (stages 1-3) of the pipeline. Always reads actual source code before writing docs. Uses `[NEEDS INVESTIGATION]` instead of guessing.

### 2. fp-docs-validator
- **Domain**: Documentation validation and accuracy verification
- **Operations**: audit, verify, sanity-check, test
- **Tools**: Read, Grep, Glob, Bash (Write and Edit disallowed)
- **References**: doc-standards.md, fp-project.md, validation-rules.md
- **Model**: opus, maxTurns: 75
- **Key behavior**: Strictly read-only. Executes the Review Phase (stages 4-5) in delegated mode. Classifies issues by severity (CRITICAL, HIGH, MEDIUM, LOW). For sanity-check, zero tolerance: every factual claim must be verified. For test, executes against the live local dev environment.

### 3. fp-docs-citations
- **Domain**: Code citation generation, maintenance, and verification
- **Operations**: generate, update, verify, audit
- **Tools**: Read, Write, Edit, Grep, Glob, Bash
- **References**: doc-standards.md, fp-project.md, citation-rules.md
- **Model**: opus, maxTurns: 75
- **Key behavior**: Three citation tiers based on function length (Full for <=15 lines, Signature for 16-100, Reference for >100). Tracks citation freshness (Fresh, Stale, Drifted, Broken, Missing). Generate/update run a subset of the pipeline; verify/audit are read-only.

### 4. fp-docs-api-refs
- **Domain**: API Reference table generation and auditing
- **Operations**: generate, audit
- **Tools**: Read, Write, Edit, Grep, Glob, Bash
- **References**: doc-standards.md, fp-project.md, api-ref-rules.md
- **Model**: opus, maxTurns: 75
- **Key behavior**: Extracts actual function signatures from PHP/JS source. Mandatory provenance tracking (PHPDoc, Verified, Authored). Covers 7 layers: helpers, components, hooks, shortcodes, rest-api, cli, integrations. Audit is read-only.

### 5. fp-docs-locals
- **Domain**: `$locals` variable contract documentation
- **Operations**: annotate, contracts, cross-ref, validate, shapes, coverage
- **Tools**: Read, Write, Edit, Grep, Glob, Bash
- **References**: doc-standards.md, fp-project.md, locals-rules.md
- **Model**: opus, maxTurns: 75
- **Key behavior**: WordPress-specific agent for documenting the data shapes passed between PHP template components. Classifies keys as Required (bare `$locals['key']` access) vs Optional (guarded with `isset`/`??`/`empty`). Supports both named keys and integer-indexed `$locals[0]` patterns. Uses an **ephemeral WP-CLI tool** (`wp fp-locals`) that leverages PHP's `token_get_all()` for 100% accurate variable extraction -- the CLI PHP source lives in the plugin (`tools/class-locals-cli.php`), is ephemerally installed into the theme during operations via setup/teardown scripts, and auto-cleaned by a SubagentStop safety net hook. Falls back to manual Read/Grep extraction when ddev is unavailable.

### 6. fp-docs-verbosity
- **Domain**: Anti-brevity enforcement and verbosity gap detection
- **Operations**: audit
- **Tools**: Read, Grep, Glob, Bash (Write and Edit disallowed)
- **References**: doc-standards.md, fp-project.md, verbosity-rules.md
- **Model**: opus, maxTurns: 50
- **Key behavior**: Read-only scanner. Enforces a banned phrase list (e.g., "etc.", "and more", "various") and banned regex patterns. Reports violations at HIGH (banned phrases), MEDIUM (incomplete lists), LOW (style issues) severity. Deep scans also check scope manifests.

### 7. fp-docs-indexer
- **Domain**: Documentation index maintenance and metadata synchronization
- **Operations**: update-project-index, update-doc-links, update-example-claude
- **Tools**: Read, Write, Edit, Grep, Glob, Bash
- **References**: doc-standards.md, fp-project.md, index-rules.md
- **Model**: opus, maxTurns: 50
- **Key behavior**: Uses `git ls-files` as source of truth, not filesystem listing. Supports incremental (update), quick, and full regeneration modes. CLAUDE.md regeneration only touches documentation sections.

### 8. fp-docs-system
- **Domain**: Plugin self-maintenance and configuration
- **Operations**: update-skills, setup, sync, update
- **Tools**: Read, Write, Edit, Grep, Glob, Bash
- **References**: doc-standards.md, fp-project.md
- **Model**: opus, maxTurns: 50
- **Key behavior**: Setup runs 7 phases (plugin verification, docs repo setup, gitignore check, branch sync, git hook installation, shell prompt integration, update notification setup). Sync manages the three-repo branch mirroring model. Update-skills regenerates command files while preserving customizations. Update checks GitHub Releases API and executes git-based self-update.

### 9. fp-docs-researcher
- **Domain**: Pre-operation source code analysis
- **Operations**: (none -- always invoked as pre-pipeline phase, not via user command)
- **Tools**: Read, Write, Grep, Glob, Bash (no Edit -- analysis only, no file modification)
- **References**: doc-standards.md, fp-project.md, codebase-analysis-guide.md
- **Model**: opus, maxTurns: 75
- **Key behavior**: Runs before specialist agents to read source code, map dependencies, identify changes, and produce structured analysis documents at `.fp-docs/analyses/`. Uses `codebase-analysis-guide.md` for scanning patterns and `source-map.json` for target-to-source mapping. Calibrates analysis depth by operation type: full (write operations), summary (read-only), minimal (admin). Always invoked in DELEGATED mode -- never runs standalone. Returns a Research Result with analysis file path, source files analyzed, key findings, and complexity assessment.

### 10. fp-docs-planner
- **Domain**: Operation strategy design and plan creation
- **Operations**: (none -- always invoked as pre-pipeline phase, not via user command)
- **Tools**: Read, Write, Grep, Glob, Bash (no Edit -- creates plan files, never modifies existing)
- **References**: doc-standards.md, fp-project.md, pipeline-enforcement.md
- **Model**: sonnet, maxTurns: 75
- **Key behavior**: Receives researcher analysis and user command, designs execution strategy, creates persistent plan files at `.fp-docs/plans/` via `fp-tools.cjs plans save`. Classifies commands as write/read/admin/batch and creates appropriately structured plans. All operations produce plan files for consistent architecture and full audit trail. Plans auto-execute by default unless `--plan-only` flag is passed. Always invoked in DELEGATED mode -- never runs standalone.

---

## Drift Detection CLI Surface (`lib/drift.cjs`)

The drift detection module provides a full CLI surface via `fp-tools drift <subcommand>`. This is a CJS module (not a user-facing `/fp-docs:*` command) used by git hooks, SessionStart handlers, and agents.

| Subcommand | Description | Used By |
|------------|-------------|---------|
| `fp-tools drift analyze` | Analyze git diff against `source-map.json` mapping (via `lib/source-map.cjs`). Maps changed source files to affected documentation targets and generates staleness signals. | Git hooks (post-merge, post-rewrite) |
| `fp-tools drift status` | Show current staleness signals from staleness.json. | Agents, users via CLI |
| `fp-tools drift clear [doc_path]` | Clear staleness signals. Clears specific doc_path or all signals. | SubagentStop hooks (auto-clear), users via CLI |
| `fp-tools drift add-signal` | Manually add a staleness signal with doc_path, source, reason, severity. | fp-docs-validator (audit), manual testing |
| `fp-tools drift list` | List signal summaries (doc_path, severity, source, timestamp, changed count). | Agents, users via CLI |
| `fp-tools drift install` | Install post-merge and post-rewrite git hooks in the codebase repo with baked paths. | `/fp-docs:setup` Phase 5 |
| `fp-tools drift shell-install` | Generate shell integration script with baked paths at codebase root. | `/fp-docs:setup` Phase 6 |

### Module Exports

`lib/drift.cjs` exports 12 functions: `analyzeDrift`, `addSignal`, `clearSignals`, `loadStaleness`, `saveStaleness`, `mergePending`, `sortByPriority`, `formatNudge`, `getChangedFiles`, `installGitHook`, `installAllHooks`, `installShellIntegration`, `cmdDrift`.

### Source-Map CLI

The source-map module provides the single source of truth for source-to-doc mapping via `fp-tools source-map <subcommand>`. This is a CJS module (`lib/source-map.cjs`) that replaces the previous three-way mapping divergence (config.json, project-config.md, mod-project inline table).

| Subcommand | Description | Used By |
|------------|-------------|---------|
| `fp-tools source-map lookup <source-path>` | Look up the doc target for a source path (exact match, then directory prefix) | Agents, workflows |
| `fp-tools source-map reverse-lookup <doc-path>` | Find source entries that map to a given doc path | Agents (reverse mapping for visual verification) |
| `fp-tools source-map unmapped` | List all source files without doc targets | fp-docs-validator (audit), gap analysis |
| `fp-tools source-map generate` | Scan codebase and docs trees to build/refresh source-map.json | Pipeline stage 7 (index update) |
| `fp-tools source-map dump` | Output full source-map.json contents | Debugging, agents |

`lib/source-map.cjs` exports 7 functions: `loadSourceMap`, `saveSourceMap`, `lookupDoc`, `lookupSource`, `getUnmapped`, `generateSourceMap`, `cmdSourceMap`.

---

## The 16 References

References are shared knowledge files in `references/` loaded by agents and workflows via `@-reference` in execution context. Per user Decision 2 (GSD explicit style), `doc-standards.md` and `fp-project.md` are repeated as `@-reference` in every command's `<execution_context>`. Each rule lives in exactly one reference (no duplication).

### Rule References (10 files, converted from modules)

| Reference | Domain | Used By |
|-----------|--------|---------|
| doc-standards.md | File naming, directory structure, document templates (10 types), content rules, depth requirements, cross-reference requirements, integrity rules | All 10 agents (via every command) |
| fp-project.md | FP-specific paths, source-map.json CLI reference (5 example rows), appendix cross-references, environment settings | All 10 agents (via every command) |
| pipeline-enforcement.md | 8-stage post-modification pipeline definition, trigger matrix, skip conditions, completion markers | fp-docs-modifier, fp-docs-planner |
| changelog-rules.md | Changelog entry format (date, files changed, summary), append-only rules | fp-docs-modifier |
| index-rules.md | PROJECT-INDEX.md update modes (quick/update/full), git consistency rules | fp-docs-modifier, fp-docs-indexer |
| citation-rules.md | Citation block format (3 tiers), marker grammar, placement rules, freshness model (5 states), excerpt rules | fp-docs-modifier, fp-docs-citations |
| api-ref-rules.md | API Reference table format (5 columns), provenance rules, scope by doc type, completeness rule, ordering | fp-docs-modifier, fp-docs-api-refs |
| locals-rules.md | @locals PHPDoc format, @controller format (HTMX), contract table columns, Required/Optional classification, shared shapes, ground truth engine (WP-CLI `wp fp-locals`), ephemeral CLI lifecycle, CLI subcommands, extraction capabilities, fallback rules | fp-docs-modifier, fp-docs-locals |
| verbosity-rules.md | Anti-compression directives, banned phrases (15+), banned patterns (4 regex), scope manifest format, self-audit protocol, context window management tiers | fp-docs-modifier, fp-docs-verbosity |
| validation-rules.md | 10-point verification checklist, sanity-check algorithm (zero-tolerance), confidence levels (HIGH/LOW), severity classification (CRITICAL/HIGH/MEDIUM/LOW) | fp-docs-modifier, fp-docs-validator |

### Algorithm References (6 files, moved from framework/algorithms/)

| Reference | Domain | Used By |
|-----------|--------|---------|
| verbosity-algorithm.md | Step-by-step verbosity enforcement procedure, scope manifest construction, gap detection | Pipeline stage 1 (verbosity enforcement) |
| citation-algorithm.md | Citation generation procedure, tier selection, freshness evaluation, block formatting | Pipeline stage 2 (citation generation) |
| api-ref-algorithm.md | API Reference extraction procedure, signature parsing, provenance assignment | Pipeline stage 3 (API ref sync) |
| validation-algorithm.md | Sanity-check and verification procedures, claim classification, 10-point checklist execution | Pipeline stages 4-5 (sanity-check, verification) |
| git-sync-rules.md | Branch synchronization procedure, three-repo coordination, conflict resolution | Pipeline stage 8 (docs commit), sync workflow |
| codebase-analysis-guide.md | Source code scanning patterns, dependency mapping, change detection procedures | fp-docs-researcher (pre-pipeline) |

---

## The Post-Modification Pipeline (8 Stages)

This is the core quality enforcement mechanism. It runs after every doc-modifying operation.

Under the command-workflow-agent architecture, write operations proceed through a **5-phase** delegation model: **Research Phase** (pre-pipeline, fp-docs-researcher), **Plan Phase** (pre-pipeline, fp-docs-planner), **Write Phase** (primary op + stages 1-3, assigned to specialist agent), **Review Phase** (stages 4-5, assigned to fp-docs-validator), and **Finalize Phase** (stages 6-8, fully CJS-executed via the pipeline callback loop -- `fp-tools.cjs pipeline init` then `fp-tools.cjs pipeline next` for each stage, handled by the workflow). The existing 8 pipeline stages are unchanged -- Research and Plan are pre-pipeline phases. In Standalone Mode, a single agent executes all 8 stages as before.

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

Pipeline actions now include `gate_failed` in addition to `spawn`, `execute`, `complete`, `blocked` (Phase 17). When a gate fails, the orchestrator receives a diagnostic with the specific violation(s) and decides whether to retry or abort. Stage output is recorded via `fp-tools pipeline record-output <stage-id>`.

---

## The Documentation Lifecycle

fp-docs enables a complete documentation lifecycle:

### 0. Discover
- `/fp-docs:help` -- View all available commands grouped by type
- `/fp-docs:do "what you want to do"` -- Describe your intent in natural language and get routed to the right command

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

### 2b. Remediate
- `/fp-docs:remediate` -- Resolve audit findings in one orchestrated batch
- `/fp-docs:remediate --plan-only` -- Save a remediation plan for later execution

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
Every command uses multi-agent execution by default via the workflow orchestration layer:
- **Write operations** use 5 agents: workflow (coordinator) + fp-docs-researcher (code analysis) + fp-docs-planner (strategy) + specialist agent (Write Phase) + fp-docs-validator (Review Phase)
- **Read-only operations** use 4 agents: workflow (coordinator) + fp-docs-researcher (pre-analysis) + fp-docs-planner (minimal plan) + specialist agent (standalone, with actionable output)
- The workflow handles all git commits (Finalize Phase), ensuring atomic documentation updates
- The workflow extracts only summary metrics from delegation results to keep context lean during large operations

### Execution Mode Flag (`--batch-mode`)
The `--batch-mode` flag controls how the workflow dispatches work:
- `--batch-mode subagent` (default): Smart subagent spawning via Agent tool. 1 file = single call, 2-8 = parallel fan-out, 9+ = batched waves of max 5 concurrent.
- `--batch-mode team` (or `--use-agent-team`): Create Agent Team for inter-agent coordination. Requires user confirmation unless the flag is explicitly passed. Teammates work directly as specialists (cannot spawn sub-subagents).
- `--batch-mode sequential`: One-at-a-time Agent calls for operations requiring strict ordering.

### Parallel Operations (`/fp-docs:parallel`)
- Requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` environment variable
- The workflow handles batch operations natively using the `--batch-mode` flag system
- Groups target files into batches of up to 5
- Creates Agent Team teammates for each batch, each running the appropriate specialist agent
- TeammateIdle and TaskCompleted hooks validate team member phase completion and task outputs
- Workflow handles Finalize Phase (changelog, index, single atomic git commit) for all batches
- Aggregates results into a unified report

### Auto-Batch Operations
- `/fp-docs:auto-update` -- Scans git diff of last 5 commits, processes all affected docs
- `/fp-docs:auto-revise` -- Processes all items in the needs-revision tracker

### Chunk-and-Delegate (Context Management)
- When scope exceeds 50 functions or 8 doc files, the workflow automatically delegates to sub-agents
- Max 8 docs per agent, max 50 functions per agent
- Context pressure (>75% usage) triggers checkpoint-and-continue

---

## Visual Verification

Browser-based documentation verification using Playwright MCP for live environment testing.

**Capabilities:**
- Navigate to `foreignpolicy.local` pages via MCP browser tools
- Capture accessibility snapshots for structural verification (token-efficient)
- Take screenshots for visual evidence and documentation assets
- Interactive verification: click, scroll, fill forms to verify documented workflows
- LLM-based visual analysis of screenshots via Claude's vision capabilities

**Integration points:**
- `/fp-docs:test visual` -- Dedicated visual test scope comparing docs against rendered pages
- `/fp-docs:revise --visual` -- Visual context gathering during documentation revision
- `/fp-docs:add --visual` -- Visual verification of newly documented components
- `/fp-docs:auto-update --visual` -- Visual verification during batch updates

**MCP server:** The Playwright MCP server is declared in `.mcp.json` at the plugin root. Claude Code automatically starts the server when the plugin is enabled. The server is version-pinned at `@playwright/mcp@0.0.68` with triple-layer SSL bypass for ddev's self-signed certificates.

**Flag system:** Visual capabilities are gated by the `--visual` flag on modify operations and the `visual` scope on test. The `visual.enabled` feature flag in system-config provides a master override. Without the flag, agents never touch browser tools.

**Screenshot storage:**
- Transient evidence: `.fp-docs/screenshots/` (not committed)
- Documentation assets: `{docs-root}/media/screenshots/` (git-tracked)

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

fp-docs uses 5 hook events registered in `settings.json` (not the old `hooks.json`). Each hook invokes a standalone JS file in `hooks/`, which delegates to CJS handler functions in `lib/hooks.cjs` via `fp-tools.cjs hooks run <event> [matcher]`:

| Event | Handler | CLI Command | Purpose |
|-------|---------|-------------|---------|
| PreToolUse (Bash) | `handlePreToolUseBashGitCheck` | `hooks run pre-tool-use bash` | Blocks raw git-write commands in non-orchestrator agents. Exit 2 = block, exit 0 = allow. CJS-mediated git (`fp-tools.cjs git`) is always exempt. |
| SessionStart | `handleInjectManifest` | `hooks run session-start inject-manifest` | Injects the plugin root path and manifest into the session context so agents can locate their workflows and references |
| SessionStart | `handleBranchSyncCheck` | `hooks run session-start branch-sync` | Detects codebase/docs branch alignment and reads the sync watermark to report codebase change state (current, stale with commit count, invalid, or none) |
| SessionStart | `handleDriftNudge` | `hooks run session-start drift-nudge` | Merges pending drift signals from git hooks, formats nudge summary if stale docs exist (top 3 + actionable commands) |
| SessionStart | `handleUpdateCheck` | `hooks run session-start update-check` | Spawns background update version check |
| SubagentStop (modify) | `handlePostModifyCheck` | `hooks run subagent-stop modify` | Validates fp-docs-modifier delegation result structure and pipeline completion. Produces structured `ENFORCEMENT VIOLATION` diagnostics. Category A (upgraded from B in Phase 17, D-04). Auto-clears drift signals for modified docs. |
| SubagentStop (orchestrate) | `handlePostOrchestrateCheck` | `hooks run subagent-stop orchestrate` | Validates workflow delegation cycle completion. Produces structured `ENFORCEMENT VIOLATION` diagnostics. Category A (upgraded from B in Phase 17, D-04). |
| SubagentStop (locals) | `handleLocalsCLICleanup` | `hooks run subagent-stop locals` | Safety net for ephemeral WP-CLI tool -- detects and removes orphaned CLI artifacts |
| SubagentStop (validate, citations, api-refs, researcher, planner) | `handleSubagentEnforcementCheck` | `hooks run subagent-stop <matcher>` | Validates specialist agent delegation results for structural compliance and stage authority. Single handler with agent_type-based validation. Category A. |
| TeammateIdle | `handleTeammateIdleCheck` | `hooks run teammate-idle` | Validates that teammates completed their assigned pipeline phases before going idle |
| TaskCompleted | `handleTaskCompletedCheck` | `hooks run task-completed` | Validates task outputs -- checks for empty modifications, missing pipeline markers, and incomplete phase handoffs |

### Runtime Enforcement (Phase 17)

The plugin enforces delegation architecture rules programmatically via `lib/enforcement.cjs` (6 exports, zero external dependencies):

- **Git-write blocking**: PreToolUse hook on Bash tool blocks raw `git commit/push/tag/merge/rebase/checkout/reset/clean/rm/mv/stash/cherry-pick/revert/am/pull` commands. Only CJS-mediated git (`fp-tools.cjs git ...`) is allowed. Applies to all non-orchestrator agents.
- **Delegation result validation**: SubagentStop hooks parse delegation results via `enforcement.parseDelegationResult()` for structural completeness (`## Delegation Result`, `### Files Modified`, `### Enforcement Stages`), enforcement stage markers, and completion indicators (`Delegation complete: ...`).
- **Stage authority checking**: `enforcement.verifyStageAuthority()` verifies that the correct agent executed the correct pipeline phase (e.g., fp-docs-modifier/citations/api-refs/locals = write phase, fp-docs-validator = review phase, workflow = finalize phase).
- **Pipeline gating**: CJS validates LLM-executed stage outputs (1-5) at each boundary before allowing progression. Failed gates return `action: gate_failed` with diagnostic. Stage output recorded via `fp-tools pipeline record-output <stage-id>`.

All violations are fatal (D-04). No warnings, no exemptions. Violation output uses `ENFORCEMENT VIOLATION: N fatal violation(s)...` prefix for orchestrator detection.

Git operations (including docs-commit) are centralized in `lib/git.cjs` and invoked via `fp-tools.cjs git commit`.

---

## Noteworthy Design Choices

### 1. Command-Workflow-Agent Chain
Commands are thin YAML+XML routing files with no logic. They declare their workflow via `@-reference` and load shared knowledge (doc-standards.md, fp-project.md) into execution context. Workflows orchestrate agent spawning and pipeline phases. Agents do the domain work. This makes the system composable: new commands only need a command file in `commands/fp-docs/` and a workflow in `workflows/`.

### 2. Read-Only Validation
The fp-docs-validator and fp-docs-verbosity agents explicitly disallow Write and Edit tools via `disallowedTools`. This makes it impossible for validation operations to accidentally modify documentation. Audit/verify results are reports only.

### 3. Anti-Compression Philosophy
The verbosity system is philosophically opposed to LLM summarization tendencies. It maintains banned phrase lists and regex patterns, scope manifests that count every enumerable item, and zero-tolerance gap checking. "Length is not a concern. Completeness is the only concern."

### 4. Citation-as-Evidence
Every documentable code claim requires a citation block linking to the exact source file, symbol, and line range. Citations have a freshness model (Fresh, Stale, Drifted, Broken, Missing) with staleness detection. Three tiers (Full, Signature, Reference) scale verbatim code inclusion by function length.

### 5. Provenance Tracking
API Reference table rows include a `Src` column tracking how each entry was created: `PHPDoc` (extracted from docblocks), `Verified` (hand-verified against source), or `Authored` (manually written). This creates an audit trail for reference accuracy.

### 6. Reference Deduplication
Each rule lives in exactly one reference file. Agents load references via `@-reference`, but references do not know about agents. This prevents rule conflicts and makes it clear where to modify any given rule.

### 7. Pipeline-as-Quality-Gate
The 8-stage pipeline is not optional. Verification and changelog stages never skip. The SubagentStop hook validates completion. This ensures every doc modification goes through the full quality process.

### 8. On-Demand Algorithm Loading
Six algorithm reference files in `references/` are loaded during pipeline stages via `@-reference`, distinct from rule references loaded at command startup. This keeps agent context smaller until the algorithm is actually needed.

### 9. Memory Management
Every agent includes memory management instructions: update agent memory when discovering recurring patterns, frequently-changing files, common false positives, and codebase-specific conventions. This enables learning across sessions.

### 10. WordPress-Specific Locals Contracts
The fp-docs-locals agent addresses a WordPress-specific pattern where template components communicate via `$locals` arrays without formal type contracts. The agent annotates source code, generates contract tables, traces caller chains, and reports coverage -- solving a real problem specific to the FP codebase's architecture. Uses an ephemeral WP-CLI tool (`wp fp-locals`) backed by PHP's `token_get_all()` for 100% accurate extraction of keys, types, required/optional status, and default values -- far superior to regex or AI inference. The CLI source lives in the plugin and is copied to the theme during operations, then removed after.

### 11. Universal Multi-Agent Orchestration
All 23 commands route through workflows that orchestrate agent spawning and pipeline execution. Write operations proceed through a 5-phase delegation model: Research Phase (fp-docs-researcher) -> Plan Phase (fp-docs-planner) -> Write Phase (specialist agent) -> Review Phase (fp-docs-validator) -> Finalize Phase (workflow). Read-only operations still route through Research + Plan for consistent architecture, but the specialist runs standalone without Write/Review/Finalize splitting. Execution mode is controlled by the `--batch-mode` flag: subagent (default), team (explicit request with confirmation), or sequential. Agents support both Delegation Mode (workflow-coordinated) and Standalone Mode (self-contained) for backward compatibility. fp-docs-researcher and fp-docs-planner are delegation-only (never standalone).

### 12. Explicit CJS Invocation in Workflows
Workflows contain literal `fp-tools.cjs` commands (e.g., `fp-tools.cjs pipeline init`, `fp-tools.cjs git commit`, `fp-tools.cjs locals-cli setup`) to prevent agent improvisation. This eliminates the risk of agents inventing ad-hoc git or pipeline commands, ensures deterministic execution of finalization stages, and provides a compliance verification layer via SubagentStop hooks that detect when write-capable agents skip expected CJS calls.

### 13. Update System with Background Check and Git-Based Self-Update (Phase 10)
Plugin updates use a three-layer approach: (1) Background spawn during SessionStart writes version check results to `.fp-docs/update-cache.json` with 1-hour TTL -- never blocks session startup. (2) A user-level statusline hook (`fp-docs-statusline.js`, installed by `/fp-docs:setup`) reads the cache and displays a passive update nudge. (3) The `/fp-docs:update` command checks the GitHub Releases API, displays the changelog from release notes, confirms with the user, and executes a git-based update (`git fetch origin && git checkout <tag>`). This pattern was adapted from GSD's `gsd-check-update.js` background spawn.

### 13. MCP over CJS for Browser Automation (Phase 9)
Browser tools integrate as MCP native tool calls, not CJS CLI wrappers. This avoids building a custom browser automation layer and lets Claude call browser tools with the same invocation pattern as Read/Write/Grep.

### 14. Flag-Gated Visual Steps (Phase 9)
Visual verification is opt-in via `--visual` flag, never default-on. Browser automation adds latency (5-15 seconds per navigation). Instruction files contain explicit numbered steps with exact MCP tool names (`browser_navigate`, `browser_snapshot`, `browser_take_screenshot`) -- no LLM judgment on when to use browser tools. Same deterministic pattern as Phase 8 D-04.

### 15. MCP Declarations in .mcp.json (Phase 13)
Dedicated `.mcp.json` file at plugin root for MCP server declarations, separate from `settings.json` permission grants. Follows Claude Code's standard `.mcp.json` convention. This keeps MCP declarations cleanly separated from tool permission settings and aligns with the platform's expected file layout for MCP server configuration.

### 16. Fatal Runtime Enforcement (Phase 17)
Reverses Phase 8 D-05 (non-blocking compliance) and Phase 12 D-05 (documentation-only enforcement). All enforcement checks are now fatal: if a check triggers, the operation stops. This trades operational flexibility for architectural guarantee -- delegation rules cannot be silently violated. Three enforcement layers: PreToolUse hooks block raw git-write commands at the tool-call level, SubagentStop hooks produce structured violation diagnostics with `ENFORCEMENT VIOLATION` prefix that the orchestrator must act on, and pipeline gating validates LLM stage outputs before progression. Enforcement logic is centralized in `lib/enforcement.cjs` (6 exports: `isGitWriteCommand`, `isCjsMediatedGit`, `parseDelegationResult`, `verifyStageAuthority`, `validateStageOutput`, `STAGE_AUTHORITY_MAP`).

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
- **Locals CLI Tool** (§7): Enabled/disabled, auto-teardown, CLI source path in plugin, CLI target path in theme, ephemeral lifecycle, subcommand-to-CLI mapping
- **Agent Model Configuration** (§9): researcher.model (opus), planner.model (sonnet), researcher.enabled, planner.enabled, plans.auto_prune, plans.retention_days, plans.max_plans, Phase Skip Behavior table

### project-config.md
FP-specific configuration:
- Project identity (theme root, docs root, WP-CLI prefix, local URL)
- Source-to-documentation mapping: **Extracted to `source-map.json`** (accessed via `lib/source-map.cjs`; project-config.md retains reference pointer only)
- Appendix cross-references (7 appendix categories)
- Key paths (changelog, revision tracker, index, shapes, flagged concerns)
- Repository configuration (codebase repo, docs repo, plugin repo)
- Feature enables (all 5 features enabled)

### settings.json
Default tool permissions: Read, Grep, Glob are auto-allowed for all operations.

---

## Document Format Templates

fp-docs defines 10 document type templates in `references/doc-standards.md`:

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

### Skip Flags (used with modify and related agents)
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
- `(no args)` -- Detect branches, align if needed, then ALWAYS run watermark-based change detection to identify codebase changes since last sync and generate a diff report
- `merge` -- Merge current docs feature branch into docs master, push, clean up
- `--force` -- Force branch switch even with uncommitted changes

### Citation Tiers
- `--tier micro|standard|comprehensive` -- Override auto-tier selection

### Execution Mode
- `--batch-mode subagent` -- (default) Smart subagent spawning via Agent tool
- `--batch-mode team` -- Create Agent Team for parallel processing (confirmation required unless `--use-agent-team`)
- `--batch-mode sequential` -- One-at-a-time sequential processing
- `--use-agent-team` -- Shorthand for `--batch-mode team`, bypasses confirmation prompt

### Visual Verification
- `--visual` -- Enable visual verification via browser automation (Playwright MCP). Available on modify operations and test visual scope.

### Pre-Execution Flags (Phase 16)
- `--plan-only` -- Stop after Plan Phase. Display plan summary. Do not execute Write/Review/Finalize phases. Available on all operations.
- `--no-research` -- Skip the Research Phase entirely. Planner works without source analysis. Useful for quick operations when latency matters.

### API Ref Layers
- `--layer helpers|components|hooks|shortcodes|rest-api|cli|all` -- Target specific code layer
