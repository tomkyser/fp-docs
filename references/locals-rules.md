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

## @controller Format (HTMX Components)

HTMX components (`components/htmx/`) use a `$cmp` controller object with these PHPDoc blocks:

- `@controller {ClassName}` — controller class identifier
- `@state { key: type — description }` — component state definition
- `@methods { method_name(): return_type }` — available methods

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

## Shape Definition Grammar

Shapes defined in `docs/05-components/_locals-shapes.md` use the standard table format from the Locals Contracts section.

### Shape Reference Syntax

In component docs, reference shared shapes with:
- **Exact match**: `**Shape**: [{Shape Name}](_locals-shapes.md#{shape-anchor})`
- **Subset**: `**Shape**: Subset of [{Shape Name}](_locals-shapes.md#{shape-anchor})`

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

The WP-CLI command `wp fp-locals` is the authoritative source. It uses `token_get_all()` for PHP tokenization, achieving 100% extraction accuracy for all 447 component files. The CLI tool is ephemeral — installed during docs operations, removed after.

### CLI Tool Location and Lifecycle

- **Source file**: `{plugin-root}/tools/class-locals-cli.php`
- **Setup command**: `node {plugin-root}/fp-tools.cjs locals-cli setup` — copies CLI into theme, registers in `functions.php`, verifies
- **Teardown command**: `node {plugin-root}/fp-tools.cjs locals-cli teardown` — unregisters, deletes, verifies
- **Safety net**: SubagentStop hook (CJS `handleLocalsCLICleanup` in lib/hooks.cjs) auto-cleans orphaned artifacts
- **Installation target**: `{theme-root}/inc/cli/class-locals-cli.php`
- **Registration**: `require_once` inside the `if ( defined( 'WP_CLI' ) && WP_CLI )` block in `functions.php`
- **Invocation prefix**: `ddev wp fp-locals` (per project-config WP-CLI prefix)

### CLI Subcommands

| Subcommand | Purpose | Output Formats |
|---|---|---|
| `extract <path> [--recursive] [--format=json\|table\|markdown]` | Extract $locals keys with types, required/optional, defaults | json, table, markdown |
| `validate <path> [--recursive]` | Compare @locals PHPDoc vs actual code usage | Text warnings |
| `cross-ref <path> [--recursive]` | Find all callers and compare passed vs consumed keys | Text report |
| `coverage [--format=json\|table]` | Report @locals PHPDoc coverage across all components | json, table |

### Extraction Capabilities

The CLI tokenizer provides capabilities beyond manual reading:
- **Type inference**: Detects wrapping functions (esc_url→string, intval→int, absint→int, boolval→bool), cast operators ((int), (string), (bool), (array)), and boolean comparisons
- **Default value capture**: Extracts right-hand side of `??` coalesce operators
- **Guard detection**: Scans backward for `isset()`, `empty()`, `array_key_exists()` guards
- **De-duplication**: Tracks unique keys across multiple access points, upgrades Optional→Required when any unguarded access exists
- **Caller detection**: Tokenizes entire theme to find `get_template_part()` calls, handles FP namespaced variants and template slug splitting

### Fallback

If the CLI is unavailable (ddev not running, environment issues), instruction files fall back to manual extraction using Read/Grep tools. This fallback is less accurate — it cannot infer types from wrapping functions, detect guards reliably, or tokenize caller argument lists. Always prefer CLI when available.

## Completeness Rule

A component doc's Locals Contracts section MUST document every component file in the corresponding `components/` directory.
