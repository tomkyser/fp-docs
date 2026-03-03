# Docs System 2.0 — Proposal Specification

> **Status**: DRAFT
> **Date**: 2026-03-01
> **Branch**: `task--theme-dev-docs`
> **Scope**: Complete architecture redesign of the FP documentation management system, built as a Claude Code plugin

---

## 1. Executive Summary

Docs System 2.0 replaces the current flat, instruction-file-based documentation system with an engine-based architecture built entirely on Claude Code's native plugin primitives (subagents, skills, hooks, persistent memory). The redesign is packaged as a Claude Code plugin (`fp-docs`) scoped to the Foreign Policy codebase, eliminating all third-party framework dependencies, resolving instruction duplication across commands, enabling CI/CD automation via Claude Code headless mode, and providing a reference implementation that can be adapted for other projects later.

### Goals
1. **Zero external dependencies** — no SuperClaude, no Serena, no Mindbase. Only Claude Code native features.
2. **No instruction duplication** — shared rules live in exactly one file each. Engines reference, never copy.
3. **Engine-based extensibility** — adding new subsystems follows a defined contract, not reverse-engineering.
4. **CI/CD ready** — GitHub Actions integration via `claude --headless` from day one.
5. **FP-scoped plugin** — project-specific config is hardcoded in the plugin, not templated. Genericization can happen later as a reference exercise.
6. **Full feature preservation** — every check, rule, step, and behavior from 1.0 carries forward.
7. **Native-first design** — leverages Claude Code plugin primitives (`argument-hint`, `!`command`!` dynamic injection, hook types, `allowed-tools`) to the fullest extent possible.
8. **Future MCP integration points** — architecture accounts for RAG Graph, Context7, and similar tools without implementing them now.

### Non-Goals
- Gradual migration. This is a big-bang switch from 1.0 to 2.0.
- MCP server implementation. Future integration points are designed but not built.
- Multi-project generalization. FP is the sole target; generic extraction is a future exercise.

---

## 2. Problem Statement

### What's wrong with 1.0

| Problem | Impact | Example |
|---------|--------|---------|
| **Instruction duplication** | Change one behavior → update 5+ files | Post-modify pipeline (citations → sanity → verify → log → index) is repeated in cc-revise, cc-add, cc-auto-update, cc-auto-revise, cc-deprecate |
| **Monolithic standards** | 680-line file mixes all concerns | `docs-standards.md` §7 (citations), §8 (API refs), §9 (locals), §10 (verbosity) are unrelated subsystems sharing one file |
| **No engine contract** | Adding subsystems is ad-hoc | Locals, verbosity, and API refs were each integrated differently — no pattern to follow |
| **Post-execution inconsistency** | Pipeline steps can be missed | Each primary command manually calls sub-instructions; nothing enforces completeness |
| **No persistent learning** | Each session starts from scratch | The system doesn't accumulate knowledge about the codebase's documentation patterns |
| **External framework dependency** | Reliability and coupling issues | SuperClaude framework is unreliable; Serena/Mindbase add fragile MCP dependencies |
| **No CI/CD path** | Documentation updates are manual-only | No way to auto-update docs when code changes in a PR |
| **Flat config** | All engines share one config file | `docs-system-config.md` mixes citation thresholds, API ref provenance, validation settings |

### What 1.0 got right (preserve these)

- **Deterministic lifecycle** — LOAD → ROUTE → PLAN → EXECUTE → ... → LOG → INDEX
- **Source-of-truth principle** — read actual code before writing docs, never guess
- **Sanity-check rigor** — zero-tolerance for assumptions, `[NEEDS INVESTIGATION]` tagging
- **Verification checklist** — now 10-point, catches format/content/link/citation/API-ref/verbosity issues
- **Revision tracker** — `needs-revision-tracker.md` for systematic backlog management
- **Standards depth** — comprehensive format templates for all 10+ document types
- **Citation system** — 3-tier provenance (Full, Signature, Reference) with stale/broken detection
- **Verbosity engine** — anti-brevity enforcement with scope manifests and post-generation gates
- **Flag design patterns** — opt-out (`--no-*`), opt-in (`--with-*`), enable (`--enable-*`)

---

## 3. Architecture Overview

### Plugin Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  fp-docs PLUGIN (Claude Code native plugin)                      │
│                                                                   │
│  Agents     — 8 engine subagent definitions (agents/)            │
│  Skills     — 18 user commands + 10 shared modules (skills/)    │
│  Hooks      — Lifecycle automation (hooks/hooks.json + scripts/) │
│  Framework  — Instructions, rules, config (framework/)          │
│  Memory     — Persistent learning (via memory: project)          │
│                                                                   │
│  Plugin manifest: .claude-plugin/plugin.json                     │
│  Plugin name: fp-docs                                            │
│  Skill namespace: /fp-docs:*                                     │
├──────────────────────────────────────────────────────────────────┤
│  PROJECT DOCS (content only — stays in FP repo)                  │
│                                                                   │
│  themes/foreign-policy-2017/docs/                                │
│  ├── FLAGGED CONCERNS/                                           │
│  ├── changelog.md                                                │
│  ├── needs-revision-tracker.md                                   │
│  ├── About.md                                                    │
│  ├── 00-getting-started/ through 24-appendices/                  │
│  └── (all 301+ documentation content files)                      │
│                                                                   │
│  NO system files in docs/ — only content and trackers.           │
└──────────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

**A. Shared Skill Modules solve deduplication.**
Operational rules (citation format, validation checklist, changelog format, verbosity rules) each live in exactly ONE skill module file. Engines preload the modules they need via the subagent `skills:` field. Change a rule → one file update → all engines that use it get the change.

**B. Pipeline is inside the engine, not between engines.**
Because subagents cannot spawn other subagents, the post-modification pipeline (verbosity → citations → sanity → verify → log → index) executes WITHIN the modify engine's single context. The engine's instructions define the sequence; the preloaded skill modules provide the rules.

**C. On-demand module loading for context efficiency.**
Not every module needs to be preloaded. Standards and config are preloaded (always needed). Pipeline modules (citation rules, validation rules) can be read from disk by the engine when it reaches that pipeline stage, keeping initial context lean.

**D. SubagentStop hooks for mandatory post-checks.**
A hook fires when any docs engine completes, running a validation script that ensures the engine actually performed all required pipeline steps. This is the safety net — even if an engine's instructions are wrong, the hook catches missing steps.

**E. FP-specific config is hardcoded in the plugin.**
The `docs-mod-project` module contains FP's source-to-docs mapping, project paths, and feature enables directly. No templates, no injection, no abstraction. This keeps the plugin simple and focused. Genericization is a future exercise — not a current design constraint.

**F. Plugin path resolution via SessionStart hook.**
`${CLAUDE_PLUGIN_ROOT}` is available in hook commands and scripts but NOT in agent/skill markdown. The SessionStart hook resolves the plugin root path and injects it as `additionalContext`, making it available to all engines and the main conversation.

**G. Parallel batch processing via Agent Teams (opt-in).**
For commands affecting 3+ files (auto-update, auto-revise, deep audits), an orchestration skill creates an Agent Team, decomposes work into per-file tasks, and spawns teammates that each process files independently. This is a **coordination skill**, not a 9th engine, because it must run in the main conversation context (subagents cannot use TeamCreate/Agent). Falls back to sequential processing when Agent Teams are disabled. See `orchestrate-spec.md` for full details.

### Plugin Manifest

```json
{
  "name": "fp-docs",
  "version": "1.0.0",
  "description": "Documentation management system for Foreign Policy WordPress codebase",
  "author": {
    "name": "FP Dev Team"
  }
}
```

### Path Resolution

| Context | `${CLAUDE_PLUGIN_ROOT}` Available? | How to reference plugin files |
|---------|-----------------------------------|-------------------------------|
| Hook commands (`hooks.json`) | Yes | `${CLAUDE_PLUGIN_ROOT}/scripts/inject-manifest.sh` |
| Hook scripts (`scripts/*.sh`) | Yes (inherited from hook command) | `${CLAUDE_PLUGIN_ROOT}/framework/manifest.md` |
| Agent markdown (`agents/*.md`) | No | Injected via SessionStart `additionalContext` |
| Skill markdown (`skills/*/SKILL.md`) | No | Injected via SessionStart `additionalContext` |
| MCP configs (`.mcp.json`) | Yes | Direct use in config values |

The SessionStart hook outputs the resolved plugin root as `additionalContext`. Engine system prompts reference `{plugin-root}` and resolve it from their session context.

---

## 4. Component Inventory

### 4.1 Engines (Custom Subagents)

Each engine is an `agents/*.md` file in the plugin root, following the Engine Contract (see `engine-contract-spec.md`).

| Engine | Subagent File | Color | Model | Responsibility | Current Equivalent |
|--------|--------------|-------|-------|----------------|--------------------|
| **docs-modify** | `agents/docs-modify.md` | `#4CAF50` Green | inherit | Revise, add, auto-update, auto-revise, deprecate documentation | cc-revise, cc-add, cc-auto-update, cc-auto-revise, cc-deprecate |
| **docs-validate** | `agents/docs-validate.md` | `#2196F3` Blue | inherit | Audit, verify, sanity-check, test documentation | cc-audit, cc-verify, cc-sanity-check, cc-test |
| **docs-citations** | `agents/docs-citations.md` | `#FF9800` Orange | inherit | Generate, update, verify, audit code citations | cc-citations-generate, cc-citations-update, cc-citations-verify, cc-citations-audit |
| **docs-api-refs** | `agents/docs-api-refs.md` | `#00BCD4` Cyan | inherit | Generate, update, audit API reference tables | cc-api-ref, cc-api-ref-audit |
| **docs-locals** | `agents/docs-locals.md` | `#E91E63` Pink | inherit | Annotate, contracts, cross-ref, validate, shapes, coverage for $locals | cc-locals |
| **docs-verbosity** | `agents/docs-verbosity.md` | `#9C27B0` Purple | sonnet | Audit docs for verbosity gaps | cc-verbosity-audit (standalone audit only) |
| **docs-index** | `agents/docs-index.md` | `#607D8B` Blue-grey | sonnet | Update PROJECT-INDEX, doc links, example CLAUDE.md | cc-update-project-index, cc-update-doc-links, cc-update-example-CLAUDE |
| **docs-system** | `agents/docs-system.md` | `#795548` Brown | sonnet | Update skills, validate system, bootstrap setup | cc-update-skills, system validation |

> **Note on `color` field**: The `color` field is functional but not listed in the official subagent frontmatter reference table. It appears in the `/agents` interactive wizard (step 6). Treat as non-critical/cosmetic — engines work identically without it.

### 4.2 Shared Skill Modules

Each module is a `skills/docs-mod-*/SKILL.md` in the plugin with `user-invocable: false` and `disable-model-invocation: true` (invisible to users and Claude — only preloaded into engines).

| Module | File (plugin-relative) | Contains | Preloaded By |
|--------|------|----------|-------------|
| **docs-mod-standards** | `skills/docs-mod-standards/SKILL.md` | Shared formatting rules, file naming, directory structure, content rules, cross-ref requirements, document templates | All engines |
| **docs-mod-project** | `skills/docs-mod-project/SKILL.md` | FP source-to-docs mapping, project paths, enabled engines, project-specific format rules | All engines |
| **docs-mod-citations** | `skills/docs-mod-citations/SKILL.md` | Citation format, tiers, generation algorithm, staleness detection, excerpt rules | docs-modify, docs-citations |
| **docs-mod-api-refs** | `skills/docs-mod-api-refs/SKILL.md` | API ref table format, provenance rules, scope table, completeness rule | docs-modify, docs-api-refs |
| **docs-mod-locals** | `skills/docs-mod-locals/SKILL.md` | Locals contract format, @locals/@controller PHPDoc, shared shapes, ground truth engine | docs-modify, docs-locals |
| **docs-mod-verbosity** | `skills/docs-mod-verbosity/SKILL.md` | Anti-brevity directives, banned phrases, scope manifests, enforcement gates, chunk/checkpoint | docs-modify, docs-verbosity |
| **docs-mod-validation** | `skills/docs-mod-validation/SKILL.md` | 10-point verification checklist, sanity-check algorithm, zero-tolerance rules, `[NEEDS INVESTIGATION]` tagging | docs-modify, docs-validate |
| **docs-mod-changelog** | `skills/docs-mod-changelog/SKILL.md` | Changelog entry format, date format, change classification | docs-modify |
| **docs-mod-index** | `skills/docs-mod-index/SKILL.md` | PROJECT-INDEX format, doc link update rules, About.md structure, _index.md requirements | docs-modify, docs-index |
| **docs-mod-pipeline** | `skills/docs-mod-pipeline/SKILL.md` | Post-modification pipeline definition: stage order, skip conditions, flag handling | docs-modify |

### 4.3 User-Facing Skills

Each skill is a `skills/*/SKILL.md` in the plugin. Users invoke with `/fp-docs:*`. Skill directory names drop the `docs-` prefix since the plugin namespace already provides context.

| Skill | Invocation | Engine | Args |
|-------|-----------|--------|------|
| `skills/revise/SKILL.md` | `/fp-docs:revise` | docs-modify | `$ARGUMENTS` = description of what to fix |
| `skills/add/SKILL.md` | `/fp-docs:add` | docs-modify | `$ARGUMENTS` = description of new code to document |
| `skills/auto-update/SKILL.md` | `/fp-docs:auto-update` | docs-modify | `$ARGUMENTS` = optional scope restriction |
| `skills/auto-revise/SKILL.md` | `/fp-docs:auto-revise` | docs-modify | `$ARGUMENTS` = optional flags |
| `skills/deprecate/SKILL.md` | `/fp-docs:deprecate` | docs-modify | `$ARGUMENTS` = description of deprecated code |
| `skills/audit/SKILL.md` | `/fp-docs:audit` | docs-validate | `$ARGUMENTS` = scope + depth flags |
| `skills/verify/SKILL.md` | `/fp-docs:verify` | docs-validate | `$ARGUMENTS` = optional scope |
| `skills/sanity-check/SKILL.md` | `/fp-docs:sanity-check` | docs-validate | `$ARGUMENTS` = scope |
| `skills/test/SKILL.md` | `/fp-docs:test` | docs-validate | `$ARGUMENTS` = scope + flags |
| `skills/citations/SKILL.md` | `/fp-docs:citations` | docs-citations | `$ARGUMENTS[0]` = subcommand, `$ARGUMENTS[1]` = scope |
| `skills/api-ref/SKILL.md` | `/fp-docs:api-ref` | docs-api-refs | `$ARGUMENTS` = scope + flags |
| `skills/locals/SKILL.md` | `/fp-docs:locals` | docs-locals | `$ARGUMENTS[0]` = subcommand, `$ARGUMENTS[1]` = scope |
| `skills/verbosity-audit/SKILL.md` | `/fp-docs:verbosity-audit` | docs-verbosity | `$ARGUMENTS` = scope + flags |
| `skills/update-index/SKILL.md` | `/fp-docs:update-index` | docs-index | `$ARGUMENTS` = mode (update\|full) |
| `skills/update-claude/SKILL.md` | `/fp-docs:update-claude` | docs-index | none |
| `skills/update-skills/SKILL.md` | `/fp-docs:update-skills` | docs-system | none |
| `skills/setup/SKILL.md` | `/fp-docs:setup` | docs-system | none (validates system integrity) |
| `skills/parallel/SKILL.md` | `/fp-docs:parallel` | *(orchestration — no engine)* | `$ARGUMENTS` = operation + scope + flags |

**Note on `/fp-docs:parallel`**: This skill does NOT use `context: fork` or `agent:` because it must run in the main conversation context to access TeamCreate and Agent tools. It coordinates teammates that each behave like engine instances. See `orchestrate-spec.md` for full details.

**Native skill features adopted**:
- **`argument-hint`**: All user skills include `argument-hint` for UI autocomplete (e.g., `argument-hint: "description of what to fix"`)
- **`allowed-tools`**: Read-only skills (audit, verify, sanity-check, verbosity-audit) use `allowed-tools` as defense-in-depth alongside engine `disallowedTools`
- **`!`command`!` dynamic injection**: The auto-update skill uses `!`git diff --name-only`!` to inject changed file list into the engine prompt

### 4.4 Hooks

Defined in `hooks/hooks.json` at the plugin root.

| Hook Event | Matcher | Type | Purpose |
|-----------|---------|------|---------|
| `SessionStart` | `startup\|resume` | `command` | Inject docs system manifest + plugin root path as `additionalContext` |
| `SubagentStop` | `docs-modify` | `command` | Run post-modification validation script — ensures all pipeline stages completed |
| `SubagentStop` | `docs-validate` | `command` | Log validation results to audit trail |
| `TeammateIdle` | *(no matcher support)* | `command` | Validate teammate pipeline completion before allowing idle (orchestration layer) |
| `TaskCompleted` | *(no matcher support)* | `command` | Validate task outputs before allowing completion (orchestration layer) |
| `PostToolUse` | `Write\|Edit` | `command` | (Future) Auto-detect doc-relevant file changes for proactive suggestions |

**Hook type notes**:
- All hooks currently use `type: command` (shell scripts). The `agent` hook type (agentic with tools) is available for future use — e.g., an intelligent SubagentStop hook that can read files and reason about pipeline completeness.
- `TeammateIdle` and `TaskCompleted` do not support matchers — they fire on every occurrence. The hook scripts filter internally by checking `team_name == "docs-batch"`.
- Hook commands use `${CLAUDE_PLUGIN_ROOT}` to reference scripts: `"command": "${CLAUDE_PLUGIN_ROOT}/scripts/inject-manifest.sh"`

### 4.5 Persistent Memory

Each engine-agent has `memory: project` for project-specific learning.

| Engine | Memory Path | What It Learns |
|--------|------------|----------------|
| docs-modify | `.claude/agent-memory/docs-modify/` | Common revision patterns, frequently-updated files, typical format issues |
| docs-validate | `.claude/agent-memory/docs-validate/` | False positive patterns, common validation failures, codebase-specific quirks |
| docs-citations | `.claude/agent-memory/docs-citations/` | Citation patterns, function signature styles, stale citation hotspots |

> **Note**: Memory directories are managed by Claude Code at the project level (`.claude/agent-memory/`), not inside the plugin. This is standard Claude Code behavior — the plugin defines `memory: project` and Claude Code handles the storage location.

---

## 5. File Structure

### Plugin Directory

```
fp-docs-system/                              # Plugin root
├── .claude-plugin/
│   └── plugin.json                          # {"name":"fp-docs","version":"1.0.0",...}
│
├── agents/                                  # 8 engine subagent definitions
│   ├── docs-modify.md                       # Modify engine (revise, add, auto-update, etc.)
│   ├── docs-validate.md                     # Validation engine (audit, verify, sanity, test)
│   ├── docs-citations.md                    # Citations engine
│   ├── docs-api-refs.md                     # API refs engine
│   ├── docs-locals.md                       # Locals engine
│   ├── docs-verbosity.md                    # Verbosity audit engine
│   ├── docs-index.md                        # Index/links engine
│   └── docs-system.md                       # System maintenance engine
│
├── skills/
│   │  # User-facing skills (directory names drop docs- prefix)
│   ├── revise/SKILL.md                      # /fp-docs:revise → docs-modify
│   ├── add/SKILL.md                         # /fp-docs:add → docs-modify
│   ├── auto-update/SKILL.md                 # /fp-docs:auto-update → docs-modify
│   ├── auto-revise/SKILL.md                 # /fp-docs:auto-revise → docs-modify
│   ├── deprecate/SKILL.md                   # /fp-docs:deprecate → docs-modify
│   ├── audit/SKILL.md                       # /fp-docs:audit → docs-validate
│   ├── verify/SKILL.md                      # /fp-docs:verify → docs-validate
│   ├── sanity-check/SKILL.md                # /fp-docs:sanity-check → docs-validate
│   ├── test/SKILL.md                        # /fp-docs:test → docs-validate
│   ├── citations/SKILL.md                   # /fp-docs:citations → docs-citations
│   ├── api-ref/SKILL.md                     # /fp-docs:api-ref → docs-api-refs
│   ├── locals/SKILL.md                      # /fp-docs:locals → docs-locals
│   ├── verbosity-audit/SKILL.md             # /fp-docs:verbosity-audit → docs-verbosity
│   ├── update-index/SKILL.md                # /fp-docs:update-index → docs-index
│   ├── update-claude/SKILL.md               # /fp-docs:update-claude → docs-index
│   ├── update-skills/SKILL.md               # /fp-docs:update-skills → docs-system
│   ├── setup/SKILL.md                       # /fp-docs:setup → docs-system
│   ├── parallel/SKILL.md                    # /fp-docs:parallel → orchestration (no engine)
│   │
│   │  # Shared Skill Modules (invisible to users — preloaded into engines)
│   ├── docs-mod-standards/SKILL.md
│   ├── docs-mod-project/SKILL.md
│   ├── docs-mod-citations/SKILL.md
│   ├── docs-mod-api-refs/SKILL.md
│   ├── docs-mod-locals/SKILL.md
│   ├── docs-mod-verbosity/SKILL.md
│   ├── docs-mod-validation/SKILL.md
│   ├── docs-mod-changelog/SKILL.md
│   ├── docs-mod-index/SKILL.md
│   └── docs-mod-pipeline/SKILL.md
│
├── hooks/
│   └── hooks.json                           # All hook registrations
│
├── scripts/                                 # Hook implementation scripts
│   ├── inject-manifest.sh                   # SessionStart: inject manifest + plugin root
│   ├── post-modify-check.sh                 # SubagentStop: validate pipeline completion
│   ├── post-validate-log.sh                 # SubagentStop: log validation results
│   ├── teammate-idle-check.sh               # TeammateIdle: validate teammate pipeline
│   └── task-completed-check.sh              # TaskCompleted: validate task outputs
│
├── framework/                               # Instructions, rules, and config
│   ├── manifest.md                          # System manifest (engine registry, command map)
│   ├── instructions/                        # Step-by-step procedures for each operation
│   │   ├── modify/
│   │   │   ├── revise.md
│   │   │   ├── add.md
│   │   │   ├── auto-update.md
│   │   │   ├── auto-revise.md
│   │   │   └── deprecate.md
│   │   ├── validate/
│   │   │   ├── audit.md
│   │   │   ├── verify.md
│   │   │   ├── sanity-check.md
│   │   │   └── test.md
│   │   ├── citations/
│   │   │   ├── generate.md
│   │   │   ├── update.md
│   │   │   ├── verify.md
│   │   │   └── audit.md
│   │   ├── api-refs/
│   │   │   ├── generate.md
│   │   │   └── audit.md
│   │   ├── locals/
│   │   │   └── locals.md                    # All subcommands in one instruction
│   │   ├── verbosity/
│   │   │   └── audit.md
│   │   ├── index/
│   │   │   ├── update-project-index.md
│   │   │   ├── update-doc-links.md
│   │   │   └── update-example-claude.md
│   │   ├── orchestrate/
│   │   │   └── parallel.md                  # Parallel batch processing procedure
│   │   └── system/
│   │       ├── update-skills.md
│   │       └── setup.md
│   ├── modules/                             # On-demand rule files (read during pipeline)
│   │   ├── standards.md                     # Shared formatting rules (extracted from docs-standards.md §1-§6)
│   │   ├── citation-rules.md                # Citation format (extracted from docs-standards.md §7)
│   │   ├── api-ref-rules.md                 # API ref format (extracted from docs-standards.md §8)
│   │   ├── locals-rules.md                  # Locals format (extracted from docs-standards.md §9)
│   │   ├── verbosity-rules.md               # Verbosity enforcement (from docs-verbosity-engine.md)
│   │   ├── validation-rules.md              # 10-point checklist + sanity-check algorithm
│   │   ├── changelog-rules.md               # Changelog entry format
│   │   ├── index-rules.md                   # PROJECT-INDEX + doc link rules
│   │   └── pipeline-rules.md                # Post-modification pipeline definition
│   └── config/
│       ├── system-config.md                 # System-level flags and thresholds
│       └── project-config.md                # FP-specific values (hardcoded, not template)
│
├── settings.json                            # Plugin settings (default agent config)
├── CHANGELOG.md
└── README.md
```

### Documentation Content (stays in FP repo)

```
themes/foreign-policy-2017/docs/             # Content only — no system files
├── FLAGGED CONCERNS/
├── About.md
├── changelog.md
├── needs-revision-tracker.md
├── 00-getting-started/
├── 01-architecture/
├── ...                                      # All 24 doc sections unchanged
└── 24-appendices/
```

### Architecture Specs (current working directory — not part of plugin)

```
.claude/docs-system-2.0/                     # Specs for designing the plugin
├── proposal-spec.md                         # This file
├── engine-contract-spec.md
├── prototype-engine.md
└── orchestrate-spec.md
```

---

## 6. How Deduplication Works

### The Problem (1.0)

```
cc-revise.md        → calls cc-sanity-check, cc-verify, cc-changelog, cc-citations-update,
                       cc-verbosity-scope, cc-verbosity-enforce
cc-add.md           → calls cc-sanity-check, cc-verify, cc-changelog, cc-citations-generate,
                       cc-verbosity-scope, cc-verbosity-enforce, cc-update-doc-links
cc-auto-update.md   → calls cc-sanity-check, cc-verify, cc-changelog, cc-citations-update,
                       cc-verbosity-scope, cc-verbosity-enforce, cc-update-doc-links
cc-auto-revise.md   → calls cc-sanity-check, cc-verify, cc-changelog, cc-citations-update
cc-deprecate.md     → calls cc-verify, cc-changelog, cc-update-doc-links
```

Five primary commands, each manually calling 3-6 sub-instructions. If you change the pipeline order, or add a step, you touch all five.

### The Solution (2.0)

```
docs-modify engine
├── Preloaded: docs-mod-pipeline (defines the stages and skip conditions)
├── Preloaded: docs-mod-standards (shared format rules)
├── Preloaded: docs-mod-project (FP-specific config)
├── On-demand: docs-mod-citations (read when pipeline reaches citation stage)
├── On-demand: docs-mod-validation (read when pipeline reaches sanity/verify stage)
├── On-demand: docs-mod-verbosity (read when pipeline reaches verbosity stage)
├── On-demand: docs-mod-changelog (read when pipeline reaches changelog stage)
└── On-demand: docs-mod-index (read when pipeline reaches index stage)
```

The **pipeline definition** lives in ONE file (`pipeline-rules.md` in `framework/modules/`). The **rules** for each stage live in ONE file each. The engine reads what it needs when it needs it.

### What changes where

| Change | Files to update | 1.0 equivalent |
|--------|----------------|-----------------|
| Add a pipeline stage | `framework/modules/pipeline-rules.md` (1 file) | 5 primary instruction files |
| Change citation format | `framework/modules/citation-rules.md` (1 file) | `docs-standards.md` §7 + cc-citations-*.md (6 files) |
| Change validation checklist | `framework/modules/validation-rules.md` (1 file) | cc-verify.md + cc-sanity-check.md (2 files) |
| Change pipeline order | `framework/modules/pipeline-rules.md` (1 file) | 5 primary instruction files |
| Add a new engine | New agent + contract compliance (2-3 files) | Reverse-engineer existing system (ad-hoc) |

---

## 7. Lifecycle

### Normal Operation (e.g., `/fp-docs:revise "fix posts helper"`)

```
1. USER invokes /fp-docs:revise "fix posts helper"
   │
2. SKILL (skills/revise/SKILL.md) parses $ARGUMENTS, sets context:fork, agent:docs-modify
   │
3. SUBAGENT (docs-modify) launches with:
   │  • System prompt: engine instructions
   │  • Preloaded skills: docs-mod-standards, docs-mod-project, docs-mod-pipeline
   │  • Memory: reads MEMORY.md for learned patterns
   │  • Tools: Read, Write, Edit, Grep, Glob, Bash
   │  • Session context: plugin root path (from SessionStart hook)
   │
4. ENGINE executes primary operation:
   │  a. Read the instruction file for "revise" operation
   │     ({plugin-root}/framework/instructions/modify/revise.md)
   │  b. Read source code (helpers/posts.php)
   │  c. Read current doc (docs/06-helpers/posts.md)
   │  d. Compare and identify discrepancies
   │  e. Apply revisions
   │
5. ENGINE executes post-modification pipeline (from preloaded pipeline module):
   │  a. VERBOSITY: Read verbosity-rules module → enforce anti-brevity
   │  b. CITATIONS: Read citation-rules module → update citation blocks
   │  c. API-REFS: Read api-ref-rules module → update API reference table (if applicable)
   │  d. SANITY-CHECK: Read validation-rules module → validate revisions against source
   │  e. VERIFY: Run 10-point verification checklist
   │  f. CHANGELOG: Read changelog-rules module → append entry
   │  g. INDEX: Read index-rules module → update links if structural changes
   │
6. ENGINE returns summary to main conversation
   │
7. HOOK (SubagentStop) fires → post-modify-check.sh validates:
   │  • Did the engine modify the doc file? (expected for revise)
   │  • Did the engine append to changelog? (mandatory)
   │  • Did the engine produce a verification report? (mandatory)
   │
8. USER sees summary of changes made
```

### Parallel Operation (e.g., `/fp-docs:parallel auto-update` with 9 changed files)

```
1. USER invokes /fp-docs:parallel auto-update
   │
2. SKILL (skills/parallel/SKILL.md) runs in MAIN CONTEXT (no fork):
   │  a. Detect changed source files → 9 files found
   │  b. Map to doc files via source-to-docs mapping → 9 doc files
   │  c. Decide: 9 files → 3 teammates, 3 files each
   │
3. ORCHESTRATION creates team:
   │  a. TeamCreate: "docs-batch"
   │  b. TaskCreate × 3: one task per file batch
   │  c. Agent × 3: spawn teammates (general-purpose, isolation: worktree)
   │     Each teammate prompt: "Read agents/docs-modify.md, process these files..."
   │
4. TEAMMATES execute in parallel (each in own context + worktree):
   │  ├── Teammate 1: processes docs 1-3, runs full pipeline per doc
   │  ├── Teammate 2: processes docs 4-6, runs full pipeline per doc
   │  └── Teammate 3: processes docs 7-9, runs full pipeline per doc
   │
   │  HOOKS fire per teammate:
   │  • TaskCompleted → validates doc changes exist before task can close
   │  • TeammateIdle → validates pipeline completion before teammate stops
   │
5. LEAD synthesizes:
   │  a. Collects all teammate reports
   │  b. Verifies completeness (all files processed, all pipelines completed)
   │  c. Merges worktree branches sequentially
   │  d. Produces consolidated report
   │
6. CLEANUP: shutdown teammates → TeamDelete
   │
7. USER sees consolidated report with all 9 files' results
```

**Fallback** (Agent Teams disabled): Same skill detects TeamCreate failure, falls back to
sequential Agent calls — one per batch, processed serially. Same report format.

### CI/CD Operation (GitHub Actions)

```
1. PR opened with changes to themes/foreign-policy-2017/helpers/posts.php
   │
2. GitHub Action triggers:
   │  claude --agent docs-modify \
   │    --headless \
   │    --permission-mode bypassPermissions \
   │    "Auto-update docs for changed files: helpers/posts.php"
   │
3. Same engine lifecycle as above (steps 3-7)
   │
4. Claude commits doc changes to PR branch
   │
5. (Optional) Second job: claude --agent docs-validate --headless "Verify all docs"
```

---

## 8. CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/docs-auto-update.yml
name: Auto-update documentation

on:
  pull_request:
    paths:
      - 'wordpress/wp-content/themes/foreign-policy-2017/**'
    types: [opened, synchronize]

jobs:
  update-docs:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write

    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.head_ref }}

      - name: Install Claude Code
        run: npm install -g @anthropic-ai/claude-code

      - name: Detect changed source files
        id: changes
        run: |
          CHANGED=$(git diff --name-only ${{ github.event.pull_request.base.sha }}..HEAD \
            -- 'wordpress/wp-content/themes/foreign-policy-2017/' \
            | grep -v '^wordpress/wp-content/themes/foreign-policy-2017/docs/' \
            | tr '\n' ' ')
          echo "files=$CHANGED" >> $GITHUB_OUTPUT

      - name: Auto-update documentation
        if: steps.changes.outputs.files != ''
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          cd wordpress/wp-content
          claude --agent docs-modify \
            --headless \
            --permission-mode bypassPermissions \
            "Auto-update documentation for changed files: ${{ steps.changes.outputs.files }}"

      - name: Commit doc updates
        run: |
          git config user.name "Claude Code Bot"
          git config user.email "claude-bot@foreignpolicy.com"
          git add wordpress/wp-content/themes/foreign-policy-2017/docs/
          git diff --cached --quiet || git commit -m "docs: auto-update for PR #${{ github.event.number }}"
          git push

  verify-docs:
    needs: update-docs
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Verify documentation
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          cd wordpress/wp-content
          claude --agent docs-validate \
            --headless \
            --permission-mode bypassPermissions \
            "Run verification checklist on all docs"
```

### Headless Mode Considerations

- **Permission mode**: `bypassPermissions` in CI (no interactive prompts)
- **API key**: Stored as GitHub secret
- **Scope**: CI runs should be focused (specific files, not `--all`)
- **Output**: Results returned as JSON for parsing by subsequent steps
- **Cost management**: Use `maxTurns` to limit engine work in CI
- **Plugin availability**: The fp-docs plugin must be installed in the CI environment (via project `.claude/plugins/` reference or local install)

### CI Parallel Mode (Optional)

For PRs affecting many source files, the CI workflow can use `/fp-docs:parallel` for faster processing:

```yaml
- name: Auto-update documentation (parallel — large PRs)
  if: steps.changes.outputs.file_count > 5
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
    CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1"
  run: |
    cd wordpress/wp-content
    claude --headless \
      --permission-mode bypassPermissions \
      "Run /fp-docs:parallel auto-update for changed files: ${{ steps.changes.outputs.files }}"
```

Parallel CI uses more tokens (N× per teammate) but completes faster. Recommended only for PRs with 5+ changed source files. See `orchestrate-spec.md` §8 for details.

---

## 9. Future MCP Integration Points

The architecture is designed to accommodate MCP servers without requiring them.

### Planned Integration Slots

| MCP Server | Integration Point | Engine(s) | Status |
|-----------|-------------------|-----------|--------|
| **Context7** | Skill module or engine `mcpServers:` field | docs-modify, docs-validate | PLANNED — for framework/library documentation lookup during doc writing |
| **RAG Graph** | Skill module or engine `mcpServers:` field | docs-modify, docs-validate | PLANNED — for codebase knowledge graph queries during doc operations |
| **Playwright** | Engine `mcpServers:` field | docs-validate (test subcommand) | PLANNED — for browser-based doc validation |
| **Sequential** | Engine `mcpServers:` field | docs-validate (complex reasoning) | PLANNED — for multi-step reasoning during audits |

### How Integration Works

When an MCP server is needed, it's added to the engine's subagent definition:

```yaml
# agents/docs-validate.md (future)
---
name: docs-validate
model: inherit
disallowedTools: [Write, Edit]
mcpServers:
  context7:
    command: npx
    args: ["-y", "@anthropic-ai/context7-server"]
  playwright:
    command: npx
    args: ["-y", "@anthropic-ai/playwright-mcp"]
---
```

The engine's instructions reference MCP tools when available, with fallback behavior when they're not:

```markdown
## Validation Step 6: Test against local environment
If Playwright MCP is available, use browser automation for visual checks.
Otherwise, use curl commands for HTTP-based checks.
```

This means MCP servers are optional enhancements, never hard dependencies.

---

## 10. Configuration

### System Config (`framework/config/system-config.md`)

System-level settings that control engine behavior:

```yaml
# Engine enables
engines:
  docs-modify: true
  docs-validate: true
  docs-citations: true
  docs-api-refs: true
  docs-locals: true
  docs-verbosity: true
  docs-index: true
  docs-system: true

# Pipeline configuration
pipeline:
  post_modify:
    stages: [verbosity, citations, api-refs, sanity-check, verify, changelog, index]
    mandatory: [verify, changelog]
    skippable_by_flag:
      verbosity: --no-verbosity
      citations: --no-citations
      api-refs: --no-api-ref
      sanity-check: --no-sanity-check
      index: --no-index

# Validation thresholds
validation:
  verify_total_checks: 10
  sanity_check_default_enabled: true
  sanity_check_multi_agent_threshold_docs: 5
  sanity_check_multi_agent_threshold_sections: 3

# Citation configuration
citations:
  enabled: true
  full_body_max_lines: 15
  signature_max_lines: 100
  include_line_numbers: true
  excerpt_comment_threshold: 5

# API Reference configuration
api_refs:
  enabled: true
  provenance_values: [PHPDoc, Verified, Authored]
  default_provenance: Verified
  phpdoc_provenance: PHPDoc

# Verbosity configuration
verbosity:
  enabled: true
  banned_phrases: [such as, including but not limited to, various, etc., and more, among others]
  chunk_size: 50
  checkpoint_interval: 25
```

### Project Config (`framework/config/project-config.md`)

FP-specific values hardcoded in the plugin:

```yaml
# Project identity
project:
  name: Foreign Policy
  theme_root: themes/foreign-policy-2017
  docs_root: docs
  wp_cli_prefix: "ddev wp"
  local_url: https://foreignpolicy.local/
  ssl: self-signed

# Source-to-docs mapping (FP-specific)
source_mapping:
  functions.php: docs/01-architecture/bootstrap-sequence.md
  inc/post-types/: docs/02-post-types/
  inc/taxonomies/: docs/03-taxonomies/
  inc/custom-fields/: docs/04-custom-fields/
  components/: docs/05-components/
  helpers/: docs/06-helpers/
  inc/shortcodes/: docs/07-shortcodes/
  inc/hooks/: docs/08-hooks/
  inc/rest-api/: docs/09-api/rest-api/
  inc/endpoints/: docs/09-api/custom-endpoints/
  layouts/: docs/10-layouts/
  features/: docs/11-features/
  # ... (complete mapping from current docs-system.md §4)

# Document type formats
doc_types:
  post-type: framework/modules/standards.md#post-type-template
  taxonomy: framework/modules/standards.md#taxonomy-template
  helper: framework/modules/standards.md#helper-template
  # ... (all 10+ types)

# Appendix cross-references
appendices:
  hooks: docs/24-appendices/A-complete-hook-registry.md
  shortcodes: docs/24-appendices/B-shortcode-quick-reference.md
  rest_routes: docs/24-appendices/C-rest-route-reference.md
  constants: docs/24-appendices/D-constants-reference.md
  dependencies: docs/24-appendices/E-third-party-dependencies.md
  acf_fields: docs/24-appendices/F-acf-field-group-reference.md
  features: docs/24-appendices/G-feature-template-catalog.md
```

---

## 11. Migration Strategy

### Approach: Big-Bang Switch

1. **Build the plugin** at `fp-docs-system/` (separate directory or repo) while 1.0 continues operating
2. **Install the plugin** into the FP project (local scope)
3. **Validate** by running 2.0 engines against the same docs 1.0 manages
4. **Switch**: Remove 1.0 instruction files and skills from project `.claude/`; remove `docs/claude-code-docs-system/` directory
5. **Clean docs/**: Remove all system files from `docs/`, leaving only content + trackers

### Migration Checklist

- [ ] Plugin manifest created (`.claude-plugin/plugin.json`)
- [ ] All 8 engine subagents created and tested (`agents/`)
- [ ] All 10 shared skill modules created from extracted standards sections (`skills/docs-mod-*/`)
- [ ] All 18 user-facing skills created and tested + 1 orchestration skill (`skills/*/`)
- [ ] All hooks registered in `hooks/hooks.json`
- [ ] All hook scripts created in `scripts/`
- [ ] Framework instruction files created (`framework/instructions/`)
- [ ] Framework module files extracted and created (`framework/modules/`)
- [ ] System and project config populated (`framework/config/`)
- [ ] System manifest created (`framework/manifest.md`)
- [ ] Pipeline module tested (all stages fire correctly)
- [ ] CI/CD workflow file created and tested
- [ ] Every 1.0 command tested against 2.0 equivalent to verify identical output
- [ ] Plugin installed in FP project and validated
- [ ] Old system files removed from `docs/claude-code-docs-system/`
- [ ] Old skills removed from project `.claude/skills/`
- [ ] Old system archived (git tag) and removed

### SuperClaude Dependency Elimination

Every SuperClaude feature used by Docs System 1.0 has a native Claude Code equivalent in 2.0. This table maps every dependency to its replacement — zero capability loss.

| SuperClaude Feature | What It Did | 2.0 Native Equivalent | Notes |
|---|---|---|---|
| **Serena MCP** | Memory management, project context persistence | `memory: project` field on subagent YAML | Auto-creates `.claude/agent-memory/{engine}/MEMORY.md` |
| **Mindbase MCP** | Memory management (secondary) | `memory: project` field on subagent YAML | Same as above — one mechanism replaces both |
| `/sc:task` | Task orchestration and delegation | Agent tool (`general-purpose`) + TaskCreate/TaskUpdate | Agent Teams for parallel work |
| `/sc:analyze` | Code analysis | Custom subagent engines (docs-validate, docs-citations) | Purpose-built engines > generic analyzer |
| `/sc:spawn` | Multi-agent delegation | Agent Teams (TeamCreate + Agent tool) | Better than SC — native coordination, worktree isolation |
| `/sc:index-repo` | Repository indexing (PROJECT_INDEX.md) | `docs-index` engine (`update-project-index` operation) | Same output format, engine-based execution |
| `/sc:index` | Comprehensive project documentation | The entire Docs System 2.0 | This IS what the full docs system does |
| `/sc:load` / `/sc:save` | Session lifecycle | SessionStart hook + `memory: project` | Manifest injection replaces manual load |
| `/sc:recommend` | Command routing | Skill descriptions + Claude's native routing | Claude reads skill descriptions and routes automatically |
| **Context7 MCP** | Framework/library doc lookup | Optional `mcpServers:` field on engines | PLANNED, not required — engines work without it |
| **Sequential MCP** | Multi-step structured reasoning | Native Claude reasoning + subagent context | Subagent context provides isolated reasoning space |
| **Playwright MCP** | Browser-based testing | Optional `mcpServers:` field on docs-validate | PLANNED, not required — curl fallback for `/fp-docs:test` |
| **MODE_Task_Management** | TodoWrite orchestration for >3 steps | TaskCreate/TaskUpdate + Agent Teams | Native Claude Code task management |
| **MODE_Orchestration** | Smart tool selection + parallelism | Skill routing + `/fp-docs:parallel` orchestration | Engine architecture handles routing; orchestration skill handles parallelism |
| **FLAGS.md** | `--think`, `--delegate`, etc. | Docs system flags (`--no-citations`, `--depth`, etc.) | Domain-specific flags replace generic framework flags |
| **RULES.md** | Behavioral rules | `docs-mod-standards` + `docs-mod-pipeline` modules | Rules embedded in shared modules, not external framework |
| **15 `/sc:` skill invocations** | Various SuperClaude commands in skill files | Removed — skills invoke engines directly | No routing layer needed |

### Preservation Guarantee

Every feature in 1.0 maps to a specific 2.0 component:

| 1.0 Feature | 2.0 Location | Verified |
|-------------|-------------|----------|
| 10-point verification | `skills/docs-mod-validation/SKILL.md` | [ ] |
| Zero-tolerance sanity-check | `skills/docs-mod-validation/SKILL.md` | [ ] |
| Citation 3-tier provenance | `skills/docs-mod-citations/SKILL.md` | [ ] |
| Verbosity enforcement | `skills/docs-mod-verbosity/SKILL.md` | [ ] |
| API ref table format | `skills/docs-mod-api-refs/SKILL.md` | [ ] |
| Locals contracts | `skills/docs-mod-locals/SKILL.md` | [ ] |
| Source-to-docs mapping | `skills/docs-mod-project/SKILL.md` | [ ] |
| Flag design patterns | Skill `$ARGUMENTS` parsing | [ ] |
| Revision tracker | Unchanged (`docs/needs-revision-tracker.md`) | [ ] |
| Depth requirements | `skills/docs-mod-standards/SKILL.md` | [ ] |
| Cross-reference requirements | `skills/docs-mod-standards/SKILL.md` | [ ] |
| All 10+ document templates | `skills/docs-mod-standards/SKILL.md` | [ ] |
| `[NEEDS INVESTIGATION]` tagging | `skills/docs-mod-validation/SKILL.md` | [ ] |
| Changelog system | `skills/docs-mod-changelog/SKILL.md` | [ ] |
| PROJECT-INDEX | `skills/docs-mod-index/SKILL.md` | [ ] |

---

## 12. Registration Chain (replaces 1.0 chain)

When adding a new command or changing system behavior, update in order:

1. **Framework module** (if new rules) → `framework/modules/`
2. **Instruction file** (if new operation) → `framework/instructions/`
3. **Engine subagent** (if new engine or changed preloads) → `agents/`
4. **Skill module** (if engine needs new preloaded knowledge) → `skills/docs-mod-*/`
5. **User skill** (if new user command) → `skills/*/`
6. **System manifest** (if new engine or command) → `framework/manifest.md`
7. **Pipeline module** (if new pipeline stage) → `framework/modules/pipeline-rules.md`
8. **Hooks** (if new lifecycle event) → `hooks/hooks.json` + `scripts/`
9. **CLAUDE.md** (if new user-facing command) → project's `.claude/CLAUDE.md` skills table
10. **CI/CD workflow** (if command should run in CI) → `.github/workflows/`

> **Note**: All paths in steps 1-8 are relative to the plugin root. Step 9 is in the consuming project. Step 10 is in the project's GitHub repo.

---

## 13. Open Questions — ALL RESOLVED

1. ~~**Skill module context budget**~~: **RESOLVED** — Set `disable-model-invocation: true` on all 10 `docs-mod-*` shared modules. They are internal-only (not user-invocable) and don't need to appear in the skill selection UI. Only the 18 user skills remain invocable, well within the 2% context budget.

2. ~~**Engine subagent model selection**~~: **RESOLVED** — Two-tier strategy. Complex engines requiring deep code analysis (docs-modify, docs-validate, docs-citations, docs-api-refs, docs-locals) use `model: inherit` to match the main conversation model. Lightweight engines doing structural or scanning work (docs-index, docs-system, docs-verbosity) use `model: sonnet` for cost efficiency. See `engine-contract-spec.md` §6 Model Tiering Strategy.

3. ~~**Memory curation**~~: **RESOLVED** — Engines update MEMORY.md only when learning something genuinely new (new patterns, new project conventions, corrected assumptions). NOT on every operation. This avoids noise and keeps memory files high-signal.

4. ~~**Batch parallelism**~~: **RESOLVED** — The orchestration layer (`orchestrate-spec.md`) addresses this. `/fp-docs:parallel` creates an Agent Team with 2-5 teammates, each processing a batch of files independently. Falls back to sequential when teams are disabled. Opt-in only (never default) to control token cost. Max 5 teammates, 4-6 files each.

5. ~~**Plugin packaging timeline**~~: **RESOLVED** — Building as an FP-scoped plugin from the start. The plugin is installed locally for the FP project. Genericization is a future reference exercise, not a current design goal.

6. ~~**Agent Teams stability**~~: **RESOLVED** — Ship `/fp-docs:parallel` as a documented opt-in feature. The sequential fallback guarantees all functionality without the experimental Agent Teams flag. Users who want parallel batch processing can enable it when ready; the core system works without it.
