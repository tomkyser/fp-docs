# GSD Architecture Analysis

> Exhaustive analysis of the get-shit-done (GSD) plugin architecture for consumption by the fp-docs conversion plan writer.
> Source: https://github.com/gsd-build/get-shit-done (v1.30.0)
> Generated: 2025-03-29

---

## Table of Contents

1. [Overall Architecture](#1-overall-architecture)
2. [Directory Layout](#2-directory-layout)
3. [The Command-Workflow-Agent Chain](#3-the-command-workflow-agent-chain)
4. [Commands (commands/gsd/)](#4-commands)
5. [Workflows (get-shit-done/workflows/)](#5-workflows)
6. [Agents (agents/)](#6-agents)
7. [gsd-tools.cjs CLI Layer](#7-gsd-toolscjs-cli-layer)
8. [References (get-shit-done/references/)](#8-references)
9. [Templates (get-shit-done/templates/)](#9-templates)
10. [Hooks and Settings](#10-hooks-and-settings)
11. [Key Patterns and Conventions](#11-key-patterns-and-conventions)
12. [Design Philosophy](#12-design-philosophy)
13. [Complete File Inventory](#13-complete-file-inventory)

---

## 1. Overall Architecture

GSD is a **meta-prompting framework** that uses a 4-layer architecture:

```
USER
  |
  v
COMMAND LAYER         commands/gsd/*.md          -- User-facing entry points (slash commands)
  |
  v
WORKFLOW LAYER        get-shit-done/workflows/*  -- Orchestration logic (thin orchestrators)
  |
  v
AGENT LAYER           agents/*.md                -- Specialized subagents (fresh context per spawn)
  |
  v
CLI TOOLS LAYER       get-shit-done/bin/          -- Node.js CJS utilities (state, config, phase, git)
  |
  v
FILE SYSTEM           .planning/                 -- All state as human-readable Markdown + JSON
```

### Core Design

- **Commands** are thin prompt files with YAML frontmatter. They `@-reference` a workflow file and pass `$ARGUMENTS`.
- **Workflows** are the orchestration brains. They load context via `gsd-tools.cjs init <workflow>`, spawn specialized agents, collect results, and update state.
- **Agents** are subagent definitions with focused roles. Each spawned agent gets a fresh context window (up to 200K tokens).
- **CLI Tools** (`gsd-tools.cjs`) centralize all state management, config parsing, model resolution, git commits, and verification into a single Node.js CLI.
- **File System** (`.planning/`) holds all state as human-readable Markdown and JSON. No database, no server.

### Key Distinction from fp-docs

GSD does NOT use the Claude Code plugin system (`plugin.json`, `.claude-plugin/`, `context: fork`, skill frontmatter). Instead, GSD installs as **custom slash commands** copied into `~/.claude/commands/gsd/`. There is no plugin manifest -- files are deployed by an npm installer (`npx get-shit-done-cc@latest`).

---

## 2. Directory Layout

### Repository Structure

```
get-shit-done/                          # Git root
+-- package.json                         # npm package (v1.30.0, bin: bin/install.js)
+-- bin/
|   +-- install.js                       # npm installer (~3000 lines)
+-- commands/
|   +-- gsd/                             # 57 slash command files (*.md)
+-- get-shit-done/
|   +-- bin/
|   |   +-- gsd-tools.cjs               # CLI entry point (919 lines)
|   |   +-- lib/                         # 17 CJS domain modules
|   |       +-- core.cjs
|   |       +-- state.cjs
|   |       +-- phase.cjs
|   |       +-- roadmap.cjs
|   |       +-- config.cjs
|   |       +-- verify.cjs
|   |       +-- template.cjs
|   |       +-- frontmatter.cjs
|   |       +-- init.cjs
|   |       +-- milestone.cjs
|   |       +-- commands.cjs
|   |       +-- model-profiles.cjs
|   |       +-- security.cjs
|   |       +-- uat.cjs
|   |       +-- profile-pipeline.cjs
|   |       +-- profile-output.cjs
|   |       +-- workstream.cjs
|   +-- workflows/                       # 58 workflow files (*.md)
|   +-- references/                      # 15 shared knowledge files (*.md)
|   +-- templates/                       # 32+ template files (*.md, *.json)
|       +-- codebase/                    # 7 brownfield mapping templates
|       +-- research-project/            # 5 research output templates
+-- agents/                              # 18 agent definitions (*.md)
+-- hooks/                               # 5 JavaScript hook files
+-- docs/                                # Documentation (ARCHITECTURE.md, USER-GUIDE.md, etc.)
+-- tests/                               # Test suite
+-- scripts/                             # Build/test scripts
+-- sdk/                                 # GSD SDK for headless execution
```

### Installed Structure (what gets deployed to ~/.claude/)

```
~/.claude/
+-- commands/gsd/                        # 57 slash commands
+-- get-shit-done/
|   +-- bin/gsd-tools.cjs               # CLI utility
|   +-- bin/lib/*.cjs                    # 17 domain modules
|   +-- workflows/*.md                   # 58 workflows
|   +-- references/*.md                  # 15 reference docs
|   +-- templates/                       # All templates
+-- agents/*.md                          # 18 agent definitions
+-- hooks/
|   +-- gsd-statusline.js
|   +-- gsd-context-monitor.js
|   +-- gsd-check-update.js
|   +-- gsd-prompt-guard.js
|   +-- gsd-workflow-guard.js
+-- settings.json                        # Hook registrations
+-- VERSION                              # Installed version number
```

### Project Files (`.planning/` -- created per project)

```
.planning/
+-- PROJECT.md              # Project vision, constraints, decisions
+-- REQUIREMENTS.md         # Scoped requirements (v1/v2/out-of-scope)
+-- ROADMAP.md              # Phase breakdown with status tracking
+-- STATE.md                # Living memory: position, decisions, blockers, metrics
+-- config.json             # Workflow configuration (mode, granularity, model_profile, etc.)
+-- MILESTONES.md           # Completed milestone archive
+-- research/               # Domain research from /gsd:new-project
|   +-- SUMMARY.md, STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md
+-- codebase/               # Brownfield mapping (from /gsd:map-codebase)
|   +-- STACK.md, ARCHITECTURE.md, CONVENTIONS.md, CONCERNS.md, STRUCTURE.md, TESTING.md, INTEGRATIONS.md
+-- phases/
|   +-- XX-phase-name/
|       +-- XX-CONTEXT.md
|       +-- XX-RESEARCH.md
|       +-- XX-YY-PLAN.md
|       +-- XX-YY-SUMMARY.md
|       +-- XX-VERIFICATION.md
|       +-- XX-VALIDATION.md
|       +-- XX-UI-SPEC.md
|       +-- XX-UI-REVIEW.md
|       +-- XX-UAT.md
+-- quick/                  # Quick task tracking
+-- todos/pending/, todos/done/
+-- threads/                # Persistent context threads
+-- seeds/                  # Forward-looking ideas
+-- debug/                  # Active debug sessions
+-- reports/                # Session and milestone reports
+-- continue-here.md        # Context handoff (from pause-work)
```

---

## 3. The Command-Workflow-Agent Chain

This is the core architectural pattern. Every user interaction follows this chain:

### Step 1: User invokes a command

```
/gsd:plan-phase 3
```

### Step 2: Command file loads (commands/gsd/plan-phase.md)

The command file has:
- **YAML frontmatter** with `name`, `description`, `argument-hint`, `allowed-tools`
- **XML-structured body** with `<objective>`, `<execution_context>`, `<context>`, `<process>` sections
- The `<execution_context>` section uses `@-references` to load workflow and reference files into context

```yaml
---
name: gsd:plan-phase
description: Create detailed phase plan (PLAN.md) with verification loop
argument-hint: "[phase] [--auto] [--research] [--skip-research] ..."
agent: gsd-planner
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
  - WebFetch
  - mcp__context7__*
---
```

```xml
<execution_context>
@~/.claude/get-shit-done/workflows/plan-phase.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<process>
Execute the plan-phase workflow from @~/.claude/get-shit-done/workflows/plan-phase.md end-to-end.
Preserve all workflow gates (validation, research, planning, verification loop, routing).
</process>
```

### Step 3: Workflow executes (get-shit-done/workflows/plan-phase.md)

The workflow is the orchestration brain. It:

1. **Bootstraps context** via `gsd-tools.cjs init plan-phase <phase>`
2. **Resolves model** via `gsd-tools.cjs resolve-model <agent-type>`
3. **Spawns agents** via `Task()` calls with agent prompts
4. **Collects results** and routes to next step
5. **Updates state** via `gsd-tools.cjs state update/patch/advance-plan`

```bash
# Typical workflow pattern
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init plan-phase "$PHASE")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi

PLANNER_MODEL=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" resolve-model gsd-planner --raw)

# Spawn agent
Task(
  prompt=filled_prompt,
  subagent_type="gsd-planner",
  model="$PLANNER_MODEL",
  description="Plan Phase $PHASE"
)
```

### Step 4: Agent executes (agents/gsd-planner.md)

The agent:
1. Gets a fresh context window (up to 200K tokens)
2. Reads project files specified in `<files_to_read>` blocks
3. Follows its system prompt instructions
4. Produces artifacts (PLAN.md files, SUMMARY.md, etc.)
5. Returns result to workflow orchestrator

### Step 5: Workflow collects and routes

The workflow:
1. Reads the agent's output
2. Updates state files via `gsd-tools.cjs`
3. Optionally spawns more agents (e.g., plan-checker for verification loop)
4. Presents results to user
5. Offers next steps

### The Pattern in One Sentence

**Commands are thin routing files that `@-reference` workflow files; workflows are orchestrators that spawn specialized agents with fresh contexts; agents do the actual work and produce artifacts; gsd-tools.cjs manages all state.**

---

## 4. Commands

### Location and Count

`commands/gsd/` -- 57 command files

### Command Frontmatter Schema

Every command file uses YAML frontmatter:

```yaml
---
name: gsd:command-name              # Slash command name
description: What it does            # One-line description
argument-hint: "[args]"             # Hint for argument syntax
allowed-tools:                       # Tools available to the command
  - Read
  - Write
  - Bash
  - Task                            # Required for spawning subagents
  - AskUserQuestion                 # Required for user interaction
  - mcp__context7__*                # MCP tool access
agent: gsd-planner                  # Optional: default agent type (rare)
argument-instructions: |            # Optional: parsing instructions for $ARGUMENTS
  Parse the argument as a phase number...
---
```

### Command Body Structure (XML)

Commands use XML-style sections in their body:

```xml
<context>
  Flags, special arguments, state refs
</context>

<objective>
  What this command does and what it produces.
  Lists created files.
  States what to do after.
</objective>

<execution_context>
  @~/.claude/get-shit-done/workflows/workflow-name.md
  @~/.claude/get-shit-done/references/reference-name.md
  @~/.claude/get-shit-done/templates/template-name.md
</execution_context>

<context>
  Phase: $ARGUMENTS
  Additional state refs
</context>

<process>
  Execute the workflow from @~/.claude/get-shit-done/workflows/X.md end-to-end.
  Preserve all workflow gates.
</process>

<success_criteria>
  - Bulleted list of what must be true when done
</success_criteria>
```

### Key Observation: Commands are Routing Files

Commands never contain implementation logic. They:
1. Declare what tools are available
2. `@-reference` a workflow file (the actual orchestration logic)
3. Pass `$ARGUMENTS` through
4. State the objective and success criteria

The command body says "Execute the workflow from @...workflow-name.md end-to-end." The workflow file contains the actual step-by-step process.

### Some Commands Have Inline Process Steps

A few commands (like `debug`, `research-phase`) embed process steps directly instead of purely delegating to a workflow. These commands act as mini-orchestrators themselves, with numbered steps that include bash invocations and Task() spawn calls.

### Full Command Catalog (57 commands)

| Command | Description | Key Tools |
|---------|-------------|-----------|
| `new-project` | Full project init: questions, research, requirements, roadmap | Task, AskUserQuestion |
| `discuss-phase` | Capture implementation decisions before planning | Task, AskUserQuestion, MCP |
| `plan-phase` | Research + plan + verify for a phase | Task, WebFetch, MCP |
| `execute-phase` | Execute all plans with wave-based parallelization | Task, TodoWrite |
| `verify-work` | Manual UAT with auto-diagnosis | Task |
| `ship` | Create PR from verified work | Bash, AskUserQuestion |
| `quick` | Ad-hoc task with GSD guarantees | Task, AskUserQuestion |
| `fast` | Inline trivial task (no subagents) | Write, Edit, Bash |
| `next` | Auto-detect next logical step | SlashCommand |
| `progress` | Show status and next steps | SlashCommand |
| `help` | Show command reference | (none) |
| `do` | Route freeform text to right command | AskUserQuestion |
| `debug` | Systematic debugging | Task, AskUserQuestion |
| `settings` | Configure workflow toggles | AskUserQuestion |
| `set-profile` | Switch model profile | Bash |
| `add-phase` | Append phase to roadmap | Bash |
| `insert-phase` | Insert urgent work between phases | Bash |
| `remove-phase` | Remove future phase and renumber | Bash |
| `add-todo` | Capture idea for later | Write |
| `check-todos` | List pending todos | Read, Bash |
| `pause-work` | Save context handoff | Write |
| `resume-work` | Restore context from last session | Read |
| `review` | Cross-AI peer review | Task |
| `stats` | Display project statistics | Bash |
| `note` | Zero-friction idea capture | Write |
| `health` | Validate .planning/ integrity | Bash |
| `autonomous` | Run all remaining phases autonomously | Task |
| `complete-milestone` | Archive milestone and tag release | Bash |
| `new-milestone` | Start next version cycle | Task, AskUserQuestion |
| `audit-milestone` | Verify milestone definition of done | Task |
| `map-codebase` | Analyze codebase with parallel mappers | Task |
| `add-backlog` | Add idea to backlog parking lot | Write |
| `review-backlog` | Promote/keep/remove backlog items | AskUserQuestion |
| `thread` | Persistent context threads | Write |
| `plant-seed` | Forward-looking idea with trigger conditions | Write |
| `workstreams` | Manage parallel workstreams | Bash |
| `manager` | Interactive command center | AskUserQuestion, Task |
| `forensics` | Post-mortem investigation | Bash |
| `session-report` | Generate session summary | Write |
| `update` | Update GSD with changelog | Bash |
| `milestone-summary` | Generate milestone summary for onboarding | Task |
| `add-tests` | Generate tests for completed phase | Task |
| `audit-uat` | Cross-phase verification audit | Read, Glob, Grep |
| `cleanup` | Archive completed milestone directories | Bash |
| `join-discord` | Display Discord invite | (none) |
| `list-phase-assumptions` | Preview Claude's approach before planning | Read, Bash |
| `list-workspaces` | List active workspaces | Bash |
| `map-codebase` | Parallel codebase analysis | Task |
| `new-workspace` | Create isolated workspace | Bash, AskUserQuestion |
| `pr-branch` | Clean PR branch filtering .planning/ commits | Bash |
| `profile-user` | Generate developer behavioral profile | Task, AskUserQuestion |
| `reapply-patches` | Restore local mods after update | Edit, AskUserQuestion |
| `remove-workspace` | Remove workspace and clean up | Bash |
| `research-phase` | Standalone research for a phase | Task |
| `validate-phase` | Retroactive Nyquist validation audit | Task |
| `ui-phase` | Generate UI design contract | Task, WebFetch, MCP |
| `ui-review` | 6-pillar visual audit | Task |

---

## 5. Workflows

### Location and Count

`get-shit-done/workflows/` -- 58 workflow files

### Workflow File Structure

Workflows are Markdown files that use XML-style sections. They do NOT have YAML frontmatter. Key sections:

```xml
<purpose>
  What this workflow does and why.
</purpose>

<required_reading>
  Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<available_agent_types>
  Valid GSD subagent types (use exact names):
  - gsd-planner -- Creates executable phase plans
  - gsd-plan-checker -- Verifies plans achieve phase goals
  - gsd-phase-researcher -- Researches technical approaches
</available_agent_types>

<process>
  <step name="initialize" priority="first">
    ## 1. Initialize
    ```bash
    INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init workflow-name "$ARGS")
    if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
    ```
    Parse JSON for: field1, field2, field3...
  </step>

  <step name="validate">
    ## 2. Validate
    Check conditions, error if invalid...
  </step>

  <step name="spawn-agent">
    ## 3. Spawn Agent
    ```
    Task(
      prompt=filled_prompt,
      subagent_type="gsd-planner",
      model="${planner_model}",
      description="Plan Phase ${PHASE}"
    )
    ```
  </step>

  <step name="collect-results">
    ## 4. Collect Results
    Handle agent output, update state...
  </step>
</process>

<success_criteria>
  - Bulleted checklist
</success_criteria>
```

### Workflow Initialization Pattern

Every workflow starts by loading context via `gsd-tools.cjs init`:

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init <workflow-type> [args])
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

The `init` command returns a JSON payload containing:
- Project config (mode, granularity, model profile)
- Current state (position, decisions, blockers)
- Phase details (number, name, directory, plans)
- Feature flags (research enabled, plan_check enabled, etc.)
- File paths for relevant artifacts

For large payloads, the init command writes to a temp file and returns `@file:/path` instead of stdout JSON.

### Agent Spawn Pattern

Workflows spawn agents using the `Task()` primitive:

```
Task(
  prompt=<filled_prompt_string>,
  subagent_type="<agent-name>",
  model="<resolved-model>",
  description="<human-readable description>"
)
```

The prompt string typically includes:
- `<objective>` -- what the agent should accomplish
- `<files_to_read>` -- files the agent must Read before starting
- `<additional_context>` -- relevant state, decisions, constraints
- `<output>` -- where to write results and what format

### Model Resolution

Before spawning, workflows resolve the model tier:

```bash
MODEL=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" resolve-model <agent-type> --raw)
```

This consults `.planning/config.json` model_profile (quality/balanced/budget/inherit) and returns the appropriate model name (opus/sonnet/haiku/inherit).

### State Update Pattern

After agent completion, workflows update state:

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state update current_phase "$PHASE"
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state patch --field1 val1 --field2 val2
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state advance-plan
```

### Full Workflow Catalog (58 workflows)

| Workflow | Purpose | Spawns Agents? |
|----------|---------|----------------|
| `new-project.md` | Full project initialization | Yes: 4x project-researcher, research-synthesizer, roadmapper |
| `discuss-phase.md` | Interactive discussion for implementation decisions | Optional: advisor-researcher |
| `discuss-phase-assumptions.md` | Codebase-driven assumptions mode | Yes: assumptions-analyzer |
| `plan-phase.md` | Research + plan + verify | Yes: phase-researcher, planner, plan-checker |
| `execute-phase.md` | Wave-based parallel execution | Yes: multiple executors, verifier |
| `execute-plan.md` | Single plan execution | Yes: executor |
| `verify-work.md` | Conversational UAT | Yes: debugger (for failures) |
| `verify-phase.md` | Phase verification | Yes: verifier |
| `quick.md` | Ad-hoc task execution | Yes: planner, executor |
| `fast.md` | Inline trivial task | No |
| `next.md` | Auto-detect next step | No (uses SlashCommand) |
| `progress.md` | Status display and routing | No |
| `help.md` | Command reference display | No |
| `ship.md` | PR creation and review | No |
| `do.md` | Freeform text routing | No |
| `diagnose-issues.md` | Issue diagnosis | Yes: debugger |
| `settings.md` | Configuration management | No |
| `discovery-phase.md` | Phase discovery | No |
| `autonomous.md` | Autonomous multi-phase execution | Yes: chains discuss/plan/execute |
| `complete-milestone.md` | Milestone archival | No |
| `new-milestone.md` | New version cycle | Yes: researchers, roadmapper |
| `audit-milestone.md` | Milestone audit | Yes: integration-checker |
| `map-codebase.md` | Parallel codebase analysis | Yes: 4x codebase-mapper |
| `add-phase.md` | Append phase to roadmap | No |
| `insert-phase.md` | Insert decimal phase | No |
| `remove-phase.md` | Remove and renumber phase | No |
| `add-todo.md` | Capture idea | No |
| `check-todos.md` | List todos | No |
| `pause-work.md` | Save handoff | No |
| `resume-project.md` | Restore context | No |
| `review.md` | Cross-AI peer review | No |
| `stats.md` | Statistics display | No |
| `note.md` | Note capture | No |
| `health.md` | .planning/ validation | No |
| `plant-seed.md` | Seed capture | No |
| `forensics.md` | Post-mortem investigation | No |
| `session-report.md` | Session summary | No |
| `update.md` | GSD update | No |
| `milestone-summary.md` | Milestone summary for onboarding | No |
| `add-tests.md` | Test generation | Yes: executor |
| `audit-uat.md` | Cross-phase UAT audit | No |
| `cleanup.md` | Archive completed directories | No |
| `list-phase-assumptions.md` | Show Claude's assumptions | No |
| `manager.md` | Interactive command center | Yes: dispatches multiple |
| `plan-milestone-gaps.md` | Create phases for audit gaps | No |
| `validate-phase.md` | Nyquist validation audit | Yes: nyquist-auditor |
| `pr-branch.md` | Clean PR branch | No |
| `ui-phase.md` | UI design contract | Yes: ui-researcher, ui-checker |
| `ui-review.md` | Visual audit | Yes: ui-auditor |
| `profile-user.md` | Developer profile | Yes: user-profiler |
| `transition.md` | State transitions | No |
| `node-repair.md` | Node.js repair | No |
| `list-workspaces.md` | Workspace listing | No |
| `new-workspace.md` | Workspace creation | No |
| `remove-workspace.md` | Workspace removal | No |
| `add-backlog.md` | Backlog item | No |
| `review-backlog.md` | Backlog review | No |
| `thread.md` | Thread management | No |

---

## 6. Agents

### Location and Count

`agents/` -- 18 agent definition files

### Agent Frontmatter Schema

```yaml
---
name: gsd-executor
description: Executes GSD plans with atomic commits, deviation handling, checkpoint protocols, and state management.
tools: Read, Write, Edit, Bash, Grep, Glob
permissionMode: acceptEdits
color: yellow
---
```

Fields:
- `name` -- Agent identifier (used in `subagent_type` when spawning)
- `description` -- Role and purpose description
- `tools` -- Comma-separated list of allowed tools
- `color` -- Terminal output color for visual distinction
- `permissionMode` -- Optional, e.g., `acceptEdits`
- No `model` field -- model is resolved at spawn time by the workflow via `gsd-tools.cjs resolve-model`
- No `skills` field -- agents do not preload modules/skills
- No `maxTurns` field

### Agent Body Structure

After frontmatter, agents use XML-style sections:

```xml
<role>
  Identity, purpose, spawning context.

  CRITICAL: Mandatory Initial Read
  If the prompt contains a <files_to_read> block, MUST Read every file listed.
</role>

<project_context>
  How to discover project context (CLAUDE.md, skills, conventions).
</project_context>

<task_execution_protocol>
  Step-by-step execution rules (for executors).
</task_execution_protocol>

<checkpoint_protocol>
  How to handle different checkpoint types.
</checkpoint_protocol>

<deviation_protocol>
  What to do when implementation differs from plan.
</deviation_protocol>

<git_protocol>
  How to commit (atomic commits per task).
</git_protocol>

<summary_protocol>
  How to write SUMMARY.md after execution.
</summary_protocol>

<quality_gate>
  Final verification checklist before declaring complete.
</quality_gate>
```

### Agent Categories and Details

| Category | Agent | Model (balanced) | Parallelism | Key Outputs |
|----------|-------|-------------------|-------------|-------------|
| **Researcher** | `gsd-project-researcher` | Sonnet | 4 parallel | STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md |
| **Researcher** | `gsd-phase-researcher` | Sonnet | 4 parallel | RESEARCH.md |
| **Researcher** | `gsd-ui-researcher` | Sonnet | Single | UI-SPEC.md |
| **Analyzer** | `gsd-assumptions-analyzer` | Sonnet | Single | Structured assumptions |
| **Analyzer** | `gsd-advisor-researcher` | Sonnet | Multiple (one per gray area) | Comparison tables |
| **Synthesizer** | `gsd-research-synthesizer` | Sonnet | Single (sequential after researchers) | SUMMARY.md |
| **Planner** | `gsd-planner` | **Opus** | Single | PLAN.md files |
| **Roadmapper** | `gsd-roadmapper` | Sonnet | Single | ROADMAP.md |
| **Executor** | `gsd-executor` | Sonnet | Multiple (parallel within waves) | Code, commits, SUMMARY.md |
| **Checker** | `gsd-plan-checker` | Sonnet | Single (iterative, max 3x) | PASS/FAIL verdict |
| **Checker** | `gsd-integration-checker` | Sonnet | Single | Integration report |
| **Checker** | `gsd-ui-checker` | Sonnet | Single (iterative, max 2x) | BLOCK/FLAG/PASS verdict |
| **Verifier** | `gsd-verifier` | Sonnet | Single | VERIFICATION.md |
| **Auditor** | `gsd-nyquist-auditor` | Sonnet | Single | Test files, VALIDATION.md |
| **Auditor** | `gsd-ui-auditor` | Sonnet | Single | UI-REVIEW.md |
| **Mapper** | `gsd-codebase-mapper` | Haiku | 4 parallel | 7 codebase docs |
| **Debugger** | `gsd-debugger` | Sonnet | Single (interactive) | Debug session files |
| **Profiler** | `gsd-user-profiler` | Sonnet | Single | USER-PROFILE.md |

### Tool Permissions (Principle of Least Privilege)

- **Checkers** are read-only (no Write/Edit) -- they evaluate, never modify
- **Researchers** have web access (WebSearch, WebFetch, MCP) -- they need current information
- **Executors** have Edit -- they modify code but no web access
- **Mappers** have Write but not Edit -- they write analysis documents but don't modify code
- **Profiler** has only Read -- purely analytical

### How Agents Receive Work

Agents receive a structured prompt from the workflow orchestrator. The prompt includes:

```xml
<objective>
  What to accomplish
</objective>

<files_to_read>
  - .planning/PROJECT.md (Project context)
  - .planning/phases/03-auth/03-01-PLAN.md (Plan to execute)
  - .planning/STATE.md (Decisions and blockers)
</files_to_read>

<additional_context>
  Phase description, user decisions, constraints
</additional_context>

<output>
  Write to: .planning/phases/03-auth/03-01-SUMMARY.md
</output>
```

The agent's first action is always to Read every file in `<files_to_read>`.

---

## 7. gsd-tools.cjs CLI Layer

### Overview

`gsd-tools.cjs` is the CLI backbone. Every workflow and agent calls it for state management, config, phase operations, model resolution, git commits, and more.

**Invocation pattern:**
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" <command> [args] [--raw] [--pick <field>]
```

### Architecture

- **Entry point**: `gsd-tools.cjs` (919 lines) -- arg parsing + CLI router
- **17 domain modules** in `lib/`:
  - `core.cjs` -- Error handling, output formatting, shared utilities, worktree resolution
  - `state.cjs` -- STATE.md parsing, updating, progression, metrics, lockfile-based mutual exclusion
  - `phase.cjs` -- Phase directory operations, decimal numbering, plan indexing
  - `roadmap.cjs` -- ROADMAP.md parsing, phase extraction, plan progress
  - `config.cjs` -- config.json read/write, section initialization
  - `verify.cjs` -- Plan structure, phase completeness, reference, commit validation
  - `template.cjs` -- Template selection and filling with variable substitution
  - `frontmatter.cjs` -- YAML frontmatter CRUD operations
  - `init.cjs` -- Compound context loading for each workflow type
  - `milestone.cjs` -- Milestone archival, requirements marking
  - `commands.cjs` -- Misc commands (slug, timestamp, todos, scaffolding, stats)
  - `model-profiles.cjs` -- Model profile resolution table
  - `security.cjs` -- Path traversal prevention, prompt injection detection, safe JSON parsing
  - `uat.cjs` -- UAT file parsing, verification debt tracking
  - `profile-pipeline.cjs` -- Session scanning, message extraction
  - `profile-output.cjs` -- Profile generation, dev preferences, CLAUDE.md sections
  - `workstream.cjs` -- Workstream create/list/status/complete/switch

### Complete Command List

**State Commands:**
- `state load` -- Load project config + state
- `state json` -- Output STATE.md frontmatter as JSON
- `state update <field> <value>` -- Update a STATE.md field
- `state get [section]` -- Get STATE.md content or section
- `state patch --field val ...` -- Batch update STATE.md fields
- `state begin-phase --phase N --name S --plans C` -- Update STATE.md for phase start
- `state advance-plan` -- Increment plan counter
- `state record-metric --phase N --plan M --duration Xmin` -- Record execution metrics
- `state update-progress` -- Recalculate progress bar
- `state add-decision --summary "..."` -- Add decision
- `state add-blocker --text "..."` -- Add blocker
- `state resolve-blocker --text "..."` -- Remove blocker
- `state record-session --stopped-at "..."` -- Update session continuity
- `state signal-waiting --type T --question Q` -- Write WAITING.json signal
- `state signal-resume` -- Remove WAITING.json

**Model Resolution:**
- `resolve-model <agent-type>` -- Get model for agent based on profile

**Phase Operations:**
- `find-phase <phase>` -- Find phase directory by number
- `phase next-decimal <phase>` -- Calculate next decimal number
- `phase add <description>` -- Append new phase
- `phase insert <after> <description>` -- Insert decimal phase
- `phase remove <phase>` -- Remove phase, renumber
- `phase complete <phase>` -- Mark phase done

**Roadmap Operations:**
- `roadmap get-phase <phase>` -- Extract phase section
- `roadmap analyze` -- Full roadmap parse with disk status
- `roadmap update-plan-progress <N>` -- Update progress from disk

**Git Operations:**
- `commit <message> [--files f1 f2] [--no-verify]` -- Commit planning docs
- `commit-to-subrepo <msg> --files f1 f2` -- Route commits to sub-repos

**Verification:**
- `verify-summary <path>` -- Verify SUMMARY.md
- `verify plan-structure <file>` -- Check PLAN.md structure
- `verify phase-completeness <phase>` -- Check all plans have summaries
- `verify references <file>` -- Check @-refs + paths resolve
- `verify commits <h1> [h2]` -- Batch verify commit hashes
- `verify artifacts <plan-file>` -- Check must_haves.artifacts
- `verify key-links <plan-file>` -- Check must_haves.key_links
- `validate consistency` -- Check phase numbering, disk/roadmap sync
- `validate health [--repair]` -- Check .planning/ integrity
- `validate agents` -- Check agent installation status

**Template Operations:**
- `template fill summary --phase N [--plan M]` -- Create pre-filled SUMMARY.md
- `template fill plan --phase N [--plan M]` -- Create pre-filled PLAN.md
- `template fill verification --phase N` -- Create pre-filled VERIFICATION.md

**Frontmatter CRUD:**
- `frontmatter get <file> [--field k]` -- Extract as JSON
- `frontmatter set <file> --field k --value v` -- Update field
- `frontmatter merge <file> --data '{json}'` -- Merge JSON into frontmatter
- `frontmatter validate <file> --schema plan|summary|verification`

**Compound Init Commands (workflow bootstrapping):**
- `init execute-phase <phase>` -- All context for execute-phase
- `init plan-phase <phase>` -- All context for plan-phase
- `init new-project` -- All context for new-project
- `init new-milestone` -- All context for new-milestone
- `init quick <description>` -- All context for quick
- `init resume` -- All context for resume-project
- `init verify-work <phase>` -- All context for verify-work
- `init phase-op <phase>` -- Generic phase operation context
- `init todos [area]` -- All context for todo workflows
- `init milestone-op` -- All context for milestone operations
- `init map-codebase` -- All context for map-codebase
- `init progress` -- All context for progress
- `init manager` -- All context for manager

**Other:**
- `generate-slug <text>` -- URL-safe slug
- `current-timestamp [format]` -- Timestamp
- `list-todos [area]` -- Count and enumerate todos
- `scaffold context|uat|verification|phase-dir --phase N` -- Scaffolding
- `progress [json|table|bar]` -- Progress rendering
- `audit-uat` -- UAT audit
- `stats [json]` -- Statistics
- `websearch <query>` -- Web search via Brave API
- `workstream create|list|status|complete|set|get|progress` -- Workstream management

### The `--pick` Flag

A key utility: `--pick <field>` extracts a single field from JSON output, replacing the need for `jq`:

```bash
PHASE_DIR=$(node gsd-tools.cjs find-phase 3 --pick phase_dir)
```

Supports dot-notation (`--pick workflow.research`) and bracket notation (`--pick directories[-1]`).

### The `@file:` Protocol

For large payloads that would exceed shell argument limits, gsd-tools.cjs writes to a temp file and returns `@file:/path`. Callers check for this:

```bash
INIT=$(node gsd-tools.cjs init execute-phase 3)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

---

## 8. References

### Location and Count

`get-shit-done/references/` -- 15 reference files

### What References Are

References are shared knowledge documents that workflows and agents `@-reference` to load into context. They contain rules, patterns, and definitions that multiple components need.

### How References Are Consumed

Referenced via `@-reference` syntax in command files:

```xml
<execution_context>
@~/.claude/get-shit-done/references/questioning.md
@~/.claude/get-shit-done/references/ui-brand.md
@~/.claude/get-shit-done/references/model-profiles.md
</execution_context>
```

When Claude processes the command, it reads the referenced files and includes them in context.

### Full Reference Catalog

| Reference | Purpose | Used By |
|-----------|---------|---------|
| `checkpoints.md` | Checkpoint type definitions (human-verify, decision, human-action, auto) and interaction patterns | Executors, workflows |
| `continuation-format.md` | Format for agent continuation prompts (when agents need to be respawned) | All agent-spawning workflows |
| `decimal-phase-calculation.md` | Rules for calculating decimal phase numbers (3.1, 3.2, etc.) | Phase management workflows |
| `git-integration.md` | Git commit, branching, and history patterns | Execute-phase, quick, ship workflows |
| `git-planning-commit.md` | Rules for committing .planning/ files | All workflows that produce artifacts |
| `model-profile-resolution.md` | How to resolve model IDs for different runtimes | All agent-spawning workflows |
| `model-profiles.md` | Per-agent model tier assignments (quality/balanced/budget/inherit table) | All agent-spawning workflows |
| `phase-argument-parsing.md` | How to parse phase number arguments (integer, decimal, letter suffix) | All phase-related commands |
| `planning-config.md` | Full config.json schema and behavior | Settings, init workflows |
| `questioning.md` | Dream extraction philosophy for project initialization | New-project workflow |
| `tdd.md` | Test-driven development integration patterns | Plan-phase, execute-phase |
| `ui-brand.md` | Visual output formatting patterns (borders, status icons, progress bars) | Most user-facing workflows |
| `user-profiling.md` | Developer profiling methodology | Profile-user workflow |
| `verification-patterns.md` | How to verify different artifact types | Verifier, plan-checker |
| `workstream-flag.md` | How to pass workstream context to subagents | All workstream-aware workflows |

---

## 9. Templates

### Location and Count

`get-shit-done/templates/` -- 32+ template files across 3 directories

### What Templates Are

Templates are Markdown (and JSON) files that define the structure for planning artifacts. Used by `gsd-tools.cjs template fill` and by workflows/agents when creating files.

### How Templates Work

Templates contain placeholder variables that get filled by `gsd-tools.cjs template fill`:

```bash
node gsd-tools.cjs template fill summary --phase 3 --plan 1 --name "User Auth"
```

Template variables use `{variable_name}` syntax. The `template fill` command substitutes them with provided values.

### Full Template Catalog

**Core Project Templates:**
- `project.md` -- PROJECT.md structure (vision, constraints, decisions)
- `requirements.md` -- REQUIREMENTS.md structure (v1/v2/out-of-scope with IDs)
- `roadmap.md` -- ROADMAP.md structure (phases with status tracking)
- `state.md` -- STATE.md structure (position, decisions, blockers, metrics)
- `config.json` -- Default config.json with all settings

**Phase Artifact Templates:**
- `context.md` -- CONTEXT.md for user implementation decisions
- `phase-prompt.md` -- Phase execution prompt template
- `research.md` -- RESEARCH.md for ecosystem investigation results
- `discovery.md` -- Discovery phase template

**Summary Templates (granularity-aware):**
- `summary.md` -- Standard summary template
- `summary-minimal.md` -- Minimal summary (for coarse granularity)
- `summary-standard.md` -- Standard summary (default)
- `summary-complex.md` -- Detailed summary (for fine granularity)

**Verification Templates:**
- `VALIDATION.md` -- Nyquist test coverage mapping
- `UAT.md` -- User acceptance testing template
- `verification-report.md` -- Phase verification report

**UI Templates:**
- `UI-SPEC.md` -- UI design contract template

**Debug Templates:**
- `DEBUG.md` -- Debug session tracking template
- `debug-subagent-prompt.md` -- Debug agent prompt template

**Agent Prompt Templates:**
- `planner-subagent-prompt.md` -- Planner agent prompt template

**Session Templates:**
- `continue-here.md` -- Context handoff template

**Project Configuration Templates:**
- `claude-md.md` -- Template for generating CLAUDE.md
- `copilot-instructions.md` -- Template for Copilot instructions
- `dev-preferences.md` -- Developer preferences template
- `user-profile.md` -- User profile template
- `user-setup.md` -- User setup template

**Milestone Templates:**
- `milestone.md` -- Milestone tracking template
- `milestone-archive.md` -- Milestone archive template
- `retrospective.md` -- Milestone retrospective template
- `discussion-log.md` -- Discussion audit trail template

**Brownfield Mapping Templates (codebase/):**
- `codebase/stack.md` -- Technology stack analysis
- `codebase/architecture.md` -- Architecture analysis
- `codebase/conventions.md` -- Coding conventions analysis
- `codebase/concerns.md` -- Issues and concerns analysis
- `codebase/structure.md` -- Project structure analysis
- `codebase/testing.md` -- Testing infrastructure analysis
- `codebase/integrations.md` -- External integrations analysis

**Research Output Templates (research-project/):**
- `research-project/SUMMARY.md` -- Research synthesis
- `research-project/STACK.md` -- Stack research
- `research-project/FEATURES.md` -- Feature research
- `research-project/ARCHITECTURE.md` -- Architecture research
- `research-project/PITFALLS.md` -- Pitfalls research

---

## 10. Hooks and Settings

### Hook Architecture

GSD uses 5 JavaScript hooks that integrate with the Claude Code runtime:

```
Runtime Engine (Claude Code)
  |
  +-- statusLine event --> gsd-statusline.js
  |     Reads: stdin (session JSON)
  |     Writes: stdout (formatted status), /tmp/claude-ctx-{session}.json (bridge)
  |
  +-- PostToolUse event --> gsd-context-monitor.js
  |     Reads: stdin (tool event JSON), /tmp/claude-ctx-{session}.json (bridge)
  |     Writes: stdout (hookSpecificOutput with additionalContext warning)
  |
  +-- SessionStart event --> gsd-check-update.js
  |     Reads: VERSION file
  |     Writes: ~/.claude/cache/gsd-update-check.json (background process)
  |
  +-- PreToolUse event --> gsd-prompt-guard.js
  |     Reads: stdin (tool event JSON)
  |     Writes: stdout (advisory warning if injection detected)
  |
  +-- PreToolUse event --> gsd-workflow-guard.js
        Reads: stdin (tool event JSON), .planning/config.json
        Writes: stdout (advisory warning if edit outside GSD workflow)
```

### Hook Details

**gsd-statusline.js** (statusLine event)
- Displays: model | current task | directory | context usage bar
- Writes bridge file `/tmp/claude-ctx-{session}.json` for context-monitor
- Color-coded progress bar: green (<50%), yellow (<65%), orange (<80%), red with skull (>80%)
- Checks for GSD updates available

**gsd-context-monitor.js** (PostToolUse event)
- Reads context metrics from statusline bridge file
- Injects agent-facing warnings at thresholds:
  - WARNING (remaining <= 35%): "Avoid starting new complex work"
  - CRITICAL (remaining <= 25%): "Context nearly exhausted, inform user"
- Debounce: 5 tool uses between warnings
- Severity escalation (WARNING->CRITICAL) bypasses debounce
- Advisory only -- never issues imperative commands

**gsd-check-update.js** (SessionStart event)
- Background process checks npm for new GSD version
- Detects stale hooks (hook version headers don't match installed VERSION)
- Writes cache file for statusline to display update notification

**gsd-prompt-guard.js** (PreToolUse event)
- Scans Write/Edit calls targeting `.planning/` files
- Detects prompt injection patterns (role override, instruction bypass, system tag injection)
- Detects suspicious invisible Unicode characters
- Advisory only -- logs detection, does not block

**gsd-workflow-guard.js** (PreToolUse event)
- Detects file edits outside GSD workflow context
- Suggests using `/gsd:fast` or `/gsd:quick` for state-tracked changes
- Opt-in via `hooks.workflow_guard: true` (default: false)
- Advisory only

### Hook Output Format

All hooks output JSON to stdout:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "WARNING: Context usage at 70%..."
  }
}
```

### Hook Safety Properties

- All hooks wrap in try/catch, exit silently on error
- stdin timeout guard (3-10s) prevents hanging on pipe issues
- Stale metrics (>60s old) are ignored
- Missing bridge files handled gracefully
- No hook ever blocks tool execution

### Settings Integration

Hooks are registered in `~/.claude/settings.json` by the installer. The settings file also configures permissions.

---

## 11. Key Patterns and Conventions

### File Naming

- **Commands**: `commands/gsd/{kebab-case-name}.md`
- **Workflows**: `get-shit-done/workflows/{kebab-case-name}.md`
- **Agents**: `agents/gsd-{role-name}.md`
- **References**: `get-shit-done/references/{kebab-case-topic}.md`
- **Templates**: `get-shit-done/templates/{kebab-case-name}.md` or `.json`
- **Hooks**: `hooks/gsd-{purpose}.js`
- **CJS Modules**: `get-shit-done/bin/lib/{domain}.cjs`

### Frontmatter Conventions

- **Commands**: YAML frontmatter with `name`, `description`, `argument-hint`, `allowed-tools`
- **Agents**: YAML frontmatter with `name`, `description`, `tools` (comma-separated), `color`
- **Workflows**: NO frontmatter (pure Markdown with XML sections)
- **References**: NO frontmatter (pure Markdown)
- **Templates**: Content with placeholder variables

### XML Prompt Formatting

GSD uses XML-style sections extensively for structured prompts:

```xml
<role>...</role>
<objective>...</objective>
<context>...</context>
<execution_context>...</execution_context>
<process>...</process>
<files_to_read>...</files_to_read>
<additional_context>...</additional_context>
<output>...</output>
<quality_gate>...</quality_gate>
<success_criteria>...</success_criteria>
```

XML task structure for plans:

```xml
<task type="auto">
  <name>Create login endpoint</name>
  <files>src/app/api/auth/login/route.ts</files>
  <action>
    Use jose for JWT. Validate credentials. Return httpOnly cookie.
  </action>
  <verify>curl -X POST localhost:3000/api/auth/login returns 200 + Set-Cookie</verify>
  <done>Valid credentials return cookie, invalid return 401</done>
</task>
```

### Context Sharing Between Components

1. **Commands load workflows** via `@-reference` syntax
2. **Commands load references** via `@-reference` syntax
3. **Workflows load context** via `gsd-tools.cjs init` (returns JSON)
4. **Workflows pass context to agents** via `<files_to_read>` blocks in prompts
5. **Agents read project files** (PROJECT.md, STATE.md, PLAN.md, etc.)
6. **Agents write artifacts** (SUMMARY.md, VERIFICATION.md, etc.)
7. **Workflows read agent artifacts** to update state and route

### Error Handling

- Workflows check `gsd-tools.cjs` output for errors before proceeding
- Agents use deviation protocols when implementation differs from plan
- Plan-checker verification loop (max 3 iterations) catches issues before execution
- Verifier catches issues after execution
- All hooks use try/catch with silent failure
- `security.cjs` validates paths, scans for injection, sanitizes shell arguments

### State Management

All state lives in `.planning/` as files:
- **STATE.md** -- Living memory with YAML frontmatter for structured fields
- **config.json** -- Configuration (mode, granularity, model_profile, workflow toggles)
- **ROADMAP.md** -- Phase status tracking
- **HANDOFF.json** -- Session handoff data
- **WAITING.json** -- Signal file for paused workflows
- **STATE.md.lock** -- Lockfile for parallel write safety

State updates go through `gsd-tools.cjs state` commands, never direct file writes from workflows.

### The "Absent = Enabled" Pattern

Feature flags default to `true` when absent from config.json. Users explicitly disable features. This means a fresh config with no workflow toggles has all features enabled.

---

## 12. Design Philosophy

### What Makes GSD's Architecture Effective

1. **Fresh Context Per Agent**: Every spawned agent gets a clean context window. The orchestrator stays lean (~15% context budget), while agents get 100% fresh context (200K tokens). This eliminates context rot.

2. **Thin Orchestrators**: Workflows never do heavy lifting. They load context, spawn agents, collect results, update state. The actual work happens in agents.

3. **File-Based State**: Everything is human-readable Markdown and JSON in `.planning/`. Survives context resets, inspectable by humans, committable to git.

4. **Separation of Concerns**:
   - Commands = routing (what tools, which workflow)
   - Workflows = orchestration (when to spawn what, how to route)
   - Agents = execution (actual work with fresh context)
   - gsd-tools.cjs = state management (all file ops centralized)
   - References = shared knowledge (loaded on demand)
   - Templates = artifact structure (consistent format)

5. **CLI as Backbone**: `gsd-tools.cjs` eliminates repetitive bash patterns across 50+ files. Every state read/write goes through the CLI, ensuring consistency.

6. **Parallel Execution with Wave Model**: Plans grouped by dependencies run in parallel waves. Each executor gets fresh context. Lockfile-based mutual exclusion prevents state corruption.

7. **Verification at Multiple Levels**: Plan-checker before execution, verifier after execution, UAT for human verification, audit for milestone completion.

### Key Design Decisions

1. **Commands are NOT Claude Code plugin commands** -- they use the native custom command system (`~/.claude/commands/`), not the plugin system (`plugin.json`, `.claude-plugin/`, `context: fork`).

2. **No plugin manifest** -- GSD installs via npm, deploying files directly to the runtime's config directory.

3. **Model resolution at spawn time** -- Agents don't declare their model. The workflow resolves it via `gsd-tools.cjs resolve-model` just before spawning, consulting the config profile.

4. **The init pattern** -- Every workflow starts with `gsd-tools.cjs init <workflow>` which returns a comprehensive JSON payload. This avoids scattered file reads in the workflow.

5. **`@-reference` for context loading** -- Commands use `@~/.claude/...` to load workflow and reference files. This leverages Claude Code's native file reference feature.

6. **XML over Markdown for prompts** -- Structured XML sections in prompts give Claude clearer boundaries than Markdown headers.

7. **Workstreams for parallelism** -- Instead of branch-based isolation, workstreams provide isolated `.planning/` state within the same repo.

### Patterns That Make the System Extensible

1. **Adding a command**: Create a new file in `commands/gsd/`, reference an existing or new workflow, declare tools.

2. **Adding a workflow**: Create a new file in `workflows/`, follow the init pattern, spawn existing agents.

3. **Adding an agent**: Create a new file in `agents/`, add to model-profiles.cjs, reference from workflows.

4. **Adding a reference**: Create a new file in `references/`, `@-reference` from commands that need it.

5. **Adding a template**: Create a new file in `templates/`, use from gsd-tools.cjs template fill or agents.

6. **Adding a CLI command**: Add handler function in the appropriate lib module, add case in gsd-tools.cjs router.

---

## 13. Complete File Inventory

### Commands (57 files)

```
commands/gsd/add-backlog.md
commands/gsd/add-phase.md
commands/gsd/add-tests.md
commands/gsd/add-todo.md
commands/gsd/audit-milestone.md
commands/gsd/audit-uat.md
commands/gsd/autonomous.md
commands/gsd/check-todos.md
commands/gsd/cleanup.md
commands/gsd/complete-milestone.md
commands/gsd/debug.md
commands/gsd/discuss-phase.md
commands/gsd/do.md
commands/gsd/execute-phase.md
commands/gsd/fast.md
commands/gsd/forensics.md
commands/gsd/health.md
commands/gsd/help.md
commands/gsd/insert-phase.md
commands/gsd/join-discord.md
commands/gsd/list-phase-assumptions.md
commands/gsd/list-workspaces.md
commands/gsd/manager.md
commands/gsd/map-codebase.md
commands/gsd/milestone-summary.md
commands/gsd/new-milestone.md
commands/gsd/new-project.md
commands/gsd/new-workspace.md
commands/gsd/next.md
commands/gsd/note.md
commands/gsd/pause-work.md
commands/gsd/plan-milestone-gaps.md
commands/gsd/plan-phase.md
commands/gsd/plant-seed.md
commands/gsd/pr-branch.md
commands/gsd/profile-user.md
commands/gsd/progress.md
commands/gsd/quick.md
commands/gsd/reapply-patches.md
commands/gsd/remove-phase.md
commands/gsd/remove-workspace.md
commands/gsd/research-phase.md
commands/gsd/resume-work.md
commands/gsd/review-backlog.md
commands/gsd/review.md
commands/gsd/session-report.md
commands/gsd/set-profile.md
commands/gsd/settings.md
commands/gsd/ship.md
commands/gsd/stats.md
commands/gsd/thread.md
commands/gsd/ui-phase.md
commands/gsd/ui-review.md
commands/gsd/update.md
commands/gsd/validate-phase.md
commands/gsd/verify-work.md
commands/gsd/workstreams.md
```

### Workflows (58 files)

```
get-shit-done/workflows/add-phase.md
get-shit-done/workflows/add-tests.md
get-shit-done/workflows/add-todo.md
get-shit-done/workflows/audit-milestone.md
get-shit-done/workflows/audit-uat.md
get-shit-done/workflows/autonomous.md
get-shit-done/workflows/check-todos.md
get-shit-done/workflows/cleanup.md
get-shit-done/workflows/complete-milestone.md
get-shit-done/workflows/diagnose-issues.md
get-shit-done/workflows/discovery-phase.md
get-shit-done/workflows/discuss-phase-assumptions.md
get-shit-done/workflows/discuss-phase.md
get-shit-done/workflows/do.md
get-shit-done/workflows/execute-phase.md
get-shit-done/workflows/execute-plan.md
get-shit-done/workflows/fast.md
get-shit-done/workflows/forensics.md
get-shit-done/workflows/health.md
get-shit-done/workflows/help.md
get-shit-done/workflows/insert-phase.md
get-shit-done/workflows/list-phase-assumptions.md
get-shit-done/workflows/list-workspaces.md
get-shit-done/workflows/manager.md
get-shit-done/workflows/map-codebase.md
get-shit-done/workflows/milestone-summary.md
get-shit-done/workflows/new-milestone.md
get-shit-done/workflows/new-project.md
get-shit-done/workflows/new-workspace.md
get-shit-done/workflows/next.md
get-shit-done/workflows/node-repair.md
get-shit-done/workflows/note.md
get-shit-done/workflows/pause-work.md
get-shit-done/workflows/plan-milestone-gaps.md
get-shit-done/workflows/plan-phase.md
get-shit-done/workflows/plant-seed.md
get-shit-done/workflows/pr-branch.md
get-shit-done/workflows/profile-user.md
get-shit-done/workflows/progress.md
get-shit-done/workflows/quick.md
get-shit-done/workflows/remove-phase.md
get-shit-done/workflows/remove-workspace.md
get-shit-done/workflows/research-phase.md
get-shit-done/workflows/resume-project.md
get-shit-done/workflows/review.md
get-shit-done/workflows/session-report.md
get-shit-done/workflows/settings.md
get-shit-done/workflows/ship.md
get-shit-done/workflows/stats.md
get-shit-done/workflows/transition.md
get-shit-done/workflows/ui-phase.md
get-shit-done/workflows/ui-review.md
get-shit-done/workflows/update.md
get-shit-done/workflows/validate-phase.md
get-shit-done/workflows/verify-phase.md
get-shit-done/workflows/verify-work.md
```

### Agents (18 files)

```
agents/gsd-advisor-researcher.md
agents/gsd-assumptions-analyzer.md
agents/gsd-codebase-mapper.md
agents/gsd-debugger.md
agents/gsd-executor.md
agents/gsd-integration-checker.md
agents/gsd-nyquist-auditor.md
agents/gsd-phase-researcher.md
agents/gsd-plan-checker.md
agents/gsd-planner.md
agents/gsd-project-researcher.md
agents/gsd-research-synthesizer.md
agents/gsd-roadmapper.md
agents/gsd-ui-auditor.md
agents/gsd-ui-checker.md
agents/gsd-ui-researcher.md
agents/gsd-user-profiler.md
agents/gsd-verifier.md
```

### References (15 files)

```
get-shit-done/references/checkpoints.md
get-shit-done/references/continuation-format.md
get-shit-done/references/decimal-phase-calculation.md
get-shit-done/references/git-integration.md
get-shit-done/references/git-planning-commit.md
get-shit-done/references/model-profile-resolution.md
get-shit-done/references/model-profiles.md
get-shit-done/references/phase-argument-parsing.md
get-shit-done/references/planning-config.md
get-shit-done/references/questioning.md
get-shit-done/references/tdd.md
get-shit-done/references/ui-brand.md
get-shit-done/references/user-profiling.md
get-shit-done/references/verification-patterns.md
get-shit-done/references/workstream-flag.md
```

### Templates (32+ files)

```
get-shit-done/templates/config.json
get-shit-done/templates/project.md
get-shit-done/templates/requirements.md
get-shit-done/templates/roadmap.md
get-shit-done/templates/state.md
get-shit-done/templates/context.md
get-shit-done/templates/phase-prompt.md
get-shit-done/templates/research.md
get-shit-done/templates/discovery.md
get-shit-done/templates/summary.md
get-shit-done/templates/summary-minimal.md
get-shit-done/templates/summary-standard.md
get-shit-done/templates/summary-complex.md
get-shit-done/templates/VALIDATION.md
get-shit-done/templates/UAT.md
get-shit-done/templates/UI-SPEC.md
get-shit-done/templates/DEBUG.md
get-shit-done/templates/claude-md.md
get-shit-done/templates/copilot-instructions.md
get-shit-done/templates/planner-subagent-prompt.md
get-shit-done/templates/debug-subagent-prompt.md
get-shit-done/templates/milestone.md
get-shit-done/templates/milestone-archive.md
get-shit-done/templates/retrospective.md
get-shit-done/templates/discussion-log.md
get-shit-done/templates/continue-here.md
get-shit-done/templates/dev-preferences.md
get-shit-done/templates/user-profile.md
get-shit-done/templates/user-setup.md
get-shit-done/templates/verification-report.md
get-shit-done/templates/codebase/architecture.md
get-shit-done/templates/codebase/concerns.md
get-shit-done/templates/codebase/conventions.md
get-shit-done/templates/codebase/integrations.md
get-shit-done/templates/codebase/stack.md
get-shit-done/templates/codebase/structure.md
get-shit-done/templates/codebase/testing.md
get-shit-done/templates/research-project/ARCHITECTURE.md
get-shit-done/templates/research-project/FEATURES.md
get-shit-done/templates/research-project/PITFALLS.md
get-shit-done/templates/research-project/STACK.md
get-shit-done/templates/research-project/SUMMARY.md
```

### Hooks (5 files)

```
hooks/gsd-statusline.js
hooks/gsd-context-monitor.js
hooks/gsd-check-update.js
hooks/gsd-prompt-guard.js
hooks/gsd-workflow-guard.js
```

### CJS Modules (18 files)

```
get-shit-done/bin/gsd-tools.cjs
get-shit-done/bin/lib/commands.cjs
get-shit-done/bin/lib/config.cjs
get-shit-done/bin/lib/core.cjs
get-shit-done/bin/lib/frontmatter.cjs
get-shit-done/bin/lib/init.cjs
get-shit-done/bin/lib/milestone.cjs
get-shit-done/bin/lib/model-profiles.cjs
get-shit-done/bin/lib/phase.cjs
get-shit-done/bin/lib/profile-output.cjs
get-shit-done/bin/lib/profile-pipeline.cjs
get-shit-done/bin/lib/roadmap.cjs
get-shit-done/bin/lib/security.cjs
get-shit-done/bin/lib/state.cjs
get-shit-done/bin/lib/template.cjs
get-shit-done/bin/lib/uat.cjs
get-shit-done/bin/lib/verify.cjs
get-shit-done/bin/lib/workstream.cjs
```

---

## Appendix: Critical Differences from fp-docs Architecture

For the conversion plan writer, these are the most important architectural differences:

### 1. Plugin System vs Custom Commands

- **fp-docs**: Uses Claude Code plugin system (`plugin.json`, `.claude-plugin/`, skills with `context: fork`, `agent:` frontmatter routing)
- **GSD**: Uses native custom commands (`~/.claude/commands/gsd/*.md`) with `@-reference` to workflow files. No plugin manifest.

### 2. Skill Routing vs Workflow Delegation

- **fp-docs**: Skills route through a universal `orchestrate` engine which delegates to specialist engines
- **GSD**: Commands directly reference workflows via `@-reference`. No central orchestrator agent. The workflow IS the orchestrator.

### 3. Module Preloading vs Reference Loading

- **fp-docs**: Modules (`modules/mod-*/SKILL.md`) are preloaded into engine context via `skills:` list in agent frontmatter
- **GSD**: References (`references/*.md`) are loaded on-demand via `@-reference` in command files. No preloading mechanism.

### 4. Pipeline vs Wave Execution

- **fp-docs**: 8-stage pipeline with 3 phases (Write, Review, Finalize) distributed across agents
- **GSD**: Wave-based execution where independent plans run in parallel, dependent plans wait

### 5. State Management

- **fp-docs**: State managed by orchestrator engine + git commits (docs repo). No central state file.
- **GSD**: Centralized `.planning/` directory with STATE.md, config.json, and gsd-tools.cjs for all state operations.

### 6. Engine Identity vs Agent Role

- **fp-docs**: 9 engines with deep identity (modify, validate, citations, api-refs, locals, verbosity, index, system, orchestrate). Each engine owns a domain.
- **GSD**: 18 agents with focused roles (researcher, planner, executor, checker, verifier, etc.). Agents are task-specific, not domain-specific.

### 7. Git Model

- **fp-docs**: Three independent git repos (codebase, docs, plugin). Only orchestrator commits.
- **GSD**: Single repo with `.planning/` directory. Executors commit per task. Orchestrator coordinates.

### 8. CLI Integration

- **fp-docs**: `fp-tools.cjs` with hook handlers, locals-cli, core, paths, git modules
- **GSD**: `gsd-tools.cjs` with 17 domain modules covering state, config, phase, roadmap, verify, template, frontmatter, init, milestone, security, and more. Much larger CLI surface.
