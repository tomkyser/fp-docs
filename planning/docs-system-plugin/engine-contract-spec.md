# Engine Contract Specification

> **Status**: DRAFT
> **Date**: 2026-03-01
> **Parent**: `proposal-spec.md`

---

## 1. What Is an Engine

An engine is a **pluggable subsystem** that owns a defined domain of responsibility within the documentation system. Each engine is implemented as a Claude Code custom subagent (`agents/*.md` in the plugin root) that follows this contract.

Engines are the unit of extensibility. To add a new capability to the docs system, you create a new engine that satisfies this contract. You should never need to modify existing engines to add new ones.

### Engine vs. Skill vs. Module

| Concept | What It Is | File Location (plugin-relative) | Example |
|---------|-----------|---------------|---------|
| **Engine** | A self-contained worker with its own context, tools, memory, and hooks | `agents/docs-*.md` | `docs-modify` — handles all doc modification operations |
| **Skill** | A user-facing command that invokes an engine | `skills/*/SKILL.md` | `/fp-docs:revise` — invokes docs-modify with "revise" operation |
| **Module** | Shared operational rules preloaded into engines | `skills/docs-mod-*/SKILL.md` | `docs-mod-citations` — citation format rules used by multiple engines |

### Engine Guarantees

Every engine MUST:
1. **Be self-contained** — complete its operation within its own context; never assume another engine will run after it
2. **Follow the pipeline** — if it modifies documentation, execute all applicable pipeline stages within its own context
3. **Read before writing** — always read source code and existing docs before making changes (never guess)
4. **Preserve content** — never delete accurate documentation content unless explicitly instructed
5. **Report its work** — return a structured summary of what it did and what it changed
6. **Update memory** — record useful patterns and learnings to its persistent memory
7. **Handle flags** — respect skip flags (`--no-citations`, `--no-sanity-check`, etc.) passed via skill arguments

---

## 2. Engine File Structure

### Required: Subagent Definition

Every engine MUST have a subagent definition file at `agents/docs-{engine-name}.md` in the plugin root.

```yaml
---
# REQUIRED fields
name: docs-{engine-name}
description: >
  {One-sentence description of what this engine does and when Claude should
  delegate to it. Be specific — Claude uses this to decide when to invoke.}

# REQUIRED: tool access
tools: Read, Write, Edit, Grep, Glob, Bash

# REQUIRED: skill module preloads
skills:
  - docs-mod-standards        # ALWAYS: shared formatting rules
  - docs-mod-project          # ALWAYS: FP-specific config
  # ... engine-specific modules

# RECOMMENDED: persistent memory
memory: project

# OPTIONAL: UI color for agent identification
# NOTE: color is functional but NOT in the official frontmatter reference table.
# It is set via the /agents interactive wizard (step 6). Treat as non-critical/cosmetic.
color: "#RRGGBB"              # unique color per engine (see §6 for assignments)

# OPTIONAL: model selection (see Model Tiering below)
model: inherit                 # complex engines: inherit (uses main conversation model)
                               # lightweight engines: sonnet (cheaper, faster)

# OPTIONAL: tool restrictions (for read-only engines)
# disallowedTools: [Write, Edit]  # preferred over permissionMode for read-only enforcement

# OPTIONAL: max turns
maxTurns: 50                   # prevent runaway engines

# OPTIONAL: engine-specific hooks
hooks:
  PreToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: "${CLAUDE_PLUGIN_ROOT}/scripts/{engine-specific-validation}.sh"

# OPTIONAL: MCP servers (future)
# mcpServers:
#   context7:
#     command: npx
#     args: ["-y", "@anthropic-ai/context7-server"]
---

{ENGINE SYSTEM PROMPT — see Section 3}
```

### Required: Instruction Files

Every engine MUST have at least one instruction file at `framework/instructions/{engine-name}/` in the plugin.

Each instruction file defines the step-by-step procedure for one operation the engine performs. The engine reads the appropriate instruction file based on the operation requested. The plugin root path is injected via the SessionStart hook's `additionalContext`.

### Required: Preloaded Modules

Every engine MUST preload at minimum:
- `docs-mod-standards` — shared formatting rules
- `docs-mod-project` — FP-specific configuration

Engines that modify documentation MUST also preload:
- `docs-mod-pipeline` — post-modification pipeline definition

### Optional: Engine-Specific Hooks

Engines MAY define hooks in their frontmatter for engine-specific validation (e.g., the citations engine validates citation format before writing). Hook commands use `${CLAUDE_PLUGIN_ROOT}` to reference scripts.

### Optional: Engine Memory

Engines SHOULD set `memory: project` to accumulate knowledge across sessions. The memory directory is auto-created at `.claude/agent-memory/docs-{engine-name}/` in the consuming project (not inside the plugin).

---

## 3. Engine System Prompt Structure

The subagent's markdown body (below the YAML frontmatter) is the engine's system prompt. It MUST follow this structure:

```markdown
You are the {Engine Name} for the FP documentation system.

## Identity
- Engine: docs-{engine-name}
- Domain: {what this engine is responsible for}
- Operations: {list of operations this engine handles}

## How You Work

### Plugin Root
The fp-docs plugin root path is provided in your session context via the
SessionStart hook. Use this path to locate instruction files and on-demand
modules. All plugin-relative paths below assume this root.

### Receiving Operations
You will be invoked with a prompt that specifies:
1. The **operation** to perform (e.g., "revise", "add", "auto-update")
2. The **target** (e.g., a file path, a description, a scope)
3. Optional **flags** (e.g., "--no-citations", "--mode plan")

### Finding Instructions
For each operation, read the corresponding instruction file from the plugin:
- "revise" → Read {plugin-root}/framework/instructions/{engine-name}/revise.md
- "add" → Read {plugin-root}/framework/instructions/{engine-name}/add.md
- {etc.}

### Using Your Preloaded Modules
Your preloaded skill modules contain the rules you need:
- **docs-mod-standards**: All shared formatting rules, templates, naming conventions
- **docs-mod-project**: FP source-to-docs mapping, project paths, enabled features
- **docs-mod-pipeline**: Post-modification pipeline stages and skip conditions
- {list other preloaded modules}

### On-Demand Module Loading
For pipeline stages, read the relevant module file when you reach that stage:
- Citation stage → Read {plugin-root}/framework/modules/citation-rules.md
- Validation stage → Read {plugin-root}/framework/modules/validation-rules.md
- {etc.}

### Reporting Your Work
When you complete your operation, return a structured summary:
- Files modified (with paths)
- Changes made (brief description per file)
- Pipeline stages completed
- Any issues found or flags raised
- Verification checklist results (if applicable)

## Memory Management
As you work, note patterns worth remembering:
- Common format issues in this codebase
- Frequently-updated files and their typical changes
- False positive patterns in validation
Write concise notes to your memory only when you discover something new.

## Critical Rules
1. NEVER guess — read actual source code before writing documentation
2. NEVER skip verification — always run the verification checklist after modifications
3. ALWAYS update the changelog after modifications
4. ALWAYS read a sibling doc for format reference before creating new docs
5. When in doubt, use [NEEDS INVESTIGATION]
6. File paths are always relative to theme root
7. Preserve accurate content when revising — never delete correct information
```

---

## 4. Shared Skill Module Contract

### Module File Structure

Each module is a Claude Code skill with frontmatter that hides it from users and Claude's auto-invocation:

```yaml
# skills/docs-mod-{name}/SKILL.md (plugin-relative)
---
name: docs-mod-{name}
description: >
  {Module description — what rules/knowledge this provides}
disable-model-invocation: true    # REQUIRED: invisible to Claude
user-invocable: false             # REQUIRED: not in / menu
---

{MODULE CONTENT — operational rules, formats, algorithms}
```

### Module Types

| Type | Purpose | Update Frequency |
|------|---------|-----------------|
| **Standards module** | Shared formatting rules, templates, naming conventions | Rarely (when adding new doc types) |
| **Project module** | FP source-to-docs mapping, project paths, feature enables | When project structure changes |
| **Domain module** | Rules for a specific subsystem (citations, API refs, etc.) | When subsystem behavior changes |
| **Pipeline module** | Post-modification stage definitions and skip conditions | When adding/removing pipeline stages |

### Module Deduplication Rules

1. **Each rule lives in exactly one module.** No rule is defined in two places.
2. **Modules do not import other modules.** Modules are flat — no nesting.
3. **Engines preload modules; modules don't know about engines.** Dependency flows one direction.
4. **FP-specific values go in the project module**, not in domain modules.

---

## 5. Pipeline Contract

### What Is the Pipeline

The pipeline is the sequence of post-operation stages that must run after any documentation modification. It ensures consistency across all modification commands (revise, add, auto-update, auto-revise, deprecate).

### Pipeline Definition (in `docs-mod-pipeline` module)

```markdown
## Post-Modification Pipeline

After completing the primary operation, execute these stages in order.
Each stage has a skip condition that can be triggered by flags.

### Stage 1: Verbosity Enforcement
- **Module**: Read {plugin-root}/framework/modules/verbosity-rules.md
- **Skip if**: --no-verbosity flag OR verbosity.enabled=false in system config
- **Action**: Scan modified doc for banned summarization phrases, unexpanded
  enumerables, and missing items. Fix violations before proceeding.

### Stage 2: Citations
- **Module**: Read {plugin-root}/framework/modules/citation-rules.md
- **Skip if**: --no-citations flag OR citations.enabled=false in system config
- **Action**: For new docs, generate citation blocks. For revised docs, update
  existing citations. Use the operation type to determine generate vs. update.

### Stage 3: API References
- **Module**: Read {plugin-root}/framework/modules/api-ref-rules.md
- **Skip if**: --no-api-ref flag OR api_refs.enabled=false in system config
  OR doc type not in API ref scope table
- **Action**: Update the API Reference table to reflect current source code.
  Verify provenance markers on all rows.

### Stage 4: Sanity-Check
- **Module**: Read {plugin-root}/framework/modules/validation-rules.md (sanity-check section)
- **Skip if**: --no-sanity-check flag OR sanity_check.default_enabled=false
- **Action**: Compare every claim in the modified doc against actual source code.
  Flag any claim that cannot be verified as [NEEDS INVESTIGATION].

### Stage 5: Verification
- **Module**: Read {plugin-root}/framework/modules/validation-rules.md (verify section)
- **Skip if**: NEVER — verification always runs
- **Action**: Run the 10-point verification checklist. Report pass/fail per check.

### Stage 6: Changelog
- **Module**: Read {plugin-root}/framework/modules/changelog-rules.md
- **Skip if**: NEVER — changelog always runs for modifications
- **Action**: Append a dated entry to docs/changelog.md describing the change.

### Stage 7: Index Update
- **Module**: Read {plugin-root}/framework/modules/index-rules.md
- **Skip if**: No structural changes (no new files, no deleted files, no moved files)
- **Action**: Update About.md and relevant _index.md files if doc structure changed.
  Update PROJECT-INDEX.md if source code structure changed.
```

### Pipeline Skip Flags

| Flag | Skips Stage | Pattern |
|------|------------|---------|
| `--no-verbosity` | Verbosity Enforcement | opt-out |
| `--no-citations` | Citations | opt-out |
| `--no-api-ref` | API References | opt-out |
| `--no-sanity-check` | Sanity-Check | opt-out |
| `--no-index` | Index Update | opt-out |
| *(none)* | Verification | never skippable |
| *(none)* | Changelog | never skippable |

---

## 6. Engine Types

### 6.1 Modification Engine (`docs-modify`)

The most complex engine. Handles all operations that change documentation content.

```yaml
skills:
  - docs-mod-standards
  - docs-mod-project
  - docs-mod-pipeline         # Defines the post-modification stages
color: "#4CAF50"               # Green — modification/creation
model: inherit                 # Complex operations need full model
```

**Operations**: revise, add, auto-update, auto-revise, deprecate

**How it selects the operation**: The invoking skill passes the operation name in the prompt. The engine reads the corresponding instruction file from `{plugin-root}/framework/instructions/modify/{operation}.md`.

**Post-modification pipeline**: ALWAYS runs after primary operation (with flag-based skip conditions).

**On-demand modules**: Reads citation-rules, validation-rules, verbosity-rules, api-ref-rules, changelog-rules, index-rules from `{plugin-root}/framework/modules/` as it reaches each pipeline stage.

### 6.2 Validation Engine (`docs-validate`)

Read-only engine. Never modifies documentation directly — only reports findings.

```yaml
skills:
  - docs-mod-standards
  - docs-mod-project
  - docs-mod-validation       # 10-point checklist + sanity-check algorithm
tools: Read, Grep, Glob, Bash  # Note: NO Write or Edit
disallowedTools: [Write, Edit] # Explicit read-only enforcement
color: "#2196F3"               # Blue — validation/read-only
model: inherit                 # Complex reasoning required for deep audits
```

**Operations**: audit, verify, sanity-check, test

**Post-modification pipeline**: Does NOT run (this engine doesn't modify docs).

### 6.3 Citations Engine (`docs-citations`)

Specialized engine for citation-specific operations that don't modify doc content beyond citations.

```yaml
skills:
  - docs-mod-standards
  - docs-mod-project
  - docs-mod-citations        # Full citation rules, tiers, staleness detection
color: "#FF9800"               # Orange — citations domain
model: inherit                 # Citation analysis requires precise code matching
```

**Operations**: generate, update, verify, audit

**Post-modification pipeline**: Runs a reduced pipeline (verify + changelog only) for generate and update operations. Does NOT run for verify and audit operations.

### 6.4 API References Engine (`docs-api-refs`)

Specialized engine for API reference table operations.

```yaml
skills:
  - docs-mod-standards
  - docs-mod-project
  - docs-mod-api-refs         # API ref format, provenance, scope table
color: "#00BCD4"               # Cyan — API reference domain
model: inherit                 # API analysis requires precise signature matching
```

**Operations**: generate/update (combined), audit

**Post-modification pipeline**: Runs a reduced pipeline (verify + changelog only) for generate/update. Does NOT run for audit.

### 6.5 Locals Engine (`docs-locals`)

Specialized engine for $locals contract documentation.

```yaml
skills:
  - docs-mod-standards
  - docs-mod-project
  - docs-mod-locals           # Locals contract format, shapes, ground truth
color: "#E91E63"               # Pink — locals/contracts domain
model: inherit                 # Contract analysis requires precise PHP parsing
```

**Operations**: annotate, contracts, cross-ref, validate, shapes, coverage

**Post-modification pipeline**: Runs for annotate and contracts (which modify docs). Does NOT run for validate, cross-ref, shapes, coverage (read-only).

### 6.6 Verbosity Engine (`docs-verbosity`)

Specialized engine for standalone verbosity auditing.

```yaml
skills:
  - docs-mod-standards
  - docs-mod-project
  - docs-mod-verbosity        # Anti-brevity rules, banned phrases, scope manifests
tools: Read, Grep, Glob, Bash  # Read-only for audit mode
disallowedTools: [Write, Edit] # Explicit read-only enforcement
color: "#9C27B0"               # Purple — verbosity domain
model: sonnet                  # Lightweight scanning, doesn't need full model
```

**Operations**: audit (standalone scan for verbosity gaps)

**Post-modification pipeline**: Does NOT run (audit is read-only).

### 6.7 Index Engine (`docs-index`)

Manages structural documentation indexes and system templates.

```yaml
skills:
  - docs-mod-standards
  - docs-mod-project
  - docs-mod-index            # PROJECT-INDEX format, doc link rules
color: "#607D8B"               # Blue-grey — structural/index operations
model: sonnet                  # Lightweight structural updates, no deep analysis
```

**Operations**: update-project-index, update-doc-links, update-example-claude

**Post-modification pipeline**: Does NOT run (index updates are structural, not content changes).

### 6.8 System Engine (`docs-system`)

System maintenance operations.

```yaml
skills:
  - docs-mod-standards
  - docs-mod-project
color: "#795548"               # Brown — system/meta operations
model: sonnet                  # Lightweight maintenance, no deep analysis
```

**Operations**: update-skills, setup (bootstrap and validation)

**Post-modification pipeline**: Does NOT run.

### Model Tiering Strategy

Engines use two model tiers based on their operational complexity:

| Tier | `model:` value | When to use | Engines |
|------|---------------|-------------|---------|
| **Full** | `inherit` | Operations requiring deep code analysis, precise signature matching, complex reasoning, or multi-step pipeline execution | docs-modify, docs-validate, docs-citations, docs-api-refs, docs-locals |
| **Lightweight** | `sonnet` | Structural updates, scanning, maintenance operations, and tasks that don't require deep reasoning | docs-index, docs-system, docs-verbosity |

`inherit` uses whatever model the main conversation is using (typically Opus). `sonnet` is cheaper and faster, appropriate for engines where the task is mechanical rather than analytical.

When adding a new engine, choose the tier based on whether the engine needs to:
- Parse and understand source code semantics → `inherit`
- Match patterns and update structure → `sonnet`

### Read-Only Enforcement

Read-only engines (those that only report findings, never modify docs) should use `disallowedTools` rather than `permissionMode: plan`:

```yaml
# PREFERRED: explicit tool denial
disallowedTools: [Write, Edit]

# DEPRECATED for this purpose: plan mode adds overhead beyond read-only enforcement
# permissionMode: plan
```

`disallowedTools` is more explicit — it states exactly which tools are denied. `permissionMode: plan` was originally designed for approval workflows, not read-only enforcement.

User-facing skills that target read-only engines can also set `allowed-tools` in their frontmatter as defense-in-depth:

```yaml
# skills/audit/SKILL.md
---
name: audit
allowed-tools: [Read, Grep, Glob, Bash]
context: fork
agent: docs-validate
---
```

### Background Mode for Long-Running Operations

For operations that may take significant time (e.g., deep audits across all doc sections, batch citations generation), engines can be invoked with `run_in_background: true` via the Agent tool. This allows the user to continue working while the engine processes.

This is an **invocation pattern**, not an engine definition field. The skill or orchestrator decides whether to use background mode based on the scope of the operation.

### Engine Color Assignments

Each engine has a unique `color` field for UI differentiation:

| Engine | Color | Hex |
|--------|-------|-----|
| docs-modify | Green | `#4CAF50` |
| docs-validate | Blue | `#2196F3` |
| docs-citations | Orange | `#FF9800` |
| docs-api-refs | Cyan | `#00BCD4` |
| docs-locals | Pink | `#E91E63` |
| docs-verbosity | Purple | `#9C27B0` |
| docs-index | Blue-grey | `#607D8B` |
| docs-system | Brown | `#795548` |

> **Note**: The `color` field is not listed in the official subagent frontmatter reference table but is functional. It appears in the `/agents` interactive wizard (step 6: "Choose a color"). Treat as non-critical — engines work identically without it.

---

## 7. Adding a New Engine

Follow these steps to add a new engine to the fp-docs plugin.

### Step 1: Define the Engine

Create `agents/docs-{name}.md` following the subagent definition format in Section 2. Include:
- `name`, `description`, `tools`, `skills` (at minimum standards + project)
- System prompt following Section 3 structure
- `memory: project` (recommended)

### Step 2: Create Instruction Files

Create `framework/instructions/{name}/` with one `.md` file per operation the engine handles. Each instruction file defines numbered steps for the operation.

### Step 3: Create Domain Module (if needed)

If the engine introduces new operational rules that other engines might need, create `skills/docs-mod-{name}/SKILL.md` with:
- `disable-model-invocation: true`
- `user-invocable: false`
- The operational rules as markdown content

### Step 4: Create User-Facing Skills

For each user command the engine serves, create `skills/{command}/SKILL.md` with:
- `name`, `description`, `argument-hint`
- `context: fork` and `agent: docs-{name}`
- `$ARGUMENTS` handling for flags and parameters
- `allowed-tools` for read-only skills (defense-in-depth)

### Step 5: Update System Manifest

Add the engine to `framework/manifest.md`:
- Engine name, file path, description
- Operations it handles
- Skills that invoke it
- Modules it preloads

### Step 6: Update Pipeline (if applicable)

If the engine introduces a new pipeline stage, update `framework/modules/pipeline-rules.md` to include the new stage with its skip condition and module path.

### Step 7: Register Hooks (if applicable)

If the engine needs lifecycle hooks, add them to:
- Engine's YAML frontmatter (engine-scoped hooks, using `${CLAUDE_PLUGIN_ROOT}` for script paths)
- `hooks/hooks.json` (system-scoped hooks)

### Step 8: Update CLAUDE.md

Add the new user-facing commands to the skills table in the consuming project's `.claude/CLAUDE.md`.

### Step 9: Test

Verify:
- [ ] Engine can be invoked by each skill that targets it (e.g., `/fp-docs:{command}`)
- [ ] Engine reads correct instruction file for each operation
- [ ] Engine's preloaded modules provide the expected rules
- [ ] Pipeline stages fire correctly (if applicable)
- [ ] Flags are respected (skip conditions work)
- [ ] Memory is updated with learnings
- [ ] SubagentStop hook validates engine completion

---

## 8. Engine Communication

Engines do not communicate directly with each other. All orchestration happens through:

1. **Skills** — invoke one engine per command
2. **The main conversation** — can chain engine invocations
3. **Hooks** — fire deterministically after engine completion
4. **Shared files** — engines read/write the same doc files on disk

This is by design. Flat engine architecture (no engine-to-engine calls) means:
- Each engine is independently testable
- Engine failures are isolated
- The system is easier to reason about
- No circular dependency risk

---

## 9. Engine Validation

### SubagentStop Hook

When any `docs-modify` engine completes, a SubagentStop hook runs `post-modify-check.sh`:

```bash
#!/bin/bash
# scripts/post-modify-check.sh
# Validates that the modify engine completed all mandatory pipeline stages

INPUT=$(cat)
AGENT_TYPE=$(echo "$INPUT" | jq -r '.agent_type // empty')

# Only validate docs-modify engine
if [[ "$AGENT_TYPE" != "docs-modify" ]]; then
  exit 0
fi

# Check that changelog was updated (mandatory)
CHANGELOG_MODIFIED=$(git diff --name-only -- docs/changelog.md 2>/dev/null)
if [[ -z "$CHANGELOG_MODIFIED" ]]; then
  echo "WARNING: docs-modify completed but changelog.md was not updated" >&2
  # Don't block (exit 2) — just warn
fi

exit 0
```

Hook registration in `hooks/hooks.json`:

```json
{
  "hooks": {
    "SubagentStop": [
      {
        "matcher": "docs-modify",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/post-modify-check.sh",
            "statusMessage": "Validating docs-modify completion..."
          }
        ]
      }
    ]
  }
}
```

> **Future enhancement**: The `agent` hook type (agentic, with tool access) could be used here for more intelligent validation — e.g., reading the modified doc to verify citations were added. Current design uses `command` type for simplicity and speed.

### System Validation Skill

The `/fp-docs:setup` skill includes a system validation step that checks:
- All engine files exist in `agents/`
- All required skill modules exist in `skills/`
- All instruction directories have at least one `.md` file
- System manifest lists all engines
- Hooks are registered in `hooks/hooks.json`
- Project config has required fields populated

---

## 10. Context Budget Considerations

### Preloaded Module Sizes (Targets)

| Module | Target Lines | Notes |
|--------|-------------|-------|
| docs-mod-standards | 200-250 | Extracted from docs-standards.md §1-§6 |
| docs-mod-project | 80-100 | FP source mapping + paths |
| docs-mod-pipeline | 80-100 | Stage definitions + skip conditions |
| docs-mod-citations | 150-180 | Citation format + tiers |
| docs-mod-api-refs | 100-120 | API ref format + provenance |
| docs-mod-locals | 120-150 | Locals contract format |
| docs-mod-verbosity | 100-120 | Verbosity rules + banned phrases |
| docs-mod-validation | 150-180 | 10-point checklist + sanity-check |
| docs-mod-changelog | 30-40 | Changelog entry format |
| docs-mod-index | 50-60 | Index + link update rules |

### Engine Context Budget

The docs-modify engine (most complex) preloads:
- Standards (~225 lines) + Project (~90 lines) + Pipeline (~90 lines) = **~405 lines preloaded**
- Engine system prompt: ~100 lines
- **Total at launch: ~505 lines**

On-demand modules loaded during pipeline execution add ~600-800 lines as needed but are spread across the operation's lifetime — the engine doesn't need all of them simultaneously.

This is **less than the current 1.0 bootstrap** (~1,025 lines) while providing more structured, more targeted content.

### Skill Description Budget

With 18 user-facing skills and 10 module skills:
- User skills: ~18 × 20 words = ~360 words of descriptions (loaded at session start)
- Module skills: `disable-model-invocation: true` = 0 words (invisible)
- Well within the 2% context budget (16K character fallback)
