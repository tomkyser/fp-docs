# fp-docs Architecture Research

> **Updated 2026-03-04**: Added multi-agent orchestration architecture (orchestrate engine, mod-orchestration module, pipeline phase delegation, delegation vs standalone modes, git serialization).

Thorough analysis of the fp-docs Claude Code plugin internals: engine-skill routing, module system, pipeline, hooks, algorithms, git model, permissions, and configuration.

---

## 1. Repository Layout and File Inventory

The fp-docs repository has a two-level nesting structure:

```
fp-docs/                              # Git root (marketplace container)
├── .claude-plugin/
│   └── marketplace.json              # fp-tools marketplace definition
├── CHANGELOG.md
├── README.md
├── LICENSE
├── planning/                         # Dev planning docs (not part of plugin)
└── plugins/
    └── fp-docs/                      # THE ACTUAL PLUGIN (install target)
        ├── .claude-plugin/
        │   └── plugin.json           # Plugin manifest v2.7.1
        ├── settings.json             # Default permissions
        ├── hooks/
        │   └── hooks.json            # 4 hook event definitions
        ├── agents/                   # 9 engine agent definitions
        │   ├── orchestrate.md
        │   ├── modify.md
        │   ├── validate.md
        │   ├── citations.md
        │   ├── api-refs.md
        │   ├── locals.md
        │   ├── verbosity.md
        │   ├── index.md
        │   └── system.md
        ├── modules/                  # 11 shared modules (preloaded)
        │   ├── mod-standards/SKILL.md
        │   ├── mod-project/SKILL.md
        │   ├── mod-pipeline/SKILL.md
        │   ├── mod-changelog/SKILL.md
        │   ├── mod-index/SKILL.md
        │   ├── mod-citations/SKILL.md
        │   ├── mod-api-refs/SKILL.md
        │   ├── mod-locals/SKILL.md
        │   ├── mod-validation/SKILL.md
        │   ├── mod-verbosity/SKILL.md
        │   └── mod-orchestration/SKILL.md
        ├── skills/                   # 19 user-facing commands
        │   ├── revise/SKILL.md
        │   ├── add/SKILL.md
        │   ├── auto-update/SKILL.md
        │   ├── auto-revise/SKILL.md
        │   ├── deprecate/SKILL.md
        │   ├── audit/SKILL.md
        │   ├── verify/SKILL.md
        │   ├── sanity-check/SKILL.md
        │   ├── test/SKILL.md
        │   ├── citations/SKILL.md
        │   ├── api-ref/SKILL.md
        │   ├── locals/SKILL.md
        │   ├── verbosity-audit/SKILL.md
        │   ├── update-index/SKILL.md
        │   ├── update-claude/SKILL.md
        │   ├── update-skills/SKILL.md
        │   ├── setup/SKILL.md
        │   ├── sync/SKILL.md
        │   └── parallel/SKILL.md
        ├── scripts/                  # 7 bash scripts (hooks + utility)
        │   ├── inject-manifest.sh
        │   ├── branch-sync-check.sh
        │   ├── post-modify-check.sh
        │   ├── post-orchestrate-check.sh
        │   ├── teammate-idle-check.sh
        │   ├── task-completed-check.sh
        │   └── docs-commit.sh
        └── framework/
            ├── manifest.md           # System manifest v2.7.1
            ├── config/
            │   ├── system-config.md  # Feature flags, thresholds
            │   └── project-config.md # FP-specific paths and mappings
            ├── algorithms/           # 6 on-demand algorithm files
            │   ├── verbosity-algorithm.md
            │   ├── citation-algorithm.md
            │   ├── api-ref-algorithm.md
            │   ├── validation-algorithm.md
            │   ├── codebase-analysis-guide.md
            │   └── git-sync-rules.md
            └── instructions/         # Per-engine instruction files
                ├── orchestrate/      # delegate.md
                ├── modify/           # revise.md, add.md, auto-update.md, auto-revise.md, deprecate.md
                ├── validate/         # audit.md, verify.md, sanity-check.md, test.md
                ├── citations/        # generate.md, update.md, verify.md, audit.md
                ├── api-refs/         # generate.md, audit.md
                ├── locals/           # annotate.md, contracts.md, cross-ref.md, validate.md, shapes.md, coverage.md
                ├── verbosity/        # audit.md
                ├── index/            # update.md, update-example-claude.md
                └── system/           # update-skills.md, setup.md, sync.md
```

Key distinction: The repo root (`fp-docs/`) is the marketplace container. The installable plugin is at `fp-docs/plugins/fp-docs/`. When using `--plugin-dir` for local dev, point at the inner path.

---

## 2. Plugin Manifest and Marketplace

### plugin.json (plugins/fp-docs/.claude-plugin/plugin.json)

```json
{
  "name": "fp-docs",
  "version": "2.7.1",
  "description": "Documentation management system for the Foreign Policy WordPress codebase...",
  "author": { "name": "Tom Kyser" },
  "repository": "https://github.com/tomkyser/fp-docs",
  "license": "MIT"
}
```

The `plugin.json` declares the plugin identity. Claude Code reads this to discover the plugin name, version, and description. Module discovery is enabled by having `"skills": "./modules/"` in plugin.json (per CLAUDE.md), though the actual file only contains the fields shown above.

### marketplace.json (fp-docs/.claude-plugin/marketplace.json)

```json
{
  "name": "fp-tools",
  "plugins": [
    {
      "name": "fp-docs",
      "source": "./plugins/fp-docs",
      "description": "Documentation management system..."
    }
  ]
}
```

The marketplace container (`fp-tools`) can host multiple plugins. Currently it contains only `fp-docs`.

### settings.json (plugins/fp-docs/settings.json)

```json
{
  "permissions": {
    "allow": ["Read", "Grep", "Glob"]
  }
}
```

Default permissions are read-only. Individual engines override this via their agent frontmatter (e.g., `modify` adds Write, Edit, Bash).

---

## 3. Engine-Skill Routing Pattern

This is the core architectural pattern. All 19 user commands now route through the **orchestrate** engine, which acts as a universal dispatcher. The orchestrator parses routing metadata embedded in each skill, classifies the command, and delegates to the appropriate specialist engine.

```
User types: /fp-docs:revise "fix the posts helper"
    │
    ▼
Skill file: skills/revise/SKILL.md
    │  - Declares agent: orchestrate
    │  - Declares context: fork (isolated subagent)
    │  - Body provides routing metadata:
    │      Engine: modify
    │      Operation: revise
    │      Instruction: framework/instructions/modify/revise.md
    │  - Passes $ARGUMENTS to orchestrator
    │
    ▼
Orchestrate engine: agents/orchestrate.md
    │  - Parses routing metadata (Engine, Operation, Instruction)
    │  - Classifies command (write vs read-only)
    │  - Determines delegation strategy (multi-agent vs fast-path)
    │  - Delegates to specialist engine(s) with pipeline phase assignments
    │
    ▼
Specialist engine: agents/modify.md (Delegation Mode)
    │  - YAML frontmatter: tools, skills (modules), model, maxTurns
    │  - System prompt: identity, how-you-work steps
    │  - Engine reads instruction file: framework/instructions/modify/revise.md
    │  - Executes assigned pipeline phases only
    │
    ▼
Pipeline phases (Write → Review → Finalize)
    │  - Coordinated across multiple agents by orchestrator
    │  - Reads on-demand algorithm files at each stage
    │  - Uses preloaded module rules
    │
    ▼
Orchestrator aggregates results → Structured report returned to user
```

### Skill Anatomy

Skills are thin routing files. Every user skill declares `agent: orchestrate` and provides routing metadata for the orchestrator:

```yaml
---
description: Human-readable description for Claude Code UI
argument-hint: "expected arguments"
context: fork              # Always fork — runs in isolated subagent
agent: orchestrate         # All skills route through orchestrator
---

Engine: modify
Operation: revise
Instruction: framework/instructions/modify/revise.md

User request: $ARGUMENTS
```

Key properties:
- `context: fork` means the skill runs as an isolated subagent, not in the main conversation
- `agent: orchestrate` routes all commands through the universal orchestrator
- The skill body provides routing metadata: `Engine:` (target specialist), `Operation:` (operation name), `Instruction:` (instruction file path)
- `$ARGUMENTS` is a Claude Code variable containing the user's input after the command name
- The orchestrator parses these fields, classifies the command, and delegates to the specialist engine

### Subcommand Skills (citations, locals, api-ref)

Some skills handle multiple subcommands. The citations skill, for example:

```yaml
---
agent: citations
context: fork
---
$ARGUMENTS

Parse the first word as the subcommand (generate|update|verify|audit).
Read the instruction file at `framework/instructions/citations/{subcommand}.md` and follow it exactly.
```

The skill body parses the subcommand from arguments and dynamically routes to the right instruction file.

### Complete Command-to-Engine Routing Table

All 19 commands declare `agent: orchestrate` in their skill frontmatter. The orchestrator reads the routing metadata and delegates to the specialist engine listed below.

| Command | Skill | Specialist Engine | Operation |
|---------|-------|-------------------|-----------|
| /fp-docs:revise | skills/revise | modify | revise |
| /fp-docs:add | skills/add | modify | add |
| /fp-docs:auto-update | skills/auto-update | modify | auto-update |
| /fp-docs:auto-revise | skills/auto-revise | modify | auto-revise |
| /fp-docs:deprecate | skills/deprecate | modify | deprecate |
| /fp-docs:audit | skills/audit | validate | audit |
| /fp-docs:verify | skills/verify | validate | verify |
| /fp-docs:sanity-check | skills/sanity-check | validate | sanity-check |
| /fp-docs:test | skills/test | validate | test |
| /fp-docs:citations | skills/citations | citations | generate/update/verify/audit |
| /fp-docs:api-ref | skills/api-ref | api-refs | generate/audit |
| /fp-docs:locals | skills/locals | locals | annotate/contracts/cross-ref/validate/shapes/coverage |
| /fp-docs:verbosity-audit | skills/verbosity-audit | verbosity | audit |
| /fp-docs:update-index | skills/update-index | index | update-project-index |
| /fp-docs:update-claude | skills/update-claude | index | update-example-claude |
| /fp-docs:update-skills | skills/update-skills | system | update-skills |
| /fp-docs:setup | skills/setup | system | setup |
| /fp-docs:sync | skills/sync | system | sync |
| /fp-docs:parallel | skills/parallel | system | (batch orchestration) |

---

## 4. The 9 Engine Agents

Each engine is a markdown file in `agents/` with YAML frontmatter and a system prompt body.

### Engine Frontmatter Schema

```yaml
---
name: engine-name
description: |
  Multi-line description with examples.
  <example>
  User: /fp-docs:command args
  <commentary>
  Context about when this triggers.
  </commentary>
  </example>
tools:
  - Read
  - Write           # Only modify-capable engines
  - Edit             # Only modify-capable engines
  - Grep
  - Glob
  - Bash
disallowedTools:     # Read-only engines
  - Write
  - Edit
skills:              # Modules to preload
  - mod-standards
  - mod-project
  - mod-pipeline     # Only modify
model: opus          # Model selection
color: green         # UI color in Claude Code
maxTurns: 75         # Max conversation turns
---
```

### Engine Inventory

| Engine | File | Model | MaxTurns | Color | Can Write? | Modules Preloaded |
|--------|------|-------|----------|-------|------------|-------------------|
| orchestrate | agents/orchestrate.md | opus | 100 | white | YES | mod-standards, mod-project, mod-orchestration |
| modify | agents/modify.md | opus | 75 | green | YES | mod-standards, mod-project, mod-pipeline, mod-changelog, mod-index |
| validate | agents/validate.md | opus | 75 | cyan | NO (disallowed) | mod-standards, mod-project, mod-validation |
| citations | agents/citations.md | opus | 75 | yellow | YES | mod-standards, mod-project, mod-citations |
| api-refs | agents/api-refs.md | opus | 75 | yellow | YES | mod-standards, mod-project, mod-api-refs |
| locals | agents/locals.md | opus | 75 | magenta | YES | mod-standards, mod-project, mod-locals |
| verbosity | agents/verbosity.md | opus | 50 | red | NO (disallowed) | mod-standards, mod-project, mod-verbosity |
| index | agents/index.md | opus | 50 | blue | YES | mod-standards, mod-project, mod-index |
| system | agents/system.md | opus | 50 | blue | YES | mod-standards, mod-project |

NOTE: The manifest.md says verbosity, index, and system use `model: sonnet`, but the actual agent files all declare `model: opus`. The agent files are the source of truth.

### Engine System Prompt Pattern

Every engine follows the same structure:
1. **Identity** section: engine name, domain, operations
2. **Plugin Root** section: explains how `{plugin-root}` is injected via SessionStart hook
3. **Step 1: Parse the Request**: extract operation, target, flags from the skill prompt
4. **Step 2: Load the Instruction File**: read the operation-specific instruction file from `framework/instructions/{engine}/{operation}.md`
5. **Step 3: Execute**: follow the instruction file, using preloaded modules for rules
6. **Step 4: Pipeline** (write engines only): run post-modification pipeline stages
7. **Step 5: Report**: return structured report in a defined format
8. **Memory Management**: guidance on what to persist in agent memory
9. **Git Awareness**: docs vs codebase repo separation rules
10. **Critical Rules**: 10 inviolable rules for the engine

### Permission Model

The permission model operates at three levels:

1. **Plugin default** (settings.json): Read, Grep, Glob only
2. **Engine agent** (frontmatter `tools:`): adds Write, Edit, Bash for write-capable engines
3. **Engine agent** (frontmatter `disallowedTools:`): explicitly blocks Write, Edit for read-only engines

**Write-capable engines**: orchestrate, modify, citations, api-refs, locals, index, system
**Read-only engines**: validate, verbosity (explicitly disallow Write and Edit)

The `audit` skill additionally declares `allowed-tools` in its skill frontmatter, restricting to Read, Grep, Glob, Bash.

---

## 5. Module System

### Module Architecture

Modules are shared rule files in `modules/mod-{name}/SKILL.md`. They use Claude Code's skill primitive but are NOT user-invocable.

### Module Anatomy

```yaml
---
name: mod-standards
description: "Shared module providing documentation formatting..."
user-invocable: false          # Cannot be triggered by user command
disable-model-invocation: true # Prevents model from invoking it spontaneously
---

# Documentation Standards Module

[Rule content here...]
```

Key properties:
- `user-invocable: false`: the module cannot be called as a slash command
- `disable-model-invocation: true`: prevents Claude from deciding to call it as a tool
- Modules are preloaded into engines via the engine's `skills:` frontmatter list

### Module Deduplication Rules

1. Each rule lives in exactly ONE module — no duplication across modules
2. Engines preload modules via `skills:` frontmatter — modules don't know about engines
3. FP-specific values (paths, mappings, enables) live in `mod-project`
4. Domain rules (citation format, verbosity rules) live in domain-specific modules
5. Universal rules (formatting, naming, depth) live in `mod-standards`

### Module Preloading Matrix

| Module | Purpose | Preloaded By |
|--------|---------|-------------|
| mod-standards | Formatting, naming, structural, depth rules | ALL 9 engines |
| mod-project | FP paths, source-to-doc mapping, environment | ALL 9 engines |
| mod-pipeline | 8-stage post-modification pipeline definition | modify only |
| mod-changelog | Changelog entry format and update procedure | modify (preloaded) |
| mod-index | PROJECT-INDEX.md update rules and triggers | modify (preloaded), index |
| mod-citations | Citation format, tiers, staleness, provenance | modify, citations |
| mod-api-refs | API Reference table format, scope, provenance | modify, api-refs |
| mod-locals | $locals contract format, shapes, validation | modify, locals |
| mod-validation | 10-point checklist, sanity-check algorithm | modify, validate |
| mod-verbosity | Anti-brevity rules, banned phrases, manifests | modify, verbosity |
| mod-orchestration | Orchestration rules, delegation thresholds, pipeline phase assignments, team protocol, git serialization rules | orchestrate |

The `modify` engine is the most heavily loaded — it preloads 5 modules directly (mod-standards, mod-project, mod-pipeline, mod-changelog, mod-index) and accesses domain module rules indirectly through the pipeline stages.

### Module Content Summary

**mod-standards**: Universal formatting rules. File naming conventions (kebab-case, `_index.md`), directory structure rules, 10 document format templates (post type, taxonomy, helper, hook, shortcode, REST, component, JS, ACF, integration), content rules (present tense, relative paths, backtick code refs), depth requirements per system type, cross-reference requirements (appendix update triggers), and 15 integrity rules.

**mod-project**: FP-specific configuration. Project identity (theme root, docs root, WP-CLI prefix, local URL, PHP namespace), source-to-documentation mapping table (30+ source→doc path pairs), appendix cross-reference table, key paths (docs hub, changelog, tracker, index, shapes, flagged concerns), feature enable flags.

**mod-pipeline**: Defines the 8-stage post-modification pipeline (see section 6 below). Includes pipeline trigger matrix, skip conditions, completion marker format, and validation rules.

**mod-changelog**: Changelog entry format (`### YYYY-MM-DD -- [Short Title]`), the 4-step update procedure (read, determine month header, append entry, validate), and mandatory rules (every operation must log, list every file, describe why).

**mod-index**: PROJECT-INDEX.md update procedure. Three modes (quick/update/full), git consistency rules (use `git ls-tree` not filesystem), branch name recording, preserve manual annotations.

**mod-citations**: Citation block format (`> **Citation** ...`), marker structure, three tiers (Full/Signature/Reference), placement rules, excerpt rules, freshness model (Fresh/Stale/Drifted/Broken/Missing), scope table.

**mod-api-refs**: API Reference section structure (heading + legend + table + citations), 5 table columns (Function, Params, Return, Description, Src), provenance rules (PHPDoc/Verified/Authored), scope table (which doc types require API refs), completeness rule, placement rule, row ordering.

**mod-locals**: `@locals` PHPDoc format, block grammar, `@controller` format for HTMX components, locals contracts section format in docs, data flow section, 6 shared shapes, shape reference syntax, integer-indexed locals, Required vs Optional classification table, ground truth engine (WP-CLI `wp fp-locals`).

**mod-validation**: 10-point verification checklist (file existence, orphan check, index completeness, appendix spot-check, link validation, changelog check, citation format, API ref provenance, locals contracts, verbosity compliance), report format, sanity-check algorithm with zero-tolerance principle, claim classification (VERIFIED/MISMATCH/HALLUCINATION/UNVERIFIABLE), confidence levels (HIGH/LOW).

**mod-verbosity**: Anti-compression directives, banned phrases (15 phrases + 4 regex patterns), scope manifest format (binding contract with item counts), self-audit protocol (4-step after each section), context window management (Tier 1: chunk-and-delegate, Tier 2: checkpoint-and-continue), delegation thresholds (max 8 docs, max 50 functions per agent).

---

## 6. The 8-Stage Post-Modification Pipeline

Defined in `mod-pipeline` and executed by the `modify` engine after every doc-modifying operation. Other engines (citations, api-refs, locals) run a subset.

### Pipeline Stages

| Stage | Name | Algorithm File | Module | Skip Condition |
|-------|------|----------------|--------|----------------|
| 1 | Verbosity Enforcement | verbosity-algorithm.md | mod-verbosity | `verbosity.enabled` = false in system-config |
| 2 | Citation Generation/Update | citation-algorithm.md | mod-citations | `citations.enabled` = false in system-config |
| 3 | API Reference Sync | api-ref-algorithm.md | mod-api-refs | `api_ref.enabled` = false in system-config |
| 4 | Sanity-Check | validation-algorithm.md | mod-validation | `--no-sanity-check` flag |
| 5 | Verification (10-point) | validation-algorithm.md | mod-validation | NEVER skipped |
| 6 | Changelog Update | (preloaded mod-changelog) | mod-changelog | NEVER skipped |
| 7 | Index Update | (preloaded mod-index) | mod-index | Only runs on structural changes |
| 8 | Docs Repo Commit | (inline in engine prompt) | — | NEVER skipped (attempts if docs repo exists) |

### Stage Details

**Stage 1 — Verbosity Enforcement**: Build a scope manifest by counting every documentable item in the source files. After generating/updating docs, compare output counts against manifest targets. Scan for banned summarization phrases. Any shortfall blocks the operation. Zero-tolerance gap.

**Stage 2 — Citation Generation/Update**: For new docs, generate all citations. For revised docs, run staleness detection (parse existing citations, locate current source, compare symbols/lines/excerpts), classify as Fresh/Stale/Drifted/Broken, and fix. Tier selection: Full (body <=15 lines), Signature (16-100 lines), Reference (>100 lines or tables).

**Stage 3 — API Reference Sync**: Check if the doc type requires an API Reference table (per system-config scope table). If yes, verify the section exists, update rows for changed functions, add new rows, remove deleted rows, ensure every row has a provenance value.

**Stage 4 — Sanity-Check**: Cross-reference every factual claim in the modified documentation against source code. Classify claims as VERIFIED, MISMATCH, HALLUCINATION, or UNVERIFIABLE. If confidence is LOW, resolve all issues before proceeding (tag unresolvable items with `[NEEDS INVESTIGATION]`).

**Stage 5 — Verification**: Run all 10 checks from mod-validation: file existence, orphan check, index completeness, appendix spot-check, link validation, changelog check, citation format, API ref provenance, locals contracts, verbosity compliance. Report PASS/FAIL per check.

**Stage 6 — Changelog Update**: Append an entry to `docs/changelog.md` under today's date. List every file created/modified/removed. Describe WHY the change was made.

**Stage 7 — Index Update**: Only triggers when structural changes occurred (new sections, major reorganization). For content-only changes, this stage is skipped.

**Stage 8 — Docs Repo Commit**: `git -C {docs-root} add -A` then `git -C {docs-root} commit -m "fp-docs: {operation} -- {summary}"`. Skips silently if docs repo not initialized.

### Pipeline Trigger Matrix by Operation

| Operation | Stages Run |
|-----------|-----------|
| revise | All 8 (1-8) |
| add | All 8 (1-8) |
| auto-update | All 8 (1-8) |
| auto-revise | All 8 (1-8) |
| deprecate | All 8 (1-8) |
| citations generate | Stages 4-8 (skip 1-3, already done) |
| citations update | Stages 4-8 |
| api-refs generate | Stages 1, 2, 4-8 (skip 3, already done) |
| locals annotate | Stages 1, 2, 4-8 |
| locals contracts | Stages 1, 2, 4-8 |
| locals shapes | Stages 1, 2, 4-8 |

### Pipeline Phase Delegation

Under the multi-agent orchestration architecture, the 8-stage pipeline is split into 3 phases that can be distributed across specialist agents:

| Phase | Name | Stages | Owner |
|-------|------|--------|-------|
| Write Phase | Primary work + enrichment | Primary operation + stages 1-3 (verbosity, citations, API refs) | Primary specialist engine (e.g., modify) |
| Review Phase | Validation | Stages 4-5 (sanity-check, verification) | validate engine (read-only) |
| Finalize Phase | Record-keeping + commit | Stages 6-8 (changelog, index, docs commit) | orchestrate engine |

In **Delegation Mode** (the default for write operations), the orchestrator assigns the Write Phase to the primary specialist, spawns the validate engine for the Review Phase, and handles the Finalize Phase itself. This ensures git serialization: only the orchestrator commits to the docs repo.

In **Standalone Mode** (when a specialist engine runs outside orchestration), the engine executes all 8 stages itself as before.

For **read-only commands** (audit, verify, sanity-check, test, verbosity-audit), the orchestrator uses a fast path: it delegates directly to the specialist engine and returns results without the full 3-phase pipeline.

### Pipeline Completion Marker

When the pipeline completes, the engine outputs:
```
Pipeline complete: [verbosity: PASS] [citations: PASS] [sanity: HIGH] [verify: PASS] [changelog: updated] [docs-commit: committed|skipped]
```

This marker is checked by the SubagentStop hook (`post-modify-check.sh` or `post-orchestrate-check.sh`) to validate pipeline execution.

---

## 7. On-Demand Algorithms vs Preloaded Modules

The plugin has two categories of shared knowledge:

### Preloaded Modules (Always Available)

Modules in `modules/` are preloaded into engine agents via the `skills:` frontmatter. They are injected into the agent's context at startup and available throughout the session. Modules contain **rules and definitions** (formats, banned phrases, classification systems, scope tables).

### On-Demand Algorithm Files (Read During Execution)

Algorithm files in `framework/algorithms/` are NOT preloaded. They are READ by engines at specific pipeline stages using the `Read` tool. They contain **step-by-step execution procedures**.

| Algorithm File | When Loaded | Who Loads It |
|----------------|-------------|-------------|
| verbosity-algorithm.md | Pipeline stage 1 | modify, citations, api-refs, locals |
| citation-algorithm.md | Pipeline stage 2 | modify, citations |
| api-ref-algorithm.md | Pipeline stage 3 | modify, api-refs |
| validation-algorithm.md | Pipeline stages 4-5 | modify, validate |
| codebase-analysis-guide.md | When scanning source files | Any engine that scans PHP/JS source |
| git-sync-rules.md | On /fp-docs:sync or SessionStart branch detection | system engine, branch-sync-check.sh |

The distinction matters for context management. Modules are always in context (consuming tokens), while algorithms are loaded only when needed and can be discarded after the stage completes.

---

## 8. Instruction Files

Instruction files in `framework/instructions/{engine}/{operation}.md` contain the step-by-step procedure for each operation. They are the source of truth for how an operation behaves.

### Instruction File Pattern

Every instruction file follows this structure:

```markdown
# {Operation} -- Instruction

## Inputs
- `$ARGUMENTS`: what the user provided
- Preloaded modules: which modules are available

## Steps
1. Parse the user's request...
2. Read source/doc files...
3. Compare and identify discrepancies...
4. Build scope manifest...
5. Execute changes...
6-7. Handle secondary concerns (API refs, links)...

## Pipeline Trigger
Execute the post-modification pipeline:
1. Read verbosity-algorithm.md -> enforce verbosity
2. Read citation-algorithm.md -> update citations
3. Read api-ref-algorithm.md -> verify API reference
4. Read validation-algorithm.md -> sanity-check
5. Read validation-algorithm.md -> 10-point verification
6. Follow mod-changelog -> append entry
7. Follow mod-index -> update index if structural

## Output
Report: files changed, sanity-check result, verification result
```

### Complete Instruction File Inventory

| Engine | Instruction File | Operation |
|--------|-----------------|-----------|
| orchestrate | orchestrate/delegate.md | Multi-agent delegation and pipeline phase coordination |
| modify | modify/revise.md | Targeted doc fix |
| modify | modify/add.md | Create new doc for new code |
| modify | modify/auto-update.md | Git-diff-driven batch update |
| modify | modify/auto-revise.md | Process revision tracker items |
| modify | modify/deprecate.md | Mark docs as deprecated |
| validate | validate/audit.md | Compare docs vs source (3 depths) |
| validate | validate/verify.md | 10-point verification checklist |
| validate | validate/sanity-check.md | Zero-tolerance claim validation |
| validate | validate/test.md | Runtime tests against local env |
| citations | citations/generate.md | Create new citation blocks |
| citations | citations/update.md | Refresh stale citations |
| citations | citations/verify.md | Check citation format |
| citations | citations/audit.md | Deep citation accuracy check |
| api-refs | api-refs/generate.md | Generate API Reference tables |
| api-refs | api-refs/audit.md | Audit API refs against source |
| locals | locals/annotate.md | Add @locals PHPDoc to source |
| locals | locals/contracts.md | Generate contract tables in docs |
| locals | locals/cross-ref.md | Cross-reference caller chains |
| locals | locals/validate.md | Validate contracts against code |
| locals | locals/shapes.md | Generate shared shape definitions |
| locals | locals/coverage.md | Report $locals documentation coverage |
| verbosity | verbosity/audit.md | Scan for verbosity gaps |
| index | index/update.md | Update PROJECT-INDEX.md |
| index | index/update-example-claude.md | Regenerate CLAUDE.md template |
| system | system/update-skills.md | Regenerate skill files |
| system | system/setup.md | Initialize/verify installation |
| system | system/sync.md | Branch sync + diff reports |

---

## 9. Hook System

### hooks.json Structure

The hooks file defines 5 event types with 7 total hook scripts:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "bash \"${CLAUDE_PLUGIN_ROOT}/scripts/inject-manifest.sh\"" },
          { "type": "command", "command": "bash \"${CLAUDE_PLUGIN_ROOT}/scripts/branch-sync-check.sh\"" }
        ]
      }
    ],
    "SubagentStop": [
      {
        "matcher": "modify",
        "hooks": [
          { "type": "command", "command": "bash \"${CLAUDE_PLUGIN_ROOT}/scripts/post-modify-check.sh\"" }
        ]
      },
      {
        "matcher": "orchestrate",
        "hooks": [
          { "type": "command", "command": "bash \"${CLAUDE_PLUGIN_ROOT}/scripts/post-orchestrate-check.sh\"" }
        ]
      }
    ],
    "TeammateIdle": [
      {
        "hooks": [
          { "type": "command", "command": "bash \"${CLAUDE_PLUGIN_ROOT}/scripts/teammate-idle-check.sh\"" }
        ]
      }
    ],
    "TaskCompleted": [
      {
        "hooks": [
          { "type": "command", "command": "bash \"${CLAUDE_PLUGIN_ROOT}/scripts/task-completed-check.sh\"" }
        ]
      }
    ]
  }
}
```

### Hook Details

**1. SessionStart: inject-manifest.sh**
- Fires: Every session start
- Purpose: Injects the plugin root path (`$CLAUDE_PLUGIN_ROOT`) and the full content of `framework/manifest.md` into the session context via `additionalContext`
- This is how engines know where to find their instruction files and algorithms
- Output: JSON with `additionalContext` containing plugin root + manifest content

**2. SessionStart: branch-sync-check.sh**
- Fires: Every session start, after inject-manifest.sh
- Purpose: Detects the codebase branch and docs branch, warns on mismatch
- Logic: Uses `git -C` to get branch names from both repos. If they match, injects sync confirmation. If they mismatch, emits a `stopMessage` telling the user to run `/fp-docs:sync`
- Gracefully handles: not in a git repo (exits silently), docs repo not set up (suggests setup)

**3. SubagentStop: post-modify-check.sh**
- Fires: When the `modify` engine subagent stops (matcher: "modify")
- Purpose: Validates that the post-modification pipeline completed, specifically checking for changelog update
- Logic: Reads the agent transcript from stdin JSON, greps for "changelog.*updated". Exit 0 = pass, Exit 2 = warn
- If no changelog update detected, emits warning to stderr

**4. SubagentStop: post-orchestrate-check.sh**
- Fires: When the `orchestrate` engine subagent stops (matcher: "orchestrate")
- Purpose: Validates that the orchestrator completed its full delegation cycle, including pipeline phase coordination and git commit serialization
- Logic: Reads the agent transcript from stdin JSON, checks for pipeline completion markers across all delegated phases. Exit 0 = pass, Exit 2 = warn

**5. TeammateIdle: teammate-idle-check.sh**
- Fires: When a teammate agent goes idle during parallel/team operations
- Purpose: Validates that teammates completed their assigned pipeline phases before going idle
- Logic: Reads teammate transcript, checks for phase completion markers (Write Phase or Review Phase), warns if a teammate went idle without completing its assigned work

**6. TaskCompleted: task-completed-check.sh**
- Fires: When a task is marked completed during orchestration
- Purpose: Validates task outputs — checks for empty modifications, missing pipeline markers, and incomplete phase handoffs
- Logic: Reads task output, verifies the delegated work product contains expected deliverables (modified files, validation results, or pipeline markers depending on the task type)

### 7th Script: docs-commit.sh (Utility, Not a Hook)

`docs-commit.sh` is a utility script called by engines (not a hook). It commits all docs changes to the docs repo:
1. Detects codebase root via `git rev-parse --show-toplevel`
2. Resolves docs root to `{codebase-root}/themes/foreign-policy-2017/docs/`
3. Verifies docs repo exists
4. `git add -A` and `git commit` with provided message
5. Handles "nothing to commit" gracefully

---

## 10. Three-Repo Git Model

The fp-docs system operates across three completely independent git repositories:

### Repo 1: Codebase

- **Git root**: `wp-content/` (the WordPress content directory)
- **Scope**: The FP WordPress source code, primarily `themes/foreign-policy-2017/`
- **Key behavior**: `.gitignore` includes `themes/foreign-policy-2017/docs/` so the docs repo is invisible to the codebase repo
- **Remote**: origin (VIP Go deployment repo)
- **Git commands**: `git -C {codebase-root}`

### Repo 2: Docs

- **Git root**: `themes/foreign-policy-2017/docs/` (nested inside the codebase workspace)
- **Remote**: `https://github.com/tomkyser/docs-foreignpolicy-com` (private)
- **Branch strategy**: Branch-mirrored with the codebase. `docs/master` = canonical for `codebase/master`. Feature branches match names.
- **Key files**: changelog.md, needs-revision-tracker.md, About.md, PROJECT-INDEX.md, all documentation
- **Git commands**: `git -C {docs-root}` (NEVER use the codebase repo's git)

### Repo 3: Plugin

- **Git root**: Standalone (not nested in either repo)
- **Remote**: `https://github.com/tomkyser/fp-docs` (public)
- **Branch strategy**: master for all users
- **Distribution**: Via fp-tools marketplace or `--plugin-dir` for local dev

### Branch Mirroring Rules

1. Detect codebase branch: `git -C {codebase-root} branch --show-current`
2. Detect docs branch: `git -C {docs-root} branch --show-current`
3. If no matching docs branch exists: create from docs master, switch to it
4. If matching branch exists but docs is on wrong branch: switch
5. Generate diff report after sync

### Diff Report Generation

On sync, the system:
1. Gets codebase diff from master: `git diff --name-only origin/master...HEAD`
2. Filters to theme-scoped files only
3. Maps changed source files to affected doc files via the source-to-doc mapping
4. Classifies each as LIKELY STALE, POSSIBLY STALE, or STRUCTURAL
5. Writes report to `docs/diffs/{YYYY-MM-DD}_{branch}_diff_report.md`

### Path Resolution

- Codebase root: `git rev-parse --show-toplevel` from working directory
- Docs root: `{codebase-root}/themes/foreign-policy-2017/docs/`
- Plugin root: `$CLAUDE_PLUGIN_ROOT` (injected by SessionStart hook)
- All doc file paths: relative to theme root (`themes/foreign-policy-2017/`)

---

## 11. Configuration System

Two configuration files control behavior at different scopes:

### system-config.md — Feature Flags and Thresholds

Controls system-wide behavior independent of the specific FP project:

**Section 1 — Citations**:
- `citations.enabled`: true (master switch)
- `citations.full_body_max_lines`: 15 (tier boundary)
- `citations.signature_max_lines`: 100 (tier boundary)
- Citation scope table: which doc elements require citations and which tier

**Section 2 — General System**:
- `sanity_check.default_enabled`: true
- `sanity_check.multi_agent_threshold_docs`: 5
- `sanity_check.multi_agent_threshold_sections`: 3
- `verify.total_checks`: 10

**Section 3 — API Reference**:
- `api_ref.enabled`: true
- `api_ref.provenance_values`: PHPDoc, Verified, Authored
- API Reference scope table: which doc types require API refs
- API Reference table column definitions

**Section 4 — Verbosity Engine**:
- `verbosity.enabled`: true
- `verbosity.gap_tolerance`: 0 (zero tolerance)
- Chunk-and-delegate thresholds (max 8 docs, max 50 functions per agent)
- Complete banned phrases list (15 phrases + 4 regex patterns)

**Section 5 — Verification** (existing):
- `verify.total_checks`: 10

**Section 6 — Orchestration** (new):
- `orchestration.enabled`: true (master switch for multi-agent orchestration)
- `orchestration.delegation_threshold_docs`: threshold for triggering multi-agent delegation
- `orchestration.delegation_threshold_stages`: threshold for pipeline phase splitting
- `orchestration.max_team_size`: maximum agents in a batch team
- `orchestration.git_serialization`: true (only orchestrator commits in delegated mode)
- `orchestration.fast_path_read_only`: true (read-only commands skip full delegation)
- Phase assignment rules and specialist-to-phase mapping

### project-config.md — FP-Specific Configuration

Contains everything specific to the Foreign Policy WordPress project:

- Project identity: theme root, docs root, WP-CLI prefix, local URL, PHP namespace
- Source-to-documentation mapping: 20+ source directory to docs directory path pairs
- Appendix cross-references: 7 code pattern to appendix file mappings
- Feature enables: citations, API refs, locals, verbosity, sanity-check all enabled
- Repository configuration: git roots, remotes, branch strategy for all 3 repos
- Path resolution algorithm: how to find codebase root, docs root
- Diff report configuration: location, naming format, accumulation rules

### How Engines Access Configuration

Engines access configuration through two channels:
1. **Preloaded mod-project module**: Contains the FP-specific mappings and paths (always in context)
2. **system-config.md reference**: Engines reference system-config values by name (e.g., `citations.enabled`). The system-config is not preloaded as a module but is referenced in engine prompts and pipeline skip conditions.

---

## 12. End-to-End Flow Example

Here is a complete trace of what happens when a user runs `/fp-docs:revise "fix the posts helper documentation"`:

### Phase 1: Session Initialization (hooks fire before command)

1. **inject-manifest.sh** runs, injecting plugin root path and full manifest into context
2. **branch-sync-check.sh** runs, checking codebase vs docs branch. If matched, injects sync confirmation + docs root path

### Phase 2: Command Routing

3. User types `/fp-docs:revise "fix the posts helper documentation"`
4. Claude Code finds `skills/revise/SKILL.md` — sees `context: fork`, `agent: modify`
5. Claude Code spawns a subagent using `agents/modify.md` as the agent definition
6. The subagent gets: tools (Read, Write, Edit, Grep, Glob, Bash), preloaded modules (mod-standards, mod-project, mod-pipeline, mod-changelog, mod-index), and the session context from hooks

### Phase 3: Engine Execution

7. Engine parses the skill body: `Operation: revise`, `User request: fix the posts helper documentation`
8. Engine reads `framework/instructions/modify/revise.md`
9. Following the instruction file steps:
   - Identifies target: `docs/06-helpers/posts.md` (via mod-project mapping from `helpers/posts.php`)
   - Reads `docs/06-helpers/posts.md` (existing doc)
   - Reads `helpers/posts.php` (source code)
   - Compares, finds discrepancies
   - Reads `framework/algorithms/verbosity-algorithm.md`, builds scope manifest
   - Makes targeted edits to fix discrepancies (preserving accurate content)
   - Checks if API Reference section needs updating

### Phase 4: Post-Modification Pipeline

10. **Stage 1 (Verbosity)**: Reads `verbosity-algorithm.md`. Counts output items vs manifest. Scans for banned phrases. Fixes any gaps.
11. **Stage 2 (Citations)**: Reads `citation-algorithm.md`. Runs staleness detection on existing citations. Updates stale ones, generates missing ones.
12. **Stage 3 (API Refs)**: Reads `api-ref-algorithm.md`. Helpers require API Reference — verifies table rows match source functions.
13. **Stage 4 (Sanity-Check)**: Reads `validation-algorithm.md`. Cross-references every factual claim against source code. Classifies as VERIFIED/MISMATCH/etc. Reports confidence.
14. **Stage 5 (Verify)**: Reads `validation-algorithm.md` (verification section). Runs all 10 checks.
15. **Stage 6 (Changelog)**: Uses preloaded mod-changelog rules. Appends entry to `docs/changelog.md`.
16. **Stage 7 (Index)**: Uses preloaded mod-index rules. Skipped (no structural changes, just a content revision).
17. **Stage 8 (Docs Commit)**: `git -C {docs-root} add -A && git -C {docs-root} commit -m "fp-docs: revise -- fix posts helper documentation"`

### Phase 5: Report

18. Engine outputs structured Modification Report with: changes made, pipeline stage results, issues found
19. Engine outputs pipeline completion marker: `Pipeline complete: [verbosity: PASS] [citations: PASS] [sanity: HIGH] [verify: PASS] [changelog: updated] [docs-commit: committed]`

### Phase 6: Hook Validation

20. **post-modify-check.sh** fires (SubagentStop hook). Reads agent transcript, checks for changelog update marker. Exits 0 (pass) or 2 (warn).

---

## 13. System Manifest (framework/manifest.md)

The manifest is a comprehensive reference document (v2.7.1) that catalogs every component in the system:

- **Plugin identity**: name, namespace, version
- **Engine table**: all 9 engines with agent file, model, operations
- **Command table**: all 19 commands with skill file, engine, operation
- **Shared modules table**: all 11 modules with location and which engines preload them
- **On-demand algorithms table**: all 6 with path and which pipeline stage loads them
- **Instruction files table**: all instruction files grouped by engine
- **Hooks table**: all 7 hooks with event, matcher, script, purpose
- **Configuration files table**: system-config and project-config
- **Project files table**: files that live in the project (not the plugin) — changelog, tracker, About.md, PROJECT-INDEX.md

The manifest is injected into every session via the SessionStart hook (inject-manifest.sh), giving all engines awareness of the full system topology.

---

## 14. The /fp-docs:parallel Command

The parallel skill routes through the orchestrate engine like all other commands. The orchestrator handles batch operations natively when scope exceeds configured thresholds:

1. Parses the operation, scope, and flags from arguments
2. Determines the set of target files
3. Groups files into batches (max 5 per batch)
4. Creates a Team with teammates running the appropriate specialist engine
5. Assigns each file/group as a task with pipeline phase assignments
6. Waits for all teammates to complete (validated by TeammateIdle and TaskCompleted hooks)
7. Handles the Finalize Phase (changelog, index, git commit) itself — git serialization
8. Aggregates results into a unified report

**Fallback**: If Agent Teams are unavailable or scope is <3 files, falls back to sequential execution.

**Requirement**: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` must be enabled.

The `TeammateIdle` and `TaskCompleted` hooks validate teammate pipeline phase completion and task outputs during team operations.

---

## 15. Memory Management

Every engine includes a "Memory Management" section in its system prompt that instructs the agent to:

- Update agent memory when discovering recurring patterns, frequently-updated files, common false positives, codebase-specific conventions
- Write concise notes to memory
- Consult memory at the start of each session

This gives engines cross-session learning: an engine that learns "helper docs frequently have stale citations for the posts namespace" can optimize future runs.

---

## 16. Key Design Decisions Summary

1. **Skills are thin routers**: All logic lives in engine agents and instruction files. Skills just declare the agent and pass arguments.
2. **Instruction files are the source of truth**: Not the engine system prompt, not the modules. Instruction files contain the step-by-step procedure for each operation.
3. **Modules are rules, algorithms are procedures**: Modules define WHAT (formats, banned phrases, classification systems). Algorithms define HOW (step-by-step execution sequences).
4. **On-demand loading manages context**: Algorithms are only read when needed, reducing baseline context consumption. Modules are always available.
5. **Pipeline is mandatory**: Every doc-modifying operation runs the pipeline. Verification and changelog stages are NEVER skippable.
6. **Three independent git repos**: No operations should ever mix codebase and docs git commands. The plugin repo is standalone.
7. **Read-only engines are enforced at the tool level**: `disallowedTools: [Write, Edit]` prevents validation and verbosity engines from accidentally modifying files.
8. **Zero-tolerance verbosity**: The system enforces complete enumeration over summarization. Every source item must appear in documentation.
9. **Evidence-based documentation**: Every claim must be verified against source code. No fabrication. `[NEEDS INVESTIGATION]` for unknowns.
10. **Hook-based lifecycle management**: SessionStart hooks inject context. SubagentStop hooks validate pipeline completion. The system self-monitors.
11. **Universal orchestrator pattern**: All 19 commands route through the orchestrate engine. The orchestrator classifies commands, delegates to specialists, coordinates pipeline phases, and serializes git commits. This centralizes routing logic and enables multi-agent execution for every command.
12. **Pipeline phase delegation**: The 8-stage pipeline is split into 3 phases (Write, Review, Finalize) that can be distributed across specialist agents. This enables parallel validation while maintaining git serialization.
13. **Git serialization**: In delegated mode, only the orchestrator commits to the docs repo. Specialist engines perform their work but do not execute git operations, preventing commit conflicts and ensuring atomic documentation updates.
14. **Delegation vs Standalone modes**: Engines support both Delegation Mode (orchestrator-coordinated, phase-limited) and Standalone Mode (self-contained, full pipeline). This preserves backward compatibility and enables direct engine invocation for debugging.
15. **Read-only fast path**: The orchestrator recognizes read-only commands (audit, verify, sanity-check, test, verbosity-audit) and uses a lightweight 2-agent path (orchestrate + specialist) instead of the full 3-phase delegation.
16. **Batch/team protocol**: When scope exceeds orchestration thresholds, the orchestrator creates Agent Teams with specialist teammates, assigns pipeline phases, and aggregates results. The TeammateIdle and TaskCompleted hooks validate team member work.

---

## 17. Multi-Agent Orchestration Architecture

### Universal Orchestrator Pattern

The `orchestrate` engine (`agents/orchestrate.md`) is the universal entry point for all 19 commands. Every skill declares `agent: orchestrate` and provides routing metadata (`Engine:`, `Operation:`, `Instruction:`). The orchestrator:

1. **Parses routing metadata** from the skill body to determine the target specialist engine
2. **Classifies the command** as write (modify, citations generate/update, api-refs generate, locals annotate/contracts/shapes) or read-only (audit, verify, sanity-check, test, verbosity-audit, citations verify/audit, api-refs audit, locals validate/cross-ref/coverage)
3. **Selects delegation strategy**: multi-agent for write operations, fast-path for read-only operations
4. **Delegates to specialist engine(s)** with specific pipeline phase assignments
5. **Aggregates results** and returns a unified report to the user

### 3-Phase Pipeline Delegation

For write operations, the orchestrator splits the 8-stage pipeline into three phases:

**Write Phase** (assigned to primary specialist engine):
- The primary operation (e.g., revise the documentation)
- Stage 1: Verbosity Enforcement
- Stage 2: Citation Generation/Update
- Stage 3: API Reference Sync

**Review Phase** (assigned to validate engine):
- Stage 4: Sanity-Check
- Stage 5: 10-Point Verification

**Finalize Phase** (handled by orchestrator itself):
- Stage 6: Changelog Update
- Stage 7: Index Update
- Stage 8: Docs Repo Commit

This separation ensures:
- Write operations execute with full tool permissions in the specialist engine
- Validation runs in a read-only engine that cannot accidentally modify files
- Git commits are serialized through the orchestrator, preventing conflicts

### Delegation Mode vs Standalone Mode

**Delegation Mode** (default when invoked through orchestrator):
- The specialist engine receives phase assignments and executes only its assigned stages
- The engine does NOT commit to git — the orchestrator handles all git operations
- The engine returns structured results to the orchestrator for aggregation
- Write operations typically involve 3+ agents: orchestrate + specialist + validate

**Standalone Mode** (when engine is invoked directly, e.g., for debugging):
- The engine executes all 8 pipeline stages itself
- The engine commits to git directly (stage 8)
- Backward-compatible with pre-orchestration behavior

### Batch/Team Protocol

When the scope of an operation exceeds orchestration thresholds (configured in system-config.md §6), the orchestrator creates Agent Teams:

1. **Scope analysis**: Count target files and determine batch groupings
2. **Team creation**: Spawn teammate agents running the appropriate specialist engine
3. **Phase assignment**: Each teammate receives Write Phase responsibilities for its batch
4. **Monitoring**: TeammateIdle hook validates teammate phase completion; TaskCompleted hook validates task outputs
5. **Review aggregation**: Orchestrator spawns validate engine for Review Phase across all modified files
6. **Finalization**: Orchestrator handles Finalize Phase (changelog, index, single atomic git commit)

### Git Serialization

A critical property of the orchestration architecture: **only the orchestrator commits to the docs repo in delegated mode**. This prevents:
- Multiple agents racing to commit simultaneously
- Partial commits from agents that fail mid-pipeline
- Inconsistent changelog entries from parallel teammates
- Git lock conflicts in the docs repo

The orchestrator collects all modifications from specialist agents, writes the changelog entry covering all changes, updates the index if needed, and performs a single `git -C {docs-root} add -A && commit`.

### Read-Only Command Fast Path

For read-only commands (audit, verify, sanity-check, test, verbosity-audit), the orchestrator uses a streamlined 2-agent path:
1. Orchestrator receives the command
2. Orchestrator delegates directly to the specialist engine (validate or verbosity)
3. Specialist engine executes and returns results
4. Orchestrator returns results to user

No pipeline phase splitting occurs because read-only commands do not modify documentation and do not need changelog/commit stages.
