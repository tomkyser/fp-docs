# Documentation Progress Tracker

> **Started**: 2026-02-25
> **Game Plan**: `.claude/docs-project/game-plan.md`
> **Output**: `themes/foreign-policy-2017/docs/`

---

## Phase 0: Foundation — COMPLETE

| # | Document | Status | Notes |
|---|---|---|---|
| 0.1 | `docs/README.md` | Done | Documentation hub with full TOC |
| 0.2 | `00-getting-started/overview.md` | Done | Theme architecture overview, 9 subsystems |
| 0.3 | `00-getting-started/local-development.md` | Done | Prerequisites, setup, secrets, environment |
| 0.4 | `00-getting-started/build-system.md` | Done | Webpack, entries, Tailwind, PostCSS, all deps |
| 0.5 | `01-architecture/bootstrap-sequence.md` | Done | 45 sections, every include from functions.php |
| 0.6 | `01-architecture/directory-map.md` | Done | All dirs, 50+ lookup entries, 1,139 lines |

## Phase 1: Core Systems — COMPLETE

| # | Document | Status | Notes |
|---|---|---|---|
| 1.1 | `02-post-types/_index.md` | Done | 18 CPTs + 2 traits + 2 legacy |
| 1.1a | `02-post-types/post.md` | Done | 25+ meta keys, NOA integration, Apple News |
| 1.1b | `02-post-types/page.md` | Done | ~3,800 line file, zone-based content system |
| 1.1c | `02-post-types/channel.md` | Done | her-power special handling documented |
| 1.1d | `02-post-types/sponsored.md` | Done | 6 template variants, D3/TopoJSON deps |
| 1.1e | `02-post-types/newsletter.md` | Done | 20 newsletters, 7 category configs |
| 1.1f | `02-post-types/newsletter-ad.md` | Done | Simplest CPT in theme |
| 1.1g | `02-post-types/project.md` | Done | 7 layout templates, 15 zones |
| 1.1h | `02-post-types/podcast.md` | Done | Series rewrite, seasons 1-8 |
| 1.1i | `02-post-types/events.md` | Done | [LEGACY] ~1050 lines FM config |
| 1.1j | `02-post-types/fp-event.md` | Done | Both traits, speaker dropdown |
| 1.1k | `02-post-types/fp-live-event.md` | Done | HasTags, status dashicons |
| 1.1l | `02-post-types/slideshow.md` | Done | Gallery structure, FBIA feed |
| 1.1m | `02-post-types/quiz.md` | Done | Scoring tiers, embed shortcode |
| 1.1n | `02-post-types/graphics.md` | Done | 6 graphic types, parallax support |
| 1.1o | `02-post-types/takeover.md` | Done | 5 templates, targeting rules |
| 1.1p | `02-post-types/attachment.md` | Done | Attribution, image format options |
| 1.1q | `02-post-types/guest-author-profile.md` | Done | 13 FM meta boxes, Co-Authors Plus |
| 1.1r | `02-post-types/legacy-ip-access-client.md` | Done | [LEGACY] 11 namespace constants |
| 1.1s | `02-post-types/legacy-link-access-client.md` | Done | [LEGACY] Token generation |
| 1.1t | `02-post-types/traits.md` | Done | HasTags + HasFeaturedMedia |
| 1.2 | `03-taxonomies/_index.md` | Done | 15 taxonomy slugs across 11 files |
| 1.2a | `03-taxonomies/post-category.md` | Done | Custom meta box, JSON feed |
| 1.2b | `03-taxonomies/hierarchical-tags.md` | Done | post_tag re-registration |
| 1.2c | `03-taxonomies/magazine-issue.md` | Done | 5-section featured articles |
| 1.2d | `03-taxonomies/magazine-category.md` | Done | Flat taxonomy |
| 1.2e | `03-taxonomies/tags-metadata.md` | Done | Tag attributes, SEO, inset box |
| 1.2f | `03-taxonomies/category-tag.md` | Done | Category hide, newsletter display |
| 1.2g | `03-taxonomies/slideshow-category.md` | Done | |
| 1.2h | `03-taxonomies/newsletter-category.md` | Done | Private, class constants |
| 1.2i | `03-taxonomies/newsletter-category-metadata.md` | Done | 4 context descriptions |
| 1.2j | `03-taxonomies/podcast-series.md` | Done | 30+ term meta fields |
| 1.2k | `03-taxonomies/rss-partners.md` | Done | 5 private taxonomies, Getty detect |
| 1.3 | `04-custom-fields/_index.md` | Done | JSON/PHP sync overview, all groups |
| 1.3a | `04-custom-fields/acf-settings.md` | Done | 4 path constants, save/load filters |
| 1.3b | `04-custom-fields/field-groups/post-fields.md` | Done | Email alerts + Sailthru content |
| 1.3c | `04-custom-fields/field-groups/events.md` | Done | 86-field group, landing + details |
| 1.3d | `04-custom-fields/field-groups/fp-live-events.md` | Done | Event + settings options page |
| 1.3e | `04-custom-fields/field-groups/newsletters.md` | Done | Sailthru blast + truncate |
| 1.3f | `04-custom-fields/field-groups/newsletter-ads.md` | Done | Ad settings + featured image |
| 1.3g | `04-custom-fields/field-groups/subscribe-pages.md` | Done | 5 field groups, flex content |
| 1.3h | `04-custom-fields/field-groups/subscriber-onboarding.md` | Done | 5 screens, new/legacy variants |
| 1.3i | `04-custom-fields/field-groups/post-recirculation.md` | Done | Non-sub + sub parallel groups |
| 1.3j | `04-custom-fields/field-groups/post-email-alerts.md` | Done | Blast ID display filter |
| 1.3k | `04-custom-fields/options-pages/secrets.md` | Done | Restricted access noted |
| 1.3l | `04-custom-fields/options-pages/myfp.md` | Done | 5 subject tabs, taxonomy filters |
| 1.3m | `04-custom-fields/options-pages/rest-authentication.md` | Done | API key management |
| 1.3n | `04-custom-fields/custom-field-types.md` | Done | fp-wp-search field type |
| 1.3o | `04-custom-fields/custom-location-rules.md` | Done | Post meta + project template |

## Phase 2: Template Layer — COMPLETE

| # | Document | Status | Notes |
|---|---|---|---|
| 2.1 | `01-architecture/template-hierarchy.md` | Done | 10 template_include filters, feature handlers |
| 2.2 | `01-architecture/data-flow.md` | Done | 6 data sources, 4 passing mechanisms |
| 2.3a | `10-layouts-and-templates/_index.md` | Done | Template system overview |
| 2.3b | `10-layouts-and-templates/root-templates.md` | Done | All 11 root templates |
| 2.3c | `10-layouts-and-templates/page-templates.md` | Done | All 17 page templates |
| 2.3d | `10-layouts-and-templates/layouts-singles.md` | Done | 18 + 2 legacy single layouts |
| 2.3e | `10-layouts-and-templates/layouts-archives.md` | Done | 8 archive layouts |
| 2.3f | `10-layouts-and-templates/layouts-pages.md` | Done | 31 page layouts |
| 2.3g | `10-layouts-and-templates/layouts-taxonomies.md` | Done | 5 taxonomy layouts |
| 2.3h | `10-layouts-and-templates/template-parts.md` | Done | 11 template parts |
| 2.3i | `10-layouts-and-templates/settings-pages.md` | Done | 10 settings files |
| 2.4a | `05-components/_index.md` | Done | 32 categories, loading patterns |
| 2.4b | `05-components/header.md` | Done | 6 files |
| 2.4c | `05-components/footer.md` | Done | 4 files, ACF-driven |
| 2.4d | `05-components/navigation.md` | Done | 42 files across 7 subdirs |
| 2.4e | `05-components/post.md` | Done | 110 files, largest category |
| 2.4f | `05-components/article.md` | Done | 8 files, paywall gating |
| 2.4g | `05-components/home.md` | Done | 36 files, content zone pipeline |
| 2.4h | `05-components/home-2025.md` | Done | Empty placeholder |
| 2.4i | `05-components/shared.md` | Done | 34 files |
| 2.4j | `05-components/events.md` | Done | 38 files, event lifecycle |
| 2.4k | `05-components/fp-live.md` | Done | 26 files, access gating |
| 2.4l | `05-components/podcast.md` | Done | 23 files, Swiper+Plyr |
| 2.4m | `05-components/projects.md` | Done | 18 files, HTMX live updates |
| 2.4n | `05-components/staff.md` | Done | 13 files |
| 2.4o | `05-components/htmx.md` | Done | 13 files, MVC pattern |
| 2.4p | `05-components/content-zones.md` | Done | 13 files, flexible content |
| 2.4q | `05-components/newsletters.md` | Done | 9 files |
| 2.4r | `05-components/ads.md` | Done | 7 files |
| 2.4s | `05-components/takeovers.md` | Done | 7 files, dispatcher pattern |
| 2.4t | `05-components/channels.md` | Done | 5 files, A-D blocks |
| 2.4u | `05-components/slideshow.md` | Done | 5 files |
| 2.4v | `05-components/power-maps.md` | Done | 5 files, Piano gating |
| 2.4w | `05-components/logos.md` | Done | 5 files, inline SVG |
| 2.4x | `05-components/inset-box.md` | Done | 5 files, router pattern |
| 2.4y | `05-components/myfp.md` | Done | 4 files |
| 2.4z | `05-components/election.md` | Done | 3 files |
| 2.4aa | `05-components/author.md` | Done | 2 files, Co-Authors Plus |
| 2.4ab | `05-components/native-prompt.md` | Done | 2 files |
| 2.4ac | `05-components/misc.md` | Done | audio, loading, scripts, etc. |
| 2.5a | `11-features/_index.md` | Done | Feature system overview |
| 2.5b | `11-features/feature-handler.md` | Done | 12 methods |
| 2.5c | `11-features/legacy-feature-handler.md` | Done | [LEGACY] 11 gallery types |
| 2.5d | `11-features/catalog.md` | Done | 219 templates + 14 subdirs |

## Phase 3: Helpers & Hooks — COMPLETE

- `06-helpers/` — 42 docs: _index + all 41 helper files (tags, templates, url, strings, arrays, allowed-tags, web-fonts, storage, response, queried-object, cron-jobs, secrets, slack, myfp, live-components, live-emails, jwk, pdf + 22 from earlier batches)
- `08-hooks/` — 18 docs: _index + 8 action classes + 9 filter classes
- `07-shortcodes/` — 10 docs: _index + 9 category docs (63 shortcode tags documented)

## Phase 4: APIs & Endpoints — COMPLETE

- `09-api/` — 29 docs: _index + 14 REST API + 13 custom endpoints + ajax-handlers
- `18-mobile/` — 4 docs: _index + api-router (22 routes) + partials + templates

## Phase 5: Integrations — COMPLETE

- `12-integrations/` — 13 docs: _index + 12 integration docs (Piano, Sailthru, Coral, Chartbeat, Meilisearch, Apple News, GA, Cloudflare, Slack, NOA, RudderStack, Braintree)
- `21-exports/` — 5 docs: _index + sailthru-content + sailthru-briefs + sailthru-email-alerts + meilisearch-index
- `22-notifications/` — 3 docs: push + live + slack

## Phase 6: Supporting Systems — COMPLETE

- `13-sponsored-content/` — 4 docs
- `14-crons-feeds-rewrites/` — 4 docs (9 crons, 9 feeds, 12 rewrites, 3 redirects)
- `15-cli/` — 8 docs: _index + 7 CLI commands
- `16-admin/` — 7 docs: _index + settings + notices + magazine + tinymce + roles + native-ads
- `19-pdf-generation/` — 5 docs
- `20-amp/` — 1 doc
- `23-htmx/` — 4 docs

## Phase 7: Frontend Assets — COMPLETE

- `17-frontend-assets/_index.md` — Asset system overview
- `17-frontend-assets/asset-enqueuing.md` — Every wp_enqueue call, conditional loading, CDN scripts
- `17-frontend-assets/javascript/_index.md` — JS architecture (~110 modules)
- `17-frontend-assets/javascript/global.md` — Global init
- `17-frontend-assets/javascript/` — 27 component JS docs (header, navigation, home, post, annotations, fp-events, fp-live, fp-quiz, myfp, newsletters, onboarding, podcasts, projects, saved-articles, shared, sponsored, staff-page, sticky-footer, takeovers, page, search, mobile-app, rudderstack, users, utilities, vendor, features)
- `17-frontend-assets/styles/_index.md` — CSS architecture (PostCSS + Tailwind)
- `17-frontend-assets/styles/component-styles.md` — 45+ style directories
- `17-frontend-assets/images-and-fonts.md` — 768 images, 55 fonts, 6 typefaces
- `00-getting-started/deployment.md` — VIP Go CI/CD, CircleCI, branch strategy
- `00-getting-started/coding-standards.md` — PHPCS, ESLint, Stylelint rules

## Phase 8: Architecture Deep Dives & Appendices — COMPLETE

- `01-architecture/design-patterns.md` — 12 design patterns documented
- `01-architecture/environment-detection.md` — All 5 environment functions
- `appendices/A-complete-hook-registry.md` — 70+ hooks, alphabetical
- `appendices/B-shortcode-quick-reference.md` — 58 shortcodes
- `appendices/C-rest-route-reference.md` — 37+ REST routes
- `appendices/D-constants-reference.md` — All constants by category
- `appendices/E-third-party-dependencies.md` — npm + Composer + CDN
- `appendices/F-acf-field-group-reference.md` — 18 JSON + 20+ PHP groups
- `appendices/G-feature-template-catalog.md` — Pointer to catalog

---

## FINAL SUMMARY

| Metric | Value |
|---|---|
| **Total documents** | **301** |
| **Total lines** | **48,492** |
| **Total size** | **2.7 MB** |
| **Phases completed** | **9/9** |
| **Status** | **COMPLETE** |

### Documents per section:

| Section | Count |
|---|---|
| 00-getting-started | 5 |
| 01-architecture | 6 |
| 02-post-types | 21 |
| 03-taxonomies | 12 |
| 04-custom-fields | 16 |
| 05-components | 29 |
| 06-helpers | 42 |
| 07-shortcodes | 10 |
| 08-hooks | 18 |
| 09-api | 29 |
| 10-layouts-and-templates | 9 |
| 11-features | 4 |
| 12-integrations | 13 |
| 13-sponsored-content | 4 |
| 14-crons-feeds-rewrites | 4 |
| 15-cli | 8 |
| 16-admin | 7 |
| 17-frontend-assets | 34 |
| 18-mobile | 4 |
| 19-pdf-generation | 5 |
| 20-amp | 1 |
| 21-exports | 5 |
| 22-notifications | 3 |
| 23-htmx | 4 |
| appendices | 7 |
| docs/README.md | 1 |
| **TOTAL** | **301** |
