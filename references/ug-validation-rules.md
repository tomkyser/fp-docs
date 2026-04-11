# User Guide Validation Rules

Defines the validation checks, jargon detection rules, completeness matrix, and report format used to validate user guide accuracy. Loaded by the ug-validator agent and referenced during pipeline stages 1-4.

## 1. UI Path Verification (Pipeline Stage 1)

Every documented navigation path and UI interaction must correspond to a real admin screen. Two verification methods, in priority order:

### 1.1 Playwright MCP Verification (preferred)

When Playwright MCP is available:

1. Navigate to `{base_url}` (default: `https://foreignpolicy.local/wp-admin/`)
2. For each documented navigation path (e.g., "Dashboard > Posts > Add New"):
   - Click through each menu level
   - Verify the target screen loads (check page title or key element)
   - Verify documented form fields, buttons, and UI elements exist on the screen
3. For each documented action (e.g., "Click **Publish**"):
   - Verify the element exists and is visible
   - If the action produces a result (e.g., success message), verify the result element exists

Classify each path:
- **VERIFIED**: Navigation path works, target screen loads, documented elements exist
- **BROKEN**: Navigation path fails at some step (menu item missing, page 404s)
- **PARTIAL**: Path works but some documented elements are missing or renamed
- **STALE**: Path works but UI has visibly changed from documented screenshots

### 1.2 Code-Based Fallback Verification

When Playwright is unavailable, trace code to verify UI elements exist:

| UI Element | Code Pattern to Search |
|-----------|----------------------|
| Admin menu item | `add_menu_page()`, `add_submenu_page()`, `add_options_page()` |
| Custom post type | `register_post_type()` — check `show_in_menu`, `menu_position`, `labels` |
| Taxonomy | `register_taxonomy()` — check `show_in_menu`, `labels` |
| Meta box / settings panel | `add_meta_box()`, `add_settings_section()`, `add_settings_field()` |
| Admin page | `add_action('admin_menu', ...)` callbacks |
| Form field | Trace the render callback for the meta box or settings page |
| Admin column | `manage_{post_type}_posts_columns` filter |
| Shortcode | `add_shortcode()` — verify tag name still registered |

For each documented path, find the code registration and verify:
- The function/hook still exists in the codebase
- The labels match what's documented (or close enough — label text may change)
- The capability requirements haven't changed

Classify results using the same categories as Playwright verification.

## 2. Screenshot Currency (Pipeline Stage 2)

Screenshots go stale when the underlying code changes. Two checks:

### 2.1 Staleness Detection

For each page with screenshots:

1. Read `last_verified` from frontmatter
2. Read `source_features` from frontmatter — these are the source files backing this page
3. For each source file, check its last modification date: `git -C {codebase-root} log -1 --format=%aI -- {source-path}`
4. If any source file was modified after `last_verified`, flag the page as **POTENTIALLY STALE**
5. Apply staleness threshold from config (`screenshot_staleness_days`, default 30): if `last_verified` is older than threshold regardless of source changes, flag as **AGE STALE**

### 2.2 Screenshot File Integrity

For each page bundle:

1. Parse `index.md` for all image references (`![...](filename)`)
2. Verify each referenced file exists in the page bundle directory
3. Flag missing files as **BROKEN REFERENCE**
4. Check for orphan screenshots: image files in the bundle not referenced by `index.md` — flag as **ORPHAN ASSET**
5. Verify screenshot naming follows the `{NN}-{slug}.png` convention — flag deviations as **NAMING VIOLATION**

### 2.3 Playwright Comparison (when available)

If Playwright MCP is available and the page is flagged POTENTIALLY STALE:

1. Navigate to the documented admin screen
2. Capture a fresh screenshot at the same viewport size
3. Visual comparison is left to the ug-writer agent during update operations — the validator only flags staleness

## 3. Jargon and Tone Check (Pipeline Stage 3)

User guide content must be free of developer terminology. This stage scans page content (excluding frontmatter and code blocks) for violations.

### 3.1 Banned Patterns

These regex patterns flag violations when found in page body text:

| Pattern | What It Catches | Example Violation |
|---------|----------------|-------------------|
| `\$[a-z_]+` | PHP variables | `$post_type` |
| `\b(function\|class\|method\|hook\|filter\|action\|callback)\b` | Dev concepts | "the action fires when..." |
| `\b(wp_[a-z_]+\|add_action\|add_filter\|do_action\|apply_filters)\b` | WP API functions | "uses `add_action` to register..." |
| `\b(array\|string\|int\|bool\|null\|void)\b` | Type names | "returns a string" |
| `\b(REST API\|WP-CLI\|PHPDoc\|ACF)\b` | Dev tools/acronyms | "the ACF field group" |
| `[a-z_]+\(\)` | Function call syntax | "calls `get_post()`" |
| `[A-Z][a-z]+::[a-z_]+` | Static method calls | `Helper::get_value` |
| `\b(inc/\|lib/\|components/\|helpers/\|themes/)\b` | File path fragments | "defined in `inc/hooks.php`" |

### 3.2 Allowed Exceptions

These terms appear in the WP admin UI and are acceptable in user guide text:

- WordPress core UI labels: Dashboard, Posts, Pages, Media, Categories, Tags, Comments, Appearance, Plugins, Users, Tools, Settings
- Post statuses: Published, Draft, Pending Review, Scheduled, Private, Trash
- Role names: Administrator, Editor, Author, Contributor, Subscriber
- Common editor terms: Featured Image, Excerpt, Slug, Permalink, Revision, Block Editor
- Widget, Menu, Theme, Plugin (when referring to user-visible UI elements)
- Custom Fields (when the admin UI section is visible)

### 3.3 Context-Sensitive Rules

- Inside `{{< step >}}` shortcodes: stricter — only imperative instructions and UI element names
- Inside tables: allowed slightly more technical column headers (e.g., "Field", "Default") but cell content must remain plain language
- Inside troubleshooting sections: allowed to name error messages verbatim (e.g., "You may see 'Permission denied'")
- Frontmatter `source_features` field: code references are expected here — do not scan

### 3.4 Severity Classification

| Severity | Criteria |
|----------|----------|
| **HIGH** | PHP/JS identifiers in body text (`$variable`, `function()`) — always wrong in user docs |
| **MEDIUM** | Developer jargon that has a plain-language alternative ("hook" -> "feature", "taxonomy" -> "category system") |
| **LOW** | Borderline terms that may be acceptable in context ("API" in a troubleshooting section) |

## 4. Completeness Check (Pipeline Stage 4)

Every page must contain all required sections for its content type. Missing sections are structural bugs.

### 4.1 Required Sections Matrix

| Content Type | Required Sections |
|-------------|-------------------|
| `feature-guide` | What Is {Feature}?, Where to Find It, How It Works, Key Fields, Common Tasks |
| `workflow-walkthrough` | Overview, Before You Begin, Steps, What Happens Next, Troubleshooting |
| `quick-start` | Welcome, What You'll Learn, Steps (Let's Get Started), Next Steps |
| `reference` | Overview, at least one tabular section, Notes |
| `faq` | Frequently Asked Questions (at least 3 Q&A pairs), Still Need Help? |

### 4.2 Section Detection

Sections are identified by H2 headings (`##`). Match is case-insensitive and allows partial matching:
- "## What Is Regions?" matches the "What Is {Feature}?" requirement
- "## Let's Get Started" matches the "Steps" requirement for quick-start
- "## Common Issues" matches the "Troubleshooting" requirement for workflow pages

### 4.3 Structural Quality Checks

Beyond section presence, check:

| Check | Applies To | Rule |
|-------|-----------|------|
| Step count | workflow-walkthrough, quick-start | At least 2 `{{< step >}}` shortcodes |
| Screenshot presence | feature-guide, workflow-walkthrough | At least 1 image reference |
| Table presence | feature-guide (Key Fields), reference | At least 1 markdown table |
| Prerequisites listed | workflow-walkthrough | Before You Begin has at least 1 bullet |
| Related Guides present | all types | At least 1 link in Related Guides (WARN, not FAIL) |
| FAQ count | faq | At least 3 question headings (H3) |
| Troubleshooting table | workflow-walkthrough | Problem/Solution table has at least 1 row |

### 4.4 Frontmatter Validation

| Field | Check |
|-------|-------|
| `title` | Non-empty string |
| `description` | Non-empty string, under 160 characters |
| `weight` | Positive integer |
| `content_type` | One of: `feature-guide`, `workflow-walkthrough`, `quick-start`, `reference`, `faq` |
| `last_verified` | Valid ISO date, not in the future |
| `source_features` | If present, each entry is a valid relative file path |

## 5. Coverage Gap Detection

Used by `ug-audit` to find undocumented user-visible features.

### 5.1 Codebase Scan — User-Visible Features

Identify features that appear in the WP admin UI:

| Feature Type | How to Detect in Code |
|-------------|----------------------|
| Admin menu items | `add_menu_page()`, `add_submenu_page()`, `add_dashboard_page()`, `add_options_page()` |
| Custom post types | `register_post_type()` where `show_in_menu` is not `false` |
| Taxonomies | `register_taxonomy()` where `show_ui` is not `false` |
| Settings pages | `add_options_page()`, `register_setting()` |
| Shortcodes | `add_shortcode()` (user-facing if used in post content) |
| Admin columns | `manage_{post_type}_posts_columns` filter |
| Meta boxes | `add_meta_box()` (visible editing panels) |
| Dashboard widgets | `wp_add_dashboard_widget()` |

### 5.2 User Guide Scan — Documented Features

For each page in `user-guide/content/`:
- Read `source_features` from frontmatter
- Extract feature names from page titles and headings
- Build a set of documented features

### 5.3 Gap Analysis

Cross-reference the two sets:
- **Undocumented**: feature exists in code but no user guide page covers it
- **Stale/Removed**: user guide page references a feature no longer in the codebase
- **Partially documented**: feature exists in `source_features` but the page lacks coverage of all sub-features (e.g., a post type page that doesn't cover its custom columns)

Priority for undocumented features:
- **HIGH**: Custom post types, admin menu pages, settings pages — core user-facing features
- **MEDIUM**: Taxonomies, meta boxes, shortcodes — supporting features
- **LOW**: Admin columns, dashboard widgets — enhancement features

## 6. Validation Report Format

All validation operations produce a structured report.

### 6.1 Per-Page Status

```
### {Page Title} (`{content-type}`)
**Path**: `user-guide/content/{section}/{page}/index.md`
**Status**: PASS | WARN | FAIL
**Last Verified**: {date}

#### Issues
| # | Check | Severity | Description |
|---|-------|----------|-------------|
| 1 | {check name} | {HIGH/MEDIUM/LOW} | {description} |
```

### 6.2 Status Classification

| Status | Meaning |
|--------|---------|
| **PASS** | All checks passed, no issues |
| **WARN** | Minor issues found (LOW severity only, or missing optional sections) |
| **FAIL** | One or more HIGH/MEDIUM severity issues |

### 6.3 Aggregate Report

```
## User Guide Validation Report — {date}

### Summary
- Pages checked: {count}
- PASS: {count}
- WARN: {count}
- FAIL: {count}

### Issues by Severity
- HIGH: {count}
- MEDIUM: {count}
- LOW: {count}

### Per-Page Results
{individual page reports}

### Recommended Actions
- {specific /fp-docs:ug-* command for each actionable issue}
```

### 6.4 Issue Classification Reference

| Check | Possible Severities | Category |
|-------|-------------------|----------|
| UI path broken | HIGH | UI Verification |
| UI path partial (element missing) | MEDIUM | UI Verification |
| Screenshot file missing | HIGH | Screenshot Currency |
| Screenshot potentially stale | MEDIUM | Screenshot Currency |
| Screenshot age stale | LOW | Screenshot Currency |
| Orphan screenshot asset | LOW | Screenshot Currency |
| PHP/JS identifier in text | HIGH | Jargon & Tone |
| Dev jargon with plain alternative | MEDIUM | Jargon & Tone |
| Borderline technical term | LOW | Jargon & Tone |
| Required section missing | HIGH | Completeness |
| Structural quality check failed | MEDIUM | Completeness |
| Frontmatter field invalid | MEDIUM | Completeness |
| Related Guides section empty | LOW | Completeness |
