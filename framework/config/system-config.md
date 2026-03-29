# Documentation System Configuration

> Controls configurable behavior for the fp-docs plugin. Engines and modules read these values to determine thresholds, defaults, and feature flags.

---

## 1. Citations

| Variable | Value | Description |
|----------|-------|-------------|
| `citations.enabled` | `true` | Whether citations are mandatory for doc-modifying operations |
| `citations.full_body_max_lines` | `15` | Functions with body ≤ this line count receive Full tier citations |
| `citations.signature_max_lines` | `100` | Functions with body ≤ this line count receive Signature tier citations |
| `citations.include_line_numbers` | `true` | Whether to include `L{start}–{end}` line ranges in citation markers |
| `citations.excerpt_comment_threshold` | `5` | Maximum comment lines to include in code excerpts |

### Citation Scope

| Doc Element | Citation Required | Tier | Notes |
|-------------|-------------------|------|-------|
| Function documentation | Yes | Full or Signature (by line count) | Every documented function gets a citation |
| Hook registrations | Yes | Full | The `add_action`/`add_filter` call |
| Meta field tables | Yes | Reference | File + method + line range, no excerpt |
| Registration args (CPT/taxonomy) | Yes | Signature | The registration args array |
| Shortcode attributes | Yes | Full | The `shortcode_atts` defaults + extract |
| REST endpoint registration | Yes | Full | Route + method + callback registration |
| ACF field definitions | Yes | Reference | File + method + line range for field arrays |
| Component file lists | No | — | File existence is self-verifying |
| Prose descriptions / overviews | No | — | Not directly citable |
| Related Docs sections | No | — | Links, not code claims |
| Admin UI descriptions | Conditional | Reference | Only when describing specific code behavior |

---

## 2. General System

| Variable | Value | Description |
|----------|-------|-------------|
| `sanity_check.default_enabled` | `true` | Whether sanity-check runs by default |
| `sanity_check.multi_agent_threshold_docs` | `5` | Trigger multi-agent review when changes touch this many docs |
| `sanity_check.multi_agent_threshold_sections` | `3` | Trigger multi-agent review when changes span this many sections |
| `verify.total_checks` | `10` | Number of verification checks |

---

## 3. API Reference

| Variable | Value | Description |
|----------|-------|-------------|
| `api_ref.enabled` | `true` | Whether API Reference sections are required in applicable doc types |
| `api_ref.provenance_values` | `PHPDoc, Verified, Authored` | Valid values for the per-row `Src` column |
| `api_ref.default_provenance` | `Verified` | Default provenance when hand-writing entries from source |
| `api_ref.phpdoc_provenance` | `PHPDoc` | Provenance value when extracting from inline docblocks |

### API Reference Scope

| Doc Type | API Ref Required | Covers |
|----------|-----------------|--------|
| Helper (§3.3) | Yes | Every function in the namespace |
| Post Type (§3.1) | Yes | Public methods on the class |
| Taxonomy (§3.2) | Yes | Public methods, query modification helpers |
| REST Endpoint (§3.6) | Yes | Callback methods, response shape typing |
| JavaScript (§3.8) | Yes | Exported functions, key event handlers |
| Integration (§3.10) | Yes | Helper functions for the integration |
| Hook (§3.4) | No | Already tabular reference format |
| Shortcode (§3.5) | No | Already has attribute tables |
| ACF Field Group (§3.9) | No | Already has field tables |
| Component (§3.7) | No | Deferred — $locals contracts are separate |

### API Reference Table Columns

| Column | Header | Content Rule |
|--------|--------|-------------|
| 1 | `Function` | Function/method name in backticks with `()`. Namespaced: `function_name()`. Class methods: `ClassName::method()`. |
| 2 | `Params` | Typed parameter list. Use `—` for no params. For 4+ params, list primary params and note "See citation." |
| 3 | `Return` | Return type in backticks. Use `void` for no return. Unions: `string\|false`. |
| 4 | `Description` | One-liner. Present tense, starts with verb. Max ~80 chars. |
| 5 | `Src` | Provenance marker. Must be one of `api_ref.provenance_values`. |

---

## 4. Git Remote Sync

| Variable | Value | Description |
|----------|-------|-------------|
| `remote.source_of_truth` | `true` | Remote origin is authoritative for docs repo |
| `remote.pull_on_session_start` | `true` | Fetch and pull from remote at session start |
| `remote.pull_before_commit` | `true` | Pull latest before committing (Stage 8) |
| `remote.halt_on_failure` | `true` | Halt operations when remote ops fail |
| `push.enabled` | `true` | Master switch — whether to push to remote after docs commits |
| `push.on_commit` | `true` | Push after every pipeline commit (Stage 8) |
| `push.on_merge` | `true` | Push after sync merge operations |

Remote sync behavior: remote origin is the source of truth for the docs repo. Always fetch/pull before work and before commit. Always push after commit. Remote sync failures halt operations with diagnostic guidance. Use `--offline` flag to skip all remote operations (fetch, pull, push) for disconnected work. Use `--no-push` flag to skip push only (pull still happens).

---

## 5. Verbosity Engine

| Variable | Value | Description |
|----------|-------|-------------|
| `verbosity.enabled` | `true` | Master switch for VERBOSITY-SCOPE and VERBOSITY-ENFORCE phases |
| `verbosity.gap_tolerance` | `0` | Maximum allowed gap between source item count and documented item count. `0` = zero tolerance. |

### Chunk-and-Delegate Thresholds (Legacy)

> These thresholds are superseded by §6 Orchestration for multi-agent delegation. Retained for backward compatibility when engines run in standalone mode.

| Variable | Value | Description |
|----------|-------|-------------|
| `chunk_delegation.max_docs_per_agent` | `8` | Maximum doc files a single agent should process in one pass |
| `chunk_delegation.max_functions_per_agent` | `50` | Maximum functions a single agent should document in one pass |
| `chunk_delegation.delegation_trigger_docs` | `8` | When total docs in scope exceed this, auto-delegate |
| `chunk_delegation.delegation_trigger_functions` | `50` | When total functions in scope exceed this, auto-delegate |

### Summarization Detection

Banned phrases (case-insensitive):

| Phrase | Context |
|--------|---------|
| `and more` | Always banned when replacing enumeration |
| `etc.` | Always banned |
| `et cetera` | Always banned |
| `similar to above` | Always banned |
| `various` | Banned when avoiding enumeration of knowable items |
| `among others` | Always banned when replacing enumeration |
| `and so on` | Always banned |
| `remaining` | Banned when avoiding enumeration |
| `and additional` | Banned when replacing enumeration |
| `the rest` | Banned when replacing enumeration |
| `likewise` | Banned when skipping repetitive documentation |
| `as above` | Banned when skipping repetitive documentation |
| `other similar` | Banned when avoiding enumeration |
| `numerous` | Banned when avoiding counting |
| `several` | Banned when avoiding enumeration of known items |
| `a number of` | Banned when avoiding enumeration of known items |

Banned patterns (regex):

| Pattern | Example Match |
|---------|---------------|
| `\d+\s+(more\|additional\|other\|remaining\|further\|extra)\b` | "5 more functions" |
| `see (above\|previous\|earlier) for (similar\|more\|details)` | "see above for similar" |
| `(handles?\|supports?\|includes?\|provides?)\s+(various\|multiple\|many\|several\|different)\b` | "handles various post types" |
| `\.{3}\|…` | Ellipsis used as list omission |

---

## 6. Orchestration

| Variable | Value | Description |
|----------|-------|-------------|
| `orchestration.enabled` | `true` | Master switch for multi-agent orchestration |
| `orchestration.max_concurrent_subagents` | `5` | Maximum concurrent subagent spawns in fan-out |
| `orchestration.max_teammates` | `5` | Maximum concurrent teammates in a team |
| `orchestration.max_files_per_batch` | `5` | Maximum files per subagent batch or teammate |
| `orchestration.pipeline_delegation` | `true` | Whether pipeline stages delegate to specialists |
| `orchestration.validation_retry_limit` | `1` | Max retries if validation finds LOW confidence |
| `orchestration.single_commit` | `true` | Aggregate all changes into one git commit |
| `orchestration.default_batch_mode` | `subagent` | Default execution mode (subagent, team, sequential) |

### Execution Mode Selection (D-08)

The execution mode is determined by the `--batch-mode` flag, NOT by file count thresholds.

```
--batch-mode subagent (default):
  1 file -> single Agent call
  2-8 files -> parallel Agent calls (fan-out, max concurrent per max_concurrent_subagents)
  9+ files -> parallel Agent calls in batches (waves of max_concurrent_subagents)

--batch-mode team (or --use-agent-team):
  Any scope -> TeamCreate + teammates
  Confirmation prompt required unless flag explicitly passed (D-07)
  Teammates work directly as specialists (no nested subagent spawning)

--batch-mode sequential:
  Any scope -> sequential Agent calls (one at a time)
```

### Pipeline Phase Grouping

| Phase | Stages | Agent | Rationale |
|-------|--------|-------|-----------|
| Write Phase | Primary op + Stages 1-3 | Primary engine (delegated) | Needs write access + fresh context |
| Review Phase | Stages 4-5 | Validate engine | Independent quality review |
| Finalize Phase | Stages 6-8 | Orchestrator | Administrative finalization |

---

## 7. Locals CLI Tool

| Variable | Value | Description |
|----------|-------|-------------|
| `locals.cli_enabled` | `true` | Whether to use the WP-CLI `fp-locals` tool for ground-truth extraction (falls back to manual if false or unavailable) |
| `locals.cli_auto_teardown` | `true` | Whether the SubagentStop hook auto-cleans orphaned CLI artifacts |
| `locals.cli_source` | `framework/tools/class-locals-cli.php` | CLI PHP file location relative to plugin root |
| `locals.cli_target` | `inc/cli/class-locals-cli.php` | Installation target relative to theme root |

### Ephemeral CLI Lifecycle

The `wp fp-locals` WP-CLI command is NOT permanently registered in the theme. It is installed ephemerally for each locals operation:

1. **Setup**: `node {plugin-root}/fp-tools.cjs locals-cli setup` copies CLI file from plugin → theme, registers in `functions.php`, verifies
2. **Execute**: Locals engine runs `ddev wp fp-locals <subcommand>` for ground-truth extraction
3. **Teardown**: `node {plugin-root}/fp-tools.cjs locals-cli teardown` removes registration and deletes file
4. **Safety net**: SubagentStop hook (CJS `handleLocalsCLICleanup` in lib/hooks.cjs) auto-cleans if teardown was missed

### Subcommands Requiring CLI

| Subcommand | Needs CLI | Fallback |
|---|:---:|---|
| `annotate` | Yes | Manual Read/Grep extraction |
| `contracts` | Yes | Manual Read/Grep extraction |
| `cross-ref` | Yes | Grep-based caller search (limited) |
| `validate` | Yes | Manual PHPDoc vs code comparison |
| `coverage` | Yes | Glob + Read scan for @locals blocks |
| `shapes` | No | Reads documentation only |

---

## 8. Visual Verification

| Variable | Value | Description |
|----------|-------|-------------|
| `visual.enabled` | `true` | Master switch for visual verification capabilities (requires Playwright MCP server) |
| `visual.default_screenshot_dir` | `.fp-docs/screenshots` | Default directory for transient screenshot storage (relative to codebase root, not committed) |
| `visual.docs_screenshot_dir` | `media/screenshots` | Directory for persistent documentation screenshots (relative to docs root, git-tracked) |
| `visual.local_url` | `https://foreignpolicy.local` | Base URL for local development environment (ddev, self-signed SSL) |

### Visual Flag Behavior

The `--visual` flag gates all browser-related operations in instruction files. This follows the same pattern as `--no-sanity-check` (which gates pipeline stage 4).

| Flag | Effect |
|------|--------|
| `--visual` present | Visual verification steps in instruction files execute (navigation, screenshot, snapshot, analysis) |
| `--visual` absent | Visual verification steps are skipped entirely -- engines never touch browser tools |
| `visual.enabled` = `false` | Master override -- visual steps never execute regardless of flag |

### Screenshot Storage

| Purpose | Directory | Git Status | Cleanup |
|---------|-----------|------------|---------|
| Test evidence | `{codebase-root}/.fp-docs/screenshots/test-{timestamp}/` | Not committed (.fp-docs/ is gitignored) | Manual or periodic |
| Operation evidence | `{codebase-root}/.fp-docs/screenshots/visual-{operation}-{timestamp}/` | Not committed | Manual or periodic |
| Documentation assets | `{docs-root}/media/screenshots/` | Committed to docs repo | Permanent |

---

## 9. Agent Model Configuration

| Variable | Value | Description |
|----------|-------|-------------|
| `researcher.model` | `opus` | Model for the researcher agent. Deep code analysis benefits from strongest reasoning (D-12). |
| `researcher.enabled` | `true` | Master switch for pre-operation research phase. When false, orchestrator skips research and goes directly to planning. |
| `planner.model` | `sonnet` | Model for the planner agent. Planning is structured and formulaic, Sonnet is appropriate (D-12). |
| `planner.enabled` | `true` | Master switch for pre-operation planning phase. When false, orchestrator skips planning and uses legacy 3-phase direct delegation. |
| `plans.auto_prune` | `true` | Whether to auto-prune completed plans older than retention period |
| `plans.retention_days` | `30` | Days to retain completed plan files before auto-pruning |
| `plans.max_plans` | `200` | Maximum plan files to retain (oldest completed plans pruned first) |

### Model Override Notes

The agent frontmatter `model:` field IS the runtime model determinant in Claude Code's plugin system. The values in this table document the intended defaults. The agent frontmatter for researcher.md declares `model: opus` and planner.md declares `model: sonnet`, matching the defaults above. To change the runtime model for either agent, update the agent's frontmatter file directly.

### Phase Skip Behavior

| Flag / Config | Effect |
|---------------|--------|
| `--no-research` | Skip the Research Phase entirely. Planner works without source analysis. |
| `--plan-only` | Stop after Plan Phase. Display plan summary. Do not execute Write/Review/Finalize. |
| `researcher.enabled = false` | Config-level skip of Research Phase (same as always passing --no-research). |
| `planner.enabled = false` | Config-level skip of Plan Phase. Orchestrator uses legacy 3-phase direct delegation. |
