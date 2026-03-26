---
name: mod-api-refs
description: "Shared module providing API Reference table format, scope definitions, provenance rules, and layer definitions. Preloaded by docs-modify and docs-api-refs engines. NOT user-invocable."
user-invocable: false
disable-model-invocation: true
---

# API Reference Module

Defines API Reference section format, scope, provenance requirements, and completeness rules.

## Section Structure

Every API Reference section follows this structure:

1. `## API Reference` heading
2. Ref Source legend blockquote (required)
3. Reference table with per-row provenance
4. Citation blocks for each entry

## Ref Source Legend

Every `## API Reference` section begins with:

> **Ref Source** · Per-row provenance in `Src` column · See system-config §4 for values

## Table Columns

| Column | Header | Content Rule |
|--------|--------|-------------|
| 1 | `Function` | Function/method name in backticks with `()`. Namespaced: `function_name()`. Class methods: `ClassName::method()`. |
| 2 | `Params` | Typed parameter list. Use `—` for no params. For 4+ params, list primary params and note "See citation." |
| 3 | `Return` | Return type in backticks. Use `void` for no return. Unions: `string\|false`. |
| 4 | `Description` | One-liner. Present tense, starts with verb. Max ~80 chars. |
| 5 | `Src` | Provenance marker. Must be one of: `PHPDoc`, `Verified`, `Authored`. |

## Provenance Rules

- Extracting from PHPDoc: use `PHPDoc`. Trusted for initial entry, flagged for future verification.
- Hand-writing from source reading: use `Verified`.
- When a `PHPDoc` entry is later verified against source: update to `Verified`.
- NEVER mark an entry `Verified` without reading the function body.

## Scope — Which Doc Types Get API Reference

| Doc Type | API Ref Required | Covers |
|----------|-----------------|--------|
| Helper | Yes | Every function in the namespace |
| Post Type | Yes | Public methods on the class |
| Taxonomy | Yes | Public methods, query modification helpers |
| REST Endpoint | Yes | Callback methods, response shape typing |
| JavaScript | Yes | Exported functions, key event handlers |
| Integration | Yes | Helper functions for the integration |
| Hook | No | Already tabular reference format |
| Shortcode | No | Already has attribute tables |
| ACF Field Group | No | Already has field tables |
| Component | No | Deferred — $locals contracts are separate |

## Completeness Rule

An API Reference section MUST document every public function/method in the source file. If a function exists in source but not in the reference table, the doc is incomplete.

## Placement

The `## API Reference` section is placed as the **last content section before `## Related Docs`**. If no `## Related Docs` exists, it is the last section.

## Table Ordering

Rows are ordered by source file line number (declaration order), not alphabetically. Private/internal helper functions within a class are excluded unless called by other documented code.
