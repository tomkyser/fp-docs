# fp-docs Current State Assessment

> Generated: 2026-03-29
> Branch: dev
> Purpose: Comprehensive architecture inventory for conversion plan to GSD-style plugin patterns

---

## 1. Complete File Inventory

### 1.1 Root Configuration Files

| File | Lines | Purpose |
|------|-------|---------|
| `.claude-plugin/plugin.json` | 11 | Plugin manifest -- name, version (1.0.0), description, author, repository |
| `settings.json` | 9 | Default tool permissions: Read, Grep, Glob |
| `config.json` | 191 | **Single source of truth** for all configuration -- system flags, project identity, pipeline definition. Replaced markdown config files. |
| `.mcp.json` | 16 | MCP server config for Playwright browser automation |
| `hooks/hooks.json` | 131 | Hook definitions for PreToolUse, SessionStart, SubagentStop, TeammateIdle, TaskCompleted |
| `fp-tools.cjs` | 237 | CLI entry point -- dispatches to 17 command modules |
| `source-map.json` | 58038 (1.7MB) | **UNTRACKED** -- Generated source-to-doc mapping with file-level granularity |
| `README.md` | 1002 | Plugin README |
| `CHANGELOG.md` | 193 | Version history |

### 1.2 Agents (11 files in `agents/`)

| File | Lines | Model | Color | MaxTurns | Role |
|------|-------|-------|-------|----------|------|
| `orchestrate.md` | 353 | opus | white | 100 | Universal dispatcher -- routes all 23 commands, delegates to specialists, handles finalization |
| `modify.md` | 206 | opus | green | 75 | Documentation creation/modification (revise, add, auto-update, auto-revise, deprecate) |
| `validate.md` | 196 | opus | cyan | 75 | Read-only audits, verification, sanity-checks. `disallowedTools: [Write, Edit]` |
| `citations.md` | 217 | opus | yellow | 75 | Citation generation, update, verify, audit |
| `api-refs.md` | 215 | opus | yellow | 75 | API Reference table generation and auditing |
| `locals.md` | 253 | opus | magenta | 75 | $locals contract documentation for PHP template components |
| `verbosity.md` | 160 | opus | red | 50 | Read-only verbosity gap scanner. `disallowedTools: [Write, Edit]` |
| `index.md` | 137 | opus | blue | 50 | PROJECT-INDEX.md maintenance, cross-doc links, CLAUDE.md template |
| `system.md` | 170 | opus | blue | 50 | Plugin self-maintenance (skill regen, setup, sync, update) |
| `researcher.md` | 179 | opus | orange | 75 | Pre-operation code analysis -- always delegated, never standalone |
| `planner.md` | 232 | **sonnet** | purple | 75 | Execution strategy design -- always delegated, creates plan files |

**Key patterns in all agents:**
- YAML frontmatter: `name`, `description` (with `<example>` blocks), `tools`, `skills` (module references), `model`, `color`, `maxTurns`
- Some have `disallowedTools` (validate, verbosity)
- System prompt body follows: Identity section, Delegation Mode section (Standalone + Delegated), How You Work steps, Report format, Memory Management, Git Awareness, Critical Rules
- Write-capable agents produce "Delegation Result" with completion marker when in delegated mode
- Read-only agents produce reports without pipeline markers

### 1.3 Skills (23 directories in `skills/`)

Every skill is a `SKILL.md` file with this consistent pattern:

```yaml
---
description: "..."
argument-hint: "..."
context: fork
agent: orchestrate
---

Engine: {engine-name}
Operation: {operation-name}
Instruction: framework/instructions/{engine}/{operation}.md

User request: $ARGUMENTS
```

All 23 skills use `context: fork` and `agent: orchestrate` -- every command enters the orchestrator.

| Skill | Engine | Operation | Type |
|-------|--------|-----------|------|
| `revise` | modify | revise | write |
| `add` | modify | add | write |
| `auto-update` | modify | auto-update | write |
| `auto-revise` | modify | auto-revise | write |
| `deprecate` | modify | deprecate | write |
| `audit` | validate | audit | read |
| `verify` | validate | verify | read |
| `sanity-check` | validate | sanity-check | read |
| `test` | validate | test | read |
| `citations` | citations | (subcommand) | write |
| `api-ref` | api-refs | (subcommand) | write |
| `locals` | locals | (subcommand) | write |
| `verbosity-audit` | verbosity | audit | read |
| `update-index` | index | update-project-index | admin |
| `update-claude` | index | update-example-claude | admin |
| `update-skills` | system | update-skills | admin |
| `setup` | system | setup | admin |
| `sync` | system | sync | admin |
| `update` | system | update | admin |
| `parallel` | orchestrate | parallel | batch |
| `remediate` | orchestrate | remediate | write |
| `do` | orchestrate | do | meta |
| `help` | orchestrate | help | meta |

**Notable: `setup` skill** has a large inline body (7 phases) that goes beyond simple routing metadata -- it includes the complete setup procedure directly in the skill file rather than just pointing to an instruction file.

### 1.4 Modules (11 directories in `modules/`)

Every module is a `SKILL.md` with frontmatter flags `user-invocable: false` and `disable-model-invocation: true`.

| Module | Lines | Preloaded By | Content |
|--------|-------|-------------|---------|
| `mod-standards` | 161 | All engines | File naming, directory structure, document format templates (10 template types), heading rules, path conventions |
| `mod-project` | ~55 | All engines | FP-specific config: theme root, docs root, WP-CLI prefix, source-to-doc mapping (now via source-map.cjs), appendix cross-refs, key paths |
| `mod-pipeline` | 187 | modify | 8-stage pipeline definition, stage descriptions, delegation protocol, trigger matrix, skip conditions, completion marker format |
| `mod-orchestration` | 228 | orchestrate | Delegation thresholds, execution mode selection (D-08), context offloading rules (D-09), pipeline phase grouping, agent count table, batching strategy, result formats, error recovery |
| `mod-citations` | ~90 | modify, citations | Citation block format (Full/Signature/Reference), tier rules, placement rules, excerpt rules, freshness model, citation scope |
| `mod-api-refs` | ~71 | modify, api-refs | API Reference table columns, provenance rules (PHPDoc/Verified/Authored), scope table, completeness rule, placement, ordering |
| `mod-changelog` | ~52 | modify | Changelog entry format (date, title, file list, summary), append rules |
| `mod-index` | ~68 | modify, index | PROJECT-INDEX.md update procedure (quick/update/full modes), git consistency rules, dual-artifact maintenance |
| `mod-locals` | 167 | modify, locals | @locals PHPDoc format, block grammar, @controller format, contract table columns, data flow section, shared shapes, integer-indexed $locals, required vs optional classification, CLI tool lifecycle |
| `mod-verbosity` | ~60 | modify, verbosity | Banned phrase list, severity classification, detection rules |
| `mod-validation` | ~60 | modify, validate | 10-point verification checklist, sanity-check severity classification |

### 1.5 CJS Library Files (`lib/`)

| File | Lines | Exports | Purpose |
|------|-------|---------|---------|
| `core.cjs` | 106 | `output`, `error`, `safeReadFile`, `safeJsonParse` | Output protocol (@file: for large payloads), error handling, safe file I/O |
| `paths.cjs` | 128 | `getPluginRoot`, `getCodebaseRoot`, `getDocsRoot`, `resolvePath`, `getAllPaths` | Three-repo path resolution |
| `config.cjs` | 178 | `loadConfig`, `getConfigValue`, `getConfig`, `cmdConfig` | JSON config loading from config.json with caching and dot-notation queries |
| `routing.cjs` | 278 | `lookupRoute`, `getRoutingTable`, `validateRoutes`, `cmdRoute`, `cmdHelp` | 21-entry routing table (command->engine mapping), route validation, help output |
| `hooks.cjs` | 750 | 12 handlers + `cmdHooks` | All hook handlers: inject-manifest, branch-sync, drift-nudge, update-check, post-modify-check, post-orchestrate-check, locals-cli-cleanup, pre-tool-use-bash-git-check, subagent-enforcement-check, teammate-idle, task-completed |
| `pipeline.cjs` | 868 | `cmdPipeline`, `initPipeline`, `getNextAction`, `shouldSkipStage`, `resolveStages`, `executeChangelog`, `evaluateIndexSkip`, `executeDocsCommit`, `validateStageGate` | 8-stage pipeline engine with callback loop, deterministic stage executors (6-8), stage gate validation |
| `state.cjs` | 627 | `loadState`, `logOperation`, `getLastOps`, `getPipeline`, `updatePipeline`, `clearPipeline`, `cmdState`, `cmdRemediate`, remediation plan CRUD | Operation history (100-entry auto-prune), pipeline state, remediation plans |
| `git.cjs` | 712 | `gitExec`, `checkRemoteAccessible`, `pullLatest`, `pushDocs`, `commitDocs`, sync operations, watermark CRUD, `cmdGit` | Three-repo git operations, structured error objects, watermark management |
| `security.cjs` | 238 | `validatePath`, `scanForInjection`, `validateShellArg`, `safeJsonParse` | Path traversal prevention, 15+ prompt injection patterns, shell safety |
| `enforcement.cjs` | 317 | `isGitWriteCommand`, `parseDelegationResult`, `verifyStageAuthority`, `validateStageOutput`, `STAGE_AUTHORITY_MAP` | Git-write detection, delegation result parsing, stage authority verification |
| `drift.cjs` | 661 | Drift analysis, staleness signals, pending merge, nudge formatting, `cmdDrift` | Drift detection: git diff -> source-map mapping -> affected docs |
| `source-map.cjs` | 420 | `loadSourceMap`, `lookupMapping`, `reverseLookup`, `getUnmapped`, `generateSourceMap`, `cmdSourceMap` | Source-to-doc mapping abstraction, 30+ directory seed mappings |
| `health.cjs` | 162 | `runHealthChecks`, `cmdHealth` | 6-area health checks: plugin root, config, codebase root, docs root, routing table, agents |
| `update.cjs` | 421 | `compareVersions`, `readUpdateCache`, `isCacheStale`, `spawnBackgroundCheck`, `cmdUpdate` | Version checking via GitHub Releases API, background spawn, cache management |
| `plans.cjs` | 482 | `savePlan`, `loadPlan`, `listPlans`, `updatePlan`, `prunePlans`, `saveAnalysis`, `loadAnalysis`, `cmdPlans` | Execution plan and analysis file persistence |
| `locals-cli.cjs` | 226 | `setup`, `teardown`, `cmdLocalsCli` | Ephemeral WP-CLI lifecycle management |

### 1.6 Framework Files

#### Instructions (30 files in `framework/instructions/`)

```
framework/instructions/
  api-refs/
    audit.md (31 lines)
    generate.md (47 lines)
  citations/
    audit.md (31 lines)
    generate.md (43 lines)
    update.md (35 lines)
    verify.md (23 lines)
  index/
    update.md (37 lines)
    update-example-claude.md (17 lines)
  locals/
    annotate.md (97 lines)
    contracts.md (72 lines)
    coverage.md (72 lines)
    cross-ref.md (68 lines)
    shapes.md (26 lines)
    validate.md (74 lines)
  modify/
    add.md (58 lines)
    auto-revise.md (35 lines)
    auto-update.md (57 lines)
    deprecate.md (43 lines)
    revise.md (63 lines)
  orchestrate/
    delegate.md (437 lines) -- THE master delegation algorithm
    do.md (92 lines)
    remediate.md (166 lines)
  system/
    setup.md (118 lines)
    sync.md (80 lines)
    update.md (146 lines)
    update-skills.md (35 lines)
  validate/
    audit.md (78 lines)
    sanity-check.md (51 lines)
    test.md (56 lines)
    verify.md (55 lines)
  verbosity/
    audit.md (31 lines)
```

#### Algorithms (6 files in `framework/algorithms/`)

| File | Lines | Purpose |
|------|-------|---------|
| `verbosity-algorithm.md` | ~80 | Step-by-step verbosity enforcement procedure |
| `citation-algorithm.md` | ~80 | Citation generation/staleness detection procedure |
| `api-ref-algorithm.md` | ~60 | API Reference table generation procedure |
| `validation-algorithm.md` | ~80 | Sanity-check + 10-point verification procedure |
| `git-sync-rules.md` | 277 | Branch sync, watermark, remote rules |
| `codebase-analysis-guide.md` | ~80 | PHP/JS scanning patterns for researcher engine |

#### Config (3 files in `framework/config/`)

| File | Lines | Purpose |
|------|-------|---------|
| `system-config.md` | 275 | **LEGACY** -- Feature flags, thresholds, citation scope. Superseded by `config.json` |
| `project-config.md` | ~50 | **LEGACY** -- FP-specific mappings. Source-to-doc mapping extracted to source-map.json |
| `playwright-mcp-config.json` | ~10 | Playwright MCP server configuration |

#### Templates (3 files in `framework/templates/`)

| File | Purpose |
|------|---------|
| `fp-docs-shell.zsh` | Shell prompt integration template |
| `fp-docs-statusline.js` | Update notification statusline hook |
| `post-merge.sh` | Git post-merge hook for drift detection |
| `post-rewrite.sh` | Git post-rewrite hook for drift detection |

#### Tools (1 file in `framework/tools/`)

| File | Lines | Purpose |
|------|-------|---------|
| `class-locals-cli.php` | 1408 | Ephemeral WP-CLI tool for $locals extraction using token_get_all() |

### 1.7 Specs (3 files in `specs/`)

| File | Lines | Scope |
|------|-------|-------|
| `architecture.md` | 1333 | Internal design, all 11 engines, module system, pipeline, hooks, git model, config |
| `features-and-capabilities.md` | 643 | Feature catalog, 23 commands, 11 engines, 11 modules |
| `usage-and-workflows.md` | 1012 | User-facing: installation, workflows, command reference |

### 1.8 Tests

**Test runner:** `tests/run.cjs` (77 lines) -- Uses `node:test` built-in. Zero external dependencies.

**Test filter flags:** `--hooks`, `--hooks-ab`, `--commands`, `--markers`, `--cli`, `--state`, `--git`, `--pipeline`, `--plans`, `--drift`, `--source-map`, `--update`, `--engine-compliance`, `--enforcement`

**Test library files (15 in `tests/lib/`):**

| File | Lines | Tests |
|------|-------|-------|
| `fixture-runner.cjs` | 398 | Golden file tests for hook handlers |
| `hooks-ab-runner.cjs` | 269 | A/B comparison tests (CJS vs bash hooks) |
| `spec-validator.cjs` | 145 | Behavioral spec validation for commands |
| `marker-checker.cjs` | 156 | Pipeline marker registry verification |
| `cli-runner.cjs` | 306 | CLI integration tests for fp-tools.cjs |
| `lib-state-tests.cjs` | 458 | State module unit tests |
| `lib-git-tests.cjs` | 235 | Git module unit tests |
| `lib-pipeline-tests.cjs` | 1171 | Pipeline engine unit tests |
| `lib-plans-tests.cjs` | 320 | Plans module unit tests |
| `lib-drift-tests.cjs` | 506 | Drift module unit tests |
| `lib-source-map-tests.cjs` | 449 | Source map module unit tests |
| `lib-update-tests.cjs` | 260 | Update module unit tests |
| `lib-routing-tests.cjs` | 168 | Routing module unit tests |
| `lib-engine-compliance-tests.cjs` | 417 | Engine CJS migration compliance tests |
| `lib-enforcement-tests.cjs` | 465 | Enforcement module unit tests |
| `lib-security-tests.cjs` | 171 | Security module unit tests |
| `lib-health-tests.cjs` | ~100 | Health module unit tests |
| `lib-paths-tests.cjs` | ~100 | Paths module unit tests |
| `lib-core-tests.cjs` | ~100 | Core module unit tests |
| `frontmatter-parser.cjs` | ~80 | YAML frontmatter parser utility |
| `json-diff.cjs` | 137 | JSON diff utility |

**Test fixtures (12+ scenarios in `tests/fixtures/hooks/`):**

```
tests/fixtures/hooks/
  branch-sync-check/no-docs-repo/ (env.json, expected-exit.json, input.json)
  inject-manifest/ (env.json, expected.json, input.json)
  locals-cli-cleanup-check/clean/ (env.json, expected.json, input.json)
  post-modify-check/changelog-{missing,present}/ (expected.json, input.json)
  post-orchestrate-check/{all-markers-present,missing-*}/ (expected.json, input.json)
  task-completed-check/{changelog-missing,hallucination-detected,write-task-complete}/
  teammate-idle-check/{delegation-complete,delegation-missing}/
```

**Test specs (23 files in `tests/specs/`):** One spec file per command -- behavioral specifications.

**Test markers (3 files in `tests/markers/`):**

| File | Purpose |
|------|---------|
| `pipeline-registry.json` | Registry of expected pipeline markers |
| `read-operation-excerpt.md` | Example read operation output |
| `write-operation-excerpt.md` | Example write operation output |

### 1.9 Untracked Files (Refactoring Direction)

Three untracked items visible in `git status`:

#### `commands/generate.md` (29 lines) -- **EARLY STUB**

A new-style command file using GSD-style frontmatter:

```yaml
---
name: fp-docs:generate
description: Initiate the process of creating documentation for entirely new or undocumented code.
argument-hint: <after> <description>
allowed-tools:
  - Read
  - Write
  - Bash
---
```

Body uses `<objective>`, `<execution_context>`, `<context>`, `<process>` XML tags. References `@~/.claude/fp-docs/workflows/generate.md` for execution. This is a GSD plugin-style command (not the current skill pattern).

#### `workflows/generate.md` (130 lines) -- **EARLY STUB / PLACEHOLDER**

A workflow file that is largely lorem ipsum placeholder content. The structure uses GSD-style `<purpose>`, `<required_reading>`, `<process>` XML tags with `<step>` elements. The actual process steps reference GSD tooling (`gsd-tools.cjs init phase-op`, `gsd-tools.cjs phase insert`), indicating this was started as a direct port from GSD's insert-phase workflow rather than an fp-docs-native workflow.

Key observations:
- References `$HOME/.claude/get-shit-done/bin/gsd-tools.cjs` -- GSD's CLI, not fp-tools.cjs
- Contains `<anti_patterns>` and `<success_criteria>` sections (GSD patterns)
- The process steps are for phase insertion, not documentation generation
- This is clearly a copy-paste scaffold from GSD, not yet adapted for fp-docs

#### `source-map.json` (58,038 lines, 1.7MB) -- **GENERATED DATA**

Auto-generated source-to-doc mapping. Contains version, generated timestamp, generator name, and `mappings` array with entries like:

```json
{
  "source": "inc/post-types/",
  "doc": "docs/02-post-types/",
  "type": "directory",
  "status": "mapped"
}
```

This is a data file generated by `fp-tools.cjs source-map generate`. Large because it maps every source file and directory in the FP codebase to its documentation counterpart.

---

## 2. Architecture Patterns

### 2.1 Skill-to-Agent Routing

**Current pattern:** Skill -> Orchestrate Agent -> Specialist Agent

Every command flows through the same path:
1. User invokes `/fp-docs:{command}` which triggers `skills/{command}/SKILL.md`
2. Skill frontmatter: `context: fork` (isolated subagent), `agent: orchestrate` (always routes here)
3. Skill body provides routing metadata: `Engine:`, `Operation:`, `Instruction:` lines + `$ARGUMENTS`
4. Orchestrate engine parses routing, classifies command type, delegates to specialist

**The orchestrate engine is the universal entry point.** It never executes domain operations directly (rule D-06). It delegates everything.

### 2.2 Multi-Agent Delegation (5-Phase Model)

For write operations, the orchestrator runs 5 phases:

1. **Research Phase:** Spawn `researcher` engine -> produces analysis file at `.fp-docs/analyses/`
2. **Plan Phase:** Spawn `planner` engine (receives analysis) -> creates plan file at `.fp-docs/plans/`
3. **Write Phase:** Spawn primary engine (modify/citations/api-refs/locals) in DELEGATED mode -> stages 1-3
4. **Review Phase:** Spawn `validate` engine in PIPELINE-VALIDATION mode -> stages 4-5
5. **Finalize Phase:** Orchestrator handles directly via CJS pipeline loop -> stages 6-8

For read-only operations: Research -> Plan -> Specialist (standalone mode). No pipeline.

For admin operations: Research (minimal) -> Plan (1-phase) -> Specialist (standalone mode).

### 2.3 Module System

Modules are preloaded into agent context via the `skills:` list in agent frontmatter:

```yaml
skills:
  - mod-standards     # Formatting rules
  - mod-project       # FP-specific config
  - mod-pipeline      # Pipeline definition
  - mod-changelog     # Changelog rules
  - mod-orchestration # Delegation protocol
```

Modules contain rules/definitions (tables, prose). Algorithms contain step-by-step procedures. The distinction is: modules are preloaded and persistent in context; algorithms are read on-demand during specific pipeline stages.

### 2.4 The Pipeline (8 Stages, 3 Phases)

```
Write Phase (primary engine, DELEGATED mode):
  Stage 1: Verbosity Enforcement  -> algorithm: verbosity-algorithm.md
  Stage 2: Citation Generation    -> algorithm: citation-algorithm.md
  Stage 3: API Reference Sync     -> algorithm: api-ref-algorithm.md

Review Phase (validate engine, PIPELINE-VALIDATION mode):
  Stage 4: Sanity Check           -> algorithm: validation-algorithm.md
  Stage 5: 10-Point Verification  -> algorithm: validation-algorithm.md

Finalize Phase (orchestrator via CJS pipeline loop):
  Stage 6: Changelog Update       -> deterministic CJS (pipeline.cjs executeChangelog)
  Stage 7: Index Update           -> evaluateIndexSkip, may spawn index engine
  Stage 8: Docs Commit & Push     -> deterministic CJS (pipeline.cjs executeDocsCommit -> git.cjs)
```

The pipeline callback loop:
```
orchestrator calls: fp-tools pipeline init --operation {op} --files {files}
loop:
  orchestrator calls: fp-tools pipeline next
  response.action == "execute" -> fp-tools pipeline run-stage {id}
  response.action == "spawn"   -> spawn LLM agent for that stage
  response.action == "complete" -> done, extract completion_marker
  response.action == "blocked"  -> HALLUCINATION detected, halt
```

### 2.5 Hook System

**6 hook events** defined in `hooks/hooks.json`:

| Event | Matchers | Handler(s) |
|-------|----------|-----------|
| `PreToolUse` | `Bash` | `handlePreToolUseBashGitCheck` -- blocks raw git-write commands |
| `SessionStart` | (none) | `handleInjectManifest`, `handleBranchSyncCheck`, `handleDriftNudge`, `handleUpdateCheck` |
| `SubagentStop` | `modify`, `orchestrate`, `locals`, `validate`, `citations`, `api-refs`, `researcher`, `planner` | Various enforcement checks per engine |
| `TeammateIdle` | (none) | `handleTeammateIdleCheck` |
| `TaskCompleted` | (none) | `handleTaskCompletedCheck` |

All hooks invoke: `node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" hooks run <event> [matcher]`

**Handler categories:**
- Category A (JSON stdout, exit 0): inject-manifest, branch-sync, drift-nudge, update-check, post-modify-check, post-orchestrate-check, subagent-enforcement-check, locals-cli-cleanup
- Category PreToolUse (exit 0 allow, exit 2 block): pre-tool-use-bash-git-check
- Category B (exit code + stderr): teammate-idle, task-completed

### 2.6 Configuration Architecture

**Current state: config.json is the source of truth** (replacing the legacy markdown config files).

```
config.json
  system:       Feature flags, thresholds, citation/api-ref/verbosity scope tables, orchestration params
  project:      FP identity, appendix triggers, 3-repo configuration
  pipeline:     8-stage definition with phases, trigger matrix, skip conditions
```

Legacy markdown configs (`framework/config/system-config.md`, `framework/config/project-config.md`) still exist but have been superseded. The project-config.md even says: "Source-to-doc mappings are now managed by source-map.json."

### 2.7 The Three-Repo Git Model

1. **Codebase repo:** The WordPress wp-content/ directory. Detected via `git rev-parse --show-toplevel`.
2. **Docs repo:** Nested at `{codebase}/themes/foreign-policy-2017/docs/`. Separate git repo with its own remote.
3. **Plugin repo:** fp-docs itself. Distributed via the fp-tools marketplace.

Only the orchestrator commits (via CJS pipeline stage 8). Specialist engines in delegated mode never touch git.

---

## 3. Key Components Deep Dive

### 3.1 Agent Frontmatter Schema

Every agent follows this YAML frontmatter pattern:

```yaml
---
name: {engine-name}
description: |
  Multi-line description with <example>/<commentary> blocks for Claude Code routing.
tools:
  - Read
  - Write     # (omitted for read-only engines)
  - Edit      # (omitted for read-only engines)
  - Grep
  - Glob
  - Bash
  - Agent     # orchestrate only
  - TeamCreate # orchestrate only
  - SendMessage # orchestrate only
  - TaskCreate  # orchestrate only
  - TaskUpdate  # orchestrate only
  - TaskList    # orchestrate only
disallowedTools:  # validate and verbosity only
  - Write
  - Edit
skills:
  - mod-standards
  - mod-project
  - mod-{domain-specific}
model: opus    # or sonnet for planner
color: {color}
maxTurns: {50-100}
---
```

### 3.2 Orchestrate Engine System Prompt

The orchestrate engine (353 lines) contains:
- Identity block with D-06 rule ("NEVER execute fp-docs operations directly")
- 9 execution steps covering write, read, admin, batch operations
- Complete Command-to-Engine Routing Table (30 entries)
- Git Rules (8 rules)
- Error Recovery (5 rules)
- Pipeline Skip Conditions
- Critical Rules (12 rules)
- Memory Management guidance

The orchestrator's finalization loop (Step 5c) uses the CJS pipeline callback pattern rather than LLM-driven finalization.

### 3.3 fp-tools.cjs CLI Surface

The CLI entry point routes to 17 command modules:

| Command | Module | Subcommands |
|---------|--------|-------------|
| `version` | inline | (none) |
| `help` | routing.cjs | (none), grouped |
| `paths` | paths.cjs | plugin-root, codebase-root, docs-root, all |
| `config` | config.cjs | get, section, dump |
| `route` | routing.cjs | lookup, table, validate |
| `health` | health.cjs | check, diagnose |
| `security` | security.cjs | check, validate-path |
| `state` | state.cjs | log, last, pipeline, get, dump |
| `remediate` | state.cjs | save, load, list, update |
| `git` | git.cjs | sync-check, commit, remote-check, watermark, branches |
| `hooks` | hooks.cjs | run (event) (matcher) |
| `locals-cli` | locals-cli.cjs | setup, teardown |
| `pipeline` | pipeline.cjs | init, next, run-stage, record-output, status, reset |
| `drift` | drift.cjs | analyze, status, clear, add-signal, list, install, shell-install |
| `source-map` | source-map.cjs | lookup, reverse-lookup, unmapped, generate, dump |
| `update` | update.cjs | check, status, run |
| `plans` | plans.cjs | save, load, list, update, prune, save-analysis, load-analysis |

### 3.4 Routing Table (lib/routing.cjs)

The canonical routing table contains exactly 21 entries. This is the single source of truth for command-to-engine mappings. The routing table also includes descriptions for help output.

```javascript
const ROUTING_TABLE = {
  'revise':          { engine: 'modify',      operation: 'revise',              type: 'write' },
  'add':             { engine: 'modify',      operation: 'add',                 type: 'write' },
  'auto-update':     { engine: 'modify',      operation: 'auto-update',         type: 'write' },
  // ... 21 total entries
};
```

### 3.5 Pipeline Engine (lib/pipeline.cjs)

The pipeline engine (868 lines) is the most complex CJS module:

- `initPipeline(opts)` -- Resolves stages for an operation, creates pipeline state
- `getNextAction()` -- The callback loop heart -- returns spawn/execute/complete/blocked
- `shouldSkipStage(stageId, context)` -- Evaluates skip conditions per config
- `resolveStages(operation, flags)` -- Maps operation to applicable stages via trigger matrix
- `validateStageGate(stageId, pipeline)` -- Gate validation before progression
- `executeChangelog(pipelineState)` -- Deterministic changelog entry generation (stage 6)
- `evaluateIndexSkip(pipelineState)` -- Determines if index update needed (stage 7)
- `executeDocsCommit(pipelineState)` -- Git commit/push via git.cjs (stage 8)

### 3.6 Enforcement Module (lib/enforcement.cjs)

Runtime enforcement for the delegation architecture:

- `isGitWriteCommand(command)` -- Blocks raw git writes, exempts CJS-mediated git
- `parseDelegationResult(text)` -- Validates delegation result structure, extracts stages/markers
- `verifyStageAuthority(agentType, expectedPhase)` -- Checks agent-to-phase authorization
- `validateStageOutput(stageId, context)` -- Stage output marker validation

The `STAGE_AUTHORITY_MAP` maps each engine to its authorized pipeline phase:
```javascript
const STAGE_AUTHORITY_MAP = {
  researcher: 'research',
  planner: 'plan',
  modify: 'write',
  citations: 'write',
  'api-refs': 'write',
  locals: 'write',
  validate: 'review',
  orchestrate: 'finalize',
};
```

---

## 4. Dependencies and Cross-References

### 4.1 Agent-to-Module Dependencies

| Agent | Modules Loaded |
|-------|---------------|
| orchestrate | mod-standards, mod-project, mod-pipeline, mod-changelog, mod-orchestration |
| modify | mod-standards, mod-project, mod-pipeline, mod-changelog, mod-index |
| validate | mod-standards, mod-project, mod-validation |
| citations | mod-standards, mod-project, mod-citations |
| api-refs | mod-standards, mod-project, mod-api-refs |
| locals | mod-standards, mod-project, mod-locals |
| verbosity | mod-standards, mod-project, mod-verbosity |
| index | mod-standards, mod-project, mod-index |
| system | mod-standards, mod-project |
| researcher | mod-standards, mod-project |
| planner | mod-standards, mod-project, mod-orchestration |

### 4.2 CJS Module Dependencies

```
fp-tools.cjs
  -> core.cjs (output protocol)
  -> paths.cjs (3-repo resolution)
  -> security.cjs (input validation)
  -> config.cjs -> core.cjs, paths.cjs
  -> routing.cjs -> core.cjs, paths.cjs
  -> health.cjs -> core.cjs, paths.cjs, routing.cjs
  -> state.cjs -> core.cjs, paths.cjs
  -> git.cjs -> core.cjs, paths.cjs, security.cjs
  -> hooks.cjs -> core.cjs, paths.cjs, git.cjs, enforcement.cjs, drift.cjs (lazy), update.cjs (lazy)
  -> pipeline.cjs -> core.cjs, config.cjs, state.cjs, paths.cjs, enforcement.cjs
  -> drift.cjs -> core.cjs, paths.cjs, source-map.cjs
  -> source-map.cjs -> core.cjs, paths.cjs (CRITICAL: leaf module, no config.cjs dependency)
  -> update.cjs -> core.cjs, paths.cjs
  -> plans.cjs -> core.cjs, paths.cjs
  -> locals-cli.cjs -> core.cjs, paths.cjs
  -> enforcement.cjs -> (no dependencies, standalone)
```

### 4.3 Representative Routing Chains

**Write command: `/fp-docs:revise fix the posts helper`**
```
User -> skills/revise/SKILL.md (context: fork, agent: orchestrate)
     -> orchestrate engine parses: Engine: modify, Operation: revise
     -> Phase 1: Spawn researcher (DELEGATED) -> produces analysis file
     -> Phase 2: Spawn planner (DELEGATED) -> creates 3-phase plan file
     -> Phase 3: Spawn modify engine (Mode: DELEGATED)
        -> reads framework/instructions/modify/revise.md
        -> executes primary operation
        -> runs stages 1-3 (reads verbosity/citation/api-ref algorithms)
        -> returns Delegation Result
     -> Phase 4: Spawn validate engine (Mode: PIPELINE-VALIDATION)
        -> runs stages 4-5
        -> returns Pipeline Validation Report
     -> Phase 5: Orchestrator CJS pipeline loop
        -> fp-tools pipeline init -> fp-tools pipeline next -> run-stage 6 (changelog)
        -> fp-tools pipeline next -> run-stage 7 (index skip check)
        -> fp-tools pipeline next -> run-stage 8 (docs commit via git.cjs)
        -> fp-tools pipeline next -> action: complete
```

**Read command: `/fp-docs:audit docs/06-helpers/`**
```
User -> skills/audit/SKILL.md (context: fork, agent: orchestrate)
     -> orchestrate engine parses: Engine: validate, Operation: audit
     -> Phase 1: Spawn researcher (DELEGATED, summary-depth)
     -> Phase 2: Spawn planner (DELEGATED, 1-phase plan)
     -> Phase 3: Spawn validate engine (standalone mode, NOT delegated)
        -> reads framework/instructions/validate/audit.md
        -> reads framework/algorithms/validation-algorithm.md
        -> returns Validation Report with Remediation Summary
     -> No pipeline. No changelog. No git.
```

**Admin command: `/fp-docs:setup`**
```
User -> skills/setup/SKILL.md (context: fork, agent: orchestrate)
     -> orchestrate engine parses: Engine: system, Operation: setup
     -> Phase 1: Spawn researcher (minimal depth)
     -> Phase 2: Spawn planner (1-phase admin plan)
     -> Phase 3: Spawn system engine (standalone mode)
        -> reads framework/instructions/system/setup.md
        -> executes 7-phase setup procedure
        -> returns Setup Verification Report
```

---

## 5. What Works vs. What Doesn't

### 5.1 Functional Patterns

- **CJS library:** The 16 lib modules are well-structured, tested, and follow consistent patterns (output protocol, safe I/O, zero external dependencies).
- **Pipeline engine:** The callback loop architecture (init/next/run-stage) is solid and tested (1171 lines of tests).
- **Hook system:** 11 handlers covering all lifecycle events, with enforcement checks and auto-cleanup.
- **Config consolidation:** Migration from markdown configs to config.json is complete. The dot-notation query API works.
- **Source-map module:** Abstracts source-to-doc mapping cleanly with lookup, reverse-lookup, and generate capabilities.
- **Git operations:** Structured error handling with classification, recovery hints, watermark management.
- **Security:** Path traversal prevention, prompt injection detection (15+ patterns), shell safety.
- **Tests:** Comprehensive test suite using Node.js built-in `node:test`. 15+ test files covering all lib modules.

### 5.2 Architectural Concerns

- **Agent count bloat:** Write operations now require 5 agents minimum (orchestrator + researcher + planner + specialist + validator). This is expensive in terms of token usage and latency.
- **Instruction file duplication:** Some behavior is defined in both the instruction file and the agent system prompt (e.g., the setup skill has a detailed procedure inline).
- **Module loading overhead:** 11 modules loaded via agent `skills:` list means significant context consumption per agent. Every engine preloads mod-standards and mod-project at minimum.
- **Config file fragmentation:** config.json is the source of truth, but legacy markdown configs still exist in `framework/config/`. The mod-project module references source-map.cjs instead of config.json for mappings.
- **Manifest vs routing table:** The manifest.md, routing table in routing.cjs, and routing table in orchestrate.md agent prompt all need to stay in sync.

### 5.3 Dead Code / Orphaned References

- `framework/config/system-config.md` and `framework/config/project-config.md` are LEGACY -- superseded by config.json but still present on disk.
- The manifest.md still lists some engines as "inherit" model but agent files say "opus."
- Some agent descriptions reference "9 engines" but there are now 11 (with researcher and planner added).

---

## 6. Untracked Files Analysis (Refactoring Direction)

### 6.1 `commands/generate.md` -- New Command Pattern

This file suggests a migration toward GSD-style command files:

**Current fp-docs pattern (skills/):**
- Frontmatter: `description`, `argument-hint`, `context: fork`, `agent: orchestrate`
- Body: routing metadata (Engine/Operation/Instruction) + `$ARGUMENTS`
- Agent coupling: always routes through orchestrate engine

**New GSD-style pattern (commands/):**
- Frontmatter: `name: fp-docs:generate`, `description`, `argument-hint`, `allowed-tools`
- Body uses XML tags: `<objective>`, `<execution_context>`, `<context>`, `<process>`
- References a workflow file: `@~/.claude/fp-docs/workflows/generate.md`
- No agent coupling -- command defines its own tool permissions

### 6.2 `workflows/generate.md` -- New Workflow Pattern

This file is a scaffold from GSD's workflow system. Key differences from current fp-docs:

**Current fp-docs pattern:**
- Instructions in `framework/instructions/` as markdown steps
- Read by engine agents at runtime via Read tool
- Engine agent decides execution flow

**New GSD-style pattern:**
- Workflows as `<step>` elements in XML process blocks
- Inline bash calls to CLI tools (gsd-tools.cjs)
- References GSD infrastructure (init phase-op, STATE.md, ROADMAP.md)
- Has `<anti_patterns>` and `<success_criteria>` sections

**Critical observation:** The workflow file references GSD's CLI (`$HOME/.claude/get-shit-done/bin/gsd-tools.cjs`), not fp-tools.cjs. This is a direct copy from GSD that has not been adapted for fp-docs.

### 6.3 Implications for Conversion

The untracked files suggest the user is exploring:
1. Replacing the `skills/` directory pattern with a `commands/` directory pattern
2. Replacing the `framework/instructions/` pattern with a `workflows/` pattern
3. Removing the mandatory orchestrator routing (commands define their own tools/agents)
4. Adopting GSD's XML tag structure for command/workflow definitions

The conversion appears to be in its earliest stages -- only one command stub and one workflow placeholder exist.

---

## 7. Structural Summary for Plan Writer

### 7.1 What the Plan Writer Needs to Know

**Total component counts:**
- 11 agent definitions (agents/)
- 23 skill definitions (skills/) -- all route through orchestrate
- 11 shared modules (modules/) -- preloaded into agents via skills: list
- 30 instruction files (framework/instructions/) -- read on-demand by engines
- 6 algorithm files (framework/algorithms/) -- read on-demand during pipeline stages
- 16 CJS library modules (lib/) -- fp-tools.cjs dispatches to them
- 1 CLI entry point (fp-tools.cjs)
- 1 hooks configuration (hooks/hooks.json) with 6 event types
- 1 consolidated config (config.json)
- 15+ test files (tests/lib/)
- 3 spec documents (specs/)
- 2 legacy markdown configs (framework/config/)
- 4 template files (framework/templates/)
- 1 PHP WP-CLI tool (framework/tools/)

**Key architectural properties:**
1. Every command enters through the orchestrate engine (single entry point)
2. Write operations use 5 agents: orchestrate -> researcher -> planner -> specialist -> validator
3. Pipeline is CJS-driven with callback loop (init/next/run-stage)
4. Hooks enforce architecture rules at runtime (git-write blocking, delegation result validation, stage authority)
5. Config is unified in config.json with source-to-doc mappings in source-map.json
6. Zero external dependencies -- all CJS uses Node.js built-ins only
7. The plugin uses Claude Code's native primitives: subagents via `context: fork`, modules via `skills:` list in agent frontmatter, hooks via hooks.json

### 7.2 Files That Map Between Architectures

The plan writer should understand these correspondences to GSD patterns:

| fp-docs Component | Likely GSD Equivalent |
|-------------------|----------------------|
| `skills/{name}/SKILL.md` | `commands/{name}.md` |
| `framework/instructions/{engine}/{op}.md` | `workflows/{name}.md` |
| `agents/{name}.md` | `agents/{name}.md` (similar but different frontmatter) |
| `modules/mod-{name}/SKILL.md` | Possibly inlined into agents or extracted to `knowledge/` |
| `framework/algorithms/{name}.md` | Possibly merged into workflows |
| `config.json` | `config.json` (similar pattern) |
| `hooks/hooks.json` | GSD's hook system (likely similar) |
| `fp-tools.cjs` -> `lib/*.cjs` | GSD's `gsd-tools.cjs` -> `lib/*.cjs` |
| `tests/run.cjs` -> `tests/lib/*.cjs` | GSD's test infrastructure |

### 7.3 Areas Requiring Special Attention

1. **The orchestrate engine** is the most complex component (353 lines). Its delegation algorithm (`delegate.md`, 437 lines) drives the entire system. The conversion must preserve or replace this coordination logic.

2. **The pipeline engine** (`pipeline.cjs`, 868 lines) is the second most complex component. The 8-stage callback loop with stage gate validation is tightly integrated with the orchestration model.

3. **The enforcement module** (`enforcement.cjs`, 317 lines) provides runtime safety guarantees. Git-write blocking, delegation result validation, and stage authority checks must be preserved in whatever form.

4. **Module content** (standards, citations, API refs, locals, etc.) contains domain-specific rules that are independent of architecture. These rules must survive the conversion regardless of how they are packaged.

5. **The 30 instruction files** contain operation-specific procedures. These are the "how to do X" knowledge that must map to workflows or equivalent.

6. **The 6 algorithm files** contain reusable procedures for pipeline stages. These may merge into workflows or become shared workflow components.

7. **The PHP WP-CLI tool** (`class-locals-cli.php`, 1408 lines) is a runtime dependency for locals operations. It has an ephemeral lifecycle (install/teardown) managed by CJS.

8. **Test infrastructure** is solid and should be preserved. 15+ test files covering all lib modules.
