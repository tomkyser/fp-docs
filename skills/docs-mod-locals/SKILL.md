---
name: docs-mod-locals
description: "Shared module providing $locals contract format, shape annotation syntax, cross-reference validation, and coverage requirements. Preloaded by docs-modify and docs-locals engines. NOT user-invocable."
user-invocable: false
disable-model-invocation: true
---

# Locals Contract Module

Defines the `$locals` contract documentation format, shapes, and validation rules for component documentation.

## @locals PHPDoc Format (Inline Annotation)

```php
<?php
/**
 * Component description
 *
 * @locals {
 *   post_ID:             int     — Required. WordPress post ID.
 *   link:                string  — Optional. URL override. [Default: '']
 *   title:               string  — Optional. Title override. [Default: '']
 * }
 */
```

Format rules:
- One key per line, indented 2 spaces inside the `@locals { }` block
- Colon separates key name from type
- Em dash (`—`) separates type from description
- "Required." or "Optional." is the first word of the description
- Default value stated in square brackets for optional keys: `[Default: value]`
- Nested keys use dot notation: `attachment_data.src: string`
- Array-indexed locals documented as: `[0]: array — Required. Primary article config.`

## @controller Format (HTMX Components)

HTMX components (`components/htmx/`) use a `$cmp` controller object. These use `@controller`, `@state`, and `@methods` PHPDoc blocks.

## Locals Contracts Section in Docs

Every component doc in `docs/05-components/` includes a `## Locals Contracts` section.

**Placement**: After main content sections, before `## Data Flow` (if present) or `## Related Docs`.

**Table columns**:

| Column | Content |
|--------|---------|
| Key | Exact `$locals` key name. Integer indices shown as `[0]`, `[1]` |
| Type | PHP type: `int`, `string`, `bool`, `array`, `string\|bool`, `string\|false` |
| Req? | `Yes` = unguarded access. `No` = guarded with fallback |
| Default | Fallback value from `??`, ternary, or conditional. `—` if required |
| Description | Brief description of what the key controls |

**Shape reference**: When a component's keys match a shared shape from `_locals-shapes.md`, add a `**Shape**:` line after the table.

## Data Flow Section

Each component doc includes a `## Data Flow` section showing caller→callee relationships.

**Placement**: After `## Locals Contracts`, before `## Related Docs`.

Format: `### Receives locals from` table + `### Passes locals to` table.

## Shared Shapes

Commonly-passed `$locals` structures defined in `docs/05-components/_locals-shapes.md`:

- **Article Config** — Post data + display flags + image overrides
- **Image Config** — Image rendering parameters
- **Zone Heading Config** — Zone header/subheader configuration
- **Ad Promo Config** — Promotional banner/ad parameters
- **Trending Config** — Trending posts widget parameters
- **Insider Recirc Config** — Insider recirculation widget parameters

## Integer-Indexed $locals

24 files use `$locals[0]`, `$locals[1]` instead of named keys. Document as positional parameters:

```
| [0] | array | Yes | — | Primary article config (see Article Config) |
| [1] | array | No  | — | Secondary article config |
```

## Required vs Optional Classification

| Access Pattern | Classification | Rationale |
|----------------|---------------|-----------|
| `$locals['key']` (bare access) | Required | No fallback — will produce notice if missing |
| `$locals['key'] ?? default` | Optional | Null coalescing provides fallback |
| `isset($locals['key'])` | Optional | Explicit existence check |
| `!empty($locals['key'])` | Optional | Emptiness guard with implicit fallback |
| `empty($locals['key']) ? fallback : $locals['key']` | Optional | Ternary fallback |

## Ground Truth Engine

The WP-CLI command `wp fp-locals` is the authoritative source. It uses `token_get_all()` for PHP tokenization, achieving 100% extraction accuracy. The CLI tool is ephemeral — installed during docs operations, removed after.

## Completeness Rule

A component doc's Locals Contracts section MUST document every component file in the corresponding `components/` directory.
