# Implementation Plan: Code Citations System

> **Created**: 2026-02-28
> **Status**: IMPLEMENTED — Phases 0–7 complete (2026-02-28). Phase 8 (first-run batch generation) pending separate session.
> **Branch**: `task--theme-dev-docs`
> **Scope**: 22 files to create/modify across `docs/claude-code-docs-system/`, `docs/docs-management.md`, `docs/docs-prompts.md`, skills, and CLAUDE.md

---

## 1. System Overview

### 1.1 What This Is

A **code citations system** that embeds source code excerpts directly into documentation files, transforming docs from "descriptions of code" into "annotated code references." Every documentable claim is anchored to a visible citation block containing the file path, symbol name, line range, and (where applicable) a code excerpt.

### 1.2 Why

The current integrity rule — "NEVER guess — read actual source code" — is an honor system. The needs-revision-tracker proves it fails: 37 issues found in the last audit, including 4 entirely fabricated documents. Citations make accuracy **evidentiary** rather than aspirational:

- **Authoring accuracy** (primary): The writer must produce a citation alongside every claim. The excerpt sits next to the prose — inconsistencies are visible during writing.
- **Auditability** (secondary): A reviewer can verify docs without re-reading all source. The relevant code is right there.
- **Machine-verifiable**: Citation markers are parseable — verify/audit commands can programmatically check that cited symbols exist and excerpts match.

### 1.3 Design Principles

1. **Visible in rendered markdown** — citations are blockquote blocks, not HTML comments
2. **Dual-identifier** — stable identifier (file + symbol) as primary, volatile line range as supplementary
3. **Tiered depth** — full body for short functions, signature-only for long ones, reference-only for tables
4. **Configurable** — thresholds and behavior controlled via `docs-system-config.md`, not hardcoded in the kernel
5. **Lifecycle-integrated** — citations are generated/updated/verified as part of the existing lifecycle, not a parallel workflow
6. **Opt-out available but off by default** — `--no-citations` flag exists but citations are mandatory unless the config says otherwise

---

## 2. File Map

### 2.1 New Files (8)

| File | Type | Purpose |
|------|------|---------|
| `docs/claude-code-docs-system/docs-system-config.md` | Config | System-wide configuration variables (citation thresholds, defaults, feature flags) |
| `docs/claude-code-docs-system/instructions/cc-citations-generate.md` | Primary instruction | Generate citations for one doc or all docs (`--all`) |
| `docs/claude-code-docs-system/instructions/cc-citations-update.md` | Primary instruction | Refresh stale citations for one doc or all docs (`--all`) |
| `docs/claude-code-docs-system/instructions/cc-citations-verify.md` | Primary instruction | Verify citation format + code matching for one doc or all docs (`--all`) |
| `docs/claude-code-docs-system/instructions/cc-citations-audit.md` | Primary instruction | Deep semantic accuracy check of citations for one doc or all docs (`--all`) |
| `docs/claude-code-docs-system/instructions/cc-citations-diff.md` | Sub-instruction | Detect stale citations via source file comparison (lifecycle phase) |
| `docs/claude-code-config/.claude/skills/docs-citations.md` | Skill | Unified skill for all 4 citation commands |
| `.claude/skills/docs-citations.md` | Active skill | Copy of the above for active use |

### 2.2 Modified Files (14)

| File | Change Summary |
|------|---------------|
| `docs/claude-code-docs-system/docs-standards.md` | Add Section 7: Citation Format and Rules |
| `docs/claude-code-docs-system/docs-system.md` | Update lifecycle, add CITATIONS phase, reference config file, update integrity rules |
| `docs/claude-code-docs-system/docs-commands-list.md` | Add 4 primary commands + 1 sub-instruction to routing tables |
| `docs/claude-code-docs-system/instructions/cc-verify.md` | Add Check 7: Citation format validation |
| `docs/claude-code-docs-system/instructions/cc-sanity-check.md` | Enhanced Step 2: use citation excerpts as evidence anchors |
| `docs/claude-code-docs-system/instructions/cc-revise.md` | Add citation update step between Execute and Sanity Check |
| `docs/claude-code-docs-system/instructions/cc-add.md` | Add citation generation step after doc creation |
| `docs/claude-code-docs-system/instructions/cc-auto-update.md` | Add citation-diff detection and update step |
| `docs/claude-code-docs-system/instructions/cc-audit.md` | Add citation coverage/accuracy reporting to audit report |
| `docs/docs-prompts.md` | Add 4 new prompt definitions for citation commands |
| `docs/docs-management.md` | Add citation commands to user-facing reference |
| `docs/claude-code-config/example-CLAUDE.md` | Add citation commands to skills table |
| `.claude/CLAUDE.md` | Add citation commands to skills table |
| `.claude/skills/docs-citations.md` | Active skill copy (updated alongside source) |

---

## 3. Implementation Phases

### Phase 0: Foundation — System Configuration File

**Goal**: Create `docs-system-config.md` — a configuration file that separates policy from mechanism, allowing citation behavior (and future system behavior) to be tuned without modifying the kernel.

**Rationale**: The user specifically requested this to avoid modifying `docs-system.md` for threshold changes. This file becomes the single place to adjust system behavior.

#### Task 0.1: Create `docs-system-config.md`

**File**: `docs/claude-code-docs-system/docs-system-config.md`

**Content structure**:

```markdown
# Documentation System Configuration

> This file controls configurable behavior for the documentation management system.
> Instruction files read this file to determine thresholds, defaults, and feature flags.
> Change values here — do NOT modify `docs-system.md` or instruction files for configuration.

---

## 1. Citations

| Variable | Value | Description |
|----------|-------|-------------|
| `citations.enabled` | `true` | Whether citations are mandatory for doc-modifying operations |
| `citations.full_body_max_lines` | `15` | Functions ≤ this line count get full-body citations |
| `citations.signature_max_lines` | `100` | Functions ≤ this line count get signature citations; above this, reference-only |
| `citations.include_line_numbers` | `true` | Whether to include line ranges in citation markers |
| `citations.excerpt_comment_threshold` | `5` | Max comment lines to include in excerpts (strip beyond this) |

## 2. Citation Scope

| Doc Element | Citation Required | Tier | Notes |
|-------------|-------------------|------|-------|
| Function documentation | Yes | Full or Signature (by line count) | Every documented function |
| Hook registrations | Yes | Full | The `add_action`/`add_filter` call |
| Meta field tables | Yes | Reference | File + method + line range, no excerpt |
| Registration args (CPT/taxonomy) | Yes | Signature | The args array head |
| Shortcode attributes | Yes | Full | The `$atts` defaults + extract |
| REST endpoint registration | Yes | Full | Route + method + callback |
| Component file lists | No | — | File existence is self-verifying |
| Prose descriptions / overviews | No | — | Not citable |
| Related Docs sections | No | — | Links, not code claims |

## 3. General System

| Variable | Value | Description |
|----------|-------|-------------|
| `sanity_check.default_enabled` | `true` | Whether sanity-check runs by default (overridden by `--no-sanity-check`) |
| `sanity_check.multi_agent_threshold_docs` | `5` | Spawn multi-agent review if changes touch this many docs |
| `sanity_check.multi_agent_threshold_sections` | `3` | Spawn multi-agent review if changes span this many sections |
| `verify.total_checks` | `7` | Number of verification checks (updated from 6 when citations added) |
```

#### Task 0.2: Reference config from `docs-system.md`

Add to `docs-system.md` Section 2 (Bootstrap Sequence):

```markdown
1. **`docs-standards.md`** (same directory) — all formatting, naming, and structural rules
1.5. **`docs-system-config.md`** (same directory) — configurable thresholds and feature flags
2. **`docs-commands-list.md`** (same directory) — the command-to-instruction routing table
```

Add to Section 6 (Key Paths):

```markdown
| System configuration | `docs/claude-code-docs-system/docs-system-config.md` |
```

---

### Phase 1: Format Specification — docs-standards.md

**Goal**: Define the citation format, tiers, scope rules, and placement rules as Section 7 of `docs-standards.md`.

#### Task 1.1: Add Section 7 to `docs-standards.md`

Append after Section 6 (Cross-Reference Requirements):

```markdown
---

## 7. Citation Format and Rules

Code citations anchor documentation claims to source code. They make accuracy visible and machine-verifiable. Citation behavior is configured in `docs-system-config.md`.

### 7.1 Citation Block Format

Every citation is a markdown blockquote with a standardized structure:

**Full citation** (functions ≤ configured `full_body_max_lines`):

> **Citation** · `helpers/environment.php` · `is_wpvip()` · L12–18
> ```php
> function is_wpvip(): bool {
>     return defined( 'VIP_GO_APP_ENVIRONMENT' )
>         && in_array( VIP_GO_APP_ENVIRONMENT, array_merge( get_staging_env(), get_prod_env() ), true );
> }
> ```

**Signature citation** (functions > `full_body_max_lines` but ≤ `signature_max_lines`):

> **Citation** · `helpers/posts.php` · `get_featured_image_data()` · L89–142
> ```php
> function get_featured_image_data( int $post_id, string $size = 'large' ): array {
>     // ... 53 lines: image source resolution, fallbacks, srcset generation
> }
> ```

**Reference citation** (tables, grouped definitions, very long methods):

> **Citation** · `inc/post-types/class-post-type-post.php` · `add_meta_boxes()` · L45–120

**Hook citation**:

> **Citation** · `inc/hooks/actions/class-foreignpolicy-actions-general.php` · `__construct()` · L15
> ```php
> add_action( 'wp_head', [ $this, 'add_meta_tags' ], 5 );
> ```

**Shortcode citation**:

> **Citation** · `inc/shortcodes/fp-live-video.php` · `fp_live_video_shortcode()` · L8–14
> ```php
> $atts = shortcode_atts( [
>     'id' => '',
> ], $atts, 'fp-live-video' );
> ```

**REST endpoint citation**:

> **Citation** · `inc/rest-api/class-foreignpolicy-fb-pixels.php` · `register_routes()` · L22–30
> ```php
> register_rest_route( 'fp', '/fb-pixel', [
>     'methods'  => 'GET',
>     'callback' => [ $this, 'get_pixel_url' ],
>     'args'     => [
>         'event_name' => [ 'required' => true ],
>         'params'     => [ 'required' => true ],
>     ],
> ] );
> ```

### 7.2 Citation Marker Structure

Every citation marker follows this exact pattern:

```
> **Citation** · `{file_path}` · `{symbol_name}` · L{start}–{end}
```

- **`{file_path}`**: Relative to theme root, using backticks. Always the source file, never the doc file.
- **`{symbol_name}`**: The function, method, hook, class, or logical block name. Use `ClassName::method()` for class methods, bare `function_name()` for namespaced functions, `__construct()` for constructor hook registrations.
- **`L{start}–{end}`**: Line range in the source file. Use `L{n}` for single-line citations. Omit entirely for reference citations if the range is the entire method.

### 7.3 Citation Placement Rules

1. **Position**: Citations appear **immediately after** the documentation element they support — after the function heading and description, after a hook table row's parent section, after a meta field table.
2. **One citation per documentable claim**: Each function, hook registration, shortcode definition, REST route, or registration block gets its own citation. Do NOT combine unrelated citations.
3. **Grouped citations**: When a table documents multiple fields from a single method (e.g., `add_meta_boxes()`), use a single reference citation above or below the table covering the entire method range.
4. **No citation needed for**: Overview paragraphs, Related Docs sections, component file existence lists, prose descriptions that summarize rather than claim specific code behavior.

### 7.4 Citation Tiers

Citation depth is determined by element type and source code length. Thresholds are configured in `docs-system-config.md`.

| Tier | When Used | Content |
|------|-----------|---------|
| **Full** | Function body ≤ `full_body_max_lines` (default 15), hook registrations, shortcode attr defaults, REST route registrations | Complete code excerpt |
| **Signature** | Function body > `full_body_max_lines` and ≤ `signature_max_lines` (default 100) | Function signature + summary comment of body |
| **Reference** | Tables derived from long methods, grouped field definitions, very long functions | File + symbol + line range only, no excerpt |

### 7.5 Citation Excerpt Rules

1. **Preserve exact code**: Excerpts are copied verbatim from source — no reformatting, no cleanup, no simplification.
2. **Strip excessive comments**: If a function has more than `excerpt_comment_threshold` (default 5) lines of comments, keep only the first line and note `// ... N comment lines`.
3. **Signature citations**: Show the function signature line, opening brace, a `// ... N lines: <summary>` comment, and closing brace.
4. **PHP only for PHP docs**: Use `php` language identifier in fenced code blocks. Use `js` for JavaScript docs.
5. **Indentation**: Preserve original indentation from the source file. Do NOT normalize.

### 7.6 Citation Freshness

Citations include line numbers which are inherently volatile. A citation with a correct symbol but wrong line numbers is **stale but not broken** — different severity levels:

| State | Symbol Exists? | Lines Match? | Excerpt Matches? | Severity |
|-------|---------------|-------------|-----------------|----------|
| **Fresh** | Yes | Yes | Yes | None |
| **Stale** | Yes | No | Yes (at different lines) | Low — update line numbers |
| **Drifted** | Yes | No | No (code changed) | Medium — update excerpt + lines |
| **Broken** | No | — | — | High — symbol was removed/renamed |
| **Missing** | — | — | — | High — doc element has no citation |
```

#### Task 1.2: Update format templates in docs-standards.md

Update each format template in Section 3 (3.1 through 3.10) to show where citations appear. Add a note after each template:

```markdown
> **Citation placement**: Citations appear after each documented function, hook, or registration block. See Section 7.3 for placement rules.
```

Do NOT rewrite the templates — just add the citation placement note to each.

---

### Phase 2: Kernel Updates — docs-system.md

**Goal**: Update the execution lifecycle, integrity rules, and bootstrap sequence to incorporate citations as a first-class system concern.

#### Task 2.1: Update execution lifecycle

Replace the lifecycle in Section 3:

```
LOAD → ROUTE → PLAN → EXECUTE → CITATIONS → SANITY-CHECK → VERIFY → LOG → INDEX
```

Add the CITATIONS phase to the lifecycle table:

```markdown
| **CITATIONS** | Generate/update/verify citations for changed docs | After any operation that creates or modifies docs (unless `--no-citations` and `citations.enabled` is configurable in `docs-system-config.md`) |
```

#### Task 2.2: Update integrity rules

Add to Section 5 (Integrity Rules):

```markdown
9. **ALWAYS include citations** — every documentable code claim requires a citation block per `docs-standards.md` §7. Skip only if `citations.enabled` is `false` in `docs-system-config.md` or `--no-citations` flag is set.
10. **NEVER fabricate citations** — citation excerpts are copied verbatim from source code. If you cannot find the source, use `[NEEDS INVESTIGATION]` instead of inventing a citation.
```

#### Task 2.3: Update bootstrap sequence

Add `docs-system-config.md` to the bootstrap sequence in Section 2 (between steps 1 and 2).

#### Task 2.4: Add config to Key Paths table

Add to Section 6 (Key Paths):

```markdown
| System configuration | `docs/claude-code-docs-system/docs-system-config.md` |
```

---

### Phase 3: New Instruction Files

**Goal**: Create 4 primary command instruction files and 1 sub-instruction file for citation operations.

#### Task 3.1: Create `cc-citations-generate.md`

**File**: `docs/claude-code-docs-system/instructions/cc-citations-generate.md`

**Structure**:

```markdown
# Instruction: cc-citations-generate

> **Type**: Primary command
> **Command**: `citations-generate`
> **Purpose**: Generate citation blocks for documentation files that lack them.

---

## Prerequisites

- You have already loaded `docs-system.md`, `docs-system-config.md`, `docs-standards.md`, and `docs-commands-list.md`.
- Read `docs-standards.md` §7 (Citation Format and Rules) for format specification.
- Read `docs-system-config.md` §1-2 (Citations + Citation Scope) for thresholds and scope.

---

## Scope Selection

| Input | Behavior |
|-------|----------|
| No arguments | ERROR — must specify a doc file path or `--all` |
| `docs/path/to/file.md` | Generate citations for that single doc |
| `--section NN` | Generate citations for all docs in `docs/NN-section/` |
| `--all` | Generate citations for all 301+ docs (batch mode) |

---

## Steps (Single Doc Mode)

### Step 1: Read Configuration

Read `docs-system-config.md`. Extract citation tier thresholds and scope rules.

### Step 2: Read the Documentation File

Read the target doc file. Identify every documentable element:
- Functions (with headings like `### function_name()`)
- Hook registrations (in hook tables or hook sections)
- Meta field tables (derived from FM/ACF field definitions)
- Shortcode attribute tables
- REST route registrations
- CPT/taxonomy registration args

### Step 3: Identify Source Files

Use the source-to-documentation mapping table in `docs-system.md` to find the corresponding source file(s). Also check the doc's own `Source File` or `Location` header for explicit references.

### Step 4: Read Source Files

Read every source file identified in Step 3. For each documentable element found in Step 2, locate the corresponding code:
- Match function names to actual function/method definitions
- Match hook names to `add_action`/`add_filter` calls
- Match meta keys to FM/ACF field definitions
- Match shortcode tags to `shortcode_atts` calls
- Match REST routes to `register_rest_route` calls

### Step 5: Determine Citation Tier

For each matched element, determine the citation tier per `docs-system-config.md` §2 (Citation Scope) and the line count thresholds:

1. Count the lines of the source element (function body, hook call, etc.)
2. Compare against `citations.full_body_max_lines` and `citations.signature_max_lines`
3. Apply the tier: Full, Signature, or Reference

### Step 6: Generate Citation Blocks

For each element, generate the citation block per `docs-standards.md` §7:

1. Construct the citation marker: `> **Citation** · \`{file}\` · \`{symbol}\` · L{start}–{end}`
2. For Full tier: copy the complete code block verbatim
3. For Signature tier: copy the signature line + summary comment + closing brace
4. For Reference tier: marker only, no code block
5. Follow all excerpt rules from `docs-standards.md` §7.5

### Step 7: Insert Citations

Insert each citation block into the documentation file at the correct position per `docs-standards.md` §7.3 (Placement Rules):
- After function heading + description
- After or below tables derived from source methods
- After hook section headings

Use the Edit tool for insertions. Preserve all existing content.

### Step 8: Handle Unmatched Elements

For any documentable element in the doc that has NO matching source code:
- Do NOT generate a citation
- Add `[NEEDS INVESTIGATION — no source match found for citation]` after the element
- Log the unmatched element in the report

### Step 9: Verify Format

After all insertions, re-read the modified doc. Verify every citation block matches the format specification. Fix any formatting issues.

### Step 10: Report

Report:
- File modified
- Number of citations generated (by tier: Full / Signature / Reference)
- Any unmatched elements
- Any elements skipped (per scope rules — e.g., prose descriptions)

---

## Steps (Batch Mode — `--all`)

### Batch Step 1: Read Configuration

Same as single-doc Step 1.

### Batch Step 2: Enumerate All Docs

Read `docs/About.md` to get the complete list of documentation files. Exclude:
- Files in `docs/claude-code-docs-system/` (system files, not code docs)
- Files in `docs/claude-code-config/` (config templates)
- `docs/About.md` itself
- `docs/changelog.md`
- `docs/needs-revision-tracker.md`
- `docs/docs-management.md`
- `docs/docs-prompts.md`

### Batch Step 3: Prioritize by Bootstrap Order

Order docs for processing following the theme's bootstrap sequence (`docs/01-architecture/bootstrap-sequence.md`):

1. **Phase 1 — Constants/Environment**: `docs/06-helpers/environment.md`, constants-reference appendix
2. **Phase 2 — Core Helpers**: All `docs/06-helpers/*.md` files (loaded in functions.php lines 39–70)
3. **Phase 3 — Settings/Context Helpers**: Remaining helper docs
4. **Phase 4 — Post Types**: All `docs/02-post-types/*.md` files
5. **Phase 5 — Taxonomies**: All `docs/03-taxonomies/*.md` files
6. **Phase 6 — Custom Fields**: All `docs/04-custom-fields/*.md` files
7. **Phase 7 — Hooks**: All `docs/08-hooks/*.md` files
8. **Phase 8 — Shortcodes**: All `docs/07-shortcodes/*.md` files
9. **Phase 9 — REST API**: All `docs/09-api/*.md` files
10. **Phase 10 — CLI**: All `docs/15-cli/*.md` files
11. **Phase 11 — Everything else**: Components, layouts, features, integrations, admin, frontend assets, mobile, PDF, AMP, exports, notifications, HTMX, appendices

### Batch Step 4: Execute Per-Doc

For each doc in priority order, execute Single Doc Steps 2–10.

### Batch Step 5: Orchestration (optional)

If `--orchestrate` is set AND total docs > 20: spawn parallel Task agents, one per documentation section. Each agent processes its section's docs independently.

### Batch Step 6: Aggregate Report

Compile a summary report:
- Total docs processed
- Total citations generated (by tier)
- Docs with unmatched elements
- Docs skipped (no citable elements)
- Processing order followed

---

## Flags

| Flag | Effect |
|------|--------|
| `--all` | Process all documentation files (batch mode) |
| `--section NN` | Process all docs in section NN |
| `--tier full\|signature\|reference` | Override auto-detected tier for all elements |
| `--orchestrate` | Use parallel Task agents for batch mode (> 20 docs) |
| `--dry-run` | Report what would be generated without modifying files |
```

#### Task 3.2: Create `cc-citations-update.md`

**File**: `docs/claude-code-docs-system/instructions/cc-citations-update.md`

**Structure**:

```markdown
# Instruction: cc-citations-update

> **Type**: Primary command
> **Command**: `citations-update`
> **Purpose**: Refresh stale or drifted citations in documentation files.

---

## Prerequisites

- You have already loaded `docs-system.md`, `docs-system-config.md`, `docs-standards.md`, and `docs-commands-list.md`.

---

## Scope Selection

| Input | Behavior |
|-------|----------|
| No arguments | ERROR — must specify a doc file path or `--all` |
| `docs/path/to/file.md` | Update citations in that single doc |
| `--section NN` | Update citations for all docs in `docs/NN-section/` |
| `--all` | Update citations across all docs (batch mode) |

---

## Steps (Single Doc Mode)

### Step 1: Read Configuration

Read `docs-system-config.md`. Extract citation tier thresholds.

### Step 2: Read the Documentation File

Read the target doc file. Parse all existing citation blocks by identifying `> **Citation**` markers. For each citation, extract:
- File path
- Symbol name
- Line range
- Code excerpt (if present)
- Citation tier (Full, Signature, or Reference — inferred from structure)

### Step 3: Read Current Source Files

For each unique file path found in citations, read the current source file.

### Step 4: Compare Each Citation

For each existing citation, compare against current source:

1. **Symbol lookup**: Search the source file for the cited symbol (function name, method name, hook name).
   - If NOT found → classify as **Broken** (symbol removed/renamed)
   - If found → proceed to line check

2. **Line range check**: Check if the symbol is at the cited line range.
   - If YES → check excerpt
   - If NO → symbol moved, record new line range → classify as **Stale**

3. **Excerpt check** (Full and Signature tiers only): Compare the citation excerpt against the current source code at the symbol's actual location.
   - If matches → **Fresh** (no update needed)
   - If different → **Drifted** (code changed)

### Step 5: Update Citations

For each non-Fresh citation:

| State | Action |
|-------|--------|
| **Stale** | Update line range only. Keep excerpt (it's still correct). |
| **Drifted** | Update line range AND regenerate excerpt from current source. Re-apply tier rules. |
| **Broken** | Add `[NEEDS INVESTIGATION — cited symbol \`{name}\` no longer exists in \`{file}\`]` marker. Do NOT remove the citation — the doc content may also need revision. |

### Step 6: Check for Missing Citations

Scan the doc for documentable elements that lack citations (per scope rules in `docs-system-config.md` §2). For any found, generate new citations following the same process as `cc-citations-generate.md` Steps 4–7.

### Step 7: Report

Report:
- File modified
- Citations updated: N (Stale: N, Drifted: N)
- Citations broken: N (with details)
- Citations fresh (unchanged): N
- New citations generated: N

---

## Steps (Batch Mode — `--all`)

### Batch Step 1: Detect Scope

Two approaches depending on context:

**If called standalone**: Read `docs/About.md`, enumerate all doc files, process each per Single Doc Steps.

**If called by lifecycle integration**: Receive a list of affected doc files from the calling instruction (e.g., `cc-auto-update.md` passes only docs whose source files changed). Process only those docs.

### Batch Step 2: Run Citations-Diff (Optional Pre-Filter)

If processing all docs, call `cc-citations-diff.md` first to identify which docs have stale citations. Process only those docs to avoid unnecessary work.

### Batch Step 3: Execute and Report

Process each doc per Single Doc Steps 2–7. Aggregate results.

---

## Flags

| Flag | Effect |
|------|--------|
| `--all` | Process all documentation files |
| `--section NN` | Process all docs in section NN |
| `--orchestrate` | Use parallel Task agents for batch mode |
| `--dry-run` | Report what would be updated without modifying files |
```

#### Task 3.3: Create `cc-citations-verify.md`

**File**: `docs/claude-code-docs-system/instructions/cc-citations-verify.md`

**Structure**:

```markdown
# Instruction: cc-citations-verify

> **Type**: Primary command
> **Command**: `citations-verify`
> **Purpose**: Verify citation format compliance and code matching for documentation files.

---

## Prerequisites

- You have already loaded `docs-system.md`, `docs-system-config.md`, `docs-standards.md`, and `docs-commands-list.md`.

---

## Scope Selection

| Input | Behavior |
|-------|----------|
| No arguments | ERROR — must specify a doc file path or `--all` |
| `docs/path/to/file.md` | Verify citations in that single doc |
| `--section NN` | Verify citations for all docs in `docs/NN-section/` |
| `--all` | Verify citations across all docs |

---

## Checks

For each documentation file in scope, run ALL of the following checks. Report every issue — do not stop at first failure.

### Check 1: Citation Block Format

Parse every `> **Citation**` block. Verify:
- Marker follows exact pattern: `> **Citation** · \`{file_path}\` · \`{symbol_name}\` · L{start}–{end}`
- Separator is ` · ` (space, middle dot U+00B7, space)
- File path is in backticks
- Symbol name is in backticks
- Line range uses `L` prefix and en-dash `–` (not hyphen `-`)
- Code block (if present) uses correct language identifier (`php` for PHP, `js` for JS)
- Code block is inside the blockquote (lines start with `> `)

### Check 2: File Path Validity

For each citation, verify:
- The cited file path exists on disk (relative to theme root)
- The file path matches the doc's `Source File` or `Location` header (if present)

### Check 3: Symbol Existence

For each citation, verify:
- The cited symbol (function, method, class, hook name) exists in the cited file
- Use grep/search — do NOT read the entire file unless necessary

### Check 4: Line Range Accuracy

For each citation with a line range, verify:
- The cited symbol actually appears at or near the cited line range
- Tolerance: ±5 lines (to account for minor edits since citation was generated)
- If beyond tolerance: flag as STALE

### Check 5: Excerpt Accuracy (Full and Signature tiers)

For each citation with a code excerpt:
- Read the actual code at the cited location
- Compare the excerpt against the actual code character-by-character
- Flag any differences as DRIFTED
- Allow whitespace normalization (trailing spaces, line endings) but NOT content changes

### Check 6: Citation Coverage

Compare the doc's documentable elements against its citations:
- Read `docs-system-config.md` §2 to determine which elements require citations
- Flag any required element that lacks a citation as MISSING

### Check 7: Tier Compliance

For each citation, verify the tier is correct:
- Count the source function's actual line count
- Compare against `docs-system-config.md` tier thresholds
- Flag if a function that should be Full tier only has Reference, or vice versa

---

## Report Format

```
## Citation Verification Report — YYYY-MM-DD
### Scope: [file | section NN | all]

### FORMAT — Citation blocks with structural issues
- `docs/06-helpers/environment.md` L45: Missing line range in citation marker
- `docs/02-post-types/post.md` L120: Wrong separator (hyphen instead of en-dash)

### STALE — Line ranges no longer accurate
- `docs/06-helpers/posts.md` · `get_featured_image_data()`: cited L89–142, actual L95–148

### DRIFTED — Code excerpts don't match current source
- `docs/08-hooks/actions/general.md` · `modify_robots_txt()`: excerpt outdated (31 bots → 35 bots)

### BROKEN — Cited symbols no longer exist
- `docs/09-api/rest-api/list-api.md` · `validate_token()`: function not found in source

### MISSING — Required elements lack citations
- `docs/06-helpers/environment.md`: `get_staging_env()` has no citation

### TIER — Wrong citation tier applied
- `docs/06-helpers/piano.md` · `get_user_access_level()`: 45 lines, should be Signature tier, has Full tier

---
### Summary
- Format issues: N
- Stale: N
- Drifted: N
- Broken: N
- Missing: N
- Tier issues: N
- **Total issues: N**
```

---

## Flags

| Flag | Effect |
|------|--------|
| `--all` | Verify all documentation files |
| `--section NN` | Verify all docs in section NN |
| `--format-only` | Only run Check 1 (format compliance), skip code matching |
| `--orchestrate` | Use parallel Task agents for batch mode |

---

## Rules

- Verification is READ-ONLY — do NOT modify any files.
- Report EVERY issue found.
- If the user wants to fix findings, they should use `citations-update`.
```

#### Task 3.4: Create `cc-citations-audit.md`

**File**: `docs/claude-code-docs-system/instructions/cc-citations-audit.md`

**Structure**:

```markdown
# Instruction: cc-citations-audit

> **Type**: Primary command
> **Command**: `citations-audit`
> **Purpose**: Deep semantic accuracy check — do the documentation claims actually match what the cited code does?

---

## Prerequisites

- You have already loaded `docs-system.md`, `docs-system-config.md`, `docs-standards.md`, and `docs-commands-list.md`.

---

## How This Differs From citations-verify

| Aspect | citations-verify | citations-audit |
|--------|-----------------|-----------------|
| Focus | Format + structural correctness | Semantic accuracy |
| Question answered | "Are citations properly formatted and do excerpts match?" | "Does the prose description match what the cited code actually does?" |
| Reads prose? | No — only checks citation blocks | Yes — reads prose AND citations, compares meaning |
| Depth | Fast, mechanical | Deep, interpretive |
| Modifies files? | No | No |

---

## Scope Selection

| Input | Behavior |
|-------|----------|
| No arguments | ERROR — must specify a doc file path or `--all` |
| `docs/path/to/file.md` | Audit citations in that single doc |
| `--section NN` | Audit citations for all docs in `docs/NN-section/` |
| `--all` | Audit citations across all docs |

---

## Steps

### Step 1: Read Configuration

Read `docs-system-config.md` for scope rules.

### Step 2: Read the Documentation File

Read the target doc. For each citation block, capture:
- The citation itself (file, symbol, lines, excerpt)
- The documentation prose immediately surrounding the citation (the claim being made)

### Step 3: Semantic Comparison

For each citation + prose pair:

1. Read the full source code context (not just the excerpt — read surrounding code, class context, calling code if relevant)
2. Compare the prose description against the actual code behavior:
   - Does the described return type match?
   - Does the described parameter list match?
   - Does the described behavior (what the function does) match?
   - Does the described default value match?
   - Does the described hook priority match?
   - Does the described conditional logic match?

3. Classify findings:
   - **ACCURATE**: Prose correctly describes the cited code
   - **INACCURATE**: Prose contradicts the cited code (e.g., "returns string" but code returns array)
   - **INCOMPLETE**: Prose omits significant behavior visible in the cited code
   - **OVERCLAIMED**: Prose describes behavior not present in the cited code
   - **OUTDATED**: Citation excerpt is correct but prose describes old behavior

### Step 4: Check Citation-to-Prose Alignment

For each citation, verify:
- The citation is actually relevant to the prose it's next to (not misplaced)
- The citation covers all claims made in the adjacent prose
- No claims in the prose require a citation that doesn't exist

### Step 5: Report

Generate an audit report following the format pattern from `cc-audit.md`:

```
## Citation Audit Report — YYYY-MM-DD
### Scope: [file | section NN | all]

### INACCURATE — Prose contradicts cited code
- `docs/file.md` · `function_name()`:
  - Prose says: "returns the post title as a string"
  - Code shows: returns an associative array with 'title', 'url', 'image' keys
  - Citation excerpt confirms the array return type

### INCOMPLETE — Prose omits significant behavior
...

### OVERCLAIMED — Prose describes non-existent behavior
...

### OUTDATED — Citation correct but prose describes old behavior
...

---
### Summary
- Accurate: N
- Inaccurate: N
- Incomplete: N
- Overclaimed: N
- Outdated: N
- **Total issues: N**

### Recommended Actions
[Specific fixes needed — but do NOT execute them]
```

---

## Flags

| Flag | Effect |
|------|--------|
| `--all` | Audit all documentation files |
| `--section NN` | Audit all docs in section NN |
| `--orchestrate` | Use parallel Task agents for batch mode |

---

## Rules

- Audit is READ-ONLY — do NOT modify any files.
- Read the FULL source context, not just the cited excerpt. The excerpt is the anchor, but the audit must consider the complete picture.
- Report EVERY semantic issue found.
- If the user wants to fix findings, they should use `revise` (for prose) or `citations-update` (for citations).
```

#### Task 3.5: Create `cc-citations-diff.md`

**File**: `docs/claude-code-docs-system/instructions/cc-citations-diff.md`

**Structure**:

```markdown
# Instruction: cc-citations-diff

> **Type**: Sub-instruction
> **Called by**: `cc-auto-update.md`, `cc-citations-update.md` (batch mode)
> **Purpose**: Detect which documentation files have stale citations based on source file changes.

---

## Prerequisites

- You have already loaded `docs-system.md`, `docs-system-config.md`, `docs-standards.md`, and `docs-commands-list.md`.
- The calling instruction provides context: either a baseline date (from `cc-auto-update`) or explicit "check all" (from `cc-citations-update --all`).

---

## Steps

### Step 1: Identify Changed Source Files

**If baseline date provided** (from auto-update):
```bash
git log --since="{baseline_date}" --name-only --pretty=format:'%H %ai %s' -- .
```

**If no baseline** (standalone check):
Use the last changelog entry date as baseline (same as `cc-auto-update` Step 1).

Filter to documentation-relevant source files using the mapping table.

### Step 2: Map Source Changes to Citation Impact

For each changed source file:
1. Use the mapping table to find the corresponding doc file(s)
2. Read each doc file and extract citation markers
3. Check if any citation references the changed source file
4. If yes → that doc has potentially stale citations

### Step 3: Quick Staleness Check

For each potentially affected doc, do a fast check:
1. For each citation referencing the changed source file:
   - Check if the cited symbol still exists at the cited line range
   - If symbol exists at same lines → likely Fresh (skip)
   - If symbol exists at different lines → Stale
   - If symbol not found → Broken
   - If excerpt doesn't match → Drifted

### Step 4: Return Affected Docs List

Return to the calling instruction:
- List of doc files with stale/drifted/broken citations
- Per-doc summary of affected citations
- Recommended action (update lines only vs. regenerate excerpts vs. investigate)

This list is used by the calling instruction to scope its update work.

---

## Rules

- This is a DETECTION step only — do NOT modify any files.
- Optimize for speed — use grep/glob for symbol lookup rather than reading entire files.
- A changed source file does NOT automatically mean its citations are stale — the change may not affect cited code.
```

---

### Phase 4: Existing Instruction Modifications

**Goal**: Integrate citations into the existing doc-modifying commands so citations are maintained as part of the normal workflow.

#### Task 4.1: Update `cc-verify.md` — Add Check 7

Add after Check 6 (Changelog Check):

```markdown
### Check 7: Citation Format Validation

If `citations.enabled` is `true` in `docs-system-config.md`:

For each doc file that was created or modified by the current operation:
1. Parse all `> **Citation**` blocks
2. Verify marker format matches `docs-standards.md` §7.2
3. Verify each cited file path exists on disk
4. Verify each cited symbol exists in the cited file (grep check — not full read)
5. Report any FORMAT, MISSING (required element without citation), or BROKEN (symbol not found) issues

If `citations.enabled` is `false`: report `SKIP — citations disabled in config`.

**Note**: This is a lightweight check — format and existence only. For deep accuracy, use `citations-verify` or `citations-audit`.
```

Update the introductory text to say "7-point verification checklist" (or reference the config variable `verify.total_checks`).

#### Task 4.2: Update `cc-sanity-check.md` — Enhanced Step 2

Modify Step 2 (Cross-Reference Source Code) to leverage citations:

```markdown
### Step 2: Cross-Reference Source Code

For each modified doc, read the source file(s) it describes.

**If the doc has citation blocks**: Use citations as evidence anchors. For each citation:
1. Read the cited source location (file + line range)
2. Verify the excerpt still matches
3. Compare the prose adjacent to the citation against the cited code
4. This is MORE EFFICIENT than re-reading entire source files — citations tell you exactly where to look

**If the doc lacks citations**: Fall back to full source file reading (existing behavior).

Compare every factual claim...
[rest of existing Step 2 continues unchanged]
```

Add to the confidence level criteria:

```markdown
**Citation-enhanced confidence modifiers**:
- Doc has citations covering >80% of claims → confidence bonus (citations provide evidence)
- Doc has broken citations → confidence penalty (structural integrity compromised)
- Doc has no citations → no modifier (assess as before)
```

#### Task 4.3: Update `cc-revise.md` — Add Citation Step

Add a new Step 4.5 between Step 4 (Make Targeted Edits) and Step 5 (Sanity Check):

```markdown
### Step 4.5: Update Citations

Unless `--no-citations` is set (and `citations.enabled` allows opt-out per `docs-system-config.md`):

For each doc modified in Step 4:
1. If the doc has existing citations affected by the revision → update them (new line ranges, new excerpts if code changed)
2. If the revision added new documentable elements → generate citations for them (follow `cc-citations-generate.md` Steps 4–7)
3. If the revision removed elements → remove their citations

If `--no-citations` is set and `citations.enabled` is `true`: warn that citations are mandatory but proceeding without them per explicit flag.
```

#### Task 4.4: Update `cc-add.md` — Add Citation Step

Add a new Step 5.5 between Step 5 (Create Documentation) and Step 6 (Quick Audit):

```markdown
### Step 5.5: Generate Citations

Unless `--no-citations` is set (and `citations.enabled` allows opt-out per `docs-system-config.md`):

Generate citations for the newly created documentation file:
1. Re-read the source file(s) identified in Step 4
2. For each documentable element in the new doc, generate a citation block per `docs-standards.md` §7
3. Apply tier rules per `docs-system-config.md`
4. Insert citations at correct positions per `docs-standards.md` §7.3

This step ensures new documentation is created WITH citations from the start, not retrofitted later.
```

#### Task 4.5: Update `cc-auto-update.md` — Add Citation-Diff Step

Add a new Step 7.5 between Step 7 (Execute) and Step 8 (Update Links):

```markdown
### Step 7.5: Citation Maintenance

Unless `--no-citations` is set:

1. **Call `cc-citations-diff.md`**: Pass the list of changed source files from Step 3. Receive back a list of docs with stale citations.

2. **For docs already modified in Step 7**: Citations were likely updated as part of the edit. Verify by checking if citations in modified docs reference any changed source files and are still fresh.

3. **For docs NOT modified in Step 7 but flagged by citations-diff**: These are docs whose cited source code changed but whose prose is still accurate (the code change didn't affect documented behavior). Update citations only (line ranges, excerpts) without modifying prose.

4. **Report citation maintenance** separately from doc content updates.
```

#### Task 4.6: Update `cc-audit.md` — Add Citation Coverage

Add a new section to the audit report format:

```markdown
### CITATION COVERAGE — Documentation with missing or incomplete citations
- `docs/06-helpers/posts.md`: 12 functions documented, 0 citations (0% coverage)
- `docs/02-post-types/channel.md`: 8 documentable elements, 3 citations (37.5% coverage)

### CITATION HEALTH — Existing citations with issues
- `docs/08-hooks/actions/general.md`: 2 broken citations (symbols removed)
- `docs/06-helpers/environment.md`: 1 stale citation (line range shifted)
```

Add to the Summary section:

```markdown
- Citation coverage: N docs with citations / M total docs (X%)
- Citation issues: N broken, N stale, N drifted
```

---

### Phase 5: Command Registration

**Goal**: Register all new commands in the routing table, prompt definitions, and user-facing docs.

#### Task 5.1: Update `docs-commands-list.md`

Add to the Primary Commands table:

```markdown
| `citations-generate` | `cc-citations-generate.md` | Generate citations for docs | `/sc:task` | `/docs-citations generate` | `--strategy systematic` |
| `citations-update` | `cc-citations-update.md` | Refresh stale citations | `/sc:task` | `/docs-citations update` | `--strategy systematic` |
| `citations-verify` | `cc-citations-verify.md` | Verify citation format + code matching | `/sc:analyze` | `/docs-citations verify` | `--depth deep --format report` |
| `citations-audit` | `cc-citations-audit.md` | Deep semantic citation accuracy check | `/sc:analyze` | `/docs-citations audit` | `--depth deep --format report` |
```

Add to the Sub-Instructions table:

```markdown
| `cc-citations-diff.md` | `auto-update`, `citations-update` (batch) | Detect stale citations via source diff |
```

Add to the Instruction-Level Flag Reference:

```markdown
| `--all` | `citations-generate`, `citations-update`, `citations-verify`, `citations-audit` | — | Process all documentation files |
| `--section` | `citations-generate`, `citations-update`, `citations-verify`, `citations-audit` | `NN` (e.g., `02`, `06`) | Limit to specific docs section |
| `--tier` | `citations-generate`, `citations-update` | `full\|signature\|reference` | Override auto-detected citation tier |
| `--dry-run` | `citations-generate`, `citations-update` | — | Report without modifying |
| `--format-only` | `citations-verify` | — | Only check format, skip code matching |
| `--no-citations` | `revise`, `auto-revise`, `add`, `auto-update` | — | Skip citation phase (if allowed by config) |
```

#### Task 5.2: Update `docs-prompts.md`

Add 4 new prompt definitions following the existing format:

```markdown
## citations-generate

- **Skill**: `/docs-citations generate`
- **Description**: Generate citation blocks for documentation files
- **Arguments**: `$ARGUMENTS` = doc file path or `--all` + optional flags (`--section NN`, `--tier`, `--orchestrate`, `--dry-run`)
- **Steps**: 1
- **SuperClaude**: `/sc:task --strategy systematic`

### Prompt

```
Read `docs/claude-code-docs-system/docs-system.md` — execute: citations-generate $ARGUMENTS
```

---

## citations-update

- **Skill**: `/docs-citations update`
- **Description**: Refresh stale citations in documentation files
- **Arguments**: `$ARGUMENTS` = doc file path or `--all` + optional flags (`--section NN`, `--orchestrate`, `--dry-run`)
- **Steps**: 1
- **SuperClaude**: `/sc:task --strategy systematic`

### Prompt

```
Read `docs/claude-code-docs-system/docs-system.md` — execute: citations-update $ARGUMENTS
```

---

## citations-verify

- **Skill**: `/docs-citations verify`
- **Description**: Verify citation format and code matching
- **Arguments**: `$ARGUMENTS` = doc file path or `--all` + optional flags (`--section NN`, `--format-only`, `--orchestrate`)
- **Steps**: 1
- **SuperClaude**: `/sc:analyze --depth deep --format report`

### Prompt

```
Read `docs/claude-code-docs-system/docs-system.md` — execute: citations-verify $ARGUMENTS
```

---

## citations-audit

- **Skill**: `/docs-citations audit`
- **Description**: Deep semantic accuracy check of citations
- **Arguments**: `$ARGUMENTS` = doc file path or `--all` + optional flags (`--section NN`, `--orchestrate`)
- **Steps**: 1
- **SuperClaude**: `/sc:analyze --depth deep --format report`

### Prompt

```
Read `docs/claude-code-docs-system/docs-system.md` — execute: citations-audit $ARGUMENTS
```
```

#### Task 5.3: Update `docs-management.md`

Add a new section for citation commands in the user-facing command reference, following the existing format. Position it after the existing commands but before the setup instructions.

#### Task 5.4: Update `example-CLAUDE.md` and `.claude/CLAUDE.md`

Add to the Documentation Skills table:

```markdown
| `/docs-citations generate [scope]` | Generate citation blocks for docs |
| `/docs-citations update [scope]` | Refresh stale citations |
| `/docs-citations verify [scope]` | Verify citation format + code matching |
| `/docs-citations audit [scope]` | Deep semantic citation accuracy check |
```

---

### Phase 6: Skill Files

**Goal**: Create a unified skill file for citation commands.

#### Task 6.1: Create `docs-citations.md` skill

**File**: `docs/claude-code-config/.claude/skills/docs-citations.md`

Follow the existing skill file format from `docs-prompts.md`. The skill should accept a subcommand (`generate`, `update`, `verify`, `audit`) as the first argument and route to the appropriate prompt.

```markdown
---
name: docs-citations
description: "Manage code citations in documentation files"
argument-hint: "<generate|update|verify|audit> [scope] [flags]"
---

# /docs-citations - Code Citation Management

Parse `$ARGUMENTS` to extract the subcommand and remaining arguments:

| Subcommand | Route |
|------------|-------|
| `generate` | `citations-generate` |
| `update` | `citations-update` |
| `verify` | `citations-verify` |
| `audit` | `citations-audit` |

Execute the matching prompt from docs-prompts.md, passing remaining arguments as `$ARGUMENTS`.
```

#### Task 6.2: Copy skill to active directory

Copy `docs/claude-code-config/.claude/skills/docs-citations.md` to `.claude/skills/docs-citations.md`.

---

### Phase 7: CLAUDE.md Updates

**Goal**: Update both `example-CLAUDE.md` and `.claude/CLAUDE.md` to document the new commands.

#### Task 7.1: Update skills tables

Add citation commands to both CLAUDE.md files (covered in Task 5.4).

#### Task 7.2: Update command registration chain in memory

Update `.claude/memory/MEMORY.md` to note that the command registration chain now includes `docs-system-config.md` as a new touchpoint.

---

### Phase 8: First-Run Strategy (Post-Implementation)

**Goal**: After all system files are in place, execute the first batch generation of citations across all docs.

> **Note**: This phase is NOT part of the system implementation. It is executed AFTER all Phase 0–7 files are committed and verified. Document this as a separate execution step.

#### Task 8.1: Document the first-run procedure

Add to the implementation plan report:

```
## First-Run Execution

After all system files are committed:

1. Run `/docs-citations generate --all --dry-run` to preview scope
2. Review the dry-run report — confirm prioritization order
3. Run `/docs-citations generate --all` (or `--all --orchestrate` for parallel)
4. Run `/docs-citations verify --all` to validate format
5. Commit the citations as a single large commit
6. Run `/docs-citations audit --section 06` (helpers first — highest accuracy value)
7. Fix any semantic issues found
8. Proceed section by section through the audit
```

#### Task 8.2: Estimated scope

Based on the current docs inventory:

| Section | Doc Count | Estimated Citations | Priority |
|---------|-----------|-------------------|----------|
| 06-helpers | 43 files | ~300+ (many functions per helper) | 1 (highest) |
| 08-hooks | ~15 files | ~100+ | 2 |
| 02-post-types | 18 files | ~80+ | 3 |
| 07-shortcodes | ~8 files | ~40+ | 4 |
| 09-api | ~15 files | ~50+ | 5 |
| 03-taxonomies | ~10 files | ~30+ | 6 |
| 04-custom-fields | ~20 files | ~60+ | 7 |
| 15-cli | ~5 files | ~15+ | 8 |
| All others | ~170 files | ~200+ | 9 |
| **Total** | **~304 files** | **~875+ citations** | |

---

## 4. Implementation Order

Phases MUST be executed in order. Within each phase, tasks can be executed in the listed order.

```
Phase 0 (Foundation)     → Creates config file, references it from kernel
Phase 1 (Format Spec)    → Defines citation format in standards
Phase 2 (Kernel Updates) → Updates lifecycle and integrity rules
Phase 3 (Instructions)   → Creates 5 new instruction files
Phase 4 (Modifications)  → Updates 6 existing instruction files
Phase 5 (Registration)   → Updates routing, prompts, user docs
Phase 6 (Skills)         → Creates skill files
Phase 7 (CLAUDE.md)      → Updates project documentation
---
Phase 8 (First Run)      → Executes batch generation (separate session)
```

**Estimated file touches**: 22 files (8 new + 14 modified)

---

## 5. Dependency Map

```
Phase 0: docs-system-config.md
    ↓
Phase 1: docs-standards.md §7
    ↓
Phase 2: docs-system.md (lifecycle, integrity rules, bootstrap)
    ↓ (Phases 3 and 4 can partially overlap but 3 should complete first)
Phase 3: cc-citations-generate.md, cc-citations-update.md,
         cc-citations-verify.md, cc-citations-audit.md, cc-citations-diff.md
    ↓
Phase 4: cc-verify.md, cc-sanity-check.md, cc-revise.md,
         cc-add.md, cc-auto-update.md, cc-audit.md
    ↓ (Phases 5, 6, 7 can run in parallel)
Phase 5: docs-commands-list.md, docs-prompts.md, docs-management.md
Phase 6: skill files
Phase 7: CLAUDE.md files, memory
    ↓
Phase 8: First-run batch generation (separate session)
```

---

## 6. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Citation maintenance burden doubles update work | Medium | `citations-diff` as lifecycle phase auto-detects staleness; `citations-update` is fast for line-range-only changes |
| Line numbers drift with every commit | Low | Dual-identifier system (symbol is primary, lines are supplementary); verify tolerance of ±5 lines |
| First-run batch generation is massive (~875+ citations) | Medium | `--orchestrate` flag for parallel processing; `--dry-run` for preview; section-by-section execution |
| Existing docs have no citations — mixed state during rollout | Low | System handles citation-less docs gracefully; sanity-check has "no modifier" for docs without citations |
| Config file adds bootstrap complexity | Low | Simple markdown table format; read once during LOAD phase; cached for session |
| Citation excerpts bloat doc file sizes | Medium | Tiered system (Signature and Reference tiers minimize bloat); `full_body_max_lines` threshold is configurable |

---

## 7. Success Criteria

After implementation:

1. All 5 new instruction files exist and follow the established format
2. All 6 existing instructions are updated with citation integration
3. `docs-system-config.md` exists and is referenced from `docs-system.md` bootstrap
4. `docs-standards.md` §7 defines the complete citation format specification
5. Citation commands are registered in routing table, prompts, management docs, and skills
6. `cc-verify.md` has 7 checks (was 6)
7. `cc-sanity-check.md` uses citations as evidence anchors when available
8. Running `/docs-citations generate docs/06-helpers/environment.md` produces correctly formatted citations
9. Running `/docs-citations verify docs/06-helpers/environment.md` validates those citations
10. The `--no-citations` flag is respected by revise, add, and auto-update when config allows
