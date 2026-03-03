# fp-docs Architecture Research

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
        │   └── plugin.json           # Plugin manifest v2.6.1
        ├── settings.json             # Default permissions
        ├── hooks/
        │   └── hooks.json            # 4 hook event definitions
        ├── agents/                   # 8 engine agent definitions
        │   ├── modify.md
        │   ├── validate.md
        │   ├── citations.md
        │   ├── api-refs.md
        │   ├── locals.md
        │   ├── verbosity.md
        │   ├── index.md
        │   └── system.md
        ├── modules/                  # 10 shared modules (preloaded)
        │   ├── mod-standards/SKILL.md
        │   ├── mod-project/SKILL.md
        │   ├── mod-pipeline/SKILL.md
        │   ├── mod-changelog/SKILL.md
        │   ├── mod-index/SKILL.md
        │   ├── mod-citations/SKILL.md
        │   ├── mod-api-refs/SKILL.md
        │   ├── mod-locals/SKILL.md
        │   ├── mod-validation/SKILL.md
        │   └── mod-verbosity/SKILL.md
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
        ├── scripts/                  # 6 bash scripts (hooks + utility)
        │   ├── inject-manifest.sh
        │   ├── branch-sync-check.sh
        │   ├── post-modify-check.sh
        │   ├── teammate-idle-check.sh
        │   ├── task-completed-check.sh
        │   └── docs-commit.sh
        └── framework/
            ├── manifest.md           # System manifest v2.6.0
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
  "version": "2.6.1",
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

This is the core architectural pattern. Every user command follows the same flow:

```
User types: /fp-docs:revise "fix the posts helper"
    │
    ▼
Skill file: skills/revise/SKILL.md
    │  - Declares agent: modify
    │  - Declares context: fork (isolated subagent)
    │  - Body says: Operation: revise
    │  - Passes $ARGUMENTS to engine
    │
    ▼
Engine agent: agents/modify.md
    │  - YAML frontmatter: tools, skills (modules), model, maxTurns
    │  - System prompt: identity, how-you-work steps
    │  - Engine reads instruction file: framework/instructions/modify/revise.md
    │
    ▼
Instruction file: framework/instructions/modify/revise.md
    │  - Step-by-step algorithm for the specific operation
    │  - References on-demand algorithm files for pipeline stages
    │
    ▼
Post-modification pipeline (8 stages)
    │  - Reads on-demand algorithm files at each stage
    │  - Uses preloaded module rules
    │
    ▼
Structured report returned to user
```

### Skill Anatomy

Skills are thin routing files. Every user skill has this structure:

```yaml
---
description: Human-readable description for Claude Code UI
argument-hint: "expected arguments"
context: fork              # Always fork — runs in isolated subagent
agent: modify              # Which engine agent to invoke
---

Operation: revise

Read the instruction file at `framework/instructions/modify/revise.md` and follow it exactly.

User request: $ARGUMENTS
```

Key properties:
- `context: fork` means the skill runs as an isolated subagent, not in the main conversation
- `agent:` names the engine agent file (without .md extension)
- `$ARGUMENTS` is a Claude Code variable containing the user's input after the command name
- The skill body tells the engine which operation to perform and which instruction file to load

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

| Command | Skill | Engine | Operation |
|---------|-------|--------|-----------|
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
| /fp-docs:parallel | skills/parallel | system | (orchestrator) |

---

## 4. The 8 Engine Agents

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

**Write-capable engines**: modify, citations, api-refs, locals, index, system
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
| mod-standards | Formatting, naming, structural, depth rules | ALL 8 engines |
| mod-project | FP paths, source-to-doc mapping, environment | ALL 8 engines |
| mod-pipeline | 8-stage post-modification pipeline definition | modify only |
| mod-changelog | Changelog entry format and update procedure | modify (preloaded) |
| mod-index | PROJECT-INDEX.md update rules and triggers | modify (preloaded), index |
| mod-citations | Citation format, tiers, staleness, provenance | modify, citations |
| mod-api-refs | API Reference table format, scope, provenance | modify, api-refs |
| mod-locals | $locals contract format, shapes, validation | modify, locals |
| mod-validation | 10-point checklist, sanity-check algorithm | modify, validate |
| mod-verbosity | Anti-brevity rules, banned phrases, manifests | modify, verbosity |

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

### Pipeline Completion Marker

When the pipeline completes, the engine outputs:
```
Pipeline complete: [verbosity: PASS] [citations: PASS] [sanity: HIGH] [verify: PASS] [changelog: updated] [docs-commit: committed|skipped]
```

This marker is checked by the SubagentStop hook (`post-modify-check.sh`) to validate pipeline execution.

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

The hooks file defines 4 event types with 5 total hook scripts:

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

**4. TeammateIdle: teammate-idle-check.sh**
- Fires: When a teammate agent goes idle during parallel operations
- Purpose: Validates that teammates completed their pipeline stages
- Current implementation: stub (exit 0), placeholder for future validation

**5. TaskCompleted: task-completed-check.sh**
- Fires: When a task is marked completed during orchestration
- Purpose: Validates task outputs (checks for empty modifications, missing changelog)
- Current implementation: stub (exit 0), placeholder for future validation

### 6th Script: docs-commit.sh (Utility, Not a Hook)

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

The manifest is a comprehensive reference document (v2.6.0) that catalogs every component in the system:

- **Plugin identity**: name, namespace, version
- **Engine table**: all 8 engines with agent file, model, operations
- **Command table**: all 19 commands with skill file, engine, operation
- **Shared modules table**: all 10 modules with location and which engines preload them
- **On-demand algorithms table**: all 6 with path and which pipeline stage loads them
- **Instruction files table**: all instruction files grouped by engine
- **Hooks table**: all 5 hooks with event, matcher, script, purpose
- **Configuration files table**: system-config and project-config
- **Project files table**: files that live in the project (not the plugin) — changelog, tracker, About.md, PROJECT-INDEX.md

The manifest is injected into every session via the SessionStart hook (inject-manifest.sh), giving all engines awareness of the full system topology.

---

## 14. The /fp-docs:parallel Command

The parallel skill is unique — it is an orchestrator, not a single-engine operation. It:

1. Parses the operation, scope, and flags from arguments
2. Determines the set of target files
3. Groups files into batches (max 5 per batch)
4. Creates a Team with teammates running the appropriate engine
5. Assigns each file/group as a task
6. Waits for all teammates to complete
7. Aggregates results into a unified report

**Fallback**: If Agent Teams are unavailable or scope is <3 files, falls back to sequential execution.

**Requirement**: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` must be enabled.

The `TeammateIdle` and `TaskCompleted` hooks (currently stubs) are designed to support this parallel orchestration by validating teammate pipeline completion and task outputs.

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
