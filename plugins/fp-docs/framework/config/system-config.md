# Documentation System Configuration

> Controls configurable behavior for the fp-docs plugin. Engines and modules read these values to determine thresholds, defaults, and feature flags.

---

## 1. Citations

| Variable | Value | Description |
|----------|-------|-------------|
| `citations.enabled` | `true` | Whether citations are mandatory for doc-modifying operations |
| `citations.full_body_max_lines` | `15` | Functions with body ≤ this line count receive Full tier citations |
| `citations.signature_max_lines` | `100` | Functions with body ≤ this line count receive Signature tier citations |
| `citations.include_line_numbers` | `true` | Whether to include `L{start}–{end}` line ranges in citation markers |
| `citations.excerpt_comment_threshold` | `5` | Maximum comment lines to include in code excerpts |

### Citation Scope

| Doc Element | Citation Required | Tier | Notes |
|-------------|-------------------|------|-------|
| Function documentation | Yes | Full or Signature (by line count) | Every documented function gets a citation |
| Hook registrations | Yes | Full | The `add_action`/`add_filter` call |
| Meta field tables | Yes | Reference | File + method + line range, no excerpt |
| Registration args (CPT/taxonomy) | Yes | Signature | The registration args array |
| Shortcode attributes | Yes | Full | The `shortcode_atts` defaults + extract |
| REST endpoint registration | Yes | Full | Route + method + callback registration |
| ACF field definitions | Yes | Reference | File + method + line range for field arrays |
| Component file lists | No | — | File existence is self-verifying |
| Prose descriptions / overviews | No | — | Not directly citable |
| Related Docs sections | No | — | Links, not code claims |
| Admin UI descriptions | Conditional | Reference | Only when describing specific code behavior |

---

## 2. General System

| Variable | Value | Description |
|----------|-------|-------------|
| `sanity_check.default_enabled` | `true` | Whether sanity-check runs by default |
| `sanity_check.multi_agent_threshold_docs` | `5` | Trigger multi-agent review when changes touch this many docs |
| `sanity_check.multi_agent_threshold_sections` | `3` | Trigger multi-agent review when changes span this many sections |
| `verify.total_checks` | `10` | Number of verification checks |

---

## 3. API Reference

| Variable | Value | Description |
|----------|-------|-------------|
| `api_ref.enabled` | `true` | Whether API Reference sections are required in applicable doc types |
| `api_ref.provenance_values` | `PHPDoc, Verified, Authored` | Valid values for the per-row `Src` column |
| `api_ref.default_provenance` | `Verified` | Default provenance when hand-writing entries from source |
| `api_ref.phpdoc_provenance` | `PHPDoc` | Provenance value when extracting from inline docblocks |

### API Reference Scope

| Doc Type | API Ref Required | Covers |
|----------|-----------------|--------|
| Helper (§3.3) | Yes | Every function in the namespace |
| Post Type (§3.1) | Yes | Public methods on the class |
| Taxonomy (§3.2) | Yes | Public methods, query modification helpers |
| REST Endpoint (§3.6) | Yes | Callback methods, response shape typing |
| JavaScript (§3.8) | Yes | Exported functions, key event handlers |
| Integration (§3.10) | Yes | Helper functions for the integration |
| Hook (§3.4) | No | Already tabular reference format |
| Shortcode (§3.5) | No | Already has attribute tables |
| ACF Field Group (§3.9) | No | Already has field tables |
| Component (§3.7) | No | Deferred — $locals contracts are separate |

### API Reference Table Columns

| Column | Header | Content Rule |
|--------|--------|-------------|
| 1 | `Function` | Function/method name in backticks with `()`. Namespaced: `function_name()`. Class methods: `ClassName::method()`. |
| 2 | `Params` | Typed parameter list. Use `—` for no params. For 4+ params, list primary params and note "See citation." |
| 3 | `Return` | Return type in backticks. Use `void` for no return. Unions: `string\|false`. |
| 4 | `Description` | One-liner. Present tense, starts with verb. Max ~80 chars. |
| 5 | `Src` | Provenance marker. Must be one of `api_ref.provenance_values`. |

---

## 4. Git Push

| Variable | Value | Description |
|----------|-------|-------------|
| `push.enabled` | `true` | Master switch — whether to push to remote after docs commits |
| `push.on_commit` | `true` | Push after every pipeline commit (Stage 8) |
| `push.on_merge` | `true` | Push after sync merge operations |

Push behavior: when enabled, push runs automatically after every successful docs commit. Use `--no-push` flag on any operation to suppress for a single invocation. Push failure is a warning, not an error.

---

## 5. Verbosity Engine

| Variable | Value | Description |
|----------|-------|-------------|
| `verbosity.enabled` | `true` | Master switch for VERBOSITY-SCOPE and VERBOSITY-ENFORCE phases |
| `verbosity.gap_tolerance` | `0` | Maximum allowed gap between source item count and documented item count. `0` = zero tolerance. |

### Chunk-and-Delegate Thresholds

| Variable | Value | Description |
|----------|-------|-------------|
| `chunk_delegation.max_docs_per_agent` | `8` | Maximum doc files a single agent should process in one pass |
| `chunk_delegation.max_functions_per_agent` | `50` | Maximum functions a single agent should document in one pass |
| `chunk_delegation.delegation_trigger_docs` | `8` | When total docs in scope exceed this, auto-delegate |
| `chunk_delegation.delegation_trigger_functions` | `50` | When total functions in scope exceed this, auto-delegate |

### Summarization Detection

Banned phrases (case-insensitive):

| Phrase | Context |
|--------|---------|
| `and more` | Always banned when replacing enumeration |
| `etc.` | Always banned |
| `et cetera` | Always banned |
| `similar to above` | Always banned |
| `various` | Banned when avoiding enumeration of knowable items |
| `among others` | Always banned when replacing enumeration |
| `and so on` | Always banned |
| `remaining` | Banned when avoiding enumeration |
| `and additional` | Banned when replacing enumeration |
| `the rest` | Banned when replacing enumeration |
| `likewise` | Banned when skipping repetitive documentation |
| `as above` | Banned when skipping repetitive documentation |
| `other similar` | Banned when avoiding enumeration |
| `numerous` | Banned when avoiding counting |
| `several` | Banned when avoiding enumeration of known items |
| `a number of` | Banned when avoiding enumeration of known items |

Banned patterns (regex):

| Pattern | Example Match |
|---------|---------------|
| `\d+\s+(more\|additional\|other\|remaining\|further\|extra)\b` | "5 more functions" |
| `see (above\|previous\|earlier) for (similar\|more\|details)` | "see above for similar" |
| `(handles?\|supports?\|includes?\|provides?)\s+(various\|multiple\|many\|several\|different)\b` | "handles various post types" |
| `\.{3}\|…` | Ellipsis used as list omission |
