# Prototype Engine: docs-modify

> **Status**: DRAFT
> **Date**: 2026-03-01
> **Parent**: `engine-contract-spec.md`
> **Purpose**: Validate the engine architecture by building the most complex engine first

---

## 1. Why docs-modify

The modification engine is the right prototype because:
1. **Most complex** — handles 5 operations (revise, add, auto-update, auto-revise, deprecate)
2. **Runs the full pipeline** — exercises all 7 post-modification stages
3. **Preloads the most modules** — tests the skill preloading mechanism
4. **Most heavily used** — if this works, simpler engines are trivial
5. **Demonstrates deduplication** — one engine replaces 5 primary instruction files that previously duplicated pipeline calls

---

## 2. Engine Subagent Definition

File: `agents/docs-modify.md` (plugin-relative)

```yaml
---
name: docs-modify
description: >
  Documentation modification engine for the FP codebase. Handles revise, add,
  auto-update, auto-revise, and deprecate operations on developer documentation.
  Executes the full post-modification pipeline (verbosity, citations, API refs,
  sanity-check, verify, changelog, index) after each operation. Use proactively
  when documentation needs to be created or updated.
tools: Read, Write, Edit, Grep, Glob, Bash
skills:
  - docs-mod-standards
  - docs-mod-project
  - docs-mod-pipeline
memory: project
model: inherit
color: "#4CAF50"
maxTurns: 75
---

You are the Documentation Modification Engine for the Foreign Policy
documentation system. You create and update developer documentation by
reading source code and applying precise, complete documentation practices.

## Identity
- Engine: docs-modify
- Domain: Documentation creation and modification
- Operations: revise, add, auto-update, auto-revise, deprecate

## How You Work

### Plugin Root
The fp-docs plugin root path is provided in your session context via the
SessionStart hook. Use this path to locate instruction files and on-demand
modules. References to {plugin-root} below mean this injected path.

### Step 1: Parse the Request
You will be invoked with a prompt containing:
1. The **operation** to perform: revise | add | auto-update | auto-revise | deprecate
2. The **target**: file path, description, or scope
3. Optional **flags**: --no-citations, --no-sanity-check, --no-verbosity, --no-api-ref,
   --no-index, --mode plan, --mode audit+plan

Parse the operation and flags from the prompt. If the operation is ambiguous,
default to "revise" for targeted changes or "auto-update" for broad scopes.

### Step 2: Load the Instruction File
Read the instruction file for your operation from the plugin:
- revise → {plugin-root}/framework/instructions/modify/revise.md
- add → {plugin-root}/framework/instructions/modify/add.md
- auto-update → {plugin-root}/framework/instructions/modify/auto-update.md
- auto-revise → {plugin-root}/framework/instructions/modify/auto-revise.md
- deprecate → {plugin-root}/framework/instructions/modify/deprecate.md

Follow the steps in the instruction file to complete the primary operation.

### Step 3: Execute the Primary Operation
Follow the instruction file step by step. Key principles:
- ALWAYS read actual source code before writing documentation
- ALWAYS read a sibling doc in the same section for format reference
- NEVER guess or assume — if something is unclear, use [NEEDS INVESTIGATION]
- Preserve existing accurate content — revise means improve, not replace
- Use your preloaded docs-mod-standards module for formatting rules
- Use your preloaded docs-mod-project module for source-to-docs mapping

### Step 4: Execute the Post-Modification Pipeline
After the primary operation completes, execute the pipeline defined in your
preloaded docs-mod-pipeline module. For each stage:

1. Check the skip condition (flag + system config)
2. If not skipped, read the on-demand module file for that stage
3. Execute the stage's action
4. Record the result

On-demand module files to read during pipeline:
- Verbosity: {plugin-root}/framework/modules/verbosity-rules.md
- Citations: {plugin-root}/framework/modules/citation-rules.md
- API Refs: {plugin-root}/framework/modules/api-ref-rules.md
- Validation: {plugin-root}/framework/modules/validation-rules.md
- Changelog: {plugin-root}/framework/modules/changelog-rules.md
- Index: {plugin-root}/framework/modules/index-rules.md

### Step 5: Report Your Work
Return a structured summary:

## Modification Report

### Operation: {operation}
### Target: {target}

### Changes Made
- {file}: {description of change}

### Pipeline Stages
- [ ] Verbosity: {completed|skipped (reason)}
- [ ] Citations: {completed|skipped (reason)}
- [ ] API Refs: {completed|skipped (reason)|not applicable}
- [ ] Sanity-Check: {completed|skipped (reason)}
- [ ] Verification: {pass|fail — details}
- [ ] Changelog: {completed}
- [ ] Index: {completed|skipped (no structural changes)}

### Issues Found
- {any concerns, flags, or [NEEDS INVESTIGATION] items}

## Memory Management
Update your agent memory when you discover:
- Recurring format issues specific to this codebase
- Files that are frequently updated (and their typical change patterns)
- Common false positives in validation
- Codebase-specific conventions not captured in standards

Write concise notes to your memory. Consult it at the start of each session.

## Critical Rules
1. NEVER guess — read actual source code before writing documentation
2. NEVER skip verification — the 10-point checklist ALWAYS runs
3. ALWAYS update the changelog — every modification gets a changelog entry
4. ALWAYS read a sibling doc for format before creating new docs
5. When in doubt, use [NEEDS INVESTIGATION]
6. File paths always relative to theme root
7. Preserve accurate content when revising
8. NEVER fabricate citations — only cite code that exists
9. API Reference provenance is mandatory — every row needs a Src value
10. NEVER use summarization language (such as, including but not limited to, etc.)
    — enumerate completely or use [NEEDS INVESTIGATION]
```

---

## 3. Skills That Invoke This Engine

### 3.1 /fp-docs:revise

File: `skills/revise/SKILL.md` (plugin-relative)

```yaml
---
name: revise
description: >
  Fix specific documentation you know is wrong or outdated. Reads source
  code, compares against existing docs, applies corrections, and runs
  the full verification pipeline.
argument-hint: "description of what to fix"
context: fork
agent: docs-modify
---

Operation: revise

$ARGUMENTS
```

**How it works**: When the user types `/fp-docs:revise fix the posts helper documentation`,
the skill sets `context: fork` with `agent: docs-modify`. The docs-modify subagent
launches with the full prompt "Operation: revise\n\nfix the posts helper documentation".
The engine parses "revise" as the operation and "fix the posts helper documentation" as the target.

### 3.2 /fp-docs:add

File: `skills/add/SKILL.md` (plugin-relative)

```yaml
---
name: add
description: >
  Create documentation for entirely new code. Reads source files, identifies
  all documentable elements, generates complete documentation following
  project templates, and runs the full pipeline.
argument-hint: "description of new code to document"
context: fork
agent: docs-modify
---

Operation: add

$ARGUMENTS
```

### 3.3 /fp-docs:auto-update

File: `skills/auto-update/SKILL.md` (plugin-relative)

```yaml
---
name: auto-update
description: >
  Auto-detect code changes since the last documentation update and handle
  everything. Compares source code against existing docs, identifies
  discrepancies, and applies corrections across all affected files.
argument-hint: "optional scope restriction"
context: fork
agent: docs-modify
---

Operation: auto-update

Changed files since last update:
!`git diff --name-only`!

$ARGUMENTS
```

**Note**: The `!`git diff --name-only`!` syntax is Claude Code's dynamic context injection — it executes the command and inserts the output into the prompt at invocation time. This gives the engine an immediate list of changed files without needing to run git itself.

### 3.4 /fp-docs:auto-revise

File: `skills/auto-revise/SKILL.md` (plugin-relative)

```yaml
---
name: auto-revise
description: >
  Batch-process all items listed in docs/needs-revision-tracker.md.
  Reads each tracker item, performs the revision, and marks items as resolved.
argument-hint: "optional flags"
context: fork
agent: docs-modify
---

Operation: auto-revise

$ARGUMENTS
```

### 3.5 /fp-docs:deprecate

File: `skills/deprecate/SKILL.md` (plugin-relative)

```yaml
---
name: deprecate
description: >
  Mark documentation as deprecated or handle code removal. Updates docs
  to reflect removed or deprecated code, adds deprecation notices, and
  updates cross-references.
argument-hint: "description of deprecated code"
context: fork
agent: docs-modify
---

Operation: deprecate

$ARGUMENTS
```

---

## 4. Shared Skill Modules (Preloaded)

### 4.1 docs-mod-standards (Always Preloaded)

File: `skills/docs-mod-standards/SKILL.md` (plugin-relative)

```yaml
---
name: docs-mod-standards
description: Shared documentation formatting rules, templates, and conventions
disable-model-invocation: true
user-invocable: false
---

# Documentation Standards

## File Naming Conventions
- Section index files: `_index.md`
- Individual docs: kebab-case (e.g., `post-type-channel.md`)
- Appendices: prefix `A-` through `G-` (e.g., `A-complete-hook-registry.md`)
- Update plans: `update-plan-{YYYY-MM-DD}.md`

## Directory Structure Rules
- Every section MUST have an `_index.md`
- Every doc MUST be linked from its parent `_index.md`
- Every section MUST be linked from `About.md`

## Content Rules
- All paths relative to theme root (e.g., `inc/hooks/`, not full filesystem path)
- Code references in backticks: `function_name()`, `$variable`, `file.php`
- Use `[LEGACY]` tag for code that works but is outdated
- Use `[NEEDS INVESTIGATION]` for anything that cannot be verified
- Use Markdown relative links between docs (e.g., `../06-helpers/posts.md`)
- Present tense, second person ("You configure...", "The helper returns...")
- Paragraphs: 3-5 sentences maximum
- No summarization language — enumerate completely or flag with [NEEDS INVESTIGATION]

## Document Format Templates

### Post Type Template
{extracted from current docs-standards.md §3.1}

### Taxonomy Template
{extracted from current docs-standards.md §3.2}

### Helper Template
{extracted from current docs-standards.md §3.3}

### Hook Template
{extracted from current docs-standards.md §3.4}

### Shortcode Template
{extracted from current docs-standards.md §3.5}

### REST Endpoint Template
{extracted from current docs-standards.md §3.6}

### Component Template
{extracted from current docs-standards.md §3.7}

### JavaScript Template
{extracted from current docs-standards.md §3.8}

### ACF Field Group Template
{extracted from current docs-standards.md §3.9}

### Integration Template
{extracted from current docs-standards.md §3.10}

## Depth Requirements
{extracted from current docs-standards.md §5}

## Cross-Reference Requirements
{extracted from current docs-standards.md §6 — appendix mapping}
```

**Note**: The `{extracted from...}` placeholders will be filled with actual content
from the current `docs-standards.md` during migration. No content is lost — it's
reorganized into this module.

### 4.2 docs-mod-project (Always Preloaded)

File: `skills/docs-mod-project/SKILL.md` (plugin-relative)

```yaml
---
name: docs-mod-project
description: FP-specific configuration for the documentation system
disable-model-invocation: true
user-invocable: false
---

# Project Configuration: Foreign Policy

## Project Identity
- Project: Foreign Policy magazine WordPress site
- Theme root: themes/foreign-policy-2017
- Docs root: themes/foreign-policy-2017/docs (relative to wp-content)
- WP-CLI prefix: ddev wp
- Local URL: https://foreignpolicy.local/
- SSL: self-signed (use curl -sk)
- PHP namespace: ForeignPolicy\Helpers\{Feature}\function_name()

## Source-to-Documentation Mapping

| Source Path | Documentation Target |
|------------|---------------------|
| functions.php | docs/01-architecture/bootstrap-sequence.md |
| inc/post-types/ | docs/02-post-types/ |
| inc/taxonomies/ | docs/03-taxonomies/ |
| inc/custom-fields/ | docs/04-custom-fields/ |
| components/ | docs/05-components/ |
| helpers/ | docs/06-helpers/ |
| inc/shortcodes/ | docs/07-shortcodes/ |
| inc/hooks/ | docs/08-hooks/ |
| inc/rest-api/ | docs/09-api/rest-api/ |
| inc/endpoints/ | docs/09-api/custom-endpoints/ |
| layouts/ | docs/10-layouts/ |
| features/ | docs/11-features/ |
| lib/autoloaded/ | docs/12-integrations/ |
| inc/cli/ | docs/16-cli/ |
| inc/admin-settings/ | docs/17-admin/ |
| assets/src/scripts/ | docs/18-frontend-assets/js/ |
| assets/src/styles/ | docs/18-frontend-assets/css/ |
| build/ | docs/00-getting-started/build-system.md |
| inc/roles/ | docs/20-exports-notifications/ |

## Appendix Cross-References

| Code Pattern | Appendix Path |
|-------------|---------------|
| add_action() / add_filter() | docs/24-appendices/A-complete-hook-registry.md |
| Shortcode registration | docs/24-appendices/B-shortcode-quick-reference.md |
| register_rest_route() | docs/24-appendices/C-rest-route-reference.md |
| define() / const | docs/24-appendices/D-constants-reference.md |
| Composer/npm dependency | docs/24-appendices/E-third-party-dependencies.md |
| ACF field group | docs/24-appendices/F-acf-field-group-reference.md |
| Feature template | docs/24-appendices/G-feature-template-catalog.md |

## Feature Enables
- Citations: enabled
- API References: enabled
- Locals contracts: enabled
- Verbosity enforcement: enabled
- Sanity-check: enabled
```

### 4.3 docs-mod-pipeline (Preloaded by docs-modify)

File: `skills/docs-mod-pipeline/SKILL.md` (plugin-relative)

```yaml
---
name: docs-mod-pipeline
description: Post-modification pipeline stage definitions and skip conditions
disable-model-invocation: true
user-invocable: false
---

# Post-Modification Pipeline

Execute these stages in order after completing the primary operation.
Parse flags from the operation prompt to determine skip conditions.

## Stage 1: Verbosity Enforcement
- Module path: {plugin-root}/framework/modules/verbosity-rules.md
- Skip if: --no-verbosity flag present
- Action: Scan modified doc sections for banned summarization phrases,
  unexpanded enumerables, and missing items. Fix all violations.
- Applies to operations: revise, add, auto-update, auto-revise

## Stage 2: Citations
- Module path: {plugin-root}/framework/modules/citation-rules.md
- Skip if: --no-citations flag present
- For "add" operation: Generate new citation blocks
- For "revise"/"auto-update"/"auto-revise": Update existing citations
- For "deprecate": Remove citations for deprecated code
- Applies to operations: revise, add, auto-update, auto-revise, deprecate

## Stage 3: API References
- Module path: {plugin-root}/framework/modules/api-ref-rules.md
- Skip if: --no-api-ref flag present OR doc type not in API ref scope
- Action: Update the ## API Reference table. Verify provenance on all rows.
- API ref scope (doc types that get API Reference sections):
  Post types, taxonomies, helpers, hooks, shortcodes, REST endpoints,
  integrations, CLI, components (with PHP logic), JavaScript modules
- Applies to operations: revise, add, auto-update, auto-revise

## Stage 4: Sanity-Check
- Module path: {plugin-root}/framework/modules/validation-rules.md
- Skip if: --no-sanity-check flag present
- Action: Compare every factual claim in the modified sections against
  actual source code. Any claim that cannot be verified gets tagged
  [NEEDS INVESTIGATION]. Zero tolerance for assumptions.
- Applies to operations: revise, add, auto-update, auto-revise

## Stage 5: Verification (NEVER SKIPPABLE)
- Module path: {plugin-root}/framework/modules/validation-rules.md
- Skip if: NEVER
- Action: Run the 10-point verification checklist:
  1. File naming and location
  2. Required sections present
  3. Content accuracy (spot-check against source)
  4. Cross-references valid
  5. Links resolve
  6. Code examples correct
  7. Citations valid (format + code match)
  8. API Reference provenance valid
  9. $locals contracts accurate (if component doc)
  10. Verbosity compliance (no banned phrases, complete enumerations)
- Applies to ALL operations

## Stage 6: Changelog (NEVER SKIPPABLE)
- Module path: {plugin-root}/framework/modules/changelog-rules.md
- Skip if: NEVER
- Action: Append a dated entry to docs/changelog.md
- Format: `### YYYY-MM-DD\n- **{operation}**: {description of change} ({file paths})`
- Applies to ALL modification operations

## Stage 7: Index Update
- Module path: {plugin-root}/framework/modules/index-rules.md
- Skip if: --no-index flag present OR no structural changes
- Structural changes = new doc files created, doc files deleted, doc files moved
- Action: Update About.md links, update relevant _index.md files,
  update PROJECT-INDEX.md if source structure changed
- Applies to operations: add, deprecate, auto-update (when structural)

## Flag Parsing
Extract flags from the operation prompt. Flags use these patterns:
- Opt-out: --no-{stage} (e.g., --no-citations, --no-sanity-check)
- Mode: --mode plan | --mode audit+plan
- Depth: --depth quick | standard | deep (for audit operations)
- Scope: --all | --section {name} | --layer {name}
```

---

## 5. Instruction File Example: revise.md

File: `framework/instructions/modify/revise.md` (plugin-relative)

This is the instruction file the engine reads when the operation is "revise".
It contains the primary operation steps ONLY — pipeline is handled by the pipeline module.

```markdown
# Instruction: Revise Documentation

## Prerequisites
- Operation: revise
- Input: description of what documentation to fix and why

## Steps

### Step 1: Identify the Target
Parse the user's description to determine:
- Which documentation file(s) need revision
- What aspect is wrong or outdated
- Use the source-to-docs mapping (from preloaded docs-mod-project) to find files

If the target is ambiguous, use Grep and Glob to search for relevant files
in the docs/ directory.

### Step 2: Read Source Code
Identify the source code file(s) that the documentation describes.
Read them completely. Note:
- All public functions/methods and their signatures
- Hook registrations (add_action, add_filter)
- Constants and configuration values
- Template files used
- Dependencies and integrations

### Step 3: Read Current Documentation
Read the target documentation file. Note:
- Current content and structure
- What sections exist
- What might be outdated or inaccurate

### Step 4: Read a Sibling Doc
Read one other documentation file in the same section directory.
This is your format reference — match its structure, heading levels,
section order, and content depth.

### Step 5: Compare and Identify Discrepancies
Compare source code against documentation. Identify:
- Functions documented but no longer existing
- Functions existing but not documented
- Parameter changes (names, types, defaults)
- Return value changes
- Hook registration changes
- Behavioral changes
- Integration changes

### Step 6: Apply Revisions
Edit the documentation file to fix all identified discrepancies:
- Update function signatures and parameters
- Update behavioral descriptions
- Update code examples if they reference changed code
- Add documentation for newly added functions
- Mark removed functions appropriately
- Preserve all accurate existing content — only change what's wrong
- Follow formatting rules from preloaded docs-mod-standards module

### Step 7: Execute Post-Modification Pipeline
Follow the pipeline defined in your preloaded docs-mod-pipeline module.
Execute each stage in order, checking skip conditions.

### Step 8: Produce Report
Return the modification report (format defined in engine system prompt).

## Outputs
- Modified documentation file(s)
- Changelog entry
- Verification report
- Any [NEEDS INVESTIGATION] items flagged
```

---

## 6. Hook Definitions

### 6.1 SessionStart Hook

File: `scripts/inject-manifest.sh` (plugin-relative)

```bash
#!/bin/bash
# Inject docs system manifest and plugin root into session context

MANIFEST_PATH="${CLAUDE_PLUGIN_ROOT}/framework/manifest.md"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"

if [[ -f "$MANIFEST_PATH" ]]; then
  MANIFEST=$(cat "$MANIFEST_PATH")
  jq -n --arg ctx "$MANIFEST" --arg root "$PLUGIN_ROOT" '{
    "hookSpecificOutput": {
      "hookEventName": "SessionStart",
      "additionalContext": ("fp-docs plugin root: " + $root + "\n\n" + $ctx)
    }
  }'
else
  # Still inject plugin root even if manifest is missing
  jq -n --arg root "$PLUGIN_ROOT" '{
    "hookSpecificOutput": {
      "hookEventName": "SessionStart",
      "additionalContext": ("fp-docs plugin root: " + $root)
    }
  }'
fi
```

Registration in `hooks/hooks.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/inject-manifest.sh",
            "statusMessage": "Loading fp-docs system..."
          }
        ]
      }
    ]
  }
}
```

### 6.2 SubagentStop Hook

File: `scripts/post-modify-check.sh` (plugin-relative)

```bash
#!/bin/bash
# Validate that docs-modify engine completed mandatory pipeline stages

INPUT=$(cat)
AGENT_TYPE=$(echo "$INPUT" | jq -r '.agent_type // empty')

# Only run for docs-modify engine
if [[ "$AGENT_TYPE" != "docs-modify" ]]; then
  exit 0
fi

# Check that changelog was updated
CHANGELOG_MODIFIED=$(git diff --name-only -- "themes/foreign-policy-2017/docs/changelog.md" 2>/dev/null)
if [[ -z "$CHANGELOG_MODIFIED" ]]; then
  echo "Warning: docs-modify completed but changelog.md was not updated. This is a mandatory pipeline stage." >&2
fi

exit 0
```

Registration in `hooks/hooks.json`:

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

---

## 7. System Manifest

File: `framework/manifest.md` (plugin-relative)

```markdown
# fp-docs System — Manifest

## Version
2.0.0

## Plugin
- Name: fp-docs
- Skill namespace: /fp-docs:*

## Engines

| Engine | Agent File | Operations | Status |
|--------|-----------|------------|--------|
| docs-modify | agents/docs-modify.md | revise, add, auto-update, auto-revise, deprecate | active |
| docs-validate | agents/docs-validate.md | audit, verify, sanity-check, test | active |
| docs-citations | agents/docs-citations.md | generate, update, verify, audit | active |
| docs-api-refs | agents/docs-api-refs.md | generate, audit | active |
| docs-locals | agents/docs-locals.md | annotate, contracts, cross-ref, validate, shapes, coverage | active |
| docs-verbosity | agents/docs-verbosity.md | audit | active |
| docs-index | agents/docs-index.md | update-project-index, update-doc-links, update-example-claude | active |
| docs-system | agents/docs-system.md | update-skills, setup | active |

## Commands

| Command | Skill File | Engine | Operation |
|---------|-----------|--------|-----------|
| /fp-docs:revise | skills/revise/SKILL.md | docs-modify | revise |
| /fp-docs:add | skills/add/SKILL.md | docs-modify | add |
| /fp-docs:auto-update | skills/auto-update/SKILL.md | docs-modify | auto-update |
| /fp-docs:auto-revise | skills/auto-revise/SKILL.md | docs-modify | auto-revise |
| /fp-docs:deprecate | skills/deprecate/SKILL.md | docs-modify | deprecate |
| /fp-docs:audit | skills/audit/SKILL.md | docs-validate | audit |
| /fp-docs:verify | skills/verify/SKILL.md | docs-validate | verify |
| /fp-docs:sanity-check | skills/sanity-check/SKILL.md | docs-validate | sanity-check |
| /fp-docs:test | skills/test/SKILL.md | docs-validate | test |
| /fp-docs:citations | skills/citations/SKILL.md | docs-citations | $ARGUMENTS[0] |
| /fp-docs:api-ref | skills/api-ref/SKILL.md | docs-api-refs | $ARGUMENTS |
| /fp-docs:locals | skills/locals/SKILL.md | docs-locals | $ARGUMENTS[0] |
| /fp-docs:verbosity-audit | skills/verbosity-audit/SKILL.md | docs-verbosity | audit |
| /fp-docs:update-index | skills/update-index/SKILL.md | docs-index | update-project-index |
| /fp-docs:update-claude | skills/update-claude/SKILL.md | docs-index | update-example-claude |
| /fp-docs:update-skills | skills/update-skills/SKILL.md | docs-system | update-skills |
| /fp-docs:setup | skills/setup/SKILL.md | docs-system | setup |
| /fp-docs:parallel | skills/parallel/SKILL.md | *(orchestration)* | $ARGUMENTS |

## Shared Modules

| Module | Skill Name | Preloaded By |
|--------|-----------|-------------|
| Standards | docs-mod-standards | ALL engines |
| Project Config | docs-mod-project | ALL engines |
| Pipeline | docs-mod-pipeline | docs-modify |
| Citation Rules | docs-mod-citations | docs-modify, docs-citations |
| API Ref Rules | docs-mod-api-refs | docs-modify, docs-api-refs |
| Locals Rules | docs-mod-locals | docs-modify, docs-locals |
| Verbosity Rules | docs-mod-verbosity | docs-modify, docs-verbosity |
| Validation Rules | docs-mod-validation | docs-modify, docs-validate |
| Changelog Rules | docs-mod-changelog | docs-modify |
| Index Rules | docs-mod-index | docs-modify, docs-index |

## Hooks

| Event | Matcher | Script | Purpose |
|-------|---------|--------|---------|
| SessionStart | startup\|resume | scripts/inject-manifest.sh | Inject this manifest + plugin root |
| SubagentStop | docs-modify | scripts/post-modify-check.sh | Validate pipeline completion |
| TeammateIdle | *(no matcher)* | scripts/teammate-idle-check.sh | Validate teammate pipeline (orchestration) |
| TaskCompleted | *(no matcher)* | scripts/task-completed-check.sh | Validate task outputs (orchestration) |

## File Paths (all plugin-relative)
- Engines: agents/docs-*.md
- Skills: skills/*/SKILL.md
- Modules: skills/docs-mod-*/SKILL.md
- Hooks: hooks/hooks.json
- Scripts: scripts/*.sh
- Instructions: framework/instructions/
- Modules (rules): framework/modules/
- Config: framework/config/
```

---

## 8. Testing the Prototype

### Test 1: Basic Revise Operation

```
/fp-docs:revise "The posts helper documentation is outdated — several functions
have been added since the last update"
```

**Expected behavior**:
1. docs-modify engine launches as subagent
2. Engine reads `framework/instructions/modify/revise.md` from plugin
3. Engine reads `helpers/posts.php` (source)
4. Engine reads `docs/06-helpers/posts.md` (current doc)
5. Engine reads a sibling helper doc for format reference
6. Engine identifies discrepancies and applies revisions
7. Pipeline: verbosity → citations → API refs → sanity → verify → changelog → index
8. Engine returns modification report
9. SubagentStop hook validates changelog was updated
10. User sees summary

### Test 2: Revise with Skip Flags

```
/fp-docs:revise "fix the channel post type docs" --no-citations --no-sanity-check
```

**Expected behavior**:
- Same as Test 1, but pipeline skips stages 2 (citations) and 4 (sanity-check)
- Verification and changelog still run (never skippable)

### Test 3: Add Operation

```
/fp-docs:add "New helper file helpers/myfp.php was created for the MyFP feature"
```

**Expected behavior**:
1. Engine reads `framework/instructions/modify/add.md` from plugin (not revise.md)
2. Engine reads `helpers/myfp.php` and a sibling helper doc
3. Engine creates `docs/06-helpers/myfp.md` from scratch
4. Pipeline: verbosity → citations (generate, not update) → API refs → sanity → verify → changelog → index (structural change: new file)
5. Index stage updates About.md, _index.md, and PROJECT-INDEX.md

### Test 4: Auto-Update (Batch)

```
/fp-docs:auto-update
```

**Expected behavior**:
1. Engine reads `framework/instructions/modify/auto-update.md` from plugin
2. Engine uses the injected git diff list (from `!`git diff --name-only`!` in skill) to detect changed source files
3. For each changed file, applies the source-to-docs mapping
4. Updates each affected doc file
5. Runs pipeline once per modified doc (or consolidated at end)

### Test 5: CI/CD Headless Mode

```bash
claude --agent docs-modify \
  --headless \
  --permission-mode bypassPermissions \
  "Operation: auto-update\n\nChanged files: helpers/posts.php, helpers/authors.php"
```

**Expected behavior**:
- Same as interactive mode but no permission prompts
- Returns JSON result that CI can parse
- Commits changes to branch

---

## 9. Comparison: 1.0 vs 2.0 for `/fp-docs:revise`

### 1.0 Flow (current)

```
1. User types /docs-revise "fix posts helper"
2. Skill loads docs-system.md (163 lines)
3. Skill loads docs-standards.md (680 lines)
4. Skill loads docs-system-config.md (84 lines)
5. Skill loads docs-commands-list.md (99 lines)
   TOTAL BOOTSTRAP: ~1,026 lines
6. Route to cc-revise.md (136 lines)
7. cc-revise executes primary operation
8. cc-revise calls cc-verbosity-scope.md (inline)
9. cc-revise calls cc-verbosity-enforce.md (inline)
10. cc-revise calls cc-citations-update.md (inline)
11. cc-revise calls cc-sanity-check.md (inline)
12. cc-revise calls cc-verify.md (inline)
13. cc-revise calls cc-changelog.md (inline)
14. cc-revise calls cc-update-project-index.md (inline, conditional)
    TOTAL SUB-INSTRUCTIONS: ~800-1000 lines loaded one by one
15. Done — all in main conversation context
    CONTEXT CONSUMED: ~2,000+ lines in main conversation
```

### 2.0 Flow (proposed)

```
1. User types /fp-docs:revise "fix posts helper"
2. Skill forks to docs-modify subagent
3. Subagent launches with:
   - System prompt: ~100 lines
   - Preloaded standards: ~225 lines
   - Preloaded project config: ~90 lines
   - Preloaded pipeline: ~90 lines
   TOTAL AT LAUNCH: ~505 lines (in subagent context, NOT main)
4. Engine reads framework/instructions/modify/revise.md: ~80 lines
5. Engine executes primary operation
6. Pipeline stages load modules on-demand:
   - verbosity-rules.md: ~100 lines (then done with it)
   - citation-rules.md: ~150 lines (then done with it)
   - validation-rules.md: ~150 lines (then done with it)
   - changelog-rules.md: ~40 lines (then done with it)
7. Engine returns summary to main conversation
   MAIN CONVERSATION CONTEXT: ~200 lines (skill prompt + summary)
   SUBAGENT CONTEXT: ~1,025 lines (spread across operation)
```

### Key Improvements

| Metric | 1.0 | 2.0 | Change |
|--------|-----|-----|--------|
| Main conversation context consumed | ~2,000 lines | ~200 lines | **90% reduction** |
| Bootstrap before work begins | ~1,026 lines | ~505 lines | **51% reduction** |
| Files that duplicate pipeline calls | 5 files | 1 module | **80% reduction** |
| Files to update for new pipeline stage | 5+ files | 1 file | **80% reduction** |
| Persistent learning | None | Memory per engine | **New capability** |
| CI/CD support | None | Headless mode | **New capability** |

---

## 10. Known Limitations

1. **Subagent context window**: If a single doc file is very large AND the source code is very large, the engine's context may get tight. Mitigation: `maxTurns: 75` prevents runaway operations; auto-compaction at 95%.

2. **No inter-engine communication**: If the modify engine finds an issue that the validation engine should know about, it can only communicate through files on disk (e.g., writing to `needs-revision-tracker.md`). By design — keeps engines independent.

3. **SubagentStop hook limitations**: The hook can check file changes (git diff) but cannot inspect the engine's internal reasoning. The hook validates observable outcomes, not process.

4. **Module preloading is all-or-nothing**: A preloaded skill loads its full content. Can't preload "just section 3" of a module. Mitigation: keep modules focused and appropriately sized.

5. **Skill description budget**: With 18 user skills, descriptions consume ~360 words of context per request. This is well within the 2% budget but should be monitored if more skills are added.

6. **Plugin path injection latency**: The SessionStart hook must fire before any engine can resolve plugin-relative paths. If the hook fails, engines cannot find instruction or module files. Mitigation: the hook outputs the plugin root even if the manifest file is missing.
