# fp-docs Architecture Fixes — Post-Implementation Plan

> **Status**: APPROVED
> **Date**: 2026-03-03
> **Version**: 2.5.0 → 2.6.0
> **Scope**: Module deduplication, on-demand module refactor, engine contract restoration
> **Strategy**: Systematic — sequential phases with validation gates
> **Prerequisite**: Analysis from `/sc:analyze` session comparing current implementation against original specs

---

## Table of Contents

1. [Problem Summary](#1-problem-summary)
2. [Phase 1: Delete Zero-Value On-Demand Modules](#2-phase-1-delete-zero-value-on-demand-modules)
3. [Phase 2: Refactor 4 Overlapping On-Demand Modules](#3-phase-2-refactor-4-overlapping-on-demand-modules)
4. [Phase 3: Absorb 4 Redundant On-Demand Modules](#4-phase-3-absorb-4-redundant-on-demand-modules)
5. [Phase 4: Create Missing Instruction Files for docs-system](#5-phase-4-create-missing-instruction-files)
6. [Phase 5: Slim Down Engine System Prompts](#6-phase-5-slim-down-engine-system-prompts)
7. [Phase 6: Add disallowedTools to Read-Only Engines](#7-phase-6-add-disallowedtools)
8. [Phase 7: Manifest & Version Bump](#8-phase-7-manifest-and-version-bump)
9. [Validation Checklist](#9-validation-checklist)
10. [File Change Summary](#10-file-change-summary)
11. [Rollback Strategy](#11-rollback-strategy)

---

## 1. Problem Summary

### Core Issue: Module Duplication

The original spec (proposal-spec.md §3, Key Decision C) mandated:

> **Preloaded modules** = Rule definitions (formats, schemas, scope tables) — loaded at engine startup
> **On-demand modules** = Execution algorithms (step-by-step procedures) — loaded during pipeline stages

The current implementation violates this: both layers contain a mix of rules AND procedures with **60-80% content overlap** across 6 module pairs. This violates the spec's prime directive: *"No instruction duplication — shared rules live in exactly one file each."*

### Secondary Issues

1. **4 unnecessary on-demand modules** that should be absorbed into existing preloaded modules or on-demand counterparts
2. **docs-system engine** has no instruction file directory (violates engine contract)
3. **docs-verbosity and docs-index engines** embed domain logic inline in system prompts instead of deferring to instruction files
4. **Read-only engines** lack `disallowedTools` defense-in-depth per engine-contract-spec §6.2

### What Is NOT Changing

- Engine count (8), skill count (19), preloaded module count (10) — all stay the same
- Engine-skill routing pattern — untouched
- Pipeline stage order and skip conditions — untouched
- Hook system — untouched
- Three-repo git model — untouched
- Module preload assignments per engine — untouched

---

## 2. Phase 1: Delete Zero-Value On-Demand Modules

**Goal**: Remove 2 on-demand modules that add zero unique content over their preloaded counterparts.
**Risk**: Low — the preloaded modules already contain identical content.
**Dependencies**: None.

### Task 1.1: Delete `framework/modules/changelog-rules.md`

**Why**: The preloaded module `docs-mod-changelog` (52 lines) already contains the complete procedure: file path, entry format template, month-header logic, append-only rules, "why not what" summary requirement, and a worked good/bad example. The on-demand `changelog-rules.md` (39 lines) is a strict subset — it contains nothing the preloaded module doesn't.

**Action**:
```
DELETE: fp-docs/plugins/fp-docs/framework/modules/changelog-rules.md
```

**Pipeline impact**: Stage 6 (Changelog) in the `docs-mod-pipeline` module currently says:
```
Read `framework/modules/changelog-rules.md` and:
```

This reference must be updated to:
```
Follow the changelog rules from your preloaded docs-mod-changelog module:
```

Wait — docs-modify does NOT preload `docs-mod-changelog`. Only `docs-modify` uses it (per the manifest). So we need to verify the pipeline instruction works without the on-demand file.

**Resolution**: Add `docs-mod-changelog` to the `docs-modify` engine's `skills:` preload list. This is a ~52-line addition to the preloaded context but eliminates the need for the on-demand file entirely.

**Changes**:
1. `DELETE`: `framework/modules/changelog-rules.md`
2. `EDIT`: `agents/docs-modify.md` — add `docs-mod-changelog` to `skills:` list
3. `EDIT`: `modules/docs-mod-pipeline/SKILL.md` — Stage 6 reference: replace `Read framework/modules/changelog-rules.md` with `Follow the rules from your preloaded docs-mod-changelog module`

### Task 1.2: Delete `framework/modules/index-rules.md`

**Why**: The preloaded module `docs-mod-index` (57 lines) already contains the complete procedure: file path, trigger conditions, 3 modes (quick/update/full) with steps, and git consistency rules. The on-demand `index-rules.md` (52 lines) is identical.

**Action**:
```
DELETE: fp-docs/plugins/fp-docs/framework/modules/index-rules.md
```

**Pipeline impact**: Stage 7 (Index) in `docs-mod-pipeline` says:
```
Read `framework/modules/index-rules.md` and:
```

**Resolution**: `docs-modify` does NOT preload `docs-mod-index`, but `docs-index` does. For the pipeline stage inside docs-modify, we have two options:

**Option A** (preferred): Add `docs-mod-index` to docs-modify's preload list (+57 lines).
**Option B**: Keep a minimal on-demand file with just the trigger condition ("only run on structural changes").

**Choose Option A** — keeps the single-source-of-truth principle pure.

**Changes**:
1. `DELETE`: `framework/modules/index-rules.md`
2. `EDIT`: `agents/docs-modify.md` — add `docs-mod-index` to `skills:` list
3. `EDIT`: `modules/docs-mod-pipeline/SKILL.md` — Stage 7 reference: replace `Read framework/modules/index-rules.md` with `Follow the rules from your preloaded docs-mod-index module`

### Task 1.3: Update Pipeline Module References

After Tasks 1.1 and 1.2, the `docs-mod-pipeline` module must have all Stage 6 and Stage 7 references updated. This is done as part of the edits above.

### Phase 1 Validation Gate

Before proceeding to Phase 2:
- [ ] `framework/modules/changelog-rules.md` deleted
- [ ] `framework/modules/index-rules.md` deleted
- [ ] `docs-modify` engine now preloads 5 modules: `docs-mod-standards`, `docs-mod-project`, `docs-mod-pipeline`, `docs-mod-changelog`, `docs-mod-index`
- [ ] `docs-mod-pipeline` Stage 6 and Stage 7 no longer reference deleted files
- [ ] Grep the entire plugin for any remaining references to `changelog-rules.md` or `index-rules.md` — should find zero

---

## 3. Phase 2: Refactor 4 Overlapping On-Demand Modules

**Goal**: Rewrite 4 on-demand modules to contain ONLY execution algorithms, with explicit references back to preloaded modules for rule definitions.
**Risk**: Medium — changes the content engines read during pipeline stages.
**Dependencies**: Phase 1 complete.

### The Refactor Principle

Each on-demand module must be restructured to follow this pattern:

```markdown
# {Domain} Pipeline Algorithm

Execute these steps during Pipeline Stage {N}.
Rule definitions referenced below are in your preloaded docs-mod-{domain} module.

## Step 1: ...
## Step 2: ...
(procedural steps that REFERENCE preloaded rules, never REPEAT them)
```

### Task 2.1: Refactor `framework/modules/verbosity-rules.md`

**Current state** (83 lines): Contains banned phrases list (DUPLICATED from `docs-mod-verbosity`), banned regex patterns (DUPLICATED), scope manifest format (DUPLICATED), correction protocol (UNIQUE), gap tolerance setting (UNIQUE), failure conditions (UNIQUE).

**Target state** (~40 lines): Algorithm-only file.

**New content**:

```markdown
# Verbosity Pipeline Algorithm

Execute these steps during Pipeline Stage 1 (Verbosity Enforcement).
All rule definitions are in your preloaded docs-mod-verbosity module.

## Step 1: Build Scope Manifest

Read the source file(s) for the doc being generated/updated.
Build a scope manifest following the format in your preloaded verbosity module.
The manifest is a binding contract — output MUST match manifest counts.

## Step 2: Generate/Update Documentation

Produce the documentation content following instruction file steps.

## Step 3: Output Coverage Check

After generating content:
1. Count functions documented → compare to manifest target
2. Count API Reference table rows → compare to manifest target
3. Count parameters documented → compare to manifest target
4. For each enumerable in manifest → verify all items appear explicitly
Any shortfall blocks the operation. Fix gaps before proceeding.

## Step 4: Banned Phrase Detection

Scan output for banned phrases and patterns from your preloaded verbosity module.
If detected, apply the correction protocol below.

## Correction Protocol

When a banned phrase or pattern is detected:
1. Identify the source code location defining the enumerable set
2. Read the source to extract all items
3. Rewrite the documentation with the explicit list
4. If items are not determinable from source, use `[NEEDS INVESTIGATION]`

## Gap Tolerance

Configured value: `0` (zero tolerance — every source item MUST be documented).

## Failure Conditions

Pipeline Stage 1 FAILS if:
- Scope manifest count exceeds documented count (missing items)
- Any banned phrase remains in output after correction pass
- Any enumerable is not fully expanded
Fix all failures before proceeding to Stage 2.
```

**Changes**:
1. `REWRITE`: `framework/modules/verbosity-rules.md` with algorithm-only content above

### Task 2.2: Refactor `framework/modules/citation-rules.md`

**Current state** (77 lines): Contains freshness model table (DUPLICATED from `docs-mod-citations`), tier selection rules (DUPLICATED), citation format template (DUPLICATED), trigger conditions for generate/update (UNIQUE), staleness detection algorithm steps (partially UNIQUE — to be merged from `citation-staleness-detection.md`), batch processing rules (UNIQUE).

**Target state** (~55 lines): Algorithm-only file that also absorbs the staleness detection algorithm from `citation-staleness-detection.md` (Phase 3 dependency — but we write the content now, delete the source file in Phase 3).

**New content**:

```markdown
# Citation Pipeline Algorithm

Execute these steps during Pipeline Stage 2 (Citations).
All format rules, tier definitions, and freshness states are in your preloaded docs-mod-citations module.

## When to Generate New Citations

Generate citations when:
1. New documentation file created (add operation)
2. New function/hook/route added to existing doc (revise operation)
3. Doc element exists without a citation block
4. Deprecated citation removed and replacement needed

## When to Update Existing Citations

Update citations when:
1. Source code modified since last citation update
2. Staleness detection finds Stale, Drifted, or Broken citations
3. Function renamed or moved to different file
4. Line numbers shifted due to edits above/below the function

## Staleness Detection Algorithm

For each existing `> **Citation**` block in the doc:

1. **Parse Citation Marker** — extract `file_path`, `symbol_name`, `line_range`
2. **Locate Current Source** — read cited file
   - If file missing → classify as **Broken** (High severity)
3. **Symbol Search** — search for `function {name}(` or `add_action`/`add_filter` with the symbol name
   - If not found → classify as **Broken** (High severity)
4. **Line Range Comparison** — compare `L{start}-{end}` against actual location
   - If lines differ but code matches → classify as **Stale** (Low severity)
5. **Excerpt Comparison** (Full and Signature tiers only) — compare code block against current source
   - If code changed → classify as **Drifted** (Medium severity)
   - If code matches → classify as **Fresh** (No action)

Apply the action for each state from your preloaded docs-mod-citations freshness model.

## Tier Selection Logic

Apply tier selection from your preloaded docs-mod-citations module.
Special cases:
- Hook registrations (`add_action`/`add_filter`): always Full tier
- Shortcode attribute defaults: always Full tier
- REST route registrations: always Full tier
- Meta field tables derived from long methods: always Reference tier

## Batch Processing Rules

When processing multiple files in a single operation:
1. Collect all unique source file paths from citations across all target docs
2. Read each source file ONCE and cache in working memory
3. For each citation in each doc, run detection/generation using the cached source
4. Report results grouped by state (Fresh/Stale/Drifted/Broken) across all docs
```

**Changes**:
1. `REWRITE`: `framework/modules/citation-rules.md` with algorithm-only content above

### Task 2.3: Refactor `framework/modules/api-ref-rules.md`

**Current state** (76 lines): Contains table column definitions (DUPLICATED from `docs-mod-api-refs`), provenance values (DUPLICATED), scope table (DUPLICATED), completeness rule (DUPLICATED), step-by-step generation algorithm (UNIQUE), update logic (UNIQUE).

**Target state** (~50 lines): Algorithm-only file.

**New content**:

```markdown
# API Reference Pipeline Algorithm

Execute these steps during Pipeline Stage 3 (API References).
All format rules, column definitions, provenance values, and scope tables are in your preloaded docs-mod-api-refs module.

## API Reference Table Generation

### Step 1: Identify Source File
Use the source-to-docs mapping from your preloaded docs-mod-project module.
Resolve the source file(s) for the doc being generated/updated.

### Step 2: Extract Functions
- **PHP helpers**: Grep for `function {name}(` inside the namespace
- **PHP classes**: Grep for `public function` and `public static function`
- **JS modules**: Grep for `export function`, `export const`, `export default`
Exclude private/internal helpers unless called by other documented code.

### Step 3: Extract Details Per Function

| Detail | Source |
|--------|--------|
| Name | Function declaration |
| Parameters | Signature + PHPDoc @param |
| Return type | Signature + PHPDoc @return |
| Description | PHPDoc @description, first line of docblock, or authored from behavior |
| Provenance | PHPDoc if from docblock, Verified if hand-written from source reading |

### Step 4: Build Table
Build the API Reference table following column definitions from your preloaded docs-mod-api-refs module.
Rows ordered by source file line number (declaration order), not alphabetically.

### Step 5: Handle Complex Parameters
For functions with 4+ parameters: list the first 2-3 primary params in the Params column, add "See citation." for the full list.

## Update Logic

When updating an existing API Reference table:
1. Read current table rows and source file
2. For each source function: check if a matching row exists
3. New functions → add row at correct position (by line number)
4. Removed functions → delete row
5. Changed signatures → update Params, Return columns; change Src to `Verified`
```

**Changes**:
1. `REWRITE`: `framework/modules/api-ref-rules.md` with algorithm-only content above

### Task 2.4: Refactor `framework/modules/validation-rules.md`

**Current state** (79 lines): Contains all 10 verification checks (DUPLICATED from `docs-mod-validation`), report format (DUPLICATED), sanity-check classification system (DUPLICATED), confidence levels (DUPLICATED), deep verification steps (UNIQUE), required actions per classification (UNIQUE).

**Target state** (~50 lines): Algorithm-only file that also absorbs the link validation algorithm from `cross-reference-validation.md` (Phase 3).

**New content**:

```markdown
# Validation Pipeline Algorithm

Execute these steps during Pipeline Stages 4 (Sanity-Check) and 5 (Verify).
All check definitions, classification systems, and report formats are in your preloaded docs-mod-validation module.

## Sanity-Check Execution (Stage 4)

### Step 1: Identify Modified Sections
List all doc sections modified by the primary operation.
Map each to its source file(s) via the project module.

### Step 2: Cross-Reference Source Code
For each modified doc section:
1. If doc has citations: use as evidence anchors — verify excerpts match current source
2. Compare every factual claim against source: function signatures, hook names/priorities, file paths, meta keys, REST routes, shortcode attributes, defaults, constants
3. Classify each claim using the classification system from your preloaded docs-mod-validation module

### Step 3: Deep Verification (for UNVERIFIABLE claims)
1. Trace call chains from the function outward
2. Check related files (parent classes, included files, trait uses)
3. Search codebase with Grep for the specific claim
4. Reclassify as VERIFIED, MISMATCH, HALLUCINATION, or UNVERIFIED

### Step 4: Cross-Reference Related Docs
Check for contradictions between modified doc and siblings/linked docs.
Use the link validation algorithm below for relative path resolution.

### Step 5: Determine Confidence
Apply confidence levels from your preloaded docs-mod-validation module.
If LOW: resolve all issues before proceeding. Tag unresolvable claims with `[NEEDS INVESTIGATION]`.

## Verification Execution (Stage 5)

Run ALL 10 checks from your preloaded docs-mod-validation module.
For each check, report PASS, FAIL (with details), or SKIP (with reason).
Do NOT modify any files during verification — report only.

## Link Validation Algorithm (used by Check 5)

For each relative markdown link `[text](target)`:
1. Extract the link target path
2. Resolve path relative to the containing file's directory
3. Normalize: `../06-helpers/posts.md` from `docs/02-post-types/post.md` resolves to `docs/06-helpers/posts.md`
4. Check if resolved path exists on disk
5. For anchor links (`#section`): verify the file exists; optionally verify heading slug
6. Report broken links with: source file, line number, target path, category

### Broken Link Categories

| Category | Description | Severity |
|----------|-------------|----------|
| MISSING_FILE | Target file does not exist on disk | High |
| WRONG_PATH | Path syntax error or wrong relative depth | High |
| BROKEN_ANCHOR | File exists but anchor heading not found | Medium |
| ORPHANED | File exists but not linked from any _index.md | Low |
```

**Changes**:
1. `REWRITE`: `framework/modules/validation-rules.md` with algorithm-only content above

### Task 2.5: Update Pipeline Module On-Demand References

After all 4 refactors, update `docs-mod-pipeline` Stage 1-4 references. The stages already say "Read `framework/modules/{file}.md`" — the file names haven't changed, just their content. But we should update the phrasing to emphasize the preloaded-first pattern:

**Edit `modules/docs-mod-pipeline/SKILL.md`** — for each of Stages 1-4, change from:

```
Read `framework/modules/{file}.md` and enforce:
```

To:

```
Read `framework/modules/{file}.md` for the execution algorithm.
Apply rules from your preloaded docs-mod-{domain} module.
```

This makes the two-layer relationship explicit in the pipeline definition.

### Phase 2 Validation Gate

Before proceeding to Phase 3:
- [ ] All 4 on-demand modules rewritten — no rule definitions remain (only algorithms + references)
- [ ] Each rewritten module explicitly references "your preloaded docs-mod-{domain} module"
- [ ] Pipeline module updated with two-layer phrasing for Stages 1-4
- [ ] Grep the 4 rewritten files for any duplicated tables/lists from preloaded modules — should find zero

---

## 4. Phase 3: Absorb 4 Redundant On-Demand Modules

**Goal**: Eliminate 4 on-demand modules by merging their unique content into existing files.
**Risk**: Medium — requires careful content migration.
**Dependencies**: Phase 2 complete (citation-rules.md and validation-rules.md already contain the absorbed content).

### Task 3.1: Delete `framework/modules/citation-staleness-detection.md`

**Why**: The staleness detection algorithm (the only unique content) was absorbed into the refactored `citation-rules.md` in Task 2.2.

**Pre-check**: Verify `citation-rules.md` now contains the 5-step detection algorithm. (It does — written in Task 2.2.)

**Action**:
```
DELETE: fp-docs/plugins/fp-docs/framework/modules/citation-staleness-detection.md
```

**Reference check**: Grep for any references to `citation-staleness-detection.md` in the plugin. Update any that exist to point to `citation-rules.md`.

### Task 3.2: Delete `framework/modules/cross-reference-validation.md`

**Why**: The link validation algorithm (unique content) was absorbed into the refactored `validation-rules.md` in Task 2.4. The appendix cross-reference table (duplicated content) already lives in `docs-mod-standards` §6 and `docs-mod-project`.

**Pre-check**: Verify `validation-rules.md` now contains the link validation algorithm and broken link categories. (It does — written in Task 2.4.)

**Action**:
```
DELETE: fp-docs/plugins/fp-docs/framework/modules/cross-reference-validation.md
```

**Reference check**: Grep for any references to `cross-reference-validation.md` in the plugin.

### Task 3.3: Absorb `framework/modules/locals-contract-grammar.md` into `docs-mod-locals`

**Why**: The grammar spec, @controller block grammar, and shape definition grammar are rule definitions that belong in the preloaded module. The validation procedures belong in instruction files.

**Content migration plan**:

| Content in `locals-contract-grammar.md` | Destination |
|---|---|
| `@locals` block grammar (token-level rules) | `modules/docs-mod-locals/SKILL.md` — add as new section `## @locals Block Grammar` after existing `## @locals PHPDoc Format` |
| `@controller` block grammar (HTMX) | `modules/docs-mod-locals/SKILL.md` — expand existing `## @controller Format` section |
| Shape definition grammar (table format) | `modules/docs-mod-locals/SKILL.md` — add as new section `## Shape Definition Grammar` after `## Shared Shapes` |
| Shape reference syntax | `modules/docs-mod-locals/SKILL.md` — add as subsection under shape grammar |
| Validation rules (cross-reference validation) | `framework/instructions/locals/validate.md` — append as additional validation steps |
| Completeness validation (already exists in preloaded) | Skip — already in `docs-mod-locals` |
| Requirement classification table (already exists in preloaded) | Skip — already in `docs-mod-locals` |
| Ground truth (already exists in preloaded) | Skip — already in `docs-mod-locals` |

**Estimated line additions to `docs-mod-locals`**: +35 lines (grammar spec, @controller expansion, shape grammar + reference syntax)
**Estimated line additions to `framework/instructions/locals/validate.md`**: +10 lines (cross-reference validation steps)

**Actions**:
1. `EDIT`: `modules/docs-mod-locals/SKILL.md` — add grammar sections (details below)
2. `EDIT`: `framework/instructions/locals/validate.md` — add cross-reference validation steps
3. `DELETE`: `framework/modules/locals-contract-grammar.md`

**Specific edits to `docs-mod-locals`**:

After the existing `## @locals PHPDoc Format` section, add:

```markdown
## @locals Block Grammar

Formal token-level grammar for @locals blocks:

```
@locals {
  {key_name}:{spaces}{type}{spaces}—{spaces}{requirement}.{spaces}{description}.{spaces}[Default: {value}]
}
```

Token rules:
- `key_name`: snake_case identifier, or `[N]` for integer-indexed
- `type`: PHP type (`int`, `string`, `bool`, `array`, `string|bool`, `string|false`)
- `requirement`: `Required` or `Optional`
- `description`: Free text, ends with period
- `Default`: Only present for Optional keys, value in square brackets

Nested keys use dot notation: `attachment_data.src: string — Required. Image source URL.`
```

Expand the existing `## @controller Format` section to include:

```markdown
## @controller Format (HTMX Components)

HTMX components (`components/htmx/`) use a `$cmp` controller object with these PHPDoc blocks:

- `@controller {ClassName}` — controller class identifier
- `@state { key: type — description }` — component state definition
- `@methods { method_name(): return_type }` — available methods
```

After `## Shared Shapes`, add:

```markdown
## Shape Definition Grammar

Shapes defined in `docs/05-components/_locals-shapes.md` use the standard table format from the Locals Contracts section.

### Shape Reference Syntax

In component docs, reference shared shapes with:
- **Exact match**: `**Shape**: [{Shape Name}](_locals-shapes.md#{shape-anchor})`
- **Subset**: `**Shape**: Subset of [{Shape Name}](_locals-shapes.md#{shape-anchor})`
```

### Task 3.4: Absorb `framework/modules/post-modify-checklist.md` into `docs-mod-pipeline`

**Why**: The pipeline module already defines the completion marker format. The checklist file adds hook validation behavior (warning conditions, "files that must change" check) that belongs in the pipeline module as a completion validation section.

**Content migration plan**:

| Content in `post-modify-checklist.md` | Destination |
|---|---|
| Required completion markers (6 items) | Already in `docs-mod-pipeline` as "Pipeline Completion Marker" |
| Full pipeline completion line | Already in `docs-mod-pipeline` |
| Validation rules (warning conditions) | `modules/docs-mod-pipeline/SKILL.md` — add as new section `## Completion Validation` |
| Files that must change | `modules/docs-mod-pipeline/SKILL.md` — add under completion validation |

**Estimated line additions to `docs-mod-pipeline`**: +15 lines

**Actions**:
1. `EDIT`: `modules/docs-mod-pipeline/SKILL.md` — add completion validation section after the existing "Pipeline Completion Marker" section
2. `DELETE`: `framework/modules/post-modify-checklist.md`

**Specific content to add to `docs-mod-pipeline`**:

After the existing `## Pipeline Completion Marker` section, add:

```markdown
## Completion Validation

The SubagentStop hook validates pipeline completion using these rules:

- Missing `[changelog: updated]` → hook emits warning
- `[verify: FAIL]` → hook emits warning with issue count
- `[sanity: LOW]` → hook emits warning
- All SKIP markers are acceptable (stage was legitimately skipped)
- Missing markers indicate incomplete pipeline — hook emits warning

### Files That Must Change

For any doc-modify operation, these files MUST have been modified:
- At least one file in `docs/` (the target documentation)
- `docs/changelog.md` (the changelog entry)

If neither changed, the operation may have failed silently.
```

### Phase 3 Validation Gate

Before proceeding to Phase 4:
- [ ] `citation-staleness-detection.md` deleted — algorithm now in `citation-rules.md`
- [ ] `cross-reference-validation.md` deleted — algorithm now in `validation-rules.md`
- [ ] `locals-contract-grammar.md` deleted — grammar now in `docs-mod-locals`, validation steps in instruction file
- [ ] `post-modify-checklist.md` deleted — validation rules now in `docs-mod-pipeline`
- [ ] `docs-mod-locals` expanded with grammar sections (~35 additional lines)
- [ ] `docs-mod-pipeline` expanded with completion validation (~15 additional lines)
- [ ] Grep entire plugin for references to the 4 deleted files — should find zero
- [ ] Total on-demand modules remaining: 6 (`verbosity-rules.md`, `citation-rules.md`, `api-ref-rules.md`, `validation-rules.md`, `codebase-analysis-guide.md`, `git-sync-rules.md`)

---

## 5. Phase 4: Create Missing Instruction Files for docs-system

**Goal**: Restore engine contract compliance for `docs-system` by creating instruction files.
**Risk**: Low — extracts inline content from the engine system prompt.
**Dependencies**: None (can run in parallel with Phase 3).

### Task 4.1: Create `framework/instructions/system/` Directory

```
CREATE: fp-docs/plugins/fp-docs/framework/instructions/system/
```

### Task 4.2: Create `framework/instructions/system/update-skills.md`

Extract the update-skills algorithm currently inline in `agents/docs-system.md` Step 2.

```markdown
# Update Skills — Instruction

## Inputs
- Preloaded modules: docs-mod-standards, docs-mod-project

## Steps

1. Read the plugin manifest at `{plugin-root}/framework/manifest.md`.

2. List all skill files: glob `{plugin-root}/skills/*/SKILL.md`.

3. For each skill file:
   a. Read the YAML frontmatter
   b. Verify `name`, `description`, `agent`, and `context: fork` fields exist
   c. Verify the referenced agent exists in `{plugin-root}/agents/`
   d. Check that `argument-hint` is present for user-facing skills

4. Compare discovered skills against the manifest's Commands table.
   - Missing from manifest → report as "unregistered skill"
   - In manifest but file missing → report as "orphaned manifest entry"

5. List all module files: glob `{plugin-root}/modules/*/SKILL.md`.

6. For each module:
   a. Verify `disable-model-invocation: true` and `user-invocable: false`
   b. Check which engine(s) preload it (from manifest Shared Modules table)

7. Regenerate the manifest Commands table and Shared Modules table from discovered files.

8. If differences found: update `framework/manifest.md` with regenerated tables.

## Output

Report: skills discovered, modules discovered, manifest changes applied (if any).
```

### Task 4.3: Create `framework/instructions/system/setup.md`

Extract the setup algorithm currently inline in `agents/docs-system.md` Step 2.

```markdown
# Setup — Instruction

## Inputs
- Preloaded modules: docs-mod-standards, docs-mod-project

## Steps

### Phase 1: Plugin Structure Verification
1. Verify all required directories exist:
   - `agents/` — should contain 8 engine files
   - `skills/` — should contain 19 user skill directories
   - `modules/` — should contain 10 shared module directories
   - `hooks/` — should contain `hooks.json`
   - `scripts/` — should contain hook scripts
   - `framework/config/` — should contain `system-config.md`, `project-config.md`
   - `framework/instructions/` — should contain instruction directories
   - `framework/modules/` — should contain on-demand modules

2. Validate `plugin.json` manifest has required fields (name, version, description).

3. Verify all 8 engine agent files exist:
   - `agents/docs-modify.md`
   - `agents/docs-validate.md`
   - `agents/docs-citations.md`
   - `agents/docs-api-refs.md`
   - `agents/docs-locals.md`
   - `agents/docs-verbosity.md`
   - `agents/docs-index.md`
   - `agents/docs-system.md`

4. Verify all 19 user skill files and 10 shared modules exist.

5. Verify `hooks/hooks.json` is valid JSON and references existing scripts.

### Phase 2: Docs Repo Setup
1. Detect codebase root: `git rev-parse --show-toplevel`
2. Check if docs repo exists at `{codebase-root}/themes/foreign-policy-2017/docs/.git`
3. If NOT found: advise user to clone docs repo
4. If found: verify remote URL and branch state

### Phase 3: Codebase Gitignore Check
1. Check if `themes/foreign-policy-2017/docs/` is in the codebase repo's `.gitignore`
2. If NOT present: warn user and offer to add it
3. If present: confirm

### Phase 4: Branch Sync
1. If docs repo is set up: detect codebase branch and docs branch
2. If mismatched: offer to run sync
3. Report overall three-repo health

## Output

Setup report with per-phase pass/fail status and recommended actions.
```

### Task 4.4: Create `framework/instructions/system/sync.md`

Extract the sync algorithm currently inline in `agents/docs-system.md` Step 2.

```markdown
# Sync — Instruction

## Inputs
- `$ARGUMENTS`: [merge] [--force]
- Framework module: `{plugin-root}/framework/modules/git-sync-rules.md`

## Steps

1. Read `framework/modules/git-sync-rules.md` for the full sync flow and diff report format.

2. Detect current branch state from session context (injected by SessionStart hook).

3. If no arguments (default sync):
   a. Detect codebase branch: `git -C {codebase-root} branch --show-current`
   b. Detect docs branch: `git -C {docs-root} branch --show-current`
   c. If branches match: report "already synced"
   d. If mismatch:
      - Check if docs repo has a branch matching the codebase branch name
      - If no: create from docs master, switch to it
      - If yes but on wrong branch: switch to matching branch
   e. Generate diff report per the format in git-sync-rules.md
   f. Write report to `docs/diffs/{YYYY-MM-DD}_{branch}_diff_report.md`

4. If `merge` argument:
   a. Verify current docs branch is NOT master
   b. Switch to docs master
   c. Merge the feature branch into master
   d. Push docs master
   e. Delete the merged feature branch (local)

5. `--force` flag: force branch switch even with uncommitted changes in docs repo.

## Output

Sync report: branches detected, actions taken, diff report location (if generated).
```

### Task 4.5: Update `agents/docs-system.md` to Reference Instruction Files

Remove the inline operation algorithms from the engine system prompt. Replace with instruction file routing, matching the pattern used by all other engines.

**Current** (Step 2 contains full inline algorithms for all 3 operations):
```markdown
### Step 2: Execute the Operation

#### For update-skills
[~30 lines of inline algorithm]

#### For setup
[~40 lines of inline algorithm]

#### For sync
[~25 lines of inline algorithm]
```

**Target** (Step 2 routes to instruction files):
```markdown
### Step 2: Load the Instruction File

Read the instruction file for your operation from the plugin:
- update-skills → {plugin-root}/framework/instructions/system/update-skills.md
- setup → {plugin-root}/framework/instructions/system/setup.md
- sync → {plugin-root}/framework/instructions/system/sync.md

Follow the steps in the instruction file to complete the operation.
```

### Phase 4 Validation Gate

Before proceeding to Phase 5:
- [ ] `framework/instructions/system/` directory exists with 3 instruction files
- [ ] `agents/docs-system.md` routes to instruction files (no inline algorithms)
- [ ] docs-system engine system prompt reduced by ~95 lines
- [ ] All 8 engines now follow the same pattern: parse request → load instruction file → execute → report

---

## 6. Phase 5: Slim Down Engine System Prompts

**Goal**: Remove inline domain logic from docs-verbosity and docs-index system prompts.
**Risk**: Low — the inline content is duplicated from preloaded modules and instruction files.
**Dependencies**: Phase 4 complete (pattern established).

### Task 5.1: Remove Inline Domain Logic from `agents/docs-verbosity.md`

**Current**: Step 3 contains two inline subsections:
- `### Banned Phrase Categories` (~15 lines) — duplicated from `docs-mod-verbosity`
- `### Severity Classification` (~10 lines) — duplicated from instruction file

**Action**: Remove both inline subsections. The engine already preloads `docs-mod-verbosity` (which has the full banned phrase list) and reads the instruction file `framework/instructions/verbosity/audit.md` (which has the classification).

**Changes**:
1. `EDIT`: `agents/docs-verbosity.md` — remove the two inline subsections from Step 3, keeping the step heading and a reference: "Follow the steps in your loaded instruction file. Use banned phrases and severity classification from your preloaded docs-mod-verbosity module."

### Task 5.2: Remove Inline Operation Algorithms from `agents/docs-index.md`

**Current**: Step 3 contains full algorithms for all 3 operations (~40 lines total):
- `#### update-project-index (incremental)` — duplicated from instruction file and `docs-mod-index`
- `#### update-project-index (full)` — duplicated
- `#### update-example-claude` — duplicated

**Action**: Remove all inline algorithms. The engine already reads instruction files and preloads `docs-mod-index`.

**Changes**:
1. `EDIT`: `agents/docs-index.md` — replace Step 3 inline algorithms with instruction file routing:
```markdown
### Step 3: Execute the Operation
Follow the steps in your loaded instruction file.
Use update modes and git consistency rules from your preloaded docs-mod-index module.
```

**Note**: The `update-example-claude` operation needs an instruction file. Currently `framework/instructions/index/update.md` covers `update` and `full` modes but not `update-example-claude`. Create a minimal instruction file:

2. `CREATE`: `framework/instructions/index/update-example-claude.md`:
```markdown
# Update Example CLAUDE.md — Instruction

## Inputs
- Preloaded modules: docs-mod-standards, docs-mod-project, docs-mod-index

## Steps

1. Read the current project CLAUDE.md (from codebase, not plugin).
2. Read the current plugin manifest at `{plugin-root}/framework/manifest.md`.
3. Read the current skill inventory from `{plugin-root}/skills/*/SKILL.md`.
4. Regenerate the skills table, documentation links, and project configuration sections.
5. Write the updated CLAUDE.md.

## Output
Report: sections updated, skills listed.
```

### Phase 5 Validation Gate

Before proceeding to Phase 6:
- [ ] `agents/docs-verbosity.md` system prompt reduced by ~25 lines (no inline banned phrases or severity classification)
- [ ] `agents/docs-index.md` system prompt reduced by ~40 lines (no inline algorithms)
- [ ] New instruction file `framework/instructions/index/update-example-claude.md` created
- [ ] All 8 engines follow the same slim system prompt pattern

---

## 7. Phase 6: Add disallowedTools to Read-Only Engines

**Goal**: Add `disallowedTools` defense-in-depth per engine-contract-spec §6.2.
**Risk**: Very low — cosmetic safety improvement.
**Dependencies**: None.

### Task 6.1: Add `disallowedTools` to `agents/docs-validate.md`

**Current frontmatter**:
```yaml
tools:
  - Read
  - Grep
  - Glob
  - Bash
```

**Add**:
```yaml
disallowedTools:
  - Write
  - Edit
```

### Task 6.2: Add `disallowedTools` to `agents/docs-verbosity.md`

Same change as 6.1 — add `disallowedTools: [Write, Edit]` to frontmatter.

### Phase 6 Validation Gate

- [ ] `agents/docs-validate.md` has `disallowedTools: [Write, Edit]`
- [ ] `agents/docs-verbosity.md` has `disallowedTools: [Write, Edit]`

---

## 8. Phase 7: Manifest & Version Bump

**Goal**: Update the system manifest and bump the plugin version to reflect the architecture changes.
**Risk**: Low.
**Dependencies**: All previous phases complete.

### Task 7.1: Update Framework Manifest

**File**: Plugin's manifest (injected at SessionStart). Update the On-Demand Framework Modules table.

**Current table** (12 entries):
```
| Module | Path | Loaded By |
|---|---|---|
| Verbosity Rules | framework/modules/verbosity-rules.md | Pipeline stage 1 |
| Citation Rules | framework/modules/citation-rules.md | Pipeline stage 2 |
| API Ref Rules | framework/modules/api-ref-rules.md | Pipeline stage 3 |
| Validation Rules | framework/modules/validation-rules.md | Pipeline stages 4-5 |
| Changelog Rules | framework/modules/changelog-rules.md | Pipeline stage 6 |
| Index Rules | framework/modules/index-rules.md | Pipeline stage 7 |
| Post-Modify Checklist | framework/modules/post-modify-checklist.md | SubagentStop hook |
| Codebase Analysis Guide | framework/modules/codebase-analysis-guide.md | Engines scanning source |
| Cross-Reference Validation | framework/modules/cross-reference-validation.md | Verification checks |
| Citation Staleness Detection | framework/modules/citation-staleness-detection.md | Citation update ops |
| Locals Contract Grammar | framework/modules/locals-contract-grammar.md | Locals engine ops |
| Git Sync Rules | framework/modules/git-sync-rules.md | docs-system sync, SessionStart hook |
```

**New table** (6 entries):
```
| Module | Path | Loaded By |
|---|---|---|
| Verbosity Algorithm | framework/modules/verbosity-rules.md | Pipeline stage 1 |
| Citation Algorithm | framework/modules/citation-rules.md | Pipeline stage 2 |
| API Ref Algorithm | framework/modules/api-ref-rules.md | Pipeline stage 3 |
| Validation Algorithm | framework/modules/validation-rules.md | Pipeline stages 4-5 |
| Codebase Analysis Guide | framework/modules/codebase-analysis-guide.md | Engines scanning source |
| Git Sync Rules | framework/modules/git-sync-rules.md | docs-system sync, SessionStart hook |
```

Also update:
- docs-system Operations row to include instruction file directory
- docs-modify Shared Modules to show 5 preloaded modules (added changelog, index)

### Task 7.2: Update plugin.json Version

```json
{
  "name": "fp-docs",
  "version": "2.6.0",
  ...
}
```

### Task 7.3: Update CLAUDE.md

Update the project CLAUDE.md at the repo root to reflect:
- Module count change (12 → 6 on-demand modules)
- docs-modify preloads 5 modules (was 3)
- docs-system now has instruction files
- Version 2.6.0

---

## 9. Validation Checklist

### After All Phases Complete

#### File Count Verification
- [ ] On-demand framework modules: exactly 6 files in `framework/modules/`
- [ ] Preloaded modules: exactly 10 files in `modules/docs-mod-*/`
- [ ] Engine agents: exactly 8 files in `agents/`
- [ ] Instruction directories: exactly 9 directories in `framework/instructions/` (modify, validate, citations, api-refs, locals, verbosity, index, system, orchestrate)
- [ ] User skills: exactly 19 directories in `skills/`

#### Deduplication Verification
- [ ] Grep all on-demand modules for complete table definitions — should find zero (tables belong in preloaded modules only)
- [ ] Grep on-demand modules for "Banned phrase" or banned phrase list items — should find zero (belongs in `docs-mod-verbosity` only)
- [ ] Grep on-demand modules for "Citation.*Format" or citation blockquote template — should find zero (belongs in `docs-mod-citations` only)
- [ ] Grep on-demand modules for column header definitions (Function|Params|Return) — should find zero (belongs in `docs-mod-api-refs` only)
- [ ] Grep on-demand modules for "10-Point" or individual check definitions — should find zero (belongs in `docs-mod-validation` only)

#### Engine Contract Verification
- [ ] All 8 engines have: Identity, How You Work (with Plugin Root), Memory Management, Git Awareness, Critical Rules
- [ ] All 8 engines route to instruction files in Step 2 (no inline algorithms except brief references)
- [ ] docs-modify preloads: standards, project, pipeline, changelog, index (5 modules)
- [ ] All other engines preload exactly 3 modules (standards, project, domain-specific)
- [ ] docs-validate and docs-verbosity have `disallowedTools: [Write, Edit]`

#### Reference Integrity
- [ ] Zero references to deleted files (`changelog-rules.md`, `index-rules.md`, `post-modify-checklist.md`, `cross-reference-validation.md`, `citation-staleness-detection.md`, `locals-contract-grammar.md`)
- [ ] All pipeline stage references point to either preloaded modules or existing on-demand files
- [ ] All instruction file references in engines point to existing files

---

## 10. File Change Summary

### Files DELETED (6)

| File | Reason |
|------|--------|
| `framework/modules/changelog-rules.md` | Zero unique content; `docs-mod-changelog` is complete |
| `framework/modules/index-rules.md` | Zero unique content; `docs-mod-index` is complete |
| `framework/modules/post-modify-checklist.md` | Absorbed into `docs-mod-pipeline` |
| `framework/modules/cross-reference-validation.md` | Algorithm absorbed into `validation-rules.md`; tables already in standards/project |
| `framework/modules/citation-staleness-detection.md` | Algorithm absorbed into `citation-rules.md` |
| `framework/modules/locals-contract-grammar.md` | Grammar absorbed into `docs-mod-locals`; validation into instruction file |

### Files REWRITTEN (4)

| File | Change |
|------|--------|
| `framework/modules/verbosity-rules.md` | Algorithm-only; removed duplicated rules (83 → ~40 lines) |
| `framework/modules/citation-rules.md` | Algorithm-only + absorbed staleness detection (77 → ~55 lines) |
| `framework/modules/api-ref-rules.md` | Algorithm-only; removed duplicated definitions (76 → ~50 lines) |
| `framework/modules/validation-rules.md` | Algorithm-only + absorbed link validation (79 → ~50 lines) |

### Files CREATED (4)

| File | Purpose |
|------|---------|
| `framework/instructions/system/update-skills.md` | Extracted from docs-system inline |
| `framework/instructions/system/setup.md` | Extracted from docs-system inline |
| `framework/instructions/system/sync.md` | Extracted from docs-system inline |
| `framework/instructions/index/update-example-claude.md` | New instruction for previously undocumented operation |

### Files EDITED (9)

| File | Change |
|------|--------|
| `agents/docs-modify.md` | Add `docs-mod-changelog`, `docs-mod-index` to `skills:` list |
| `agents/docs-system.md` | Replace inline algorithms with instruction file routing |
| `agents/docs-verbosity.md` | Remove inline banned phrases + severity; add `disallowedTools` |
| `agents/docs-index.md` | Remove inline algorithms; route to instruction files |
| `agents/docs-validate.md` | Add `disallowedTools: [Write, Edit]` |
| `modules/docs-mod-pipeline/SKILL.md` | Update Stage 6-7 refs; add completion validation section |
| `modules/docs-mod-locals/SKILL.md` | Add grammar sections (~35 lines) |
| `.claude-plugin/plugin.json` | Version bump 2.5.0 → 2.6.0 |
| Framework manifest | Update on-demand module table (12 → 6) |

### Total: 6 deleted + 4 rewritten + 4 created + 9 edited = 23 file operations

---

## 11. Rollback Strategy

All changes are within the plugin directory. Rollback approach:

1. **Before starting**: Create a git branch from current state
   ```bash
   cd "/Users/tom.kyser/FP LOCAL DEV/cc-plugins/fp-docs"
   git checkout -b architecture-fixes-v2.6
   ```

2. **After each phase**: Commit the phase's changes
   ```bash
   git add -A && git commit -m "Phase N: {description}"
   ```

3. **If issues detected**: Revert to the commit before the problematic phase
   ```bash
   git revert HEAD  # or git reset --soft HEAD~1
   ```

4. **Full rollback**: Return to the pre-fix state
   ```bash
   git checkout master  # or whatever the pre-fix branch was
   ```

---

## Execution Order

| Phase | Tasks | Can Parallelize? | Estimated Scope |
|-------|-------|-----------------|-----------------|
| **Phase 1** | Delete 2 on-demand files, update pipeline refs, add 2 preloads | No (sequential) | 3 deletes, 3 edits |
| **Phase 2** | Rewrite 4 on-demand files, update pipeline phrasing | Yes (4 rewrites independent) | 4 rewrites, 1 edit |
| **Phase 3** | Delete 4 on-demand files, merge content into preloaded modules | Partially (deletes depend on Phase 2) | 4 deletes, 2 edits |
| **Phase 4** | Create instruction directory + 3 files, update engine prompt | Yes (independent of 1-3) | 1 dir, 3 creates, 1 edit |
| **Phase 5** | Slim 2 engine prompts, create 1 instruction file | After Phase 4 | 2 edits, 1 create |
| **Phase 6** | Add `disallowedTools` to 2 engines | Anytime | 2 edits |
| **Phase 7** | Update manifest, version bump, CLAUDE.md | After all others | 3 edits |

**Optimal parallel grouping**:
- **Batch A** (foundations): Phase 1 + Phase 4 + Phase 6 (independent)
- **Batch B** (refactors): Phase 2 (depends on Phase 1 for pipeline refs)
- **Batch C** (absorption): Phase 3 (depends on Phase 2)
- **Batch D** (prompts): Phase 5 (depends on Phase 4)
- **Batch E** (finalize): Phase 7 (depends on all)
