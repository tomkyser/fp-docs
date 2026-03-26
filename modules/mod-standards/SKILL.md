---
name: mod-standards
description: "Shared module providing documentation formatting, naming, structural, and depth standards. Preloaded by all engines. NOT user-invocable."
user-invocable: false
disable-model-invocation: true
---

# Documentation Standards Module

This module is the single source of truth for all formatting, naming, structural, and depth rules governing the `docs/` folder. Every engine preloads this module — NEVER duplicate these rules elsewhere.

## 1. File Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Section index | `_index.md` (underscore prefix) | `docs/02-post-types/_index.md` |
| Individual doc | Kebab-case matching source file or system name | `post.md`, `build-system.md` |
| Appendix | Letter prefix `A-` through `G-` (next available) | `A-complete-hook-registry.md` |
| Changelog entries | Date-based under month headings | `### 2026-02-26 — Short Title` |

## 2. Directory Structure Rules

- Every `docs/NN-section/` directory MUST have a `_index.md`.
- Every doc file in any section MUST be linked from its parent `_index.md`.
- Every section MUST be linked from `About.md`.
- New appendix entries use the next available letter prefix (currently through `G-`).

## 3. Document Format Templates

### 3.1 Post Type Doc

```
# [Post Type Name]
## Overview — ## Source File — ## Registration — ## Fields / Meta Keys — ## Hooks — ## Templates — ## Admin UI — ## Related Docs
```

### 3.2 Taxonomy Doc

```
# [Taxonomy Name]
## Overview — ## Source File — ## Registration Args — ## Term Meta — ## Admin UI — ## Query Modifications — ## Related Docs
```

### 3.3 Helper Doc

```
# [Helper Name]
## Overview — ## Source File — ## Namespace — ## Functions (table) — ## Related Docs
```

### 3.4 Hook Doc

```
# [Hook Group Name]
## Overview — ## Hooks (table: Hook Name | Type | Priority | Callback | Behavior) — ## Dependencies — ## Related Docs
```

### 3.5 Shortcode Doc

```
# [Shortcode Category]
## Overview — ### [shortcode_tag] — Attributes table — Output HTML — Example — ## Related Docs
```

### 3.6 REST Endpoint Doc

```
# [Endpoint Name]
## Overview — ## Route — ## Method — ## Parameters — ## Response Shape — ## Authentication — ## Related Docs
```

### 3.7 Component Doc

```
# [Component Name]
## Overview — ## Files — ## Variables / Context — ## Callers — ## Related Docs
```

### 3.8 JavaScript Doc

```
# [Module Name]
## Overview — ## Source File — ## Exports — ## Event Listeners — ## DOM Dependencies — ## Imports — ## Related Docs
```

### 3.9 ACF Field Group Doc

```
# [Field Group Name]
## Overview — ## Sync Method — ## Fields — ## Location Rules — ## Related Docs
```

### 3.10 Integration Doc

```
# [Service Name] Integration
## Overview — ## Service — ## API — ## Credentials — ## Data Flow — ## Error Handling — ## Related Docs
```

> **Citation placement**: Citations appear immediately after the documentation element they support. See the citations module for format rules.

## 4. Content Rules

- All file paths are relative to theme root (`themes/foreign-policy-2017/`).
- Code references use backticks: `function_name()`, `$variable`, `class-name.php`.
- `[LEGACY]` tag marks deprecated systems — add to document title.
- `[NEEDS INVESTIGATION]` for unclear behavior — NEVER guess or fabricate.
- Links between docs MUST be relative markdown links.
- Present tense: "The function returns..." not "will return".
- Second person for instructions: "You can configure..." not "One configures...".
- Paragraphs 3–5 sentences maximum.
- Tables for reference data, prose for explanations.
- Every function/method: signature, parameters, return type.
- Every hook: name, priority, callback, behavior.

## 5. Depth Requirements

| System | What to Document |
|--------|-----------------|
| Post types | Every field, meta key, hook, template, taxonomy, admin customization |
| Taxonomies | Registration args, admin UI, term meta, query modifications |
| Helpers | Every function: full signature, parameters, return type, callers, side effects |
| Hooks | Hook name, priority, callback function, behavior, dependencies |
| Shortcodes | Tag name, all attributes with types/defaults, output HTML, example usage |
| REST endpoints | Route pattern, HTTP method, parameters, response shape, authentication |
| Components | File path, expected variables/context, output structure, who calls it |
| JavaScript | Every export, event listener, DOM dependency, import (same depth as PHP) |
| ACF field groups | Sync method (JSON/PHP/both), every field with type/key, location rules |
| Integrations | Service, API, credentials, data flow, error handling |

## 6. Cross-Reference Requirements

When creating or modifying docs that contain any of the following, the corresponding appendix MUST be checked and updated:

| When you add/change... | Also update... |
|------------------------|---------------|
| A hook (`add_action`/`add_filter`) | `appendices/A-complete-hook-registry.md` |
| A shortcode | `appendices/B-shortcode-quick-reference.md` |
| A REST route | `appendices/C-rest-route-reference.md` |
| A constant (`define()`/`const`) | `appendices/D-constants-reference.md` |
| A dependency (Composer/npm/external) | `appendices/E-third-party-dependencies.md` |
| An ACF field group | `appendices/F-acf-field-group-reference.md` |
| A feature template | `appendices/G-feature-template-catalog.md` |

## 7. Integrity Rules

1. NEVER guess — read actual source code before writing or updating any documentation.
2. NEVER skip verification — verify runs after every operation that changes docs.
3. ALWAYS update the changelog after every operation that changes docs.
4. ALWAYS read a sibling doc for format before creating a new doc in any section.
5. NEVER duplicate mapping tables or rules — reference the project module.
6. When in doubt, use `[NEEDS INVESTIGATION]` — never fabricate content.
7. File paths are always relative to the theme root.
8. Preserve accurate content — when revising a doc, keep everything that is still correct.
9. ALWAYS include citations — every documentable code claim requires a citation block.
10. NEVER fabricate citations — citation excerpts are copied verbatim from source code.
11. API Reference provenance is mandatory — every row MUST include a `Src` value.
12. Flag genuine code defects in `docs/FLAGGED CONCERNS/`.
13. NEVER summarize enumerables — list every item explicitly.
14. NEVER truncate for context savings — delegate or checkpoint instead.
15. Scope manifests are contracts — binding targets that block progression if not met.
