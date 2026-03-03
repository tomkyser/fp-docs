# Documentation Game Plan: Foreign Policy 2017 Theme

> **Generated**: 2026-02-25
> **Scope**: `themes/foreign-policy-2017/` only
> **Output**: `themes/foreign-policy-2017/docs/`
> **Status**: PLANNING PHASE

---

## Table of Contents

1. [Why This Matters](#1-why-this-matters)
2. [Theme Inventory Summary](#2-theme-inventory-summary)
3. [Documentation Structure](#3-documentation-structure)
4. [Phase Breakdown](#4-phase-breakdown)
5. [Document Specifications](#5-document-specifications)
6. [Execution Strategy](#6-execution-strategy)
7. [Quality Standards](#7-quality-standards)
8. [Open Questions](#8-open-questions)

---

## 1. Why This Matters

This is a ~10-year-old custom WordPress theme with:
- **Zero original team members remaining**
- **1,374+ code files** across 23 top-level directories
- **46 helper modules**, **50+ shortcodes**, **13+ custom post types**, **7 custom taxonomies**, **25+ REST routes**, **7 CLI commands**, **9 cron jobs**, **9 custom feeds**, **50+ ACF field groups**, **277+ action hooks**, **80+ filter hooks**
- Deep integrations with Piano, Sailthru, Coral, Chartbeat, Meilisearch, Apple News, Cloudflare, and more
- A complex Webpack build system with Tailwind CSS
- 221+ one-off feature article templates
- A mobile API layer
- PDF generation, AMP support, sponsored content templating, and more

No single person understands the full system. The documentation must serve as the definitive reference for anyone working on this theme.

---

## 2. Theme Inventory Summary

### By the Numbers

| Category | Count |
|---|---|
| Top-level directories | 23 |
| Root template files | 13 |
| `inc/` subsystem files | 252 |
| `components/` template files | 447 (32 categories) |
| `helpers/` utility files | 46 |
| `features/` one-off templates | 221+ |
| `layouts/` template files | 63 (4 categories) |
| `page-templates/` | 16 |
| `shortcodes/` | 50+ |
| `custom-fields/` (ACF) | 32+ files |
| `post-types/` | 18 classes + 2 legacy + 2 traits |
| `taxonomies/` | 11 classes |
| `rest-api/` endpoints | 14 files (25+ routes) |
| `endpoints/` (non-REST) | 13 classes |
| `hooks/actions/` | 8 classes |
| `hooks/filters/` | 9 classes |
| `cli/` commands | 7 classes |
| `crons/` scheduled tasks | 9 files |
| `feeds/` handlers | 9 files |
| `rewrites/` | 12 files |
| `redirects/` | 3 files |
| `settings/` page configs | 10 files |
| `admin-settings/` | 8 classes |
| `notifications/` | 4 classes |
| `exports/` | 4 classes |
| `roles/` | 2 classes |
| `sponsored/` templates | 6 templates + parts + projects |
| `mobile/` API layer | API router + partials + templates |
| `dynamic-pdfs/` | Components + styles + templates |
| `amp/` templates | 8 files |
| `template-parts/` | 11 files |
| `assets/src/` source files | 662 (scripts + styles + images + fonts) |
| `build/` (Webpack config) | webpack.config.js + entries + tailwind + package.json |
| `lib/autoloaded/` (Composer) | 11+ PHP dependencies |

### Top-Level Directory Map

```
themes/foreign-policy-2017/
├── amp/                    # Google AMP templates
├── assets/                 # Source assets (JS, CSS, images, fonts)
│   └── src/
│       ├── scripts/        # JavaScript source (400+ files)
│       ├── styles/         # PostCSS/Tailwind source (200+ files)
│       ├── images/         # Image assets
│       └── fonts/          # Web fonts
├── build/                  # Webpack build configuration
├── components/             # Reusable template components (447 files, 32 categories)
├── crons/                  # Scheduled tasks (9 files)
├── css/                    # Legacy CSS
├── dynamic-pdfs/           # PDF generation system
├── features/               # One-off feature article templates (221+)
├── feeds/                  # Custom RSS/feed handlers (9 files)
├── helpers/                # Namespaced utility functions (46 files)
├── inc/                    # Core functionality (252 files)
│   ├── abstract/           # Abstract base classes
│   ├── admin-settings/     # Admin settings pages
│   ├── cli/                # WP-CLI commands
│   ├── custom-fields/      # ACF field group definitions
│   ├── custom-field-types/ # Custom ACF field types
│   ├── custom-location-rules/ # ACF location rules
│   ├── endpoints/          # Custom (non-REST) endpoints
│   ├── exports/            # Data export handlers
│   ├── hooks/              # Centralized action/filter hooks
│   │   ├── actions/        # WordPress action handlers
│   │   └── filters/        # WordPress filter handlers
│   ├── notifications/      # Notification systems
│   ├── post-types/         # Custom post type definitions
│   │   ├── legacy/         # Legacy post types
│   │   └── traits/         # Shared post type traits
│   ├── rest-api/           # REST API endpoint handlers
│   ├── roles/              # Custom user roles
│   ├── shortcodes/         # Shortcode handlers
│   ├── taxonomies/         # Custom taxonomy definitions
│   └── traits/             # PHP traits (HTMX)
├── layouts/                # Page layout templates
│   ├── archives/           # Archive page layouts
│   ├── pages/              # Page-specific layouts
│   ├── singles/            # Single post layouts
│   │   └── legacy/         # Legacy single layouts
│   └── taxonomies/         # Taxonomy archive layouts
├── lib/                    # Third-party libraries
│   └── autoloaded/         # Composer-managed packages
├── mobile/                 # Mobile app API layer
│   ├── api/                # REST API router + controllers
│   ├── partials/           # Mobile-specific partials
│   └── templates/          # Mobile templates
├── node_modules/           # NPM dependencies (build only)
├── page-templates/         # Custom WordPress page templates (16)
├── public/                 # Compiled assets output
├── redirects/              # URL redirect handlers
├── rewrites/               # WordPress rewrite rules
├── settings/               # Page/section content settings
├── sponsored/              # Sponsored content system
│   ├── data/               # Sponsored data
│   ├── parts/              # Sponsored template parts
│   └── projects/           # Sponsored project templates
├── static/                 # Static assets
├── template-parts/         # WordPress template parts
├── 404.php                 # 404 error template
├── archive.php             # Archive template
├── author.php              # Author page template
├── footer.php              # Footer template
├── functions.php           # THEME BOOTSTRAP (413 lines)
├── header.php              # Header template
├── image.php               # Image attachment template
├── index.php               # Default fallback template
├── page.php                # Page template
├── search.php              # Search results template
├── sidebar.php             # Sidebar template
├── single.php              # Single post template
└── style.css               # Theme metadata
```

---

## 3. Documentation Structure

All documentation lives in `themes/foreign-policy-2017/docs/`. The structure mirrors the logical organization of the theme, not its file tree.

```
docs/
├── README.md                          # Documentation hub & navigation guide
│
├── 00-getting-started/
│   ├── overview.md                    # Theme architecture overview & philosophy
│   ├── local-development.md           # Environment setup, dependencies, tooling
│   ├── build-system.md                # Webpack, npm scripts, Tailwind, asset pipeline
│   ├── deployment.md                  # CI/CD, VIP Go deployment, branch strategy
│   └── coding-standards.md            # PHPCS, ESLint, Stylelint, Psalm rules
│
├── 01-architecture/
│   ├── bootstrap-sequence.md          # functions.php loading order (all 46 steps)
│   ├── directory-map.md               # Complete directory reference with purpose
│   ├── template-hierarchy.md          # WordPress template resolution + theme overrides
│   ├── design-patterns.md             # Singleton, traits, namespaces, component model
│   ├── data-flow.md                   # How data moves: WP Query -> Layout -> Components
│   └── environment-detection.md       # VIP environment helpers, staging vs production
│
├── 02-post-types/
│   ├── _index.md                      # Post type system overview & registration pattern
│   ├── post.md                        # Standard posts (NOA, features, etc.)
│   ├── page.md                        # Pages with custom meta
│   ├── channel.md                     # Channels (her-power handling, navigation)
│   ├── sponsored.md                   # Sponsored content (templates, data, projects)
│   ├── newsletter.md                  # Newsletter posts
│   ├── newsletter-ad.md               # Newsletter advertisements
│   ├── project.md                     # Projects (layouts, live blog, collections)
│   ├── podcast.md                     # Podcasts (series, episodes, players)
│   ├── events.md                      # Legacy events
│   ├── fp-event.md                    # Modern FP events (speakers, agendas, sessions)
│   ├── fp-live-event.md               # FP Live event coverage
│   ├── slideshow.md                   # Photo slideshows
│   ├── quiz.md                        # Interactive quizzes
│   ├── graphics.md                    # Graphics/infographic embeds
│   ├── takeover.md                    # Takeover editorial pages
│   ├── attachment.md                  # Custom attachment handling
│   ├── guest-author-profile.md        # Co-Authors Plus profiles
│   ├── legacy-ip-access-client.md     # Legacy IP access post type
│   ├── legacy-link-access-client.md   # Legacy link access post type
│   └── traits.md                      # HasTags, HasFeaturedMedia traits
│
├── 03-taxonomies/
│   ├── _index.md                      # Taxonomy system overview
│   ├── post-category.md               # Post categories (custom meta box, JSON feed)
│   ├── hierarchical-tags.md           # Tags converted to hierarchical
│   ├── magazine-issue.md              # Magazine issue taxonomy
│   ├── magazine-category.md           # Magazine category taxonomy
│   ├── tags-metadata.md               # Tag metadata storage
│   ├── category-tag.md                # Category/tag taxonomy
│   ├── slideshow-category.md          # Slideshow categories
│   ├── newsletter-category.md         # Newsletter categories
│   ├── newsletter-category-metadata.md # Newsletter category metadata
│   ├── podcast-series.md              # Podcast series grouping
│   └── rss-partners.md                # RSS partnership taxonomy
│
├── 04-custom-fields/
│   ├── _index.md                      # ACF integration overview & patterns
│   ├── acf-settings.md                # Global ACF settings & configuration
│   ├── field-groups/                   # One doc per logical field group
│   │   ├── post-fields.md
│   │   ├── events.md
│   │   ├── fp-live-events.md
│   │   ├── newsletters.md
│   │   ├── newsletter-ads.md
│   │   ├── subscribe-pages.md
│   │   ├── subscriber-onboarding.md
│   │   ├── post-recirculation.md
│   │   └── post-email-alerts.md
│   ├── options-pages/
│   │   ├── secrets.md
│   │   ├── myfp.md
│   │   └── rest-authentication.md
│   ├── custom-field-types.md          # Custom ACF field type: fp-wp-search
│   └── custom-location-rules.md       # Post meta filter, projects layout rules
│
├── 05-components/
│   ├── _index.md                      # Component system overview & conventions
│   ├── header.md                      # Header components
│   ├── footer.md                      # Footer components
│   ├── navigation.md                  # Navigation, breadcrumbs, pagination (42 files)
│   ├── post.md                        # Post display components (110 files)
│   ├── article.md                     # Article-specific components
│   ├── home.md                        # Homepage components (36 files)
│   ├── home-2025.md                   # New 2025 homepage
│   ├── shared.md                      # Shared/reusable components (34 files)
│   ├── events.md                      # Events 2023 components (38 files)
│   ├── fp-live.md                     # FP Live components (26 files)
│   ├── podcast.md                     # Podcast components (23 files)
│   ├── projects.md                    # Projects components (18 files)
│   ├── staff.md                       # Staff components (13 files)
│   ├── htmx.md                        # HTMX interactive components (13 files)
│   ├── content-zones.md               # Content zone components (13 files)
│   ├── newsletters.md                 # Newsletter components (9 files)
│   ├── ads.md                         # Ad placement components (7 files)
│   ├── takeovers.md                   # Takeover components (7 files)
│   ├── channels.md                    # Channel components (5 files)
│   ├── slideshow.md                   # Slideshow components (5 files)
│   ├── power-maps.md                  # Power maps components (5 files)
│   ├── logos.md                       # Logo components (5 files)
│   ├── inset-box.md                   # Inset box components (5 files)
│   ├── myfp.md                        # MyFP components (4 files)
│   ├── election.md                    # Election components (3 files)
│   ├── author.md                      # Author components (2 files)
│   ├── native-prompt.md               # Native app prompts (2 files)
│   └── misc.md                        # audio, loading, scripts, end-of-post-notes, core
│
├── 06-helpers/
│   ├── _index.md                      # Helpers overview, namespace convention, usage
│   ├── environment.md                 # Environment detection helpers
│   ├── context.md                     # Page context detection (150+ conditions)
│   ├── attachments.md                 # Image/media helpers (900+ lines)
│   ├── authors.md                     # Co-author helpers (600+ lines)
│   ├── events.md                      # Event data helpers (600+ lines)
│   ├── cloudflare.md                  # Cache purging helpers (800+ lines)
│   ├── posts.md                       # Post query helpers
│   ├── piano.md                       # Piano/paywall integration
│   ├── sailthru.md                    # Email platform integration
│   ├── meilisearch.md                 # Search integration
│   ├── ip-access.md                   # IP access control + ip-utils
│   ├── encryption.md                  # Encryption/decryption (AES-128-CBC)
│   ├── projects.md                    # Projects helpers (projects, projects-meta, live-blog-feed)
│   ├── newsletters.md                 # Newsletter management
│   ├── structured-data.md             # Schema.org helpers
│   ├── briefs.md                      # Email HTML formatting
│   ├── htmx.md                        # HTMX helpers
│   ├── geo.md                         # Geolocation
│   ├── audio.md                       # Audio embed helpers
│   ├── podcasts.md                    # Podcast helpers
│   ├── slideshows.md                  # Slideshow helpers
│   ├── takeovers.md                   # Takeover helpers
│   ├── taxonomies.md                  # Taxonomy utility functions
│   ├── tags.md                        # Tag helpers
│   ├── templates.md                   # Template rendering helpers
│   ├── url.md                         # URL manipulation
│   ├── strings.md                     # String utilities
│   ├── arrays.md                      # Array utilities
│   ├── allowed-tags.md                # wp_kses sanitization
│   ├── web-fonts.md                   # Font loading
│   ├── storage.md                     # Storage/cache helpers
│   ├── response.md                    # HTTP response helpers
│   ├── queried-object.md              # Queried object detection
│   ├── cron-jobs.md                   # Cron scheduling helpers
│   ├── secrets.md                     # Credentials management
│   ├── slack.md                       # Slack integration
│   ├── myfp.md                        # MyFP account helpers
│   ├── live-components.md             # FP Live component helpers
│   ├── live-emails.md                 # Live event emails
│   ├── jwk.md                         # JSON Web Key handling
│   └── pdf.md                         # PDF generation helpers
│
├── 07-shortcodes/
│   ├── _index.md                      # Shortcode system overview + registration list
│   ├── content-media.md               # brightcove, audio_embed, post-embed, graphics
│   ├── formatting.md                  # pullquote, footnote, annotation, inset_box, hr rules, etc.
│   ├── interactive.md                 # quiz, timeline, imagemap, snazzymap, treemap, googlechart, parallax
│   ├── content-promotion.md           # featured_related_content, related_posts, gallery-link, archive
│   ├── marketing-promos.md            # marketing, ilist, fp_live_promo, campaign-specific promos
│   ├── newsletter.md                  # newsletter-signup, newsletter-ad, newsletter-sponsored, subs tout
│   ├── podcast.md                     # podcast, promo_dtyf_podcast
│   ├── ads.md                         # google_ad, distroscale-ad, pdf-links
│   └── utility.md                     # gating_truncation, sticky-menu, expandable, truncate, redboxend
│
├── 08-hooks/
│   ├── _index.md                      # Hook system overview + centralized hook architecture
│   ├── actions/
│   │   ├── admin.md                   # Admin-specific actions
│   │   ├── feeds.md                   # Feed actions
│   │   ├── general.md                 # General lifecycle actions
│   │   ├── plugins.md                 # Plugin-related actions
│   │   ├── posts.md                   # Post save/transition actions
│   │   ├── requests.md               # Request/HTTP actions
│   │   ├── templates.md               # Template actions
│   │   └── cloudflare-cache.md        # Cloudflare cache actions
│   └── filters/
│       ├── admin.md                   # Admin UI/menu filters
│       ├── content.md                 # Content display filters
│       ├── plugins.md                 # Plugin filters (Apple News, Jetpack, etc.)
│       ├── posts.md                   # Post query/display filters
│       ├── redirects-rewrites.md      # URL/redirect filters
│       ├── rest-authentication.md     # REST auth filters
│       ├── scripts.md                 # Script/style enqueue filters
│       ├── search.md                  # Search filters
│       └── templates.md               # Template selection filters
│
├── 09-api/
│   ├── _index.md                      # API layer overview (REST + custom endpoints)
│   ├── rest-api/
│   │   ├── template-part-ajax.md      # Dynamic component loading
│   │   ├── live-blog.md               # Live blog post fetching
│   │   ├── posts-by-tag.md            # Tag-filtered posts
│   │   ├── fb-pixels.md               # Facebook Pixel management
│   │   ├── mobile-app-feeds.md        # Mobile app feed endpoints
│   │   ├── list-api.md                # List/collection API
│   │   ├── page-by-template.md        # Template-filtered pages
│   │   ├── newsletter-ads.md          # Newsletter ad endpoints
│   │   ├── update-st-user.md          # Sailthru user updates
│   │   ├── myfp-manage.md             # MyFP account management (10 routes)
│   │   ├── coral-jwt.md               # Coral commenting tokens
│   │   ├── coral-username.md          # Coral user management
│   │   ├── sailthru-hid.md            # Sailthru HID integration
│   │   └── noa-audio.md              # News Over Audio
│   ├── custom-endpoints/
│   │   ├── author-payments.md         # Author payment processing
│   │   ├── print-archive-proxy.md     # Print archive redirects
│   │   ├── piano-ajax.md              # Piano SDK integration
│   │   ├── piano-update-user.md       # Piano user profile updates
│   │   ├── piano-cookies.md           # Piano cookie management
│   │   ├── zkipster.md                # Zkipster event integration
│   │   ├── live-events.md             # Live event endpoints
│   │   ├── fp-live.md                 # FP Live content
│   │   ├── fp-events.md               # FP Events
│   │   ├── recaptcha.md               # reCAPTCHA validation
│   │   ├── power-maps.md              # Power Maps
│   │   ├── sailthru-newsletters.md    # Sailthru newsletters
│   │   └── htmx.md                    # HTMX component endpoint
│   ├── ajax-handlers.md               # AJAX load-more handlers (5 classes)
│   └── mobile-api.md                  # Mobile app API (20+ routes, v3)
│
├── 10-layouts-and-templates/
│   ├── _index.md                      # Template system overview
│   ├── root-templates.md              # single.php, page.php, archive.php, etc.
│   ├── page-templates.md              # 16 custom page templates
│   ├── layouts-singles.md             # Single post layouts (12+ layouts)
│   ├── layouts-archives.md            # Archive layouts (8 layouts)
│   ├── layouts-pages.md               # Page-specific layouts (30+ layouts)
│   ├── layouts-taxonomies.md          # Taxonomy archive layouts (5 layouts)
│   ├── template-parts.md              # WordPress template parts (11 files)
│   └── settings-pages.md              # Page/section content settings (10 files)
│
├── 11-features/
│   ├── _index.md                      # Feature article system overview
│   ├── feature-handler.md             # Dynamic feature template loader
│   ├── legacy-feature-handler.md      # Legacy feature support
│   └── catalog.md                     # Index of all 221+ feature templates
│
├── 12-integrations/
│   ├── _index.md                      # External integration overview
│   ├── piano.md                       # Subscription/paywall (endpoints, cookies, user mgmt)
│   ├── sailthru.md                    # Email/newsletters (content export, user sync, HID)
│   ├── coral.md                       # Commenting system (JWT auth, username mgmt)
│   ├── chartbeat.md                   # Analytics (trending posts, config)
│   ├── meilisearch.md                 # Search engine (indexing, CLI, queries)
│   ├── apple-news.md                  # Content syndication (formatting, publishing hooks)
│   ├── google-analytics.md            # Analytics tracking
│   ├── cloudflare.md                  # CDN/cache management
│   ├── slack.md                       # Notification system
│   ├── noa.md                         # News Over Audio
│   ├── rudderstack.md                 # Customer data platform
│   └── braintree.md                   # Payment processing
│
├── 13-sponsored-content/
│   ├── _index.md                      # Sponsored content system overview
│   ├── templates.md                   # Sponsored templates (6 templates)
│   ├── parts.md                       # Sponsored template parts
│   └── projects.md                    # Sponsored project templates
│
├── 14-crons-feeds-rewrites/
│   ├── crons.md                       # All 9 cron jobs
│   ├── feeds.md                       # All 9 custom feeds
│   ├── rewrites.md                    # All 12 rewrite rules
│   └── redirects.md                   # All 3 redirect handlers
│
├── 15-cli/
│   ├── _index.md                      # WP-CLI overview
│   ├── foreignpolicy.md               # wp foreignpolicy commands
│   ├── acf.md                         # wp fp-acf commands (FM -> ACF migration)
│   ├── meilisearch.md                 # wp meilisearch commands
│   ├── categories.md                  # wp categories commands
│   ├── storage.md                     # wp storage commands
│   ├── media.md                       # wp media (NonGetty) commands
│   └── tags.md                        # wp fp tag commands
│
├── 16-admin/
│   ├── _index.md                      # Admin customization overview
│   ├── settings-pages.md              # Admin settings pages (8 classes)
│   ├── admin-notices.md               # Admin notification system
│   ├── magazine.md                    # Magazine admin customizations
│   ├── tinymce.md                     # TinyMCE toolbar customizations
│   ├── user-roles.md                  # Custom roles (Admin L2, Dev)
│   └── native-ads.md                  # Native ad settings
│
├── 17-frontend-assets/
│   ├── _index.md                      # Asset system overview
│   ├── webpack-config.md              # Webpack configuration deep dive
│   ├── entry-points.md                # All webpack entry points
│   ├── tailwind-config.md             # Tailwind CSS configuration
│   ├── javascript/
│   │   ├── _index.md                  # JS architecture overview
│   │   ├── global.md                  # Global initialization script
│   │   ├── annotations.md             # Annotation component JS
│   │   ├── archive-scroller.md        # Archive scroller JS
│   │   ├── fp-events.md               # FP Events JS
│   │   ├── fp-live.md                 # FP Live JS
│   │   ├── fp-quiz.md                 # Quiz JS
│   │   ├── header.md                  # Header JS
│   │   ├── home.md                    # Homepage JS
│   │   ├── myfp.md                    # MyFP JS
│   │   ├── navigation.md              # Navigation JS
│   │   ├── newsletters.md             # Newsletters JS
│   │   ├── onboarding.md              # Onboarding JS
│   │   ├── page.md                    # Page JS
│   │   ├── podcasts.md                # Podcasts JS
│   │   ├── post.md                    # Post JS
│   │   ├── projects.md                # Projects JS
│   │   ├── saved-articles.md          # Saved articles JS
│   │   ├── shared.md                  # Shared JS components
│   │   ├── sponsored.md               # Sponsored JS
│   │   ├── staff-page.md              # Staff page JS
│   │   ├── sticky-footer.md           # Sticky footer forms JS
│   │   ├── takeovers.md               # Takeovers JS
│   │   ├── search.md                  # Search JS
│   │   ├── mobile-app.md              # Mobile app JS
│   │   ├── rudderstack.md             # RudderStack analytics JS
│   │   ├── users.md                   # User-related JS
│   │   ├── utilities.md               # Shared JS utilities
│   │   ├── vendor.md                  # Third-party JS libraries
│   │   └── features.md               # Feature-specific scripts
│   ├── styles/
│   │   ├── _index.md                  # CSS architecture overview
│   │   └── component-styles.md        # Component-scoped CSS organization
│   ├── images-and-fonts.md            # Image assets and web font loading
│   └── asset-enqueuing.md             # How assets are registered and loaded
│
├── 18-mobile/
│   ├── _index.md                      # Mobile layer overview
│   ├── api-router.md                  # Mobile API v3 router (20+ routes)
│   ├── partials.md                    # Mobile-specific partials
│   └── templates.md                   # Mobile templates
│
├── 19-pdf-generation/
│   ├── _index.md                      # PDF system overview
│   ├── pdf-classes.md                 # mPDF wrapper classes
│   ├── components.md                  # PDF components
│   ├── styles.md                      # PDF-specific styles
│   └── templates.md                   # PDF templates
│
├── 20-amp/
│   └── amp-support.md                 # Google AMP implementation
│
├── 21-exports/
│   ├── _index.md                      # Export system overview
│   ├── sailthru-content.md            # Sailthru content export
│   ├── sailthru-briefs.md             # Sailthru briefs export
│   ├── sailthru-email-alerts.md       # Email alert exports
│   └── meilisearch-index.md           # Search index management
│
├── 22-notifications/
│   ├── push-notifications.md          # Mobile push notifications
│   ├── live-notifications.md          # Live event notifications
│   └── slack-notifications.md         # Slack notification system (old + new)
│
├── 23-htmx/
│   ├── _index.md                      # HTMX integration overview
│   ├── abstract-core.md               # Base HTMX class
│   ├── traits.md                      # Piano-user, sailthru-user, notifications traits
│   └── components.md                  # HTMX component implementations
│
└── appendices/
    ├── A-complete-hook-registry.md     # Every add_action/add_filter with file locations
    ├── B-shortcode-quick-reference.md  # Shortcode name, params, output for all 50+
    ├── C-rest-route-reference.md       # Every REST route with method, params, auth
    ├── D-constants-reference.md        # All defined constants
    ├── E-third-party-dependencies.md   # Composer + npm dependency inventory
    ├── F-acf-field-group-reference.md  # Complete ACF field group registry
    └── G-feature-template-catalog.md   # All 221+ feature templates indexed
```

### Document Count: ~205 markdown files

---

## 4. Phase Breakdown

### Phase 0: Foundation (Do First)
**Goal**: Create the docs infrastructure and highest-value orientation documents.

| # | Document | Priority | Why First |
|---|---|---|---|
| 0.1 | `docs/README.md` | Critical | Entry point for everything |
| 0.2 | `00-getting-started/overview.md` | Critical | First thing any dev reads |
| 0.3 | `00-getting-started/local-development.md` | Critical | Unblocks new developers |
| 0.4 | `00-getting-started/build-system.md` | Critical | Must understand to work on frontend |
| 0.5 | `01-architecture/bootstrap-sequence.md` | Critical | Foundation for understanding everything |
| 0.6 | `01-architecture/directory-map.md` | Critical | Navigation reference |

**Estimated scope**: 6 documents

---

### Phase 1: Core Systems (Post Types, Taxonomies, Custom Fields)
**Goal**: Document the content model — the backbone of the theme.

| # | Document | Priority |
|---|---|---|
| 1.1 | `02-post-types/_index.md` + all 20 post type docs | Critical |
| 1.2 | `03-taxonomies/_index.md` + all 11 taxonomy docs | Critical |
| 1.3 | `04-custom-fields/_index.md` + all field group docs | Critical |

**Estimated scope**: ~45 documents

---

### Phase 2: Template Layer
**Goal**: Document how content is rendered.

| # | Document | Priority |
|---|---|---|
| 2.1 | `01-architecture/template-hierarchy.md` | High |
| 2.2 | `01-architecture/data-flow.md` | High |
| 2.3 | `10-layouts-and-templates/` (all 8 docs) | High |
| 2.4 | `05-components/` (all 28 docs) | High |
| 2.5 | `11-features/` (all 3 docs + catalog) | Medium |

**Estimated scope**: ~42 documents

---

### Phase 3: Helpers & Hooks
**Goal**: Document the utility layer and WordPress integration surface.

| # | Document | Priority |
|---|---|---|
| 3.1 | `06-helpers/` (all 42 docs) | High |
| 3.2 | `08-hooks/` (all 18 docs) | High |
| 3.3 | `07-shortcodes/` (all 10 docs) | High |

**Estimated scope**: ~70 documents

---

### Phase 4: APIs & Endpoints
**Goal**: Document every way external systems or the frontend interact with the theme.

| # | Document | Priority |
|---|---|---|
| 4.1 | `09-api/` (all 30 docs) | High |
| 4.2 | `18-mobile/` (all 4 docs) | Medium |

**Estimated scope**: ~34 documents

---

### Phase 5: Integrations & External Systems
**Goal**: Document every third-party integration.

| # | Document | Priority |
|---|---|---|
| 5.1 | `12-integrations/` (all 13 docs) | High |
| 5.2 | `21-exports/` (all 5 docs) | Medium |
| 5.3 | `22-notifications/` (all 3 docs) | Medium |

**Estimated scope**: ~21 documents

---

### Phase 6: Supporting Systems
**Goal**: Document secondary systems.

| # | Document | Priority |
|---|---|---|
| 6.1 | `13-sponsored-content/` (4 docs) | Medium |
| 6.2 | `14-crons-feeds-rewrites/` (4 docs) | Medium |
| 6.3 | `15-cli/` (8 docs) | Medium |
| 6.4 | `16-admin/` (7 docs) | Medium |
| 6.5 | `19-pdf-generation/` (5 docs) | Low |
| 6.6 | `20-amp/` (1 doc) | Low |
| 6.7 | `23-htmx/` (4 docs) | Medium |

**Estimated scope**: ~33 documents

---

### Phase 7: Frontend Assets
**Goal**: Document the asset pipeline and frontend code at full depth (same as PHP).

| # | Document | Priority |
|---|---|---|
| 7.1 | `17-frontend-assets/` (all ~35 docs including per-component JS docs) | High |
| 7.2 | `00-getting-started/coding-standards.md` | Medium |
| 7.3 | `00-getting-started/deployment.md` | Medium |

**Estimated scope**: ~37 documents

> **Note**: JS documentation is elevated to full depth per project decision. Every JS component module gets the same treatment as PHP — function signatures, dependencies, call chains, and behavior documentation.

---

### Phase 8: Architecture Deep Dives & Appendices
**Goal**: Complete remaining architecture docs and build reference appendices.

| # | Document | Priority |
|---|---|---|
| 8.1 | `01-architecture/design-patterns.md` | Medium |
| 8.2 | `01-architecture/environment-detection.md` | Medium |
| 8.3 | All 7 appendices | Medium |

**Estimated scope**: ~9 documents

---

## 5. Document Specifications

### Standard Document Template

Every document follows this structure:

```markdown
# [System/Component Name]

> **Location**: `relative/path/to/files/`
> **Files**: N files
> **Depends on**: [list of dependencies]
> **Used by**: [list of consumers]

## Overview

[2-3 sentence summary of what this system does and why it exists]

## Architecture

[How this system is structured, key classes/files, relationships]

## Key Files

| File | Purpose |
|---|---|
| `filename.php` | Brief description |

## How It Works

[Detailed explanation of behavior, data flow, key functions/methods]

## Configuration

[Any settings, constants, options that control behavior]

## Usage Examples

[Code examples of how other parts of the theme interact with this system]

## Dependencies

[What this system depends on — other theme systems, plugins, external services]

## Known Patterns & Gotchas

[Quirks, legacy decisions, things that would surprise a new developer]

## Related Documentation

[Links to related docs within this documentation set]
```

### Document Types

**Index documents** (`_index.md`): System-level overviews. Start broad, link to specifics.

**Entity documents** (e.g., individual post types): Deep dives into a single entity. Include every field, hook, template, and behavior.

**Appendices**: Machine-readable reference tables. Optimized for Ctrl+F lookup.

**Architecture documents**: Cross-cutting concerns that span multiple systems.

### What "Exhaustive" Means for Each System

For **post types**: Every registered field, every meta key, every admin customization, every template used, every hook fired, every REST endpoint, every ACF field group attached, every taxonomy associated.

For **taxonomies**: Registration args, admin UI customizations, query modifications, template usage, field groups attached.

For **helpers**: Every function name, namespace, parameters, return type, what calls it, side effects.

For **hooks**: The hook name, priority, callback function, what it does, which file registers it, which file defines the callback.

For **shortcodes**: Tag name, all attributes with defaults, output HTML structure, when/where it's used editorially.

For **REST endpoints**: Route, method, permission callback, request params, response shape, authentication requirements.

For **components**: File path, expected variables/context, output HTML structure, where it's called from.

For **integrations**: What service, what API, what credentials are needed, what data flows in/out, error handling.

For **JavaScript modules**: Every exported function, every event listener, every DOM dependency, every import, initialization flow, what triggers it, what PHP enqueues it. Same depth as PHP — no shortcuts.

For **ACF field groups**: Sync method (JSON, PHP, or both), every field with type/name/key, conditional logic, location rules, which post types/templates use it.

---

## 6. Execution Strategy

### Approach: Code-First Documentation

Each document is generated by actually reading the source code — not by guessing or summarizing from memory. For each document:

1. **Read** the relevant source files completely
2. **Trace** relationships (what calls this? what does this call?)
3. **Document** with specifics (line numbers, function signatures, actual values)
4. **Cross-reference** with related systems
5. **Flag** unknowns — mark anything unclear as `[NEEDS INVESTIGATION]` rather than guessing

### Per-Document Workflow

```
1. Identify all source files for this document
2. Read each file
3. Extract: classes, functions, hooks, filters, constants, dependencies
4. Trace: how is this called? what calls this?
5. Write the document following the template
6. Add cross-references to related docs
7. Flag any unknowns or ambiguities
```

### Parallelization Strategy

Within each phase, documents that don't depend on each other can be written in parallel. The phase ordering ensures that foundational docs (architecture, post types) exist before docs that reference them (components, templates).

### Incremental Delivery

Each phase produces complete, usable documentation. Phase 0 alone makes the codebase significantly more navigable. Each subsequent phase adds a complete system's documentation.

---

## 7. Quality Standards

### Every Document Must:

- [ ] Be generated from reading actual source code, not from assumptions
- [ ] Include specific file paths relative to the theme root
- [ ] Include function/method signatures where relevant
- [ ] Document parameters and return values for public functions
- [ ] List dependencies (what it requires) and consumers (what uses it)
- [ ] Note any `[NEEDS INVESTIGATION]` items honestly rather than guessing
- [ ] Use consistent formatting per the template
- [ ] Cross-reference related documentation

### Every Document Must NOT:

- Contain speculative information presented as fact
- Duplicate content that belongs in another document (link instead)
- Include aspirational "should be" statements — document what IS
- Skip "obvious" things — if it's in the code, it gets documented

### Naming Conventions

- File names: lowercase, hyphens, `.md` extension
- Section headers: Title Case for H1/H2, Sentence case for H3+
- Code references: backtick-wrapped (`functions.php`, `get_post_meta()`)
- File paths: always relative to theme root (`inc/post-types/class-post-type-channel.php`)

---

## 8. Resolved Decisions

All questions have been resolved. These decisions are binding for execution:

1. **Feature templates**: Grouped catalog with slug index. Each of the 221+ one-off feature templates gets an entry in the catalog, organized by grouping.

2. **JavaScript depth**: **Full depth, same as PHP.** Every JS component module gets the same treatment as PHP — function signatures, dependencies, what calls it, what it calls. Too much time is currently wasted deciphering JS; this documentation must eliminate that.

3. **Legacy vs. active**: Document equally but mark with `[LEGACY]` tags. Legacy systems get the same documentation depth as active systems, with a clear `[LEGACY]` badge so developers know the status.

4. **ACF field groups**: All ACF fields are synced via JSON or PHP (some may have both sync methods). There are **no database-exclusive ACF fields**. Documentation should note the sync method (JSON, PHP, or both) for each field group.

5. **Sponsored content**: Full depth. The `sponsored/` directory is a distinct subsystem and gets complete documentation.

6. **Static assets**: Light catalog. Note what's there at a directory level, don't enumerate every individual image file.

7. **Documentation hosting**: GitHub. Use GitHub-compatible markdown with relative links. All cross-references use relative paths that work in GitHub's markdown renderer.

---

## Summary

| Metric | Value |
|---|---|
| Total documents planned | ~205 |
| Total phases | 9 (0-8) |
| Critical priority docs | Phase 0 + Phase 1 (~51 docs) |
| High priority docs | Phase 2 + Phase 3 + Phase 4 + Phase 7 (~183 docs) |
| Medium/Low priority docs | Phase 5, 6, 8 (~76 docs) |
| Estimated coverage | Every PHP file, every JS component module, every CSS architecture decision, every integration, every hook, every shortcode, every endpoint |
| Hosting | GitHub (relative markdown links) |
| Legacy treatment | Full depth + `[LEGACY]` tags |
| JS depth | Full (same as PHP) |
| ACF sync | JSON and/or PHP only (no DB-exclusive fields) |

This plan documents the theme as it actually exists — warts, legacy code, and all — so that any developer can understand, maintain, and extend it with confidence.
