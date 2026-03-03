# fp-docs Plugin — Implementation Plan

> **Purpose**: Step-by-step build instructions for the `fp-docs` Claude Code plugin.
> **Consumer**: The official `plugin-dev` plugin (`/plugin-dev:create-plugin`) or a developer building manually.
> **Spec files**: `proposal-spec.md`, `engine-contract-spec.md`, `prototype-engine.md`, `orchestrate-spec.md`
> **All open questions resolved** — see `proposal-spec.md` §13.

---

## Table of Contents

1. [Pre-Implementation Setup](#1-pre-implementation-setup)
2. [Phase 1: Plugin Bootstrap](#2-phase-1-plugin-bootstrap)
3. [Phase 2: Shared Modules (Preloaded Skills)](#3-phase-2-shared-modules)
4. [Phase 3: On-Demand Framework Modules](#4-phase-3-on-demand-framework-modules)
5. [Phase 4: Instruction Files](#5-phase-4-instruction-files)
6. [Phase 5: Engine Agents](#6-phase-5-engine-agents)
7. [Phase 6: Hook System](#7-phase-6-hook-system)
8. [Phase 7: User-Facing Skills](#8-phase-7-user-facing-skills)
9. [Phase 8: System Manifest & Validation](#9-phase-8-system-manifest-and-validation)
10. [Migration Mapping (1.0 → 2.0)](#10-migration-mapping)
11. [Validation Checklist](#11-validation-checklist)
12. [Plugin-Dev Integration Notes](#12-plugin-dev-integration-notes)

---

## 1. Pre-Implementation Setup

### 1.1 Create Plugin Root

```bash
mkdir -p fp-docs-system/.claude-plugin
```

The plugin lives at `fp-docs-system/` (sibling to the project's `.claude/` directory or anywhere on disk — loaded via `--plugin-dir`).

### 1.2 Read These 1.0 Source Files First

Before creating ANY 2.0 content, the implementer MUST read these files. All module and instruction content is extracted/restructured from them — no new operational logic is invented.

| 1.0 File | Path (relative to theme root `themes/foreign-policy-2017/`) | Lines | Purpose |
|---|---|---|---|
| `docs-system.md` | `docs/claude-code-docs-system/docs-system.md` | ~380 | Bootstrap, lifecycle, source-to-doc mapping |
| `docs-standards.md` | `docs/claude-code-docs-system/docs-standards.md` | ~680 | Format templates, naming, structure rules |
| `docs-system-config.md` | `docs/claude-code-docs-system/docs-system-config.md` | ~150 | Feature flags, thresholds, scope tables |
| `docs-verbosity-engine.md` | `docs/claude-code-docs-system/docs-verbosity-engine.md` | ~200 | Anti-compression rules, scope manifests |
| `docs-commands-list.md` | `docs/claude-code-docs-system/docs-commands-list.md` | ~250 | Command-to-instruction routing (reference only) |
| 27 instruction files | `docs/claude-code-docs-system/instructions/cc-*.md` | ~2,500 total | Step-by-step procedures for each operation |

Also read:
- All 17 existing skill files at `.claude/skills/docs-*/SKILL.md`
- The 4 spec files in `.claude/docs-system-2.0/`

### 1.3 Content Stays in `docs/` (Do NOT Move)

These files stay exactly where they are — the plugin reads them, it doesn't own them:

- `docs/changelog.md`
- `docs/needs-revision-tracker.md`
- `docs/FLAGGED CONCERNS/`
- `docs/About.md`
- `docs/docs-management.md`
- `docs/docs-prompts.md`
- All 364 documentation content files in `docs/00-*` through `docs/23-*`, `docs/appendices/`
- `docs/claude-code-docs-system/PROJECT-INDEX.md` (stays — engines read it in place)

---

## 2. Phase 1: Plugin Bootstrap

**Creates**: 5 files
**Dependencies**: None

### File 1: `.claude-plugin/plugin.json`

```json
{
  "name": "fp-docs",
  "displayName": "Foreign Policy Documentation System",
  "version": "2.0.0",
  "description": "Documentation management system for the Foreign Policy WordPress theme. Provides 18 commands for creating, validating, and maintaining 300+ developer docs.",
  "author": {
    "name": "FP Dev Team"
  },
  "keywords": ["documentation", "wordpress", "foreign-policy"]
}
```

### File 2: `settings.json`

```json
{
  "agent": "docs-modify"
}
```

> The `agent` key sets the default agent when the plugin is active. `docs-modify` is the most commonly used engine. Other engines are invoked via skills.

### File 3: `README.md`

Write a brief overview covering:
- What the plugin does (manages 300+ developer docs for the FP WordPress theme)
- Installation: `claude --plugin-dir ./fp-docs-system`
- Command list: all 18 `/fp-docs:*` commands with one-line descriptions
- Architecture overview: 8 engines, 10 shared modules, 18 user skills
- Link to spec files for detailed design

### File 4: `framework/config/system-config.md`

**Source**: Extract from `docs/claude-code-docs-system/docs-system-config.md`

Content to include:
- Feature enable/disable flags: `citations.enabled`, `api_refs.enabled`, `verbosity.enabled`, `sanity_check.enabled`, `locals.enabled`
- Threshold values: citation staleness (days), verbosity minimum counts, API ref scope depth
- Pipeline stage enables (which stages run for which operations)
- Model tiering defaults: which engines use `inherit` vs `sonnet`
- Team limits: `max_teammates: 5`, `max_files_per_teammate: 6`

### File 5: `framework/config/project-config.md`

**Source**: FP-specific values (hardcoded, not templated)

Content to include:
- **Theme root**: `themes/foreign-policy-2017/`
- **Docs root**: `themes/foreign-policy-2017/docs/`
- **Source-to-docs mapping table** (from `docs-system.md` §4): maps source directories to doc sections
  - `inc/post-types/*.php` → `docs/02-post-types/`
  - `inc/taxonomies/*.php` → `docs/03-taxonomies/`
  - `inc/custom-fields/*.php` → `docs/04-custom-fields/`
  - `components/*/` → `docs/05-components/`
  - `helpers/*.php` → `docs/06-helpers/`
  - `inc/shortcodes/*.php` → `docs/07-shortcodes/`
  - `inc/hooks/*.php` → `docs/08-hooks/`
  - `inc/rest-api/*.php` → `docs/09-api/`
  - `layouts/*.php` → `docs/10-layouts-and-templates/`
  - `features/*/` → `docs/11-features/`
  - (complete table from docs-system.md)
- **Tracker file paths**: `docs/changelog.md`, `docs/needs-revision-tracker.md`
- **Index file path**: `docs/claude-code-docs-system/PROJECT-INDEX.md`
- **PHP namespace convention**: `ForeignPolicy\Helpers\{Feature}\function_name()`
- **Local dev config**: ddev WP-CLI prefix, local URL, SSL settings

---

## 3. Phase 2: Shared Modules

**Creates**: 10 files in `skills/docs-mod-*/SKILL.md`
**Dependencies**: Phase 1 complete (config files exist)

**Critical**: ALL shared modules MUST have this frontmatter:

```yaml
---
name: docs-mod-{name}
description: {40-word description of what rules this module provides}
disable-model-invocation: true
user-invocable: false
---
```

The `disable-model-invocation: true` keeps them out of Claude's context budget. The `user-invocable: false` hides them from the `/` menu. They are only visible to engines that preload them.

### Module 1: `skills/docs-mod-standards/SKILL.md`

**Source**: `docs/claude-code-docs-system/docs-standards.md` §1-§6

Extract and include:
- File naming conventions (kebab-case, index files, section numbering)
- Directory structure rules (every section has `_index.md` or equivalent)
- Content formatting rules (paths relative to theme root, backticks for code, `[NEEDS INVESTIGATION]` markers)
- Document format templates for each doc type:
  - Post type template
  - Taxonomy template
  - Helper template
  - Hook template
  - Shortcode template
  - REST endpoint template
  - Component template
  - JavaScript module template
  - ACF field group template
  - Integration template
- Depth requirements (minimum sections, required headings)
- Cross-reference format (`See [Component Name](../05-components/component-name.md)`)

**Estimated size**: 200-250 lines

### Module 2: `skills/docs-mod-project/SKILL.md`

**Source**: `framework/config/project-config.md` (the file from Phase 1)

This is a **cached copy** of project-config.md formatted as a skill for preloading. Include:
- Source-to-docs mapping table
- Theme directory structure summary
- Key file paths
- PHP namespace conventions

**Estimated size**: 80-100 lines

### Module 3: `skills/docs-mod-pipeline/SKILL.md`

**Source**: `docs/claude-code-docs-system/docs-system.md` lifecycle section + `prototype-engine.md` §5 pipeline

Extract and include:
- 7-stage post-modification pipeline definition:
  1. Verbosity enforcement (read `framework/modules/verbosity-rules.md`)
  2. Citation generation/update (read `framework/modules/citation-rules.md`)
  3. API reference sync (read `framework/modules/api-ref-rules.md`)
  4. Sanity check (read `framework/modules/validation-rules.md`)
  5. Verify (read `framework/modules/validation-rules.md`)
  6. Changelog update (read `framework/modules/changelog-rules.md`)
  7. Index update (read `framework/modules/index-rules.md`)
- Which operations trigger which pipeline stages
- Stage skip conditions (feature flags from system-config.md)
- Pipeline completion markers (for hook validation)

**Estimated size**: 80-100 lines

### Module 4: `skills/docs-mod-citations/SKILL.md`

**Source**: `docs/claude-code-docs-system/docs-standards.md` §7

Extract and include:
- Citation block format template
- Citation tier definitions (T1: exact line, T2: function/class, T3: file, T4: directory)
- Staleness indicators and thresholds
- Provenance validation rules
- Examples of well-formed citations

**Estimated size**: 150-180 lines

### Module 5: `skills/docs-mod-api-refs/SKILL.md`

**Source**: `docs/claude-code-docs-system/docs-system-config.md` §4

Extract and include:
- API reference table format (columns: Function/Method, Parameters, Return, Description)
- Scope table (which doc types get API refs)
- Provenance requirements
- Layer definitions (7 layers: helpers, hooks, REST, CLI, shortcodes, post-types, taxonomies)

**Estimated size**: 100-120 lines

### Module 6: `skills/docs-mod-locals/SKILL.md`

**Source**: `docs/claude-code-docs-system/docs-standards.md` §9

Extract and include:
- `$locals` contract block format
- Shape annotation syntax
- Cross-reference validation rules
- Coverage requirements

**Estimated size**: 120-150 lines

### Module 7: `skills/docs-mod-verbosity/SKILL.md`

**Source**: `docs/claude-code-docs-system/docs-verbosity-engine.md`

Extract and include:
- Anti-brevity rules (banned summarization phrases)
- Enumeration requirements (every item in a list must be expanded)
- Scope manifest format (count source items → count output items)
- Minimum coverage thresholds
- Gate failure conditions

**Estimated size**: 100-120 lines

### Module 8: `skills/docs-mod-validation/SKILL.md`

**Source**: `docs/claude-code-docs-system/instructions/cc-verify.md` + `cc-sanity-check.md`

Extract and include:
- 10-point verification checklist
- Sanity check algorithm (compare doc claims against source code)
- Zero-tolerance sanity check mode
- Verification pass/fail criteria
- Output format for check results

**Estimated size**: 150-180 lines

### Module 9: `skills/docs-mod-changelog/SKILL.md`

**Source**: `docs/claude-code-docs-system/instructions/cc-changelog.md`

Extract and include:
- Changelog entry format (date, operation, files modified, summary)
- Entry categorization rules
- Deduplication rules
- File path: `docs/changelog.md`

**Estimated size**: 30-40 lines

### Module 10: `skills/docs-mod-index/SKILL.md`

**Source**: `docs/claude-code-docs-system/instructions/cc-update-project-index.md`

Extract and include:
- PROJECT-INDEX.md update rules
- Link format requirements
- When to trigger full vs incremental update
- File path: `docs/claude-code-docs-system/PROJECT-INDEX.md`

**Estimated size**: 50-60 lines

---

## 4. Phase 3: On-Demand Framework Modules

**Creates**: 11 files in `framework/modules/*.md`
**Dependencies**: Phase 1 complete

These are NOT skills — they are plain markdown files loaded on-demand by engines during pipeline execution. No YAML frontmatter.

### Module 1: `framework/modules/verbosity-rules.md`

**Source**: `docs-verbosity-engine.md` (full algorithm)

Include the complete verbosity enforcement algorithm:
- Scope manifest generation: count every enumerable item in source
- Output coverage check: verify every item appears in generated doc
- Banned phrase list (e.g., "such as", "including but not limited to", "various", "etc.")
- Gap detection rules
- Failure conditions and remediation steps

### Module 2: `framework/modules/citation-rules.md`

**Source**: `docs-standards.md` §7 + `instructions/cc-citations-generate.md` + `cc-citations-update.md`

Include the complete citation algorithm:
- When to generate new citations vs update existing
- Staleness detection (compare cited line content with current file content)
- Tier selection logic
- Format template with all fields
- Batch processing rules for multi-file updates

### Module 3: `framework/modules/api-ref-rules.md`

**Source**: `docs-system-config.md` §4 + `instructions/cc-api-ref.md`

Include:
- API reference table generation algorithm
- Parameter extraction from PHP source
- Return type inference rules
- 7-layer scope definitions
- Provenance tagging

### Module 4: `framework/modules/validation-rules.md`

**Source**: `instructions/cc-verify.md` + `cc-sanity-check.md`

Include:
- Complete 10-point verification checklist with pass/fail criteria
- Sanity check algorithm (read source → compare with doc claims)
- Zero-tolerance mode behavior
- Output format for both verify and sanity-check results

### Module 5: `framework/modules/changelog-rules.md`

**Source**: `instructions/cc-changelog.md`

Include the full changelog update procedure (brief — ~40 lines).

### Module 6: `framework/modules/index-rules.md`

**Source**: `instructions/cc-update-project-index.md`

Include PROJECT-INDEX update procedure and link format rules.

### Module 7: `framework/modules/post-modify-checklist.md`

**Source**: `docs-system.md` appendix + `docs-verbosity-engine.md` scope manifest

Include the post-modification completion checklist that SubagentStop hooks validate against.

### Module 8: `framework/modules/codebase-analysis-guide.md`

**Source**: `docs-system.md` appendix

Include guidance for how engines should analyze FP source code:
- PHP file scanning patterns
- Function/class extraction approach
- Hook registration detection
- Template hierarchy traversal

### Module 9: `framework/modules/cross-reference-validation.md`

**Source**: `docs-standards.md` §6

Include link validation rules, relative path resolution, broken link detection.

### Module 10: `framework/modules/citation-staleness-detection.md`

**Source**: `docs-standards.md` §7 (staleness subsection)

Include the algorithm for detecting stale citations by comparing cited content with current file state.

### Module 11: `framework/modules/locals-contract-grammar.md`

**Source**: `docs-standards.md` §9

Include the complete `$locals` contract grammar, shape syntax, and validation rules.

---

## 5. Phase 4: Instruction Files

**Creates**: 22 files in `framework/instructions/{engine}/`
**Dependencies**: Phase 3 complete (on-demand modules exist for pipeline references)

Each instruction file is a **numbered step-by-step procedure** that an engine reads when executing an operation. Written in imperative form. References on-demand modules by path when the engine needs to load them mid-operation.

### Directory Structure

```
framework/instructions/
├── modify/
│   ├── revise.md
│   ├── add.md
│   ├── auto-update.md
│   ├── auto-revise.md
│   └── deprecate.md
├── validate/
│   ├── audit.md
│   ├── verify.md
│   ├── sanity-check.md
│   └── test.md
├── citations/
│   ├── generate.md
│   ├── update.md
│   ├── verify.md
│   └── audit.md
├── api-refs/
│   ├── generate.md
│   └── audit.md
├── locals/
│   ├── annotate.md
│   ├── contracts.md
│   ├── cross-ref.md
│   ├── validate.md
│   ├── shapes.md
│   └── coverage.md
├── verbosity/
│   └── audit.md
└── index/
    └── update.md
```

### Instruction File Template

Every instruction file follows this structure:

```markdown
# {Operation Name} — Instruction

## Inputs
- `$ARGUMENTS`: {what the user passes}
- Preloaded modules: {which modules are already in context}

## Steps

1. {First step — specific, actionable}
2. {Second step}
...
N. {Final step}

## Pipeline Trigger
{For modify operations only}
After completing the above steps, execute the post-modification pipeline:
1. Read `framework/modules/verbosity-rules.md` → enforce verbosity
2. Read `framework/modules/citation-rules.md` → update citations
...

## Output
{What the engine should output to the user when done}
```

### Key Instruction Files

**`modify/revise.md`** — Most complete reference. See `prototype-engine.md` §5 for the full 12-step procedure. This is the template for all other modify instructions.

**Content for each instruction file is extracted from the corresponding 1.0 instruction file** (`instructions/cc-*.md`), restructured into the numbered step format, with explicit module Read calls replacing the old "bootstrap the system" approach.

### Instruction-to-1.0-Source Mapping

| Instruction File | 1.0 Source File(s) | Key Changes from 1.0 |
|---|---|---|
| `modify/revise.md` | `cc-revise.md` | Add module Read calls, remove bootstrap |
| `modify/add.md` | `cc-add.md` | Same pattern |
| `modify/auto-update.md` | `cc-auto-update.md` + `cc-planning.md` | Merge planning into auto-update (no separate planning skill) |
| `modify/auto-revise.md` | `cc-auto-revise.md` | Add tracker reading step |
| `modify/deprecate.md` | `cc-deprecate.md` (if exists, else inferred) | Deprecation marking + changelog |
| `validate/audit.md` | `cc-audit.md` | No pipeline trigger (read-only) |
| `validate/verify.md` | `cc-verify.md` | No pipeline trigger |
| `validate/sanity-check.md` | `cc-sanity-check.md` | No pipeline trigger |
| `validate/test.md` | `cc-test.md` | No pipeline trigger |
| `citations/generate.md` | `cc-citations-generate.md` | Module Read call |
| `citations/update.md` | `cc-citations-update.md` | Module Read call |
| `citations/verify.md` | `cc-citations-verify.md` | No pipeline trigger |
| `citations/audit.md` | `cc-citations-audit.md` | No pipeline trigger |
| `api-refs/generate.md` | `cc-api-ref.md` | Module Read call + pipeline |
| `api-refs/audit.md` | `cc-audit-api-ref.md` | No pipeline trigger |
| `locals/annotate.md` | `cc-locals.md` (annotate subsection) | Module Read call + pipeline |
| `locals/contracts.md` | `cc-locals.md` (contracts subsection) | Module Read call + pipeline |
| `locals/cross-ref.md` | `cc-locals.md` (cross-ref subsection) | No pipeline (read-only) |
| `locals/validate.md` | `cc-locals.md` (validate subsection) | No pipeline (read-only) |
| `locals/shapes.md` | `cc-locals.md` (shapes subsection) | Module Read call + pipeline |
| `locals/coverage.md` | `cc-locals.md` (coverage subsection) | No pipeline (read-only) |
| `verbosity/audit.md` | `cc-verbosity-audit.md` | No pipeline (read-only) |
| `index/update.md` | `cc-update-project-index.md` | Standalone (no pipeline) |

### Operations That Run the Pipeline

Only these operations trigger the 7-stage post-modification pipeline:
- `modify/revise.md`
- `modify/add.md`
- `modify/auto-update.md`
- `modify/auto-revise.md`
- `modify/deprecate.md`
- `citations/generate.md`
- `citations/update.md`
- `api-refs/generate.md`
- `locals/annotate.md`
- `locals/contracts.md`
- `locals/shapes.md`

All other operations are read-only and do NOT run the pipeline.

---

## 6. Phase 5: Engine Agents

**Creates**: 8 files in `agents/docs-*.md`
**Dependencies**: Phases 2-4 complete (modules and instructions exist)

Each engine is a **Custom Subagent** defined as a markdown file with YAML frontmatter and a system prompt body.

### Agent Frontmatter Format (Required by CC)

```yaml
---
name: docs-{engine-name}
description: |
  {One paragraph explaining what this engine does and when to use it.}

  <example>
  User: {example user request}
  <commentary>
  {Why this engine is the right one for this request}
  </commentary>
  </example>

  <example>
  User: {second example}
  <commentary>
  {Why this triggers this engine}
  </commentary>
  </example>
model: inherit  # or sonnet
color: green    # blue|cyan|green|yellow|magenta|red
tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
skills:
  - docs-mod-standards
  - docs-mod-project
  - docs-mod-pipeline  # (only for docs-modify)
---
```

**IMPORTANT**: The `description` field MUST include 2-4 `<example>` blocks with `<commentary>`. This is how Claude decides when to invoke the agent.

### Engine 1: `agents/docs-modify.md`

**Source**: `prototype-engine.md` §2 (complete — use as-is with frontmatter format adjustment)

- **Model**: `inherit`
- **Color**: `green`
- **Skills**: `docs-mod-standards`, `docs-mod-project`, `docs-mod-pipeline`
- **Tools**: `Read`, `Write`, `Edit`, `Grep`, `Glob`, `Bash`
- **Operations**: revise, add, auto-update, auto-revise, deprecate
- **System prompt**: See `prototype-engine.md` starting at the system prompt section. Must include:
  - Identity section (name, domain, operations)
  - "How You Work" section explaining plugin root from session context
  - Instruction file reading protocol
  - Module preloading explanation
  - Pipeline execution reference
  - Memory management: "Update MEMORY.md only when learning something genuinely new"
  - Critical rules (never skip sanity-check, always update changelog, etc.)

### Engine 2: `agents/docs-validate.md`

- **Model**: `inherit`
- **Color**: `cyan`
- **Skills**: `docs-mod-standards`, `docs-mod-project`, `docs-mod-validation`
- **Tools**: `Read`, `Grep`, `Glob`, `Bash` (NO Write, NO Edit — read-only engine)
- **Operations**: audit, verify, sanity-check, test
- **System prompt pattern**: Same structure as docs-modify but identity is "validation engine", no pipeline execution, emphasis on accuracy reporting

### Engine 3: `agents/docs-citations.md`

- **Model**: `inherit`
- **Color**: `yellow`
- **Skills**: `docs-mod-standards`, `docs-mod-project`, `docs-mod-citations`
- **Tools**: `Read`, `Write`, `Edit`, `Grep`, `Glob`, `Bash`
- **Operations**: generate, update, verify, audit
- **Note**: `verify` and `audit` are read-only operations but the engine needs Write for `generate` and `update`

### Engine 4: `agents/docs-api-refs.md`

- **Model**: `inherit`
- **Color**: `yellow`
- **Skills**: `docs-mod-standards`, `docs-mod-project`, `docs-mod-api-refs`
- **Tools**: `Read`, `Write`, `Edit`, `Grep`, `Glob`, `Bash`
- **Operations**: generate, audit

### Engine 5: `agents/docs-locals.md`

- **Model**: `inherit`
- **Color**: `magenta`
- **Skills**: `docs-mod-standards`, `docs-mod-project`, `docs-mod-locals`
- **Tools**: `Read`, `Write`, `Edit`, `Grep`, `Glob`, `Bash`
- **Operations**: annotate, contracts, cross-ref, validate, shapes, coverage
- **Note**: `cross-ref`, `validate`, `coverage` are read-only but engine needs Write for the others

### Engine 6: `agents/docs-verbosity.md`

- **Model**: `sonnet`
- **Color**: `red`
- **Skills**: `docs-mod-standards`, `docs-mod-project`, `docs-mod-verbosity`
- **Tools**: `Read`, `Grep`, `Glob`, `Bash` (read-only engine)
- **Operations**: audit

### Engine 7: `agents/docs-index.md`

- **Model**: `sonnet`
- **Color**: `blue`
- **Skills**: `docs-mod-standards`, `docs-mod-project`, `docs-mod-index`
- **Tools**: `Read`, `Write`, `Edit`, `Grep`, `Glob`, `Bash`
- **Operations**: update-project-index, update-doc-links, update-example-claude

### Engine 8: `agents/docs-system.md`

- **Model**: `sonnet`
- **Color**: `blue`
- **Skills**: `docs-mod-standards`, `docs-mod-project`
- **Tools**: `Read`, `Write`, `Edit`, `Grep`, `Glob`, `Bash`
- **Operations**: update-skills, setup

---

## 7. Phase 6: Hook System

**Creates**: 1 JSON file + 4 shell scripts (+ 2 optional)
**Dependencies**: Phase 5 complete (engines exist for matchers)

### File 1: `hooks/hooks.json`

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/inject-manifest.sh"
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "matcher": "docs-modify",
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/post-modify-check.sh"
          }
        ]
      }
    ],
    "TeammateIdle": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/teammate-idle-check.sh"
          }
        ]
      }
    ],
    "TaskCompleted": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/task-completed-check.sh"
          }
        ]
      }
    ]
  }
}
```

### File 2: `scripts/inject-manifest.sh`

**Source**: `prototype-engine.md` §6.1

Purpose: SessionStart hook that injects plugin root path and manifest content into the session context.

```bash
#!/bin/bash
# SessionStart: Inject plugin root path and manifest into session context
# Input: JSON on stdin with session metadata
# Output: JSON with additionalContext field

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
MANIFEST_CONTENT=$(cat "${PLUGIN_ROOT}/framework/manifest.md" 2>/dev/null || echo "Manifest not found")

cat <<EOF
{
  "additionalContext": "fp-docs plugin root: ${PLUGIN_ROOT}\n\n${MANIFEST_CONTENT}"
}
EOF
```

### File 3: `scripts/post-modify-check.sh`

**Source**: `prototype-engine.md` §6.2

Purpose: SubagentStop hook for docs-modify engine. Validates that the pipeline ran to completion (changelog was updated).

```bash
#!/bin/bash
# SubagentStop: Validate docs-modify pipeline completion
# Input: JSON on stdin with agent transcript summary
# Exit 0 = pass, Exit 2 = warn

INPUT=$(cat)
TRANSCRIPT=$(echo "$INPUT" | jq -r '.transcript // ""')

# Check for changelog update marker
if echo "$TRANSCRIPT" | grep -qi "changelog.*updated\|updated.*changelog"; then
  exit 0
else
  echo "Warning: docs-modify completed without changelog update confirmation" >&2
  exit 2
fi
```

### File 4: `scripts/teammate-idle-check.sh`

**Source**: `orchestrate-spec.md` §4.1

Purpose: TeammateIdle hook for orchestration. Validates teammate pipeline completion.

```bash
#!/bin/bash
# TeammateIdle: Check teammate pipeline completion
INPUT=$(cat)
# Parse teammate output and validate pipeline markers
exit 0
```

### File 5: `scripts/task-completed-check.sh`

**Source**: `orchestrate-spec.md` §4.2

Purpose: TaskCompleted hook for orchestration. Validates task outputs.

```bash
#!/bin/bash
# TaskCompleted: Verify task outputs
INPUT=$(cat)
# Validate that task produced expected doc modifications
exit 0
```

### Optional Future Scripts

- `scripts/validation-pre-write.sh` — Engine-scoped write validation
- `scripts/citation-format-check.sh` — Citation format validation

These can be added later as the system matures. Not required for launch.

---

## 8. Phase 7: User-Facing Skills

**Creates**: 18 files in `skills/*/SKILL.md`
**Dependencies**: Phase 5 complete (engines exist to be invoked)

### Skill Frontmatter Template

All user-facing skills follow this pattern:

```yaml
---
name: {skill-name}
description: {40-word description explaining what it does and when to use it}
argument-hint: "{hint text shown in autocomplete}"
context: fork
agent: docs-{engine-name}
---
```

For read-only skills, add:
```yaml
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
```

### docs-modify Skills (5 files)

**Skill 1: `skills/revise/SKILL.md`**

```yaml
---
name: revise
description: Fix specific documentation you know is wrong or outdated. Provide a description of what needs fixing and the engine will locate, update, and validate the affected docs.
argument-hint: "description of what to fix"
context: fork
agent: docs-modify
---
```

Body:
```
Operation: revise

Read the instruction file at `framework/instructions/modify/revise.md` and follow it exactly.

User request: $ARGUMENTS
```

**Skill 2: `skills/add/SKILL.md`**

```yaml
---
name: add
description: Create documentation for entirely new code that doesn't have docs yet. Describe the new code and the engine will analyze it and generate complete documentation.
argument-hint: "description of new code to document"
context: fork
agent: docs-modify
---
```

Body: Same pattern — `Operation: add` + instruction file reference + `$ARGUMENTS`

**Skill 3: `skills/auto-update/SKILL.md`**

```yaml
---
name: auto-update
description: Auto-detect code changes since last documentation update and handle everything. Scans git diff, identifies affected docs, and updates them.
argument-hint: "optional scope restriction"
context: fork
agent: docs-modify
---
```

Body:
```
Operation: auto-update

Changed files since last docs update:
!`git diff --name-only HEAD~5 -- themes/foreign-policy-2017/`!

Read the instruction file at `framework/instructions/modify/auto-update.md` and follow it exactly.

User scope restriction (if any): $ARGUMENTS
```

> Note the `!`command`!` dynamic injection — this runs at skill invocation time and injects the git diff output into the prompt.

**Skill 4: `skills/auto-revise/SKILL.md`**

```yaml
---
name: auto-revise
description: Batch-process all items listed in the needs-revision-tracker. Reads the tracker, processes each item, and marks them complete.
argument-hint: "optional flags like --dry-run"
context: fork
agent: docs-modify
---
```

Body: `Operation: auto-revise` + instruction file reference + `$ARGUMENTS`

**Skill 5: `skills/deprecate/SKILL.md`**

```yaml
---
name: deprecate
description: Mark documentation as deprecated when code has been removed or replaced. Updates the doc with deprecation notice and updates trackers.
argument-hint: "description of deprecated code"
context: fork
agent: docs-modify
---
```

Body: `Operation: deprecate` + instruction file reference + `$ARGUMENTS`

### docs-validate Skills (4 files)

**Skill 6: `skills/audit/SKILL.md`**

```yaml
---
name: audit
description: Compare documentation against source code and report discrepancies. Supports quick, standard, and deep audit depths.
argument-hint: "--depth quick|standard|deep [scope]"
context: fork
agent: docs-validate
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---
```

**Skill 7: `skills/verify/SKILL.md`**

```yaml
---
name: verify
description: Run the 10-point verification checklist on documentation files without making changes. Reports pass/fail for each check.
argument-hint: "optional scope like docs/06-helpers/"
context: fork
agent: docs-validate
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---
```

**Skill 8: `skills/sanity-check/SKILL.md`**

```yaml
---
name: sanity-check
description: Validate that documentation claims match actual source code. Zero-tolerance mode flags any discrepancy.
argument-hint: "scope like docs/06-helpers/posts.md"
context: fork
agent: docs-validate
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---
```

**Skill 9: `skills/test/SKILL.md`**

```yaml
---
name: test
description: Execute runtime validations against the local development environment. Tests REST endpoints, WP-CLI commands, and template rendering.
argument-hint: "test scope like rest-api|cli|templates"
context: fork
agent: docs-validate
---
```

> Note: `test` does NOT have `allowed-tools` restriction because it needs Bash for curl/WP-CLI.

### Specialized Engine Skills (6 files)

**Skill 10: `skills/citations/SKILL.md`**

```yaml
---
name: citations
description: Manage code citations in documentation files. Subcommands: generate (create new), update (refresh stale), verify (check format), audit (deep accuracy check).
argument-hint: "generate|update|verify|audit [scope]"
context: fork
agent: docs-citations
---
```

Body:
```
Operation: $ARGUMENTS

Parse the first word of $ARGUMENTS as the subcommand (generate|update|verify|audit).
Read the instruction file at `framework/instructions/citations/{subcommand}.md` and follow it exactly.
Pass remaining arguments as scope.
```

**Skill 11: `skills/api-ref/SKILL.md`**

```yaml
---
name: api-ref
description: Generate or update API Reference sections in documentation files. Extracts function signatures from source code and creates formatted reference tables.
argument-hint: "generate|audit [scope]"
context: fork
agent: docs-api-refs
---
```

**Skill 12: `skills/locals/SKILL.md`**

```yaml
---
name: locals
description: Manage $locals contract documentation. Subcommands: annotate, contracts, cross-ref, validate, shapes, coverage.
argument-hint: "annotate|contracts|cross-ref|validate|shapes|coverage [scope]"
context: fork
agent: docs-locals
---
```

**Skill 13: `skills/verbosity-audit/SKILL.md`**

```yaml
---
name: verbosity-audit
description: Scan existing documentation for verbosity gaps — missing items, summarization language, unexpanded enumerables.
argument-hint: "--depth quick|standard|deep [scope]"
context: fork
agent: docs-verbosity
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---
```

**Skill 14: `skills/update-index/SKILL.md`**

```yaml
---
name: update-index
description: Refresh the PROJECT-INDEX.md codebase reference. Scans source files and updates the master index.
argument-hint: "update|full"
context: fork
agent: docs-index
---
```

**Skill 15: `skills/update-claude/SKILL.md`**

```yaml
---
name: update-claude
description: Regenerate the CLAUDE.md template with current skill inventory, documentation links, and project configuration.
argument-hint: ""
context: fork
agent: docs-index
---
```

### System Skills (2 files)

**Skill 16: `skills/update-skills/SKILL.md`**

```yaml
---
name: update-skills
description: Regenerate all plugin skills from the current prompt definitions. Syncs skill files with the source-of-truth prompts.
argument-hint: ""
context: fork
agent: docs-system
---
```

**Skill 17: `skills/setup/SKILL.md`**

```yaml
---
name: setup
description: Initialize or verify the fp-docs plugin installation. Checks all required files exist and validates configuration.
argument-hint: ""
context: fork
agent: docs-system
---
```

### Orchestration Skill (1 file)

**Skill 18: `skills/parallel/SKILL.md`**

```yaml
---
name: parallel
description: Run documentation operations in parallel across multiple files using Agent Teams. Opt-in feature — falls back to sequential if teams are disabled.
argument-hint: "operation scope flags"
---
```

> Note: NO `context: fork` and NO `agent:` — this skill runs in the main context and creates an Agent Team.

Body: See `orchestrate-spec.md` §3 for the full orchestration logic. The skill body contains the team creation, task distribution, and result aggregation logic inline.

---

## 9. Phase 8: System Manifest and Validation

**Creates**: 1 file
**Dependencies**: ALL previous phases complete

### File: `framework/manifest.md`

**Source**: `prototype-engine.md` §7

```markdown
# fp-docs System — Manifest v2.0.0

## Plugin
- **Name**: fp-docs
- **Namespace**: /fp-docs:*
- **Version**: 2.0.0

## Engines

| Engine | Agent File | Model | Operations |
|---|---|---|---|
| docs-modify | agents/docs-modify.md | inherit | revise, add, auto-update, auto-revise, deprecate |
| docs-validate | agents/docs-validate.md | inherit | audit, verify, sanity-check, test |
| docs-citations | agents/docs-citations.md | inherit | generate, update, verify, audit |
| docs-api-refs | agents/docs-api-refs.md | inherit | generate, audit |
| docs-locals | agents/docs-locals.md | inherit | annotate, contracts, cross-ref, validate, shapes, coverage |
| docs-verbosity | agents/docs-verbosity.md | sonnet | audit |
| docs-index | agents/docs-index.md | sonnet | update-project-index, update-doc-links, update-example-claude |
| docs-system | agents/docs-system.md | sonnet | update-skills, setup |

## Commands

| Command | Skill File | Engine | Operation |
|---|---|---|---|
| /fp-docs:revise | skills/revise/SKILL.md | docs-modify | revise |
| /fp-docs:add | skills/add/SKILL.md | docs-modify | add |
| /fp-docs:auto-update | skills/auto-update/SKILL.md | docs-modify | auto-update |
| /fp-docs:auto-revise | skills/auto-revise/SKILL.md | docs-modify | auto-revise |
| /fp-docs:deprecate | skills/deprecate/SKILL.md | docs-modify | deprecate |
| /fp-docs:audit | skills/audit/SKILL.md | docs-validate | audit |
| /fp-docs:verify | skills/verify/SKILL.md | docs-validate | verify |
| /fp-docs:sanity-check | skills/sanity-check/SKILL.md | docs-validate | sanity-check |
| /fp-docs:test | skills/test/SKILL.md | docs-validate | test |
| /fp-docs:citations | skills/citations/SKILL.md | docs-citations | (subcommand) |
| /fp-docs:api-ref | skills/api-ref/SKILL.md | docs-api-refs | (subcommand) |
| /fp-docs:locals | skills/locals/SKILL.md | docs-locals | (subcommand) |
| /fp-docs:verbosity-audit | skills/verbosity-audit/SKILL.md | docs-verbosity | audit |
| /fp-docs:update-index | skills/update-index/SKILL.md | docs-index | update-project-index |
| /fp-docs:update-claude | skills/update-claude/SKILL.md | docs-index | update-example-claude |
| /fp-docs:update-skills | skills/update-skills/SKILL.md | docs-system | update-skills |
| /fp-docs:setup | skills/setup/SKILL.md | docs-system | setup |
| /fp-docs:parallel | skills/parallel/SKILL.md | (orchestrator) | (batch) |

## Shared Modules (Preloaded)

| Module | Skill Name | Preloaded By |
|---|---|---|
| Standards | docs-mod-standards | ALL engines |
| Project Config | docs-mod-project | ALL engines |
| Pipeline | docs-mod-pipeline | docs-modify |
| Citations | docs-mod-citations | docs-modify, docs-citations |
| API Refs | docs-mod-api-refs | docs-modify, docs-api-refs |
| Locals | docs-mod-locals | docs-modify, docs-locals |
| Verbosity | docs-mod-verbosity | docs-modify, docs-verbosity |
| Validation | docs-mod-validation | docs-modify, docs-validate |
| Changelog | docs-mod-changelog | docs-modify |
| Index | docs-mod-index | docs-modify, docs-index |

## Hooks

| Event | Matcher | Script | Purpose |
|---|---|---|---|
| SessionStart | (all) | scripts/inject-manifest.sh | Inject plugin root + manifest |
| SubagentStop | docs-modify | scripts/post-modify-check.sh | Validate pipeline completion |
| TeammateIdle | (all) | scripts/teammate-idle-check.sh | Validate teammate pipeline |
| TaskCompleted | (all) | scripts/task-completed-check.sh | Validate task outputs |
```

### Validation Steps

After all phases complete:

1. **Structure check**: Verify all 80+ files exist at expected paths
2. **Plugin load test**: `claude --plugin-dir ./fp-docs-system` — confirm no load errors
3. **Skill visibility**: Run `/help` — confirm all 18 `/fp-docs:*` commands appear
4. **Agent visibility**: Run `/agents` — confirm all 8 `docs-*` agents appear
5. **Smoke test**: Run `/fp-docs:verify docs/06-helpers/posts.md` — confirm engine launches, reads modules, executes instruction, returns results
6. **Pipeline test**: Run `/fp-docs:revise fix a minor typo in posts.md` — confirm the 7-stage pipeline executes
7. **Hook test**: Confirm SessionStart injects manifest into context on startup

---

## 10. Migration Mapping

### 1.0 → 2.0 Complete File Mapping

#### System Files (MOVE to plugin)

| 1.0 Location (relative to theme docs/) | 2.0 Plugin Location | Action |
|---|---|---|
| `claude-code-docs-system/docs-system.md` | `framework/` (decomposed) | Extract lifecycle → `docs-mod-pipeline`, source map → `docs-mod-project`, rules → engine system prompts |
| `claude-code-docs-system/docs-standards.md` | `skills/docs-mod-*/` (decomposed) | Extract §1-6 → `docs-mod-standards`, §7 → `docs-mod-citations`, §9 → `docs-mod-locals` |
| `claude-code-docs-system/docs-system-config.md` | `framework/config/system-config.md` | Direct migration + threshold extraction |
| `claude-code-docs-system/docs-verbosity-engine.md` | `skills/docs-mod-verbosity/` + `framework/modules/verbosity-rules.md` | Split: summary → module skill, algorithm → framework module |
| `claude-code-docs-system/docs-commands-list.md` | `framework/manifest.md` | Replace routing table with manifest |
| 27 instruction files (`instructions/cc-*.md`) | `framework/instructions/*/` + `framework/modules/` | Refactor: step procedures → instructions, algorithms → modules |

#### Skill Files (RENAME and migrate)

| 1.0 Skill | 2.0 Skill | Invocation Change |
|---|---|---|
| `.claude/skills/docs-revise/SKILL.md` | `fp-docs-system/skills/revise/SKILL.md` | `/docs-revise` → `/fp-docs:revise` |
| `.claude/skills/docs-auto-update/SKILL.md` | `fp-docs-system/skills/auto-update/SKILL.md` | `/docs-auto-update` → `/fp-docs:auto-update` |
| `.claude/skills/docs-audit/SKILL.md` | `fp-docs-system/skills/audit/SKILL.md` | `/docs-audit` → `/fp-docs:audit` |
| `.claude/skills/docs-add/SKILL.md` | `fp-docs-system/skills/add/SKILL.md` | `/docs-add` → `/fp-docs:add` |
| `.claude/skills/docs-deprecate/SKILL.md` | `fp-docs-system/skills/deprecate/SKILL.md` | `/docs-deprecate` → `/fp-docs:deprecate` |
| `.claude/skills/docs-citations/SKILL.md` | `fp-docs-system/skills/citations/SKILL.md` | `/docs-citations` → `/fp-docs:citations` |
| `.claude/skills/docs-api-ref/SKILL.md` | `fp-docs-system/skills/api-ref/SKILL.md` | `/docs-api-ref` → `/fp-docs:api-ref` |
| `.claude/skills/docs-locals/SKILL.md` | `fp-docs-system/skills/locals/SKILL.md` | `/docs-locals` → `/fp-docs:locals` |
| `.claude/skills/docs-verify/SKILL.md` | `fp-docs-system/skills/verify/SKILL.md` | `/docs-verify` → `/fp-docs:verify` |
| `.claude/skills/docs-sanity-check/SKILL.md` | `fp-docs-system/skills/sanity-check/SKILL.md` | `/docs-sanity-check` → `/fp-docs:sanity-check` |
| `.claude/skills/docs-test/SKILL.md` | `fp-docs-system/skills/test/SKILL.md` | `/docs-test` → `/fp-docs:test` |
| `.claude/skills/docs-verbosity-audit/SKILL.md` | `fp-docs-system/skills/verbosity-audit/SKILL.md` | `/docs-verbosity-audit` → `/fp-docs:verbosity-audit` |
| `.claude/skills/docs-auto-revise/SKILL.md` | `fp-docs-system/skills/auto-revise/SKILL.md` | `/docs-auto-revise` → `/fp-docs:auto-revise` |
| `.claude/skills/docs-update-index/SKILL.md` | `fp-docs-system/skills/update-index/SKILL.md` | `/docs-update-index` → `/fp-docs:update-index` |
| `.claude/skills/docs-update-claude/SKILL.md` | `fp-docs-system/skills/update-claude/SKILL.md` | `/docs-update-claude` → `/fp-docs:update-claude` |
| `.claude/skills/docs-update-skills/SKILL.md` | `fp-docs-system/skills/update-skills/SKILL.md` | `/docs-update-skills` → `/fp-docs:update-skills` |
| (new) | `fp-docs-system/skills/setup/SKILL.md` | `/fp-docs:setup` |
| (new) | `fp-docs-system/skills/parallel/SKILL.md` | `/fp-docs:parallel` |

#### Content Files (STAY in `docs/`)

All 364 documentation content files, trackers, and PROJECT-INDEX.md stay exactly where they are. The plugin reads them in place.

### Post-Migration Cleanup

After 2.0 is validated and working:
1. Remove old 1.0 skill files from `.claude/skills/docs-*/`
2. Archive (don't delete) `docs/claude-code-docs-system/` — engines may still reference PROJECT-INDEX.md there
3. Update project `.claude/CLAUDE.md` to reference plugin commands instead of standalone skills
4. Remove `docs/docs-management.md` (replaced by plugin README)
5. Keep `docs/docs-prompts.md` as source of truth for prompt definitions

---

## 11. Validation Checklist

### Phase-by-Phase Validation

| Phase | Check | How to Validate |
|---|---|---|
| 1 | Plugin loads without errors | `claude --plugin-dir ./fp-docs-system` — no error output |
| 2 | Modules visible to engines | Engine system prompt lists preloaded skills |
| 3 | Framework modules readable | Engine can `Read` a module file during pipeline |
| 4 | Instruction files accessible | Engine can `Read` instruction file for its operation |
| 5 | Engines launch correctly | `/agents` shows all 8 docs-* agents |
| 6 | Hooks fire on events | SessionStart injects manifest; SubagentStop validates |
| 7 | Skills invoke engines | `/fp-docs:revise "test"` launches docs-modify |
| 8 | Manifest accurate | All paths in manifest resolve to real files |

### Smoke Test Sequence

1. `claude --plugin-dir ./fp-docs-system`
2. Verify: `/help` shows 18 `/fp-docs:*` commands
3. Run: `/fp-docs:verify docs/06-helpers/posts.md`
4. Verify: docs-validate engine launches, runs 10-point checklist, returns results
5. Run: `/fp-docs:audit --depth quick docs/06-helpers/`
6. Verify: docs-validate engine audits all helper docs
7. Run: `/fp-docs:revise "fix the return type in posts helper docs"`
8. Verify: docs-modify engine launches, modifies doc, runs pipeline, updates changelog

---

## 12. Plugin-Dev Integration Notes

### Using `/plugin-dev:create-plugin`

If using the official plugin-dev plugin to scaffold this:

1. **Phase 1 (Discovery)**: Feed it this description: "Documentation management system for the Foreign Policy WordPress theme. 8 engine agents, 10 shared modules, 18 user commands, hooks for pipeline validation."

2. **Phase 2 (Component Planning)**: Confirm these components:
   - 18 Skills (user-facing)
   - 10 Skills (shared modules with `disable-model-invocation: true`)
   - 8 Agents (one per engine)
   - 4 Hooks (SessionStart, SubagentStop, TeammateIdle, TaskCompleted)
   - 1 Settings file

3. **Phase 3 (Detailed Design)**: Reference this implementation plan for answers to all design questions. The spec files contain complete answers.

4. **Phase 4 (Structure Creation)**: Let it scaffold the directory structure. Verify it matches the structure in this plan.

5. **Phase 5 (Component Implementation)**: For each component, provide content from the corresponding section of this plan. The `agent-creator` subagent will generate agent definitions — feed it the specs from Phase 5 above.

6. **Phase 6 (Validation)**: Let the `plugin-validator` agent run. Fix any issues it flags.

7. **Phase 7 (Testing)**: Follow the smoke test sequence in §11.

8. **Phase 8 (Documentation)**: README content is specified in Phase 1 above.

### Key Things plugin-dev Needs to Know

- Skill names use the plugin namespace: `/fp-docs:{skill-name}`
- Shared modules MUST have `disable-model-invocation: true` and `user-invocable: false`
- Agent descriptions MUST include `<example>` blocks with `<commentary>`
- The `context: fork` + `agent: docs-{engine}` combination on skills routes them to the correct engine
- Hook scripts use `${CLAUDE_PLUGIN_ROOT}` for path resolution
- The `!`command`!` syntax in auto-update skill body is dynamic injection (runs at invocation time)

### Content That Must Be Written (Not Just Scaffolded)

The plugin-dev tool can scaffold the file structure and frontmatter, but these files require substantive content that must be written by reading the 1.0 source files:

1. **10 shared module bodies** — extracted from 1.0 system files (docs-standards.md, docs-verbosity-engine.md, etc.)
2. **8 engine system prompts** — the `docs-modify` prototype is in `prototype-engine.md`; the other 7 follow the same pattern
3. **22 instruction files** — extracted and restructured from 1.0 `instructions/cc-*.md` files
4. **11 framework modules** — algorithms extracted from 1.0 instruction and system files
5. **System manifest** — inventory of all components (generated after everything exists)

These are the bulk of the work. The skills, hooks, and config files are mostly structural (frontmatter + short bodies).

---

## File Count Summary

| Category | Count | Phase |
|---|---|---|
| Plugin config (plugin.json, settings.json, README) | 3 | 1 |
| Framework config (system-config, project-config) | 2 | 1 |
| Shared modules (docs-mod-*) | 10 | 2 |
| On-demand modules (framework/modules/) | 11 | 3 |
| Instruction files (framework/instructions/) | 22 | 4 |
| Engine agents (agents/docs-*) | 8 | 5 |
| Hook JSON + scripts | 5 | 6 |
| User-facing skills | 18 | 7 |
| System manifest | 1 | 8 |
| **TOTAL** | **80** | |

---

## Dependency Graph (Visual)

```
Phase 1: Bootstrap
├── .claude-plugin/plugin.json
├── settings.json
├── README.md
├── framework/config/system-config.md
└── framework/config/project-config.md
    │
    ▼
Phase 2: Shared Modules (10 skill files)
├── skills/docs-mod-standards/SKILL.md    ← docs-standards.md §1-6
├── skills/docs-mod-project/SKILL.md      ← project-config.md (cached)
├── skills/docs-mod-pipeline/SKILL.md     ← docs-system.md lifecycle
├── skills/docs-mod-citations/SKILL.md    ← docs-standards.md §7
├── skills/docs-mod-api-refs/SKILL.md     ← docs-system-config.md §4
├── skills/docs-mod-locals/SKILL.md       ← docs-standards.md §9
├── skills/docs-mod-verbosity/SKILL.md    ← docs-verbosity-engine.md
├── skills/docs-mod-validation/SKILL.md   ← cc-verify + cc-sanity-check
├── skills/docs-mod-changelog/SKILL.md    ← cc-changelog.md
└── skills/docs-mod-index/SKILL.md        ← cc-update-project-index.md
    │
    ▼
Phase 3: On-Demand Modules (11 framework files)
├── framework/modules/verbosity-rules.md
├── framework/modules/citation-rules.md
├── framework/modules/api-ref-rules.md
├── framework/modules/validation-rules.md
├── framework/modules/changelog-rules.md
├── framework/modules/index-rules.md
├── framework/modules/post-modify-checklist.md
├── framework/modules/codebase-analysis-guide.md
├── framework/modules/cross-reference-validation.md
├── framework/modules/citation-staleness-detection.md
└── framework/modules/locals-contract-grammar.md
    │
    ▼
Phase 4: Instruction Files (22 files across 7 directories)
├── framework/instructions/modify/     (5 files)
├── framework/instructions/validate/   (4 files)
├── framework/instructions/citations/  (4 files)
├── framework/instructions/api-refs/   (2 files)
├── framework/instructions/locals/     (6 files)
├── framework/instructions/verbosity/  (1 file)
└── framework/instructions/index/      (1 file)
    │
    ▼
Phase 5: Engine Agents (8 files)
├── agents/docs-modify.md      ← inherit, green
├── agents/docs-validate.md    ← inherit, cyan
├── agents/docs-citations.md   ← inherit, yellow
├── agents/docs-api-refs.md    ← inherit, yellow
├── agents/docs-locals.md      ← inherit, magenta
├── agents/docs-verbosity.md   ← sonnet, red
├── agents/docs-index.md       ← sonnet, blue
└── agents/docs-system.md      ← sonnet, blue
    │
    ▼
Phase 6: Hook System (5 files)
├── hooks/hooks.json
├── scripts/inject-manifest.sh
├── scripts/post-modify-check.sh
├── scripts/teammate-idle-check.sh
└── scripts/task-completed-check.sh
    │
    ▼
Phase 7: User-Facing Skills (18 files)
├── skills/revise/SKILL.md          → docs-modify
├── skills/add/SKILL.md             → docs-modify
├── skills/auto-update/SKILL.md     → docs-modify (+ dynamic injection)
├── skills/auto-revise/SKILL.md     → docs-modify
├── skills/deprecate/SKILL.md       → docs-modify
├── skills/audit/SKILL.md           → docs-validate (read-only)
├── skills/verify/SKILL.md          → docs-validate (read-only)
├── skills/sanity-check/SKILL.md    → docs-validate (read-only)
├── skills/test/SKILL.md            → docs-validate
├── skills/citations/SKILL.md       → docs-citations
├── skills/api-ref/SKILL.md         → docs-api-refs
├── skills/locals/SKILL.md          → docs-locals
├── skills/verbosity-audit/SKILL.md → docs-verbosity (read-only)
├── skills/update-index/SKILL.md    → docs-index
├── skills/update-claude/SKILL.md   → docs-index
├── skills/update-skills/SKILL.md   → docs-system
├── skills/setup/SKILL.md           → docs-system
└── skills/parallel/SKILL.md        → (main context orchestrator)
    │
    ▼
Phase 8: System Manifest
└── framework/manifest.md    ← inventories all of the above
```
