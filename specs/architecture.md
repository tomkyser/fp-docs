# fp-docs Architecture

<!-- Updated 2026-03-29: Full rewrite for GSD command-workflow-agent architecture (Phase 10 conversion) -->

> **Updated 2026-03-29**: Architecture rewritten for GSD conversion. Previous skill-engine-module architecture replaced by command-workflow-agent chain. Commands are thin YAML+XML routing files, workflows are orchestrators that spawn agents, agents do domain work. References replace modules and algorithms. Instruction files absorbed into workflows. Hook system migrated from hooks.json to settings.json with standalone JS files.

Thorough analysis of the fp-docs Claude Code plugin internals: command-workflow-agent routing, reference system, pipeline, hooks, git model, permissions, and configuration.

---

## 1. Repository Layout and File Inventory

The fp-docs repository is an independent git repo (`tomkyser/fp-docs`) added as a submodule to the `fp-tools` marketplace container (`tomkyser/fp-tools`):

```
fp-docs/                              # Git root (independent repo, submodule of fp-tools)
├── .claude-plugin/
│   └── plugin.json                   # Plugin manifest v1.0.0
├── settings.json                     # Default permissions + hook registrations
├── .mcp.json                         # Playwright MCP server declaration (visual verification)
├── config.json                       # Model profiles and plugin configuration
├── hooks/                            # Standalone JS hook files (6 files)
│   ├── fp-docs-session-start.js
│   ├── fp-docs-check-update.js
│   ├── fp-docs-git-guard.js
│   ├── fp-docs-subagent-stop.js
│   ├── fp-docs-teammate-idle.js
│   └── fp-docs-task-completed.js
├── agents/                           # 10 GSD-style agent definitions
│   ├── fp-docs-modifier.md
│   ├── fp-docs-validator.md
│   ├── fp-docs-citations.md
│   ├── fp-docs-api-refs.md
│   ├── fp-docs-locals.md
│   ├── fp-docs-verbosity.md
│   ├── fp-docs-indexer.md
│   ├── fp-docs-system.md
│   ├── fp-docs-researcher.md
│   └── fp-docs-planner.md
├── commands/fp-docs/                 # 23 user-facing commands (YAML frontmatter + XML body)
│   ├── revise.md
│   ├── add.md
│   ├── auto-update.md
│   ├── auto-revise.md
│   ├── deprecate.md
│   ├── audit.md
│   ├── verify.md
│   ├── sanity-check.md
│   ├── test.md
│   ├── citations.md
│   ├── api-ref.md
│   ├── locals.md
│   ├── verbosity-audit.md
│   ├── update-index.md
│   ├── update-claude.md
│   ├── update-skills.md
│   ├── setup.md
│   ├── sync.md
│   ├── update.md
│   ├── parallel.md
│   ├── remediate.md
│   ├── do.md
│   └── help.md
├── workflows/                        # 23 workflow orchestrators (one per command)
│   ├── revise.md                     # Write workflow (6-step template)
│   ├── add.md
│   ├── auto-update.md
│   ├── auto-revise.md
│   ├── deprecate.md
│   ├── audit.md                      # Read workflow (4-step template)
│   ├── verify.md
│   ├── sanity-check.md
│   ├── test.md
│   ├── verbosity-audit.md
│   ├── citations.md                  # Multi-subcommand workflow
│   ├── api-ref.md
│   ├── locals.md
│   ├── update-index.md               # Admin workflow
│   ├── update-claude.md
│   ├── update-skills.md
│   ├── setup.md
│   ├── sync.md
│   ├── update.md
│   ├── parallel.md                   # Batch workflow
│   ├── remediate.md
│   ├── do.md                         # Meta workflow (inline, no agent spawning)
│   └── help.md
├── references/                       # 16 shared reference files (loaded via @-reference)
│   ├── doc-standards.md              # Formatting, naming, structural, depth rules
│   ├── fp-project.md                 # FP-specific paths, source-map CLI reference
│   ├── pipeline-enforcement.md       # 8-stage pipeline definition
│   ├── citation-rules.md             # Citation format, tiers, staleness
│   ├── api-ref-rules.md              # API Reference table format, scope
│   ├── changelog-rules.md            # Changelog entry format
│   ├── index-rules.md                # PROJECT-INDEX.md update rules
│   ├── locals-rules.md               # $locals contract format, shapes
│   ├── verbosity-rules.md            # Anti-brevity rules, banned phrases
│   ├── validation-rules.md           # 10-point checklist, sanity-check
│   ├── verbosity-algorithm.md        # Verbosity enforcement procedure (pipeline stage 1)
│   ├── citation-algorithm.md         # Citation generation procedure (pipeline stage 2)
│   ├── api-ref-algorithm.md          # API Reference sync procedure (pipeline stage 3)
│   ├── validation-algorithm.md       # Sanity-check + verification procedure (stages 4-5)
│   ├── codebase-analysis-guide.md    # Source code scanning procedure
│   └── git-sync-rules.md             # Branch sync procedure
├── templates/                        # Git hook and shell integration templates
│   ├── post-merge.sh
│   ├── post-rewrite.sh
│   ├── fp-docs-shell.zsh
│   └── fp-docs-statusline.js
├── lib/                              # CJS modules (hooks, locals-cli, core, paths, etc.)
│   ├── hooks.cjs                     # Hook handler functions
│   ├── enforcement.cjs               # Runtime enforcement (git-write blocking, delegation validation)
│   ├── locals-cli.cjs                # Ephemeral WP-CLI setup/teardown lifecycle
│   ├── core.cjs                      # Shared utilities (output, error, safeJsonParse)
│   ├── paths.cjs                     # Three-repo path resolution
│   ├── security.cjs                  # Input validation and injection scanning
│   ├── config.cjs                    # Configuration access
│   ├── routing.cjs                   # Command routing table (23 entries)
│   ├── health.cjs                    # System health checks
│   ├── state.cjs                     # Operation state management
│   ├── git.cjs                       # Three-repo git operations
│   ├── drift.cjs                     # Drift detection and staleness tracking
│   ├── pipeline.cjs                  # Pipeline sequencing engine (stages 6-8, gate validation 1-5)
│   ├── remediate.cjs                 # Remediation plan persistence
│   ├── source-map.cjs                # Source-to-doc mapping abstraction
│   ├── plans.cjs                     # Execution plan and analysis file CRUD
│   ├── update.cjs                    # Background update checking, version comparison
│   ├── init.cjs                      # CLI init commands (write-op, read-op, admin-op)
│   └── model-profiles.cjs            # Agent-to-model resolution
├── source-map.json                   # Source-to-doc mapping data (generated by source-map.cjs)
├── fp-tools.cjs                      # CLI entry point for all CJS modules
├── framework/
│   ├── config/
│   │   └── playwright-mcp-config.json # Playwright browser config
│   └── tools/
│       └── class-locals-cli.php      # WP-CLI fp-locals command (token-based $locals extraction)
├── specs/                            # Canonical specification documents
├── tests/                            # Characterization and unit tests
├── README.md
└── CHANGELOG.md
```

Key distinction: The repo root IS the plugin root. When using `--plugin-dir` for local dev, point at this directory. The marketplace container (`fp-tools`) references it via `.claude-plugin/marketplace.json` with `"source": "./fp-docs"`.

---

## 2. Plugin Manifest and Configuration

### plugin.json (.claude-plugin/plugin.json)

```json
{
  "name": "fp-docs",
  "version": "1.0.0",
  "description": "Documentation management system for the Foreign Policy WordPress codebase...",
  "author": { "name": "Tom Kyser" },
  "repository": "https://github.com/tomkyser/fp-docs",
  "license": "MIT"
}
```

### settings.json

Contains default permissions and all hook registrations:

```json
{
  "permissions": {
    "allow": ["Read", "Grep", "Glob"]
  },
  "hooks": {
    "PreToolUse": [...],
    "SessionStart": [...],
    "SubagentStop": [...],
    "TeammateIdle": [...],
    "TaskCompleted": [...]
  }
}
```

Hook registrations reference standalone JS files in `hooks/` (see Section 8).

### config.json

Contains model profile mappings for agents:

```json
{
  "model_profile": {
    "fp-docs-modifier": "opus",
    "fp-docs-validator": "opus",
    "fp-docs-researcher": "opus",
    "fp-docs-planner": "sonnet",
    ...
  }
}
```

---

## 3. Command-Workflow-Agent Routing Pattern

This is the core architectural pattern. All 23 user commands follow the GSD command-workflow-agent chain:

```
User types: /fp-docs:revise "fix the posts helper"
    │
    ▼
Command file: commands/fp-docs/revise.md
    │  - YAML frontmatter: name, description, argument-hint, allowed-tools
    │  - XML body: <objective>, <execution_context> (with @-references),
    │    <context>, <process>, <success_criteria>
    │  - @-references load workflow + doc-standards + fp-project + pipeline-enforcement
    │
    ▼
Workflow: workflows/revise.md
    │  - Orchestrates the full operation lifecycle
    │  - Step 1: Initialize via fp-tools init write-op
    │  - Step 2: Spawn fp-docs-researcher for source code analysis
    │  - Step 3: Spawn fp-docs-planner for change planning
    │  - Step 4: Spawn fp-docs-modifier for Write Phase (stages 1-3)
    │  - Step 5: Spawn fp-docs-validator for Review Phase (stages 4-5)
    │  - Step 6: Handle Finalize Phase (stages 6-8) via pipeline callback loop
    │
    ▼
Agent: agents/fp-docs-modifier.md
    │  - GSD-style frontmatter: name, model, tools, agent_type
    │  - XML body: <identity>, <capabilities>, <process>, <rules>
    │  - Loads references via <files_to_read> in spawn prompt
    │  - Executes assigned pipeline phases only
    │
    ▼
Pipeline phases (Write → Review → Finalize)
    │  - Coordinated by workflow, distributed across agents
    │  - References loaded on-demand at each stage
    │
    ▼
Workflow aggregates results → Structured report returned to user
```

### Command Anatomy

Commands are thin YAML+XML routing files in `commands/fp-docs/`. Every command loads its workflow and common references via `@-reference`:

```yaml
---
name: fp-docs:revise
description: Fix specific documentation you know is wrong or outdated.
argument-hint: "description of what to fix"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - Task
---

<objective>
Locate, update, and validate documentation...
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/workflows/revise.md
@${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
@${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
@${CLAUDE_PLUGIN_ROOT}/references/pipeline-enforcement.md
</execution_context>

<context>
Arguments: $ARGUMENTS
Operation type: write (full pipeline required)
</context>

<process>
Execute the revise workflow end-to-end.
</process>

<success_criteria>
Pipeline completion with all stages passing.
</success_criteria>
```

Key properties:
- `allowed-tools` controls which tools are available (write commands get Write/Edit, read commands don't)
- Every command includes `doc-standards.md` and `fp-project.md` in `<execution_context>` (GSD explicit style)
- The `<process>` section delegates to the workflow
- `$ARGUMENTS` is a Claude Code variable containing the user's input

### Complete Command-to-Agent Routing Table (23 Commands)

All 23 commands are in the ROUTING_TABLE in `lib/routing.cjs`.

| Command | Agent | Workflow | Operation | Type |
|---------|-------|----------|-----------|------|
| /fp-docs:revise | fp-docs-modifier | revise.md | revise | write |
| /fp-docs:add | fp-docs-modifier | add.md | add | write |
| /fp-docs:auto-update | fp-docs-modifier | auto-update.md | auto-update | write |
| /fp-docs:auto-revise | fp-docs-modifier | auto-revise.md | auto-revise | write |
| /fp-docs:deprecate | fp-docs-modifier | deprecate.md | deprecate | write |
| /fp-docs:audit | fp-docs-validator | audit.md | audit | read |
| /fp-docs:verify | fp-docs-validator | verify.md | verify | read |
| /fp-docs:sanity-check | fp-docs-validator | sanity-check.md | sanity-check | read |
| /fp-docs:test | fp-docs-validator | test.md | test | read |
| /fp-docs:citations | fp-docs-citations | citations.md | (subcommand) | write |
| /fp-docs:api-ref | fp-docs-api-refs | api-ref.md | (subcommand) | write |
| /fp-docs:locals | fp-docs-locals | locals.md | (subcommand) | write |
| /fp-docs:verbosity-audit | fp-docs-verbosity | verbosity-audit.md | audit | read |
| /fp-docs:update-index | fp-docs-indexer | update-index.md | update-project-index | admin |
| /fp-docs:update-claude | fp-docs-indexer | update-claude.md | update-example-claude | admin |
| /fp-docs:update-skills | fp-docs-system | update-skills.md | update-skills | admin |
| /fp-docs:setup | fp-docs-system | setup.md | setup | admin |
| /fp-docs:sync | fp-docs-system | sync.md | sync | admin |
| /fp-docs:update | fp-docs-system | update.md | update | admin |
| /fp-docs:parallel | (none) | parallel.md | parallel | batch |
| /fp-docs:remediate | (none) | remediate.md | remediate | write |
| /fp-docs:do | (none) | do.md | do | meta |
| /fp-docs:help | (none) | help.md | help | meta |

### Workflow Templates

Workflows orchestrate agent spawning and pipeline execution. Four templates:

**Write Workflow (6 steps)**: Used by revise, add, auto-update, auto-revise, deprecate.
1. Initialize via `fp-tools init write-op`
2. Spawn fp-docs-researcher for codebase analysis
3. Spawn fp-docs-planner for change planning
4. Spawn primary agent (fp-docs-modifier) for Write Phase (stages 1-3)
5. Spawn fp-docs-validator for Review Phase (stages 4-5)
6. Handle Finalize Phase (stages 6-8) via pipeline callback loop

**Read Workflow (4 steps)**: Used by audit, verify, sanity-check, test, verbosity-audit.
1. Initialize via `fp-tools init read-op`
2. Research phase (optional)
3. Plan phase (optional)
4. Spawn specialist agent in standalone mode (no pipeline)

**Admin Workflow**: Used by setup, sync, update, update-skills, update-index, update-claude.
Initializes via `fp-tools init admin-op`, spawns the appropriate system/indexer agent.

**Meta Workflow**: Used by do, help.
Executes inline -- no agent spawning. The workflow itself handles routing or display.

---

## 4. The 10 Agents

Each agent is a markdown file in `agents/` with GSD-style YAML frontmatter and an XML body.

### Agent Inventory

| Agent | File | Primary Commands | Can Write? |
|-------|------|-----------------|------------|
| fp-docs-modifier | fp-docs-modifier.md | revise, add, auto-update, auto-revise, deprecate | YES |
| fp-docs-validator | fp-docs-validator.md | audit, verify, sanity-check, test | NO (disallowed) |
| fp-docs-citations | fp-docs-citations.md | citations | YES |
| fp-docs-api-refs | fp-docs-api-refs.md | api-ref | YES |
| fp-docs-locals | fp-docs-locals.md | locals | YES |
| fp-docs-verbosity | fp-docs-verbosity.md | verbosity-audit | NO (disallowed) |
| fp-docs-indexer | fp-docs-indexer.md | update-index, update-claude | YES |
| fp-docs-system | fp-docs-system.md | setup, sync, update, update-skills | YES |
| fp-docs-researcher | fp-docs-researcher.md | (pre-operation research) | YES |
| fp-docs-planner | fp-docs-planner.md | (operation planning) | YES |

**Write-capable agents**: fp-docs-modifier, fp-docs-citations, fp-docs-api-refs, fp-docs-locals, fp-docs-indexer, fp-docs-system, fp-docs-researcher, fp-docs-planner
**Read-only agents**: fp-docs-validator, fp-docs-verbosity (explicitly disallow Write and Edit)

### Permission Model

The permission model operates at two levels:

1. **Plugin default** (settings.json `permissions.allow`): Read, Grep, Glob only
2. **Command level** (`allowed-tools` in command frontmatter): adds Write, Edit, Bash, Task for write-capable commands

---

## 5. Reference System

References replace the previous module and algorithm systems. All shared knowledge lives in `references/` and is loaded via `@-reference` paths in commands and `<files_to_read>` blocks in agent spawn prompts.

### Reference Categories

**Rule References** (domain rules and definitions):
| Reference | Content |
|-----------|---------|
| doc-standards.md | Formatting, naming, structural, depth rules |
| fp-project.md | FP-specific paths, source-map CLI reference |
| pipeline-enforcement.md | 8-stage pipeline definition and trigger matrix |
| citation-rules.md | Citation format, tiers, staleness, provenance |
| api-ref-rules.md | API Reference table format, scope, provenance |
| changelog-rules.md | Changelog entry format and update procedure |
| index-rules.md | PROJECT-INDEX.md update rules and triggers |
| locals-rules.md | $locals contract format, shapes, validation |
| verbosity-rules.md | Anti-brevity rules, banned phrases, manifests |
| validation-rules.md | 10-point checklist, sanity-check algorithm |

**Algorithm References** (step-by-step procedures, loaded on-demand during pipeline stages):
| Reference | When Loaded | Who Loads It |
|-----------|-------------|-------------|
| verbosity-algorithm.md | Pipeline stage 1 | fp-docs-modifier, fp-docs-citations, fp-docs-api-refs, fp-docs-locals |
| citation-algorithm.md | Pipeline stage 2 | fp-docs-modifier, fp-docs-citations |
| api-ref-algorithm.md | Pipeline stage 3 | fp-docs-modifier, fp-docs-api-refs |
| validation-algorithm.md | Pipeline stages 4-5 | fp-docs-modifier, fp-docs-validator |
| codebase-analysis-guide.md | Source file scanning | Any agent scanning PHP/JS source |
| git-sync-rules.md | /fp-docs:sync or SessionStart | fp-docs-system, lib/hooks.cjs |

### How References Are Loaded

Commands load references via `@-reference` in `<execution_context>`:
```
@${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
```

Workflows load references into agent spawn prompts via `<files_to_read>` blocks:
```
<files_to_read>
${CLAUDE_PLUGIN_ROOT}/references/verbosity-algorithm.md
</files_to_read>
```

Every command includes `doc-standards.md` and `fp-project.md` (GSD explicit style). Operation-specific references are loaded as needed.

---

## 6. The 8-Stage Post-Modification Pipeline

Defined in `references/pipeline-enforcement.md` and executed across agents during write operations.

### Pipeline Stages

Stages 1-5 are LLM-executed with CJS gate validation at each boundary. The `pipeline next` command validates the previous stage's output before returning the next action.

| Stage | Name | Algorithm Reference | Rule Reference | Skip Condition |
|-------|------|-------------------|----------------|----------------|
| 1 | Verbosity Enforcement | verbosity-algorithm.md | verbosity-rules.md | `verbosity.enabled` = false |
| 2 | Citation Generation/Update | citation-algorithm.md | citation-rules.md | `citations.enabled` = false |
| 3 | API Reference Sync | api-ref-algorithm.md | api-ref-rules.md | `api_ref.enabled` = false |
| 4 | Sanity-Check | validation-algorithm.md | validation-rules.md | `--no-sanity-check` flag |
| 5 | Verification (10-point) | validation-algorithm.md | validation-rules.md | NEVER skipped |
| 6 | Changelog Update | (inline) | changelog-rules.md | NEVER skipped |
| 7 | Index Update | (inline) | index-rules.md | Only on structural changes |
| 8 | Docs Repo Commit | (inline) | — | NEVER skipped |

### Pipeline Phase Delegation

Under the workflow-based architecture, all write operations proceed through a 5-phase delegation model:

```
Research Phase (fp-docs-researcher) -> Plan Phase (fp-docs-planner) -> Write Phase (specialist, stages 1-3) -> Review Phase (fp-docs-validator, stages 4-5) -> Finalize Phase (workflow, stages 6-8)
```

| Phase | Stages | Owner |
|-------|--------|-------|
| Research Phase | Pre-pipeline | fp-docs-researcher (spawned by workflow) |
| Plan Phase | Pre-pipeline | fp-docs-planner (spawned by workflow) |
| Write Phase | Primary operation + stages 1-3 | Primary specialist agent (e.g., fp-docs-modifier) |
| Review Phase | Stages 4-5 | fp-docs-validator (read-only) |
| Finalize Phase | Stages 6-8 (CJS pipeline callback loop) | Workflow itself |

The workflow first spawns the researcher for source code analysis, then the planner for strategy design. The planner produces a persistent plan file. The workflow then spawns the primary specialist for the Write Phase, the validator for the Review Phase, and handles the Finalize Phase itself via `fp-tools pipeline init/next/run-stage`.

For **read-only commands**, the workflow uses a streamlined path: specialist agent runs in standalone mode without Write/Review/Finalize phase splitting.

### Pipeline Completion Marker

```
Pipeline complete: [verbosity: PASS] [citations: PASS] [sanity: HIGH] [verify: PASS] [changelog: updated] [docs-commit: committed|skipped]
```

Checked by SubagentStop hooks to validate pipeline execution.

---

## 7. CLI Tooling (fp-tools.cjs)

The `fp-tools.cjs` CLI provides initialization, pipeline control, routing, health checks, and all CJS operations:

### Init Commands

```bash
fp-tools init write-op <command> "<arguments>"   # Returns JSON: operation context + pipeline config
fp-tools init read-op <command> "<arguments>"     # Returns JSON: operation context (no pipeline)
fp-tools init admin-op <command> "<arguments>"    # Returns JSON: operation context (admin mode)
```

### Pipeline Commands

```bash
fp-tools pipeline init <operation>                # Initialize pipeline state
fp-tools pipeline next                            # Get next pipeline action (with gate validation)
fp-tools pipeline run-stage <stage-id>            # Execute CJS-deterministic stage (6-8)
fp-tools pipeline record-output <stage-id> <text> # Record LLM stage output for gate validation
```

### Model Resolution

```bash
fp-tools resolve-model <agent-name>               # Returns model from config.json model_profile
```

### Other Commands

```bash
fp-tools route lookup|table|validate              # Routing table operations
fp-tools help [grouped]                           # Command listing
fp-tools health check                             # System health verification
fp-tools git commit                               # Docs repo commit (CJS-mediated)
fp-tools hooks run <event> [matcher]              # Hook handler dispatch
```

---

## 8. Hook System

### Hook Registration (settings.json)

Hooks are registered in `settings.json` and reference standalone JS files in `hooks/`:

| Event | Hook Files | Matchers | Purpose |
|-------|-----------|----------|---------|
| PreToolUse | fp-docs-git-guard.js | Bash | Git-write command blocking |
| SessionStart | fp-docs-session-start.js, fp-docs-check-update.js | — | Context injection, update check |
| SubagentStop | fp-docs-subagent-stop.js | 9 matchers (modifier, validator, citations, api-refs, locals, indexer, system, researcher, planner) | Delegation result enforcement |
| TeammateIdle | fp-docs-teammate-idle.js | — | Teammate pipeline completion check |
| TaskCompleted | fp-docs-task-completed.js | — | Task output verification |

### Hook Implementation

All hook logic is implemented in `lib/hooks.cjs`. The standalone JS files in `hooks/` are thin wrappers that invoke `fp-tools.cjs hooks run <event> [matcher]`.

### Runtime Enforcement Model

Enforcement logic is centralized in `lib/enforcement.cjs`:

| Export | Purpose |
|--------|---------|
| `isGitWriteCommand(command)` | Block raw git-write operations; returns `{ blocked, reason }` |
| `isCjsMediatedGit(command)` | Check for `fp-tools.cjs git` exemption |
| `parseDelegationResult(text)` | Parse delegation result for structural compliance |
| `verifyStageAuthority(agentType, expectedPhase)` | Verify agent is authorized for pipeline phase |
| `validateStageOutput(stageId, context)` | Validate LLM stage output completion markers |
| `STAGE_AUTHORITY_MAP` | Maps agent types to authorized pipeline phases |

**PreToolUse Git-Write Blocking**: Blocks `git commit`, `git push`, `git tag`, etc. in non-workflow contexts. CJS-mediated git (`fp-tools.cjs git ...`) is always allowed.

**Fatal SubagentStop Enforcement**: All SubagentStop handlers produce structured violation diagnostics. Violation format: `ENFORCEMENT VIOLATION: N fatal violation(s)...` prefix. Workflows halt on enforcement violations.

**CJS Pipeline Stage Gating**: The `pipeline next` command validates the most recently completed LLM stage before returning the next action. Failed gates return `action: gate_failed`.

---

## 9. Three-Repo Git Model

The fp-docs system operates across three independent git repositories:

### Repo 1: Codebase
- **Git root**: `wp-content/` (WordPress content directory)
- **Key behavior**: `.gitignore` includes `themes/foreign-policy-2017/docs/`
- **Git commands**: `git -C {codebase-root}`

### Repo 2: Docs
- **Git root**: `themes/foreign-policy-2017/docs/` (nested inside codebase)
- **Remote**: `https://github.com/tomkyser/docs-foreignpolicy-com`
- **Branch strategy**: Branch-mirrored with codebase
- **Git commands**: `git -C {docs-root}`

### Repo 3: Plugin
- **Git root**: Standalone
- **Remote**: `https://github.com/tomkyser/fp-docs`

### Git Serialization

In workflow-coordinated operations, only the Finalize Phase commits to the docs repo. Specialist agents perform their work but do not execute git operations, preventing commit conflicts.

### Path Resolution

- Codebase root: `git rev-parse --show-toplevel`
- Docs root: `{codebase-root}/themes/foreign-policy-2017/docs/`
- Plugin root: `$CLAUDE_PLUGIN_ROOT` (injected by SessionStart hook)

---

## 10. Drift Detection System

Proactively identifies when documentation has become stale due to source code changes.

### Data Flow

```
Git pull/merge/rebase
    │
    ▼
post-merge / post-rewrite hook (from templates/)
    │  Runs: node fp-tools.cjs drift analyze
    │
    ▼
drift-pending.json
    │
    ▼
SessionStart: merge into staleness.json → format nudge
    │
    ├── Session nudge (inside Claude Code)
    ├── Shell prompt notification (via fp-docs-shell.zsh from templates/)
    └── Auto-clear after successful doc operations (SubagentStop hooks)
```

Hook templates live in `templates/post-merge.sh` and `templates/post-rewrite.sh`. Shell prompt integration template at `templates/fp-docs-shell.zsh`.

---

## 11. MCP Integration Layer

The plugin declares external MCP servers in `.mcp.json`:

| Server | Package | Purpose |
|--------|---------|---------|
| playwright | `@playwright/mcp@0.0.68` | Browser automation for visual verification |

Configuration at `framework/config/playwright-mcp-config.json`. MCP tools (`browser_navigate`, `browser_snapshot`, etc.) are available to agents as native tool calls.

---

## 12. End-to-End Flow Example

Complete trace of `/fp-docs:revise "fix the posts helper documentation"`:

### Phase 1: Session Initialization

1. **fp-docs-session-start.js** fires, injecting plugin root path and sync status
2. **fp-docs-check-update.js** fires, checking for plugin updates

### Phase 2: Command Routing

3. User types `/fp-docs:revise "fix the posts helper documentation"`
4. Claude Code finds `commands/fp-docs/revise.md`
5. Command loads workflow `workflows/revise.md` + references via `@-reference`

### Phase 3: Workflow Orchestration

6. Workflow calls `fp-tools init write-op revise "fix the posts helper documentation"` for context
7. Workflow spawns fp-docs-researcher with `<files_to_read>` for source analysis
8. Workflow spawns fp-docs-planner with research results for change planning
9. Workflow spawns fp-docs-modifier for Write Phase:
   - Agent reads source code and existing docs
   - Makes targeted edits
   - Stage 1: Verbosity enforcement (reads verbosity-algorithm.md)
   - Stage 2: Citation update (reads citation-algorithm.md)
   - Stage 3: API Reference sync (reads api-ref-algorithm.md)
10. Workflow spawns fp-docs-validator for Review Phase:
    - Stage 4: Sanity-check (reads validation-algorithm.md)
    - Stage 5: 10-point verification

### Phase 4: Finalize Phase (Workflow)

11. Workflow runs pipeline callback loop: `fp-tools pipeline init` → `pipeline next` → `pipeline run-stage`
12. Stage 6: Changelog update
13. Stage 7: Index update (if structural changes)
14. Stage 8: Docs commit via `fp-tools git commit`

### Phase 5: SubagentStop Validation

15. **fp-docs-subagent-stop.js** fires for each agent, validating delegation results and pipeline markers

---

## 13. Key Design Decisions

1. **Commands are thin routers**: All logic lives in workflows, agents, and references. Commands just declare tools and load context via @-reference.
2. **Workflows are orchestrators**: Workflows own the operation lifecycle -- initialization, agent spawning, pipeline coordination, finalization.
3. **References are the shared knowledge layer**: Rule references define WHAT (formats, banned phrases, classification systems). Algorithm references define HOW (step-by-step procedures). Both are loaded via @-reference.
4. **GSD explicit style**: Every command includes `doc-standards.md` and `fp-project.md` in its `<execution_context>` for consistent context.
5. **Pipeline is mandatory**: Every doc-modifying operation runs the 8-stage pipeline. Verification and changelog stages NEVER skip.
6. **Three independent git repos**: No operations mix codebase and docs git commands.
7. **Read-only agents enforced at tool level**: fp-docs-validator and fp-docs-verbosity disallow Write and Edit.
8. **Zero-tolerance verbosity**: Complete enumeration over summarization. Every source item must appear in documentation.
9. **Evidence-based documentation**: Every claim verified against source code. `[NEEDS INVESTIGATION]` for unknowns.
10. **Hook-based lifecycle management**: SessionStart hooks inject context. SubagentStop hooks validate pipeline completion. All hooks reference standalone JS files in `hooks/`.
11. **CLI-driven orchestration**: Workflows invoke `fp-tools.cjs` for initialization, pipeline control, model resolution, and git operations.
12. **Pipeline phase delegation**: The 8-stage pipeline splits into 3 phases (Write, Review, Finalize) distributed across agents. Pre-pipeline Research and Plan phases provide consistent intelligence.
13. **Git serialization**: Only the Finalize Phase (in the workflow) commits to the docs repo. Specialist agents never commit in delegated mode.
14. **Runtime enforcement**: PreToolUse hooks block git-write commands. SubagentStop hooks produce structured violation diagnostics. Pipeline gating validates LLM outputs. Enforcement logic centralized in `lib/enforcement.cjs`.
15. **Ephemeral CLI tool pattern**: WP-CLI `fp-locals` command lives in `framework/tools/` but operates in the theme. Setup/teardown managed by `lib/locals-cli.cjs`. SubagentStop safety net auto-cleans orphaned artifacts.
16. **Plugin-bundled MCP**: Browser automation via `.mcp.json` declared Playwright server. No CJS glue code needed.
