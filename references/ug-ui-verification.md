# UI Verification Guide

How to verify that documented UI paths correspond to real WordPress admin screens. Loaded by the ug-writer and ug-validator agents when performing UI behavior verification (pipeline stage 1) and screenshot capture.

## 1. Playwright MCP Verification (Preferred)

When Playwright MCP is available, verify documented paths by navigating the live WP admin. This is the highest-confidence method.

### 1.1 Authentication

The FP local dev environment uses cookie-based auth at `https://foreignpolicy.local/wp-admin/`.

1. Navigate to `https://foreignpolicy.local/wp-login.php`
2. If a login form appears, authenticate with dev credentials
3. Cookies persist across navigations within the same Playwright session — no need to re-authenticate per page
4. The local site uses a self-signed SSL certificate — Playwright must be configured with `ignoreHTTPSErrors: true`

### 1.2 Navigation Path Verification

For each documented navigation path (e.g., "Dashboard > Posts > Add New"):

1. **Start at the Dashboard**: `browser_navigate` to `https://foreignpolicy.local/wp-admin/`
2. **Click each menu level**: Use `browser_click` on each menu item in the documented path
   - Primary menu items are in `#adminmenu` — match by link text or `href`
   - Submenu items appear on hover/click — match by link text within `.wp-submenu`
3. **Verify the target screen**: After clicking through, confirm:
   - The page title matches expectations (`#wpbody-content h1` or `.wrap h1`)
   - No error page loaded (check for "Sorry, you are not allowed..." or 404 text)
   - Key UI elements documented on the page exist in the DOM

### 1.3 Element Verification

For each documented UI element (buttons, fields, panels):

| Element Type | How to Verify |
|-------------|---------------|
| Button | `browser_click` or query selector by text content or `id`/`class` |
| Form field | Query by `name` attribute, `label` text, or `id` |
| Meta box / settings panel | Query by `.postbox` with matching `h2` heading text |
| Admin notice | Query `.notice` or `.updated` after triggering the action |
| Tab | Query `.nav-tab` elements within `.nav-tab-wrapper` |
| Table column | Query `th` elements within `.wp-list-table thead` |
| Bulk action | Query `select[name="action"]` options |

### 1.4 Screenshot Capture Protocol

When capturing screenshots for user guide pages:

1. **Viewport**: Set to 1280x900 (matches `config.json` `user_guide.screenshot.viewport_width/height`)
2. **Wait**: After navigation, wait 2000ms (matches `config.json` `user_guide.playwright.wait_after_navigate_ms`) for dynamic content to load
3. **Target**: Capture the relevant area — full page for overview shots, element-specific for detail shots
4. **State**: Ensure the page shows realistic content:
   - Posts lists should have entries (not empty state)
   - Edit screens should show populated fields
   - If documenting an empty state, capture that intentionally
5. **Sensitive data**: Review captures before saving — blur or crop out real author names, emails, draft content
6. **Naming**: Save as `{NN}-{slug}.png` in the page bundle directory (see ug-standards.md section 4)
7. **Format**: PNG at default quality. Resize images wider than 1200px down to 1200px width

### 1.5 Admin URL Patterns

WordPress admin URLs follow predictable patterns. Use these to navigate directly when the menu path is known:

| Admin Screen | URL Pattern |
|-------------|-------------|
| Dashboard | `/wp-admin/` |
| All Posts | `/wp-admin/edit.php` |
| Add New Post | `/wp-admin/post-new.php` |
| Edit Post | `/wp-admin/post.php?post={id}&action=edit` |
| All Pages | `/wp-admin/edit.php?post_type=page` |
| Custom Post Type list | `/wp-admin/edit.php?post_type={slug}` |
| Add New CPT | `/wp-admin/post-new.php?post_type={slug}` |
| Taxonomy terms | `/wp-admin/edit-tags.php?taxonomy={slug}` |
| Taxonomy terms (with CPT) | `/wp-admin/edit-tags.php?taxonomy={slug}&post_type={cpt_slug}` |
| Media Library | `/wp-admin/upload.php` |
| Custom admin page | `/wp-admin/admin.php?page={menu_slug}` |
| Settings page | `/wp-admin/options-general.php?page={menu_slug}` |
| Appearance > Menus | `/wp-admin/nav-menus.php` |
| Appearance > Widgets | `/wp-admin/widgets.php` |
| Users | `/wp-admin/users.php` |
| Plugins | `/wp-admin/plugins.php` |
| Tools submenu | `/wp-admin/tools.php?page={menu_slug}` |

Base URL for FP local: `https://foreignpolicy.local/wp-admin/`

## 2. Code-Based Fallback Verification

When Playwright MCP is unavailable, verify UI paths by tracing the code that registers them. This is lower confidence than live verification but still catches removed or renamed features.

### 2.1 Admin Menu Registration

Admin menus are registered via WordPress hook callbacks. Search patterns:

```
# Top-level menu items
Grep pattern: `add_menu_page\s*\(` in themes/foreign-policy-2017/**/*.php
# Extract: page_title, menu_title, capability, menu_slug, function, icon_url, position

# Submenu items
Grep pattern: `add_submenu_page\s*\(` in themes/foreign-policy-2017/**/*.php
# Extract: parent_slug, page_title, menu_title, capability, menu_slug, function

# Options pages (Settings submenu)
Grep pattern: `add_options_page\s*\(` in themes/foreign-policy-2017/**/*.php

# Dashboard widgets
Grep pattern: `wp_add_dashboard_widget\s*\(` in themes/foreign-policy-2017/**/*.php
```

To verify a documented menu path:
1. Search for the menu registration that creates the target page
2. Confirm the `menu_slug` matches the expected URL pattern
3. Confirm the `capability` requirement hasn't changed (affects who can see it)
4. Confirm the callback function still exists (the page will 404 if the callback is missing)

### 2.2 Custom Post Type Registration

Custom post types create admin menu items automatically when `show_in_menu` is true.

```
# CPT registration
Grep pattern: `register_post_type\s*\(` in themes/foreign-policy-2017/**/*.php
```

For each registration, check:
- `show_in_menu` is not `false` (default is `true` if `show_ui` is true)
- `labels` array — the `menu_name` label determines what appears in the admin sidebar
- `menu_position` — where in the sidebar it appears
- `supports` array — determines which editor features are available (title, editor, thumbnail, etc.)
- `menu_icon` — the dashicon shown in the sidebar

### 2.3 Taxonomy Registration

Taxonomies create admin submenus under their associated post type when `show_ui` is true.

```
# Taxonomy registration
Grep pattern: `register_taxonomy\s*\(` in themes/foreign-policy-2017/**/*.php
```

For each registration, check:
- `show_ui` is not `false`
- `show_in_menu` is not `false`
- `labels` array — `menu_name` determines sidebar text
- Object type(s) the taxonomy is registered for — determines which post type menu it appears under

### 2.4 Meta Box Registration

Meta boxes are settings panels that appear on the post edit screen.

```
# Meta box registration
Grep pattern: `add_meta_box\s*\(` in themes/foreign-policy-2017/**/*.php
```

For each registration, check:
- `screen` parameter — which post type(s) the box appears on
- `context` — where on the screen (normal, side, advanced)
- `title` — the heading shown on the box (this is what users see)
- `callback` — the render function must still exist

### 2.5 Form Field Tracing

To verify documented form fields exist:

1. Find the meta box callback function from section 2.4
2. Read the callback — it renders the HTML form fields
3. Check for `<input>`, `<select>`, `<textarea>` elements
4. Match field `name` attributes and label text against documentation
5. For ACF fields: check `acf_add_local_field_group()` or JSON field group files in `inc/custom-fields/`

### 2.6 Settings Page Registration

```
# Settings registration
Grep pattern: `register_setting\s*\(` in themes/foreign-policy-2017/**/*.php

# Settings sections
Grep pattern: `add_settings_section\s*\(` in themes/foreign-policy-2017/**/*.php

# Settings fields
Grep pattern: `add_settings_field\s*\(` in themes/foreign-policy-2017/**/*.php
```

### 2.7 Shortcode Registration

Shortcodes are user-facing features embedded in post content.

```
# Shortcode registration
Grep pattern: `add_shortcode\s*\(` in themes/foreign-policy-2017/**/*.php
```

Check:
- The shortcode tag name still matches what's documented
- The `shortcode_atts()` defaults haven't changed
- The render callback still exists

## 3. Mapping Documented Paths to Verification Targets

When a user guide page says "Dashboard > Posts > Add New", translate to verification steps:

### 3.1 Path Decomposition

Split the documented path on ` > ` to get individual navigation levels:

| Level | Text | Verification |
|-------|------|-------------|
| 1 | "Dashboard" | Starting point — navigate to `/wp-admin/` |
| 2 | "Posts" | Menu item — search for `add_menu_page` with `edit.php` or built-in post type |
| 3 | "Add New" | Submenu item — search for `add_submenu_page` with parent `edit.php` or check built-in post type `post-new.php` link |

### 3.2 Built-in vs Custom

WordPress has built-in admin pages that won't appear in `add_menu_page` searches:
- Posts, Pages, Media, Comments — built-in post types
- Appearance, Plugins, Users, Tools, Settings — core admin sections

For built-in pages, verify they haven't been hidden:
```
# Check if a built-in menu is removed
Grep pattern: `remove_menu_page\s*\(` in themes/foreign-policy-2017/**/*.php
Grep pattern: `remove_submenu_page\s*\(` in themes/foreign-policy-2017/**/*.php
```

### 3.3 Capability Mapping

If documentation says a feature is available to "Editors", verify the capability requirement:

| Role | Key Capabilities |
|------|-----------------|
| Administrator | `manage_options`, `edit_theme_options`, `activate_plugins` |
| Editor | `publish_pages`, `edit_others_posts`, `manage_categories` |
| Author | `publish_posts`, `edit_published_posts`, `upload_files` |
| Contributor | `edit_posts`, `delete_posts` |
| Subscriber | `read` |

Check the `capability` parameter in `add_menu_page` / `add_submenu_page` against the documented role.

## 4. Verification Result Format

Each verified path produces a structured result for the validation report:

```
### Path: "{documented path}"
**Target URL**: {expected admin URL}
**Method**: Playwright | Code trace
**Status**: VERIFIED | BROKEN | PARTIAL | STALE

#### Checks
- Menu item exists: YES/NO
- Target page loads: YES/NO/N/A
- Documented elements present: {count found}/{count documented}
- Capability unchanged: YES/NO/UNKNOWN

#### Notes
- {any discrepancies, renamed elements, changed labels}
```

Status classification:
- **VERIFIED**: All checks pass — path works, elements exist, capability matches
- **BROKEN**: Menu item or page is missing — the documented path no longer works at all
- **PARTIAL**: Path works but some documented elements are missing, renamed, or relocated
- **STALE**: Path works and elements exist, but labels or layout have visibly changed from what's documented
