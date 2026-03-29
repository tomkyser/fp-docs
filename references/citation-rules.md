# Citations Module

Defines the citation format, tier system, placement rules, freshness model, and provenance requirements for code citations in documentation.

## Citation Block Format

Every citation is a markdown blockquote with a standardized structure.

**Full citation** (functions ≤ 15 lines):

> **Citation** · `helpers/environment.php` · `is_wpvip()` · L12–18
> ```php
> function is_wpvip(): bool {
>     return defined( 'VIP_GO_APP_ENVIRONMENT' )
>         && in_array( VIP_GO_APP_ENVIRONMENT, array_merge( get_staging_env(), get_prod_env() ), true );
> }
> ```

**Signature citation** (functions 16–100 lines):

> **Citation** · `helpers/posts.php` · `get_featured_image_data()` · L89–142
> ```php
> function get_featured_image_data( int $post_id, string $size = 'large' ): array {
>     // ... 53 lines: image source resolution, fallbacks, srcset generation
> }
> ```

**Reference citation** (tables, grouped definitions, very long methods):

> **Citation** · `inc/post-types/class-post-type-post.php` · `add_meta_boxes()` · L45–120

## Citation Marker Structure

```
> **Citation** · `{file_path}` · `{symbol_name}` · L{start}–{end}
```

- `{file_path}`: Relative to theme root, in backticks
- `{symbol_name}`: Function, method, hook, class, or logical block name. Use `ClassName::method()` for class methods, bare `function_name()` for namespaced functions
- `L{start}–{end}`: Line range in source file. Use `L{n}` for single-line. Omit for reference citations covering entire method.

## Citation Tiers

| Tier | When Used | Content |
|------|-----------|---------|
| **Full** | Function body ≤ 15 lines, hook registrations, shortcode attr defaults, REST route registrations | Complete code excerpt |
| **Signature** | Function body 16–100 lines | Function signature + summary comment of body |
| **Reference** | Tables derived from long methods, grouped field definitions, functions > 100 lines | File + symbol + line range only, no excerpt |

## Citation Placement Rules

1. Citations appear **immediately after** the documentation element they support.
2. One citation per documentable claim — each function, hook, shortcode, REST route gets its own.
3. Grouped citations: when a table documents multiple fields from a single method, use a single reference citation covering the entire method range.
4. No citation needed for: overview paragraphs, Related Docs sections, component file existence lists, prose descriptions.

## Citation Excerpt Rules

1. Preserve exact code — excerpts are copied verbatim from source. No reformatting.
2. Strip excessive comments: if > 5 comment lines, keep first line and note `// ... N comment lines`.
3. Signature citations: show function signature, opening brace, `// ... N lines: <summary>`, closing brace.
4. Use `php` language identifier for PHP docs, `js` for JavaScript docs.
5. Preserve original indentation from source file.

## Citation Freshness Model

| State | Symbol Exists? | Lines Match? | Excerpt Matches? | Severity |
|-------|---------------|-------------|-----------------|----------|
| **Fresh** | Yes | Yes | Yes | None |
| **Stale** | Yes | No | Yes (at different lines) | Low — update line numbers |
| **Drifted** | Yes | No | No (code changed) | Medium — update excerpt + lines |
| **Broken** | Yes (renamed) or No | — | — | High — symbol was removed/renamed |
| **Missing** | — | — | — | High — doc element has no citation |

## Citation Scope

| Doc Element | Citation Required | Tier |
|-------------|-------------------|------|
| Function documentation | Yes | Full or Signature (by line count) |
| Hook registrations | Yes | Full |
| Meta field tables | Yes | Reference |
| Registration args (CPT/taxonomy) | Yes | Signature |
| Shortcode attributes | Yes | Full |
| REST endpoint registration | Yes | Full |
| ACF field definitions | Yes | Reference |
| Component file lists | No | — |
| Prose descriptions / overviews | No | — |
| Related Docs sections | No | — |
