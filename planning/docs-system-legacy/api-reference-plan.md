# Implementation Plan: API Reference Sections

> **Created**: 2026-02-28
> **Status**: IMPLEMENTED — All 8 phases complete. ~106 doc files updated with API Reference sections, ~838 function/method rows. JavaScript layer deferred (sparse docs).
> **Branch**: `task--theme-dev-docs`
> **Prerequisite**: Execute after the citations system is in place and the needs-revision-tracker corrections are complete
> **Scope**: ~15 files to create/modify across `docs/claude-code-docs-system/`, `docs/docs-management.md`, `docs/docs-prompts.md`, skills, and CLAUDE.md — then a phased generation sweep across ~70 existing doc files

---

## 1. System Overview

### 1.1 What This Is

An **API Reference** layer added alongside existing narrative documentation. Every applicable doc file gains a standardized `## API Reference` section containing a complete, scannable table of every function, method, or callable in the documented source file — with signatures, parameters, return types, one-liner descriptions, and **per-row provenance markers** that track how each entry was sourced.

### 1.2 Why

The current docs explain *how things work* (guide/explainer style) but don't provide a *complete, scannable inventory* of what's available to use. A developer building something new can't answer "what helper functions exist that take a post ID?" without scanning narrative prose or reading source directly. The API reference fills this gap with a lookup-optimized format.

The distinction:

| Current Docs | API Reference Addition |
|-------------|----------------------|
| "The homepage override system works by checking three conditions..." | `set_homepage_or_sitewide_overrides( int $post_ID ): array` — Builds post array with hed/dek/image overrides |
| Explains the *why* and *how* | Catalogs the *what* — every callable, every signature |
| Read for understanding | Scan for discovery and lookup |

### 1.3 Design Principles

1. **Alongside, not separate** — reference sections are appended to existing doc files, not a parallel doc tree. One file, one source of truth.
2. **Per-row provenance** — every function row includes a machine-parseable provenance marker indicating how it was sourced (PHPDoc extraction, source verification, or hand-authored).
3. **Configurable scope** — which doc types get API reference sections and the provenance vocabulary are defined in `docs-system-config.md`, not hardcoded in standards.
4. **Hybrid generation** — extract from PHPDoc when available, hand-author from source reading when not. Provenance markers create an audit trail for future verification.
5. **Citations still apply** — API reference entries are documentable code claims and receive citations per the existing citation system. The reference table provides the summary; the citation provides the evidence.
6. **Initial buildout command + ongoing maintenance** — a dedicated `/docs-api-ref` command handles the one-time generation sweep; afterward, existing commands (`/docs-revise`, `/docs-add`, `/docs-auto-update`) maintain reference sections as part of normal operations.

---

## 2. Key Design Decisions

### 2.1 Per-Row Provenance Markers

Each row in an API reference table includes a `Src` column with one of three provenance values:

| Value | Meaning | Audit Implication |
|-------|---------|-------------------|
| `PHPDoc` | Extracted from inline `@param`, `@return`, `@throws` docblocks | Flagged for future verification — inline docs were trusted, not cross-checked |
| `Verified` | Cross-checked against actual function body (either hand-authored or PHPDoc-extracted then verified) | Trusted — normal freshness checks apply |
| `Authored` | No PHPDoc existed; reference was written entirely from source reading | Treated same as `Verified` |

Example table:

```markdown
## API Reference

> **Ref Source** · Per-row provenance in `Src` column · See `docs-system-config.md` §4 for values

| Function | Params | Return | Description | Src |
|----------|--------|--------|-------------|-----|
| `is_wpvip()` | — | `bool` | True on any VIP environment | `Verified` |
| `is_production()` | — | `bool` | True only when `VIP_GO_APP_ENVIRONMENT === 'production'` | `PHPDoc` |
| `is_staging()` | — | `bool` | True for any staging environment | `Verified` |
| `get_staging_env()` | — | `array` | Returns list of 7 staging env strings | `Authored` |
```

The `> **Ref Source**` blockquote above the table serves as a human-visible legend and machine-parseable section marker. It follows the existing citation blockquote convention (`> **Bold Label** · details`).

### 2.2 Section Placement

The `## API Reference` section is placed as the **last content section before `## Related Docs`** in every applicable doc file. This keeps the narrative flow intact — a developer reading top-to-bottom gets the explainer first, then the reference. A developer looking up a specific function scrolls to the bottom or searches.

```
# [Doc Title]
## Overview
## Source File
## [Narrative sections...]
## API Reference          ← new
## Related Docs           ← existing, always last
```

### 2.3 Table Column Specification

The standard API reference table has 5 columns:

| Column | Content | Notes |
|--------|---------|-------|
| **Function** | Function/method name with parentheses, in backticks | `function_name()` for namespaced functions, `ClassName::method()` for class methods |
| **Params** | Typed parameter list | `int $post_ID`, `string $size = 'large'` — use `—` for no params |
| **Return** | Return type in backticks | `bool`, `array`, `string\|false`, `void` |
| **Description** | One-liner describing behavior | Present tense, starts with verb: "Returns...", "Checks...", "Builds..." |
| **Src** | Provenance marker | One of the configured `api_ref.provenance_values` |

For methods with complex parameter lists (4+ params), the table row contains the primary params and a "See citation below" note, with the full signature visible in the citation block that follows.

### 2.4 Relationship to Citations

API reference tables and citations are complementary:

- **Reference table** = the lookup index (scannable, complete, one row per function)
- **Citation block** = the evidence (code excerpt proving the table row is accurate)

Every function row in the API reference table should have a corresponding citation block elsewhere in the doc (either in the existing narrative section or immediately following the reference table). The citation system handles this — no special treatment needed beyond ensuring the reference table's functions are included in the citation scope.

### 2.5 Which Doc Types Get API Reference Sections

This mapping is **defined in `docs-system-config.md`**, not in `docs-standards.md`. The standards file defines the abstract pattern; the config file defines where it applies.

Default configuration:

| Doc Type | Gets API Ref? | What It Covers |
|----------|---------------|----------------|
| Helper (§3.3) | Yes | Every function in the namespace |
| Post Type (§3.1) | Yes | Public methods on the class |
| Taxonomy (§3.2) | Yes | Public methods, query helpers |
| REST Endpoint (§3.6) | Yes | Callback methods, response shape typing |
| HTMX Abstract/Traits (mapped to §3.1) | Yes | Public/protected methods |
| JavaScript (§3.8) | Yes | Exported functions, key event handlers |
| Integration (§3.10) | Yes | Helper functions for the integration |
| Hook (§3.4) | No | Already tabular reference format |
| Shortcode (§3.5) | No | Already has attribute tables at reference depth |
| ACF Field Group (§3.9) | No | Already has field tables at reference depth |
| Component (§3.7) | Future | $locals contracts — separate project |

---

## 3. File Map

### 3.1 New Files (4)

| File | Type | Purpose |
|------|------|---------|
| `docs/claude-code-docs-system/instructions/cc-api-ref.md` | Primary instruction | Generate/update API reference sections for one doc or scope (`--all`, `--layer helpers`, etc.) |
| `docs/claude-code-docs-system/instructions/cc-api-ref-audit.md` | Sub-instruction | Audit provenance markers: find all `PHPDoc` rows, verify against actual source |
| `docs/claude-code-config/.claude/skills/docs-api-ref.md` | Skill | Skill file for `/docs-api-ref` command |
| `.claude/skills/docs-api-ref.md` | Active skill | Copy of the above for active use |

### 3.2 Modified Files (~11)

| File | Change Summary |
|------|---------------|
| `docs/claude-code-docs-system/docs-standards.md` | Add §8: API Reference Format and Rules (abstract patterns only — placement, column structure, provenance marker format, relationship to citations) |
| `docs/claude-code-docs-system/docs-system-config.md` | Add §4: API Reference (feature flag, provenance values, doc-type-to-API-ref mapping table, table column spec) |
| `docs/claude-code-docs-system/docs-system.md` | Add integrity rule 11 (provenance markers required). Add note that EXECUTE phase includes API ref generation for applicable types. |
| `docs/claude-code-docs-system/docs-commands-list.md` | Add `api-ref` primary command + `api-ref-audit` sub-instruction to routing tables |
| `docs/claude-code-docs-system/instructions/cc-revise.md` | Add step: "If doc type has API Reference (per config §4), update the reference section" |
| `docs/claude-code-docs-system/instructions/cc-add.md` | Add step: "If doc type has API Reference (per config §4), generate the reference section" |
| `docs/claude-code-docs-system/instructions/cc-auto-update.md` | Add step: detect API reference section staleness when source functions change |
| `docs/claude-code-docs-system/instructions/cc-verify.md` | Add Check 8: API Reference provenance marker validation (every row has valid `Src` value) |
| `docs/docs-prompts.md` | Add prompt definition for `/docs-api-ref` command |
| `docs/docs-management.md` | Add `api-ref` command to user-facing reference |
| `docs/claude-code-config/example-CLAUDE.md` | Add `/docs-api-ref` to skills table |

**Note**: `.claude/CLAUDE.md` will also need the skill added, but that's maintained by `/docs-update-claude` and isn't counted as a manual modification.

---

## 4. Implementation Phases

### Phase 1: System Infrastructure

**Goal**: Update the docs system files to support API reference sections as a first-class concept. No doc files are modified yet — this is pure infrastructure.

#### Task 1.1: Update `docs-system-config.md` — Add §4: API Reference

Add the following section after the existing §3:

```markdown
## 4. API Reference

| Variable | Value | Description |
|----------|-------|-------------|
| `api_ref.enabled` | `true` | Whether API Reference sections are required in applicable doc types during doc-modifying operations |
| `api_ref.provenance_values` | `PHPDoc, Verified, Authored` | Valid values for the per-row `Src` column |
| `api_ref.default_provenance` | `Verified` | Default provenance when hand-writing reference entries from source |
| `api_ref.phpdoc_provenance` | `PHPDoc` | Provenance value when extracting from inline docblocks |

### 4.1 API Reference Scope

This table defines which documentation format templates (per `docs-standards.md` §3) include an `## API Reference` section. Instruction files reference this table — they do NOT maintain their own scope rules.

| Doc Type (Standards §) | API Ref Required | Covers |
|------------------------|-----------------|--------|
| Helper (§3.3) | Yes | Every function in the namespace |
| Post Type (§3.1) | Yes | Public methods on the class |
| Taxonomy (§3.2) | Yes | Public methods, query modification helpers |
| REST Endpoint (§3.6) | Yes | Callback methods, response shape typing |
| JavaScript (§3.8) | Yes | Exported functions, key event handlers |
| Integration (§3.10) | Yes | Helper functions for the integration |
| Hook (§3.4) | No | Already tabular reference format |
| Shortcode (§3.5) | No | Already has attribute tables at reference depth |
| ACF Field Group (§3.9) | No | Already has field tables at reference depth |
| Component (§3.7) | No | Deferred — $locals contracts are a separate project |

### 4.2 API Reference Table Columns

| Column | Header | Content Rule |
|--------|--------|-------------|
| 1 | `Function` | Function/method name in backticks with `()`. Namespaced: `function_name()`. Class methods: `ClassName::method()`. |
| 2 | `Params` | Typed parameter list. Use `—` for no params. For 4+ params, list primary params and note "See citation." |
| 3 | `Return` | Return type in backticks. Use `void` for no return. Unions: `string\|false`. |
| 4 | `Description` | One-liner. Present tense, starts with verb. Max ~80 chars. |
| 5 | `Src` | Provenance marker. Must be one of `api_ref.provenance_values`. |
```

#### Task 1.2: Update `docs-standards.md` — Add §8: API Reference Format and Rules

Add a new section after §7 (Citation Format and Rules). This section defines **abstract patterns only** — no configurable values.

```markdown
## 8. API Reference Format and Rules

API Reference sections provide a scannable, complete inventory of every callable in a documented source file. They complement the narrative documentation above them.

### 8.1 Section Structure

Every API Reference section follows this structure:

1. `## API Reference` heading
2. Ref Source legend blockquote (required)
3. Reference table with per-row provenance
4. Citation blocks for each entry (per §7)

### 8.2 Ref Source Legend

Every `## API Reference` section begins with a provenance legend blockquote:

> **Ref Source** · Per-row provenance in `Src` column · See `docs-system-config.md` §4 for values

This blockquote is:
- **Human-visible**: tells readers what the `Src` column means
- **Machine-parseable**: instruction files use this marker to locate API reference sections in doc files

### 8.3 Placement

The `## API Reference` section is placed as the **last content section before `## Related Docs`**. If no `## Related Docs` exists, it is the last section.

### 8.4 Table Format

The table column specification is defined in `docs-system-config.md` §4.2. Standards rules:

- One row per public function or method in the documented source file.
- Rows are ordered by source file line number (declaration order), not alphabetically.
- Private/internal helper functions within a class are excluded unless they are called by other documented code.
- If a function has 4+ parameters, list the first 2–3 and add "See citation" in the Params column, with full signature in the citation block.
- The `Src` column value MUST be one of the values defined in `docs-system-config.md` `api_ref.provenance_values`.

### 8.5 Provenance Rules

- When extracting from PHPDoc: use the configured `api_ref.phpdoc_provenance` value. The PHPDoc is trusted for the initial entry but flagged for future verification.
- When hand-writing from source reading: use the configured `api_ref.default_provenance` value.
- When a `PHPDoc` entry is later verified against source: update the `Src` column to `Verified`.
- NEVER mark an entry `Verified` without reading the function body. `PHPDoc` is the honest default when inline docs are trusted.

### 8.6 Completeness Rule

An API Reference section MUST document every public function/method in the source file. If a function exists in source but not in the reference table, the doc is incomplete. The `/docs-api-ref audit` sub-command checks for this.

### 8.7 Which Doc Types Get API Reference

The mapping of doc types to API reference applicability is defined in `docs-system-config.md` §4.1. The standards file does not hardcode this mapping.
```

#### Task 1.3: Update `docs-system.md`

Two changes:

**1. Add integrity rule 11:**

```markdown
11. **API Reference provenance is mandatory** — every row in an API Reference table MUST include a `Src` provenance value from `docs-system-config.md` §4. NEVER omit provenance.
```

**2. Add EXECUTE phase note** (in the lifecycle table, expand the EXECUTE row's description):

```
| **EXECUTE** | Follow the instruction file's steps. For doc types with API Reference (per `docs-system-config.md` §4.1), generate or update the `## API Reference` section. | ALWAYS |
```

#### Task 1.4: Update `docs-commands-list.md`

Add to the primary commands table:

```markdown
| `api-ref [scope]` | `instructions/cc-api-ref.md` | Generate or update API Reference sections. Scope: file path, `--layer helpers`, `--layer post-types`, or `--all`. |
```

Add to the sub-instructions table:

```markdown
| `api-ref-audit` | `instructions/cc-api-ref-audit.md` | Audit provenance markers: find `PHPDoc`-sourced entries, verify against source. Called via `--audit` flag on `api-ref`. |
```

---

### Phase 2: Instruction Files

**Goal**: Create the primary instruction file for the `/docs-api-ref` command and the audit sub-instruction. Update existing instruction files to maintain API reference sections during normal operations.

#### Task 2.1: Create `cc-api-ref.md`

Primary instruction file for generating and updating API reference sections.

**Procedure outline:**

1. **Parse scope**: Accept a file path (single doc), `--layer {layer}` (all docs in a layer), or `--all` (every applicable doc).
2. **Load config**: Read `docs-system-config.md` §4 for applicable doc types and provenance values.
3. **For each target doc**:
   a. Read the existing doc file.
   b. Identify the source file(s) from the doc's `## Source File` section.
   c. Read the source file(s).
   d. Extract all public functions/methods with signatures, parameters, return types.
   e. For each function, check for PHPDoc:
      - If PHPDoc exists: extract `@param`, `@return`, `@throws` annotations. Set `Src` = configured `api_ref.phpdoc_provenance`.
      - If no PHPDoc: read the function body, write description from understanding. Set `Src` = configured `api_ref.default_provenance`.
   f. Generate the `## API Reference` section with Ref Source legend and table.
   g. Insert before `## Related Docs` (or append if no Related Docs section).
   h. Generate citation blocks for each function per existing citation rules (§7).
4. **Run verification** (VERIFY lifecycle phase).
5. **Log changes** (LOG lifecycle phase).

**Flags:**

| Flag | Behavior |
|------|----------|
| `--all` | Process every applicable doc file |
| `--layer {name}` | Process all docs in a specific layer (helpers, post-types, rest, htmx, etc.) |
| `--audit` | After generation, run `cc-api-ref-audit.md` to verify `PHPDoc` entries |
| `--no-citations` | Skip citation generation (reference table only). Respects `citations.enabled` config. |
| `--no-sanity-check` | Skip sanity-check phase |

#### Task 2.2: Create `cc-api-ref-audit.md`

Sub-instruction for auditing provenance markers.

**Procedure outline:**

1. Find all `## API Reference` sections in target scope.
2. Parse each table, extract rows where `Src` = `PHPDoc`.
3. For each `PHPDoc` row:
   a. Read the actual function body in source.
   b. Compare: does the PHPDoc-extracted description, param types, and return type match the actual behavior?
   c. If match: optionally upgrade `Src` to `Verified` (controlled by `--upgrade` flag).
   d. If mismatch: report the discrepancy with expected vs. actual.
4. Output a summary: N entries audited, N verified, N mismatched, N upgraded.

#### Task 2.3: Update existing instruction files

**`cc-revise.md`** — Add step after EXECUTE, before CITATIONS:

> "If the doc's type is listed in `docs-system-config.md` §4.1 as requiring API Reference: check whether an `## API Reference` section exists. If not, generate one. If it exists, verify the function list matches the current source file — add missing functions, remove deleted ones, update changed signatures."

**`cc-add.md`** — Add step after doc creation:

> "If the new doc's type is listed in `docs-system-config.md` §4.1: generate an `## API Reference` section as part of initial doc creation."

**`cc-auto-update.md`** — Add detection step:

> "When diffing source changes: if a function was added, removed, or had its signature changed in a file whose doc type requires API Reference, flag the API reference section for update."

**`cc-verify.md`** — Add Check 8:

> "**Check 8: API Reference provenance** — For each doc with an `## API Reference` section: every row has a `Src` column value that matches one of the configured `api_ref.provenance_values`. Flag missing or invalid provenance values."

---

### Phase 3: Command Registration Chain

**Goal**: Register the new command through the full chain so it's discoverable and invocable.

Following the established chain: instruction file → docs-commands-list.md → docs-prompts.md → docs-management.md → Skill files (source + active) → example-CLAUDE.md → .claude/CLAUDE.md

#### Task 3.1: Update `docs-prompts.md`

Add prompt definition for `/docs-api-ref`:

```markdown
### docs-api-ref

**Trigger**: `/docs-api-ref [scope] [flags]`

**Prompt**:
Read `docs/claude-code-docs-system/docs-system.md` to bootstrap the documentation management system. Then execute the `api-ref` command with scope: `{scope}` and flags: `{flags}`.

**Scope values**: A doc file path, `--layer helpers`, `--layer post-types`, `--layer rest`, `--layer htmx`, `--layer javascript`, `--layer integrations`, `--layer taxonomies`, `--all`

**Flags**: `--audit`, `--no-citations`, `--no-sanity-check`
```

#### Task 3.2: Update `docs-management.md`

Add to the user-facing command reference:

```markdown
| `/docs-api-ref [scope] [flags]` | Generate or update API Reference sections in docs |
```

With detailed usage section matching the existing command documentation style.

#### Task 3.3: Create skill files

**Source**: `docs/claude-code-config/.claude/skills/docs-api-ref.md`
**Active copy**: `.claude/skills/docs-api-ref.md`

Skill file routes `/docs-api-ref` invocations to the docs system bootstrap.

#### Task 3.4: Update `example-CLAUDE.md` and `.claude/CLAUDE.md`

Add to the Documentation Skills table:

```markdown
| `/docs-api-ref [scope] [flags]` | Generate or update API Reference sections |
```

---

### Phase 4: Generation Sweep — Helpers (Priority 1)

**Goal**: Generate API reference sections for all 44 helper doc files. This is the largest and highest-value layer.

**Scope**: All files in `docs/06-helpers/` that correspond to helper source files in `helpers/`.

**Estimated files**: ~35 individual helper docs (some helpers share a doc file, some lack individual docs).

**Procedure per file**:
1. Read the helper source file (e.g., `helpers/authors.php`).
2. Extract every function in the namespace.
3. Check each function for PHPDoc.
4. Generate the `## API Reference` table with per-row provenance.
5. Generate citation blocks.
6. Insert into the existing doc file.

**Sub-priority within helpers** (based on usage frequency and developer need):

| Priority | Helper Files | Rationale |
|----------|-------------|-----------|
| 4a | `posts.php`, `attachments.php`, `authors.php`, `taxonomies.php` | Most-called, largest API surface |
| 4b | `context.php`, `templates.php`, `environment.php` | Core plumbing every template uses |
| 4c | `piano.php`, `sailthru.php`, `meilisearch.php`, `htmx.php` | Integration helpers |
| 4d | `strings.php`, `url.php`, `arrays.php`, `tags.php`, `events.php` | Utility helpers |
| 4e | Remaining helpers | Long tail |

---

### Phase 5: Generation Sweep — Core Systems (Priority 2)

**Goal**: Generate API reference sections for post types, taxonomies, and REST endpoints.

#### 5a: Post Type Docs

**Scope**: `docs/02-post-types/` — 17 post type docs.

For post type classes, the API reference covers **public methods only**. Constructor-registered hooks are already documented in the narrative; the reference table catalogs the methods themselves.

#### 5b: Taxonomy Docs

**Scope**: `docs/03-taxonomies/` — taxonomy docs with class methods.

Lighter touch — most taxonomy classes have fewer public methods than post types.

#### 5c: REST Endpoint Docs

**Scope**: `docs/09-api/rest-api/` — 14 endpoint docs.

**Important**: This phase runs AFTER the needs-revision-tracker corrections are complete (4 fabricated docs must be fixed first). The API reference generation will be based on corrected narrative docs and verified source code.

---

### Phase 6: Generation Sweep — HTMX + JavaScript (Priority 3)

#### 6a: HTMX Abstract + Traits

**Scope**: `docs/23-htmx/` — abstract core doc, traits docs.

The HTMX `Core` class and its traits form a well-defined API surface. ~30 methods across 4 files.

#### 6b: JavaScript Docs

**Scope**: `docs/17-frontend-assets/javascript/` — JS module docs.

JavaScript presents a challenge: no PHPDoc equivalent (JSDoc exists but coverage is unknown). Most entries will likely be `Authored` provenance. The existing JS docs were recently flagged as sparse in the needs-revision tracker, so this phase may be limited by the quality of underlying narrative docs.

---

### Phase 7: Generation Sweep — Integrations + CLI (Priority 4)

#### 7a: Integration Docs

**Scope**: `docs/12-integrations/` — integration docs that have associated helper functions.

Not all integration docs need API reference — some describe external service configuration only. The reference section applies when there are FP-authored helper functions or wrapper classes.

#### 7b: CLI Docs

**Scope**: `docs/15-cli/` — CLI command docs.

Small surface area. CLI commands have well-defined signatures and are straightforward to reference.

---

### Phase 8: Verification + Cleanup

**Goal**: Validate the complete API reference rollout.

#### Task 8.1: Full Audit Pass

Run `/docs-api-ref --all --audit` to:
- Verify every applicable doc has an `## API Reference` section
- Verify every row has valid provenance
- Flag all `PHPDoc`-sourced entries for review
- Check function count in reference table matches function count in source file

#### Task 8.2: Update `_index.md` Files

Update section index files (`docs/06-helpers/_index.md`, `docs/02-post-types/_index.md`, etc.) to note that docs in the section now include API reference sections.

#### Task 8.3: Update `About.md`

Add a note to the documentation hub about the API reference layer — what it is, how to use it, how provenance works.

#### Task 8.4: Changelog Entry

Log the full rollout as a major documentation enhancement in `docs/changelog.md`.

---

## 5. Dependencies and Ordering

```
Phase 1 (infrastructure) → Phase 2 (instructions) → Phase 3 (registration)
    ↓
Phase 4 (helpers) → Phase 5 (post-types, taxonomies, REST) → Phase 6 (HTMX, JS) → Phase 7 (integrations, CLI)
    ↓
Phase 8 (verification)
```

**External dependencies:**
- Phases 1–3 can be executed immediately (system infrastructure only)
- Phases 4–7 should execute AFTER the needs-revision-tracker corrections are complete, so API references are generated against accurate narrative docs
- Phase 5c (REST endpoints) specifically requires the 4 fabricated endpoint docs to be corrected first

---

## 6. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| PHPDoc coverage is inconsistent across the codebase | Many entries will be `Authored` rather than `PHPDoc`, reducing the value of the hybrid extraction approach | This is acceptable — `Authored` entries from source reading are still accurate. The provenance system just won't have many entries to audit via the PHPDoc verification path. |
| API reference sections increase doc file length significantly | Helper docs like `posts.md` or `authors.md` could grow by 50+ lines | The reference section is at the bottom — narrative flow is preserved. Developers looking up references will find them quickly. |
| Maintenance burden: function additions/removals require reference table updates | Risk of reference tables becoming stale | Mitigated by Phase 2 updates to `cc-auto-update.md` (detects source function changes) and `cc-verify.md` (Check 8 validates provenance). |
| Per-row provenance adds visual noise to tables | Tables are wider and busier than a version without the Src column | The `Src` column is narrow (max 10 chars) and provides critical audit metadata. The tradeoff is worth it. |

---

## 7. Success Criteria

After full implementation:

1. Every applicable doc file (per `docs-system-config.md` §4.1) has an `## API Reference` section
2. Every reference table row has a valid `Src` provenance value
3. Every reference table is complete (function count matches source file)
4. The `/docs-api-ref` command is registered and functional across the full command chain
5. Existing commands (`/docs-revise`, `/docs-add`, `/docs-auto-update`) maintain reference sections during normal operations
6. The `/docs-api-ref --audit` sub-command can find and verify all `PHPDoc`-sourced entries
7. `cc-verify.md` Check 8 validates provenance on every verification pass

---

## 8. Out of Scope

- **Component `$locals` contracts** — separate project (see standalone prompt generated during brainstorm)
- **Automated PHPDoc generation** — we document what exists; we don't add PHPDoc to source files
- **Interactive API documentation** (Swagger/OpenAPI-style) — this is static markdown integrated into the existing docs system
- **JavaScript JSDoc extraction tooling** — if JSDoc coverage is low, JS entries are hand-authored
- **Backfilling PHPDoc into source files** — provenance tracking handles this gap without requiring source changes
