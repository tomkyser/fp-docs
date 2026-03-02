# API Reference Rules

Complete algorithm for generating and updating API Reference sections. Loaded on-demand by engines during pipeline execution.

## API Reference Table Generation

### Step 1: Identify Source File
Use the source-to-documentation mapping to find the corresponding source file(s). Check the doc's `## Source File` header.

### Step 2: Extract Functions

**PHP namespaced helpers**: Every function in the namespace. Skip `use` imports.

**PHP classes**: Every `public` method. `protected` methods only for abstract classes/traits where documented subclasses call them. Skip `private` methods. Include `__construct()` only if it registers hooks or has significant init logic.

**JavaScript modules**: Every exported function (named + default). Key event handlers. Skip internal helpers unless part of public API.

### Step 3: Extract Details Per Function

| Detail | Source |
|--------|--------|
| Name | Function/method name. Class methods: `ClassName::method()`. |
| Parameters | Typed param list from signature. Include defaults. |
| Return type | From type declaration, PHPDoc `@return`, or source reading. |
| Description | One-liner, present tense, starts with verb, max ~80 chars. |
| Provenance | `PHPDoc` if extracted from docblock. `Verified` if authored from source reading. |

### Step 4: Build Table

```markdown
## API Reference

> **Ref Source** · Per-row provenance in `Src` column

| Function | Params | Return | Description | Src |
|----------|--------|--------|-------------|-----|
```

Rows ordered by source file line number (declaration order).

### Step 5: Handle Complex Parameters
If a function has 4+ parameters: list first 2–3, add "See citation." in Params column.

## Scope — 7 Layers

| Layer | Doc Directory | Covers |
|-------|--------------|--------|
| Helpers | `docs/06-helpers/` | Every function in namespace |
| Post Types | `docs/02-post-types/` | Public methods on class |
| Taxonomies | `docs/03-taxonomies/` | Public methods, query helpers |
| REST Endpoints | `docs/09-api/rest-api/` | Callback methods, response types |
| JavaScript | `docs/17-frontend-assets/javascript/` | Exports, event handlers |
| Integrations | `docs/12-integrations/` | Helper functions |
| HTMX | `docs/23-htmx/` | Abstract + trait methods |

## Provenance Tagging

- `PHPDoc`: Extracted from inline `/** ... */` docblock. Trusted for initial entry.
- `Verified`: Hand-authored by reading function body. Higher confidence.
- `Authored`: Manually written without direct source verification. Use sparingly.

Upgrade path: `PHPDoc` → `Verified` (after reading function body to confirm).

## Completeness Rule

Every public function/method in the source file MUST have a row in the API Reference table. Missing functions = incomplete doc.

## Update Logic

When updating an existing API Reference section:
1. Compare existing rows against current source functions
2. Add rows for new functions (at correct line-order position)
3. Remove rows for deleted functions
4. Update rows where signatures changed
5. Preserve existing `Src` values for unchanged rows
