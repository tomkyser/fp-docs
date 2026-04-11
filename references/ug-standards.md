# User Guide Content Standards

This reference is the single source of truth for all formatting, structure, tone, and asset rules governing user guide pages in the `user-guide/content/` directory. Loaded by the ug-writer and ug-validator agents — NEVER duplicate these rules elsewhere.

## 1. Content Types

Five page types, each with a required structure. Templates live in `scaffolds/user-guide/templates/`.

### 1.1 Feature Guide (`feature-guide`)

```
## What Is {Feature}? — ## Where to Find It — ## How It Works — ### Key Fields — ## Common Tasks — ## Tips — ## Related Guides
```

Purpose: Explain a single WP admin feature from the user's perspective. Must include the navigation path and at least one screenshot of the feature's primary screen.

### 1.2 Workflow Walkthrough (`workflow-walkthrough`)

```
## Overview — ## Before You Begin — ## Steps (using {{< step >}} shortcode) — ## What Happens Next — ## Troubleshooting — ## Related Guides
```

Purpose: Walk through a multi-step process. Every step gets a numbered `{{< step >}}` shortcode and a screenshot showing the expected state.

### 1.3 Quick Start (`quick-start`)

```
## Welcome — ## What You'll Learn — ## Let's Get Started (numbered sections) — ## You Did It! — ## Next Steps
```

Purpose: Onboard new users to a specific area. Warm tone, minimal steps, clear outcomes.

### 1.4 Reference (`reference`)

```
## Overview — ## {Section} (tables of settings/options) — ## Notes — ## Related Guides
```

Purpose: Lookup table for settings, options, or configuration. Every option gets a row with description and default value.

### 1.5 FAQ (`faq`)

```
## Frequently Asked Questions (### per question, --- separators) — ## Still Need Help?
```

Purpose: Answer common questions. Each answer is self-contained — no forward references to other answers in the same page.

## 2. Hugo Page Bundle Conventions

Every user guide page is a Hugo **page bundle**: a directory containing `index.md` plus co-located assets.

```
user-guide/content/{section}/{page-name}/
  index.md              # Page content (frontmatter + markdown)
  01-menu-location.png  # Screenshot: numbered, descriptive slug
  02-edit-screen.png    # Screenshot: numbered, descriptive slug
  recording-*.webm      # Optional: screen recording for workflows
```

Rules:
- Page directory names use kebab-case matching the feature or workflow name
- `index.md` is always the page file (not `_index.md` — that's for section directories)
- Section directories use `_index.md` for their index pages
- All assets co-located in the same directory as `index.md` — no shared asset directories
- Image references in markdown use relative paths: `![alt](filename.png)` — no leading `./` or absolute paths

## 3. Frontmatter Specification

Every `index.md` requires this frontmatter:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Page title, plain language |
| `description` | string | Yes | 1-sentence summary for meta/search |
| `weight` | integer | Yes | Sort order within section (lower = earlier) |
| `content_type` | string | Yes | One of: `feature-guide`, `workflow-walkthrough`, `quick-start`, `reference`, `faq` |
| `last_verified` | date | Yes | ISO date when content was last verified against current UI (`YYYY-MM-DD`) |
| `screenshot_count` | integer | No | Number of screenshots in the page bundle (auto-counted) |
| `source_features` | list | No | Code references backing this page (e.g., `inc/post-types/post.php`) |

Example:
```yaml
---
title: "How to Create a New Post"
description: "Step-by-step guide to creating and publishing a post on the FP site."
weight: 10
content_type: "workflow-walkthrough"
last_verified: "2026-04-11"
screenshot_count: 5
source_features:
  - "inc/post-types/post.php"
  - "inc/admin/editor-customizations.php"
---
```

The `source_features` field links user-facing docs back to the code that implements the feature. Used by the pipeline to detect when source changes may have invalidated the documentation.

## 4. Screenshot Conventions

### Naming

Pattern: `{NN}-{slug}.{ext}`

| Component | Rule | Example |
|-----------|------|---------|
| `{NN}` | Two-digit sequence number, zero-padded | `01`, `02`, `13` |
| `{slug}` | Kebab-case description of what the screenshot shows | `menu-location`, `edit-screen-fields`, `publish-button` |
| `{ext}` | Format: `png` for static, `webm` for recordings | `png` |

Examples:
- `01-menu-location.png` — where to find the feature in the admin menu
- `02-edit-screen.png` — the main editing interface
- `03-publish-confirmation.png` — what the user sees after publishing

### Capture Rules

- **Viewport**: 1280x900 default (matches config `screenshot.viewport_width/height`)
- **Max width**: 1200px — resize larger captures down
- **Format**: PNG for screenshots, WebM for recordings
- **Content**: Capture only the relevant area — crop out unrelated sidebars when possible
- **State**: Show realistic content, not empty/default states (unless documenting the empty state)
- **Sensitive data**: Blur or replace real author names, email addresses, and draft content with placeholder values
- **Numbering**: Sequential within the page, matching the order they appear in the markdown

### Overview Screenshots

Feature guide and reference pages should include a primary screenshot (`overview.png` or `01-*.png`) showing the feature's main screen early in the page.

## 5. Tone and Language Rules

**Audience**: Non-technical WordPress editors and content managers. They know how to use a CMS but do not know PHP, JavaScript, or WordPress internals.

### Do

- Use plain, direct language: "Click **Save Draft**" not "Execute the save operation"
- Address the reader as "you": "You can find this under..." not "Users can find this under..."
- Use present tense: "The page shows..." not "The page will show..."
- Name UI elements exactly as they appear on screen, in **bold**: "Click **Publish**"
- Use "the site" or "the FP site" — not "the Foreign Policy WordPress installation"
- Keep paragraphs to 2-4 sentences maximum
- Use numbered lists for sequential steps, bullet lists for non-sequential items

### Do Not

- Use PHP/JS identifiers: no `$post_type`, no `function_name()`, no `add_action()`
- Use developer jargon: no "hook", "filter", "callback", "REST endpoint", "taxonomy registration"
- Use WordPress internals: no "custom post type" (say "content type" or name it specifically), no "meta box" (say "settings panel" or describe what it does)
- Reference file paths, class names, or code architecture
- Link to dev wiki pages — user guide is self-contained
- Use passive voice for instructions: "**Save** is clicked" should be "Click **Save**"
- Use hedging language: "You might want to..." should be "To do X, click Y"

### Allowed Technical Terms

These terms are acceptable because users encounter them in the WP admin UI:

- WordPress, Dashboard, Posts, Pages, Media, Categories, Tags
- Editor, Administrator, Contributor, Subscriber (role names)
- Featured image, Excerpt, Slug, Permalink
- Widget, Menu, Theme, Plugin (when visible in UI)
- Publish, Draft, Pending Review, Scheduled (post statuses)
- Custom fields (when visible in the editor UI)

## 6. Link Conventions

- **Between user guide pages**: relative markdown links: `[Creating a Post](../content-management/creating-a-post/)`
- **To sections within the same page**: anchor links: `[see Key Fields](#key-fields)`
- **To external resources**: full URLs, open in new tab if Hugo supports it
- **NEVER link to dev wiki pages** — user guide and dev wiki are separate audiences
- **NEVER use bare URLs** — always wrap in markdown link syntax

## 7. Shortcode Usage

Two custom shortcodes are available (defined in `scaffolds/user-guide/layouts/shortcodes/`):

### `{{< step >}}`

For numbered workflow steps. Used in workflow-walkthrough and quick-start pages.

```markdown
{{< step number="1" title="Open the Posts screen" >}}
From the Dashboard, click **Posts** in the left sidebar.
![Posts menu item](01-posts-menu.png)
{{< /step >}}
```

Rules:
- `number` attribute is required (sequential integer)
- `title` attribute is required (imperative verb phrase: "Open...", "Click...", "Enter...")
- Content between tags: 1-3 sentences + optional screenshot
- One action per step — if a step requires sub-actions, break into separate steps

### `{{< recording >}}`

For embedded screen recordings in workflow pages.

```markdown
{{< recording src="publish-workflow.webm" title="Publishing a post" >}}
```

Rules:
- `src` is a relative path to a WebM file in the page bundle
- `title` provides accessible alt text
- Use sparingly — screenshots are preferred for most steps; recordings for complex multi-step interactions

## 8. Section Organization

User guide content lives in six sections, each with a specific scope:

| Section | Directory | Content Focus |
|---------|-----------|--------------|
| Getting Started | `getting-started/` | Login, dashboard orientation, profile setup |
| Content Management | `content-management/` | Posts, pages, media, categories, tags |
| Custom Features | `custom-features/` | FP-specific content types, regions, topics, shortcodes |
| Workflows | `workflows/` | Multi-step processes: publishing, review, bulk ops |
| Site Features | `site-features/` | Search, navigation, newsletters, social |
| Troubleshooting | `troubleshooting/` | Problem-solution guides, FAQs |

Rules:
- Every section directory has an `_index.md` that lists and links all pages in the section
- Pages sort by `weight` frontmatter field within their section
- A page belongs to exactly one section — no cross-listing
- If a topic spans sections, put it where the user would look first and add Related Guides links

## 9. Integrity Rules

1. NEVER guess about UI behavior — navigate the admin (via Playwright or manual testing) or trace the code before documenting.
2. NEVER reference code constructs in user-facing text — the audience does not read code.
3. ALWAYS include at least one screenshot per feature-guide and workflow-walkthrough page.
4. ALWAYS update `last_verified` frontmatter when any content on the page is verified or changed.
5. ALWAYS use the appropriate page template as the starting structure for new pages.
6. NEVER create orphan pages — every page must be linked from its section `_index.md`.
7. Links between pages MUST be relative markdown links within the user guide.
8. Screenshots MUST show current UI state — stale screenshots are treated as documentation bugs.
9. Every workflow step MUST describe what the user will see, not just what to click.
10. When uncertain about current UI behavior, use `[NEEDS VERIFICATION]` — never fabricate steps.
