# $locals Contract Grammar

Complete grammar, shape syntax, and validation rules for `$locals` contract documentation. Loaded on-demand by the docs-locals engine.

## @locals Block Grammar

```
@locals {
  {key_name}:{spaces}{type}{spaces}—{spaces}{requirement}.{spaces}{description}.{spaces}[Default: {value}]
}
```

### Tokens

| Token | Rule |
|-------|------|
| `key_name` | Exact PHP array key. Snake_case. Integer indices as `[0]`, `[1]`. |
| `type` | PHP type: `int`, `string`, `bool`, `array`, `float`, `string\|bool`, `string\|false`, `array\|null` |
| `requirement` | `Required` or `Optional` |
| `description` | Brief description ending with period |
| `[Default: value]` | Only for Optional keys. The fallback value from `??` or ternary. |

### Nested Keys

Use dot notation: `attachment_data.src: string — Required. Image source URL.`

### Integer-Indexed Locals

```
[0]: array — Required. Primary article config.
[1]: array — Optional. Secondary article config. [Default: null]
```

## @controller Block Grammar (HTMX)

```
@controller {ClassName}
@state {
  {key}: {type} — {description}
}
@methods {
  {method_name}(): {return_type}
}
```

## Shape Definition Grammar

Shapes are defined in `docs/05-components/_locals-shapes.md`:

```markdown
## {Shape Name}

{Description of the shape and its usage context.}

| Key | Type | Req? | Default | Description |
|-----|------|------|---------|-------------|
| {key} | {type} | {Yes/No} | {default} | {description} |
```

## Shape Reference Syntax

In component doc contracts:

```markdown
**Shape**: Subset of [{Shape Name}](_locals-shapes.md#{shape-anchor})
```

Or for exact matches:

```markdown
**Shape**: [{Shape Name}](_locals-shapes.md#{shape-anchor})
```

## Validation Rules

### Requirement Classification

| Access Pattern in Component PHP | Classification |
|--------------------------------|---------------|
| `$locals['key']` (bare) | Required |
| `$locals['key'] ?? default` | Optional |
| `isset($locals['key'])` | Optional |
| `!empty($locals['key'])` | Optional |
| `empty($locals['key']) ? fallback : $locals['key']` | Optional |

### Completeness Validation

Every `.php` file in a component directory MUST have an entry in the doc's Locals Contracts section. Files with no `$locals` access get a "No `$locals` keys" entry.

### Cross-Reference Validation

- Every shape reference in a component doc must resolve to a shape in `_locals-shapes.md`
- Every key in a contract table must exist in the component's PHP file
- Required/Optional classification must match the access pattern in code

## Ground Truth

The `wp fp-locals` WP-CLI command is the authoritative source. Uses `token_get_all()` for tokenization. Ephemeral installation during docs operations.

### Coverage Subcommand

`wp fp-locals coverage` reports:
- Total component files
- Files with contracts documented
- Files missing contracts
- Coverage percentage
