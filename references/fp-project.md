# Project Configuration Module

FP-specific configuration preloaded by every engine. Contains source-to-documentation mapping, key paths, and environment settings.

## Project Identity

- **Project**: Foreign Policy magazine WordPress site
- **Theme root**: `themes/foreign-policy-2017`
- **Docs root**: `themes/foreign-policy-2017/docs` (relative to wp-content)
- **WP-CLI prefix**: `ddev wp`
- **Local URL**: `https://foreignpolicy.local/`
- **SSL**: self-signed (use `curl -sk`)
- **PHP namespace**: `ForeignPolicy\Helpers\{Feature}\function_name()`

## Source-to-Documentation Mapping

Source-to-doc mappings are managed by `source-map.json` at the plugin root, accessed through `lib/source-map.cjs`.

**Lookup commands** (run via Bash tool):
- Single lookup: `node {plugin-root}/fp-tools.cjs source-map lookup <source-path>`
- Reverse (doc to source): `node {plugin-root}/fp-tools.cjs source-map reverse-lookup <doc-path>`
- All unmapped files: `node {plugin-root}/fp-tools.cjs source-map unmapped`
- Full mapping dump: `node {plugin-root}/fp-tools.cjs source-map dump`

**Example mappings** (representative sample -- full mapping in source-map.json):

| Source | Documentation |
|--------|--------------|
| `inc/post-types/` | `docs/02-post-types/` |
| `helpers/` | `docs/06-helpers/` |
| `components/` | `docs/05-components/` |
| `inc/hooks/` | `docs/08-hooks/` |
| `inc/rest-api/` | `docs/09-api/rest-api/` |

> **ONE SOURCE OF TRUTH:** `source-map.json` is the sole authoritative source-to-doc mapping. Do NOT maintain competing mapping tables in any other module, instruction file, or config file.

## Appendix Cross-References

| When you add/change... | Also update... |
|------------------------|---------------|
| A hook (`add_action`/`add_filter`) | `docs/appendices/A-complete-hook-registry.md` |
| A shortcode | `docs/appendices/B-shortcode-quick-reference.md` |
| A REST route | `docs/appendices/C-rest-route-reference.md` |
| A constant (`define()`/`const`) | `docs/appendices/D-constants-reference.md` |
| A dependency (Composer/npm/external) | `docs/appendices/E-third-party-dependencies.md` |
| An ACF field group | `docs/appendices/F-acf-field-group-reference.md` |
| A feature template | `docs/appendices/G-feature-template-catalog.md` |

## Key Paths

| Resource | Path (relative to theme root) |
|----------|------------------------------|
| Documentation root | `docs/` |
| Documentation hub | `docs/About.md` |
| Changelog | `docs/changelog.md` |
| Needs revision tracker | `docs/needs-revision-tracker.md` |
| Codebase index | `docs/claude-code-docs-system/PROJECT-INDEX.md` |
| Shared locals shapes | `docs/05-components/_locals-shapes.md` |
| Flagged concerns registry | `docs/FLAGGED CONCERNS/` |

## Feature Enables

- Citations: enabled
- API References: enabled
- Locals contracts: enabled
- Verbosity enforcement: enabled
- Sanity-check: enabled
