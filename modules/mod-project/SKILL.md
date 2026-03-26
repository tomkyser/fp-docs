---
name: mod-project
description: "Shared module providing FP project-specific configuration: source-to-doc mapping, key paths, environment settings. Preloaded by all engines. NOT user-invocable."
user-invocable: false
disable-model-invocation: true
---

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

| Source Directory | Documentation Target |
|-----------------|---------------------|
| `functions.php` | `docs/01-architecture/bootstrap-sequence.md` |
| `inc/post-types/` | `docs/02-post-types/` |
| `inc/taxonomies/` | `docs/03-taxonomies/` |
| `inc/custom-fields/` | `docs/04-custom-fields/` |
| `inc/custom-field-types/` | `docs/04-custom-fields/custom-field-types.md` |
| `inc/custom-location-rules/` | `docs/04-custom-fields/custom-location-rules.md` |
| `components/` | `docs/05-components/` |
| `helpers/` | `docs/06-helpers/` |
| `inc/shortcodes/` | `docs/07-shortcodes/` |
| `inc/hooks/` | `docs/08-hooks/` |
| `inc/rest-api/` | `docs/09-api/rest-api/` |
| `inc/endpoints/` | `docs/09-api/custom-endpoints/` |
| `layouts/` | `docs/10-layouts-and-templates/` |
| `features/` | `docs/11-features/catalog.md` |
| `inc/cli/` | `docs/15-cli/` |
| `inc/admin-settings/` | `docs/16-admin/` |
| `inc/roles/` | `docs/16-admin/user-roles.md` |
| `assets/src/scripts/` | `docs/17-frontend-assets/javascript/` |
| `assets/src/styles/` | `docs/17-frontend-assets/styles/` |
| `build/` | `docs/00-getting-started/build-system.md` |
| `crons/` | `docs/14-crons-feeds-rewrites/crons.md` |
| `feeds/` | `docs/14-crons-feeds-rewrites/feeds.md` |
| `rewrites/` | `docs/14-crons-feeds-rewrites/rewrites.md` |
| `redirects/` | `docs/14-crons-feeds-rewrites/redirects.md` |
| `mobile/` | `docs/18-mobile/` |
| `sponsored/` | `docs/13-sponsored-content/` |
| `dynamic-pdfs/` | `docs/19-pdf-generation/` |
| `amp/` | `docs/20-amp/amp-support.md` |
| `inc/exports/` | `docs/21-exports/` |
| `inc/notifications/` | `docs/22-notifications/` |
| `inc/abstract/htmx/`, `inc/traits/htmx/` | `docs/23-htmx/` |
| `lib/` | `docs/appendices/E-third-party-dependencies.md` |

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
