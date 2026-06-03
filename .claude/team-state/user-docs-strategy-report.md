# User-Facing Documentation Strategy Report — Phase 1

> **Author**: Architect (team-architect)
> **Date**: 2026-04-09
> **Status**: Complete
> **Scope**: Architecture decisions for Wave 3 user-facing documentation system

---

## 1. Executive Summary

This report addresses the five key architecture questions for Wave 3: where user docs live, how they're deployed, how content is generated, what the doc structure looks like, and how visual assets integrate. The recommendations prioritize clean audience separation, minimal infrastructure overhead, and alignment with the existing Wave 2 Hugo dev wiki.

**Recommendations at a glance**:
- **Repo**: Subfolder within existing docs repo (`user-guide/`)
- **Site**: Separate Hugo build, separate deployment — NOT shared with dev wiki
- **Theme**: User-friendly theme (not Book) — optimized for non-technical readers
- **Assets**: Hugo page bundles + Git LFS for binary files
- **Generation**: Code-informed, UI-presented pipeline using Playwright + Claude synthesis

---

## 2. Repo Placement Decision

### Question: Should user docs live in a subfolder of the docs repo or a separate repo?

### Recommendation: **Subfolder in docs repo** (`docs-foreignpolicy-com/user-guide/`)

### Analysis

| Factor | Subfolder | Separate Repo |
|---|---|---|
| Management overhead | Lower — one repo | Higher — two repos to maintain |
| Git history | Shared (but user-guide/ is self-contained) | Fully independent |
| Binary asset bloat | Mitigated by Git LFS on `user-guide/` path | Not an issue |
| Deployment coupling | Decoupled — separate Hugo builds | Naturally decoupled |
| Access control | Same visibility as dev docs | Independent visibility |
| fp-docs plugin integration | Simpler — one docs root | Needs second docs root config |
| Branch strategy | Follows same branch as dev docs | Independent branching |

### Rationale

1. **Git LFS solves the bloat problem**: The main argument for a separate repo is screenshot/recording binary bloat. Git LFS scoped to `user-guide/**/*.{png,jpg,gif,mp4,webp}` eliminates this concern entirely.

2. **Deployment is already decoupled**: Hugo builds can target a specific `contentDir`. The dev wiki uses `contentDir = "."` and ignores internal dirs. A second GitHub Actions workflow targeting only `user-guide/` gives full deployment independence with zero coupling.

3. **Plugin simplicity**: The fp-docs plugin already knows `project.repos.docs.git_root`. Adding a `user_guide_path` subkey is simpler than configuring a second repo with its own remote, branch strategy, and sync hooks.

4. **Single source of truth**: When dev docs reference a feature, the user guide for that same feature is in the same repo. Cross-referencing is straightforward.

### Constraints
- Git LFS must be configured on the docs repo (requires GitHub LFS storage quota — free tier is 1GB, should be sufficient initially)
- `.gitattributes` must be added to `user-guide/` to enable LFS tracking

---

## 3. Site Strategy Decision

### Question: Should user docs share the Wave 2 Hugo dev wiki or be a separate site?

### Recommendation: **Separate Hugo site** (own build, own theme, own deployment)

### Analysis

| Factor | Shared Site | Separate Site |
|---|---|---|
| Audience clarity | Confusing — tech and non-tech mixed | Clear — each site serves one audience |
| Navigation | 24 dev sections + user sections = overwhelming | Clean, user-focused navigation |
| Search | Dev docs pollute user search results | Only user-relevant content in search |
| Theme | Book theme is developer-oriented | Can choose user-friendly theme |
| Deployment | Single pipeline | Two pipelines (manageable) |
| Infrastructure | Simpler | Slightly more, but worth it |

### Rationale

1. **Audience separation is non-negotiable**: Dev docs are for developers reading code references. User docs are for content editors navigating WordPress admin screens. Mixing these in one navigation tree serves neither audience well.

2. **Theme mismatch**: Hugo Book is a developer documentation theme — monospace fonts, code-block-centric, sidebar hierarchy optimized for API docs. User docs need: larger screenshots, step-by-step visual flow, warmer design, less code. A different theme is essential.

3. **Search isolation**: If a content editor searches "how to add a post," they should not get hits from dev docs about `register_post_type()`. Separate sites = separate search indexes.

4. **Deployment independence**: User docs update when UI changes. Dev docs update when code changes. These are different cadences. Independent builds mean neither blocks the other.

### Implementation
- Second `hugo.toml` at `user-guide/hugo.toml`
- Second GitHub Actions workflow: `.github/workflows/deploy-user-guide.yml`
- Separate GitHub Pages deployment (can use a different base URL or subdirectory)
- Dev wiki: `tomkyser.github.io/docs-foreignpolicy-com/`
- User guide: `tomkyser.github.io/docs-foreignpolicy-com/user-guide/` (via `publishDir` configuration) OR a separate Pages site

### Theme Candidates
User-friendly Hugo themes worth evaluating (Engineer/Phase 2):
- **Hugo Clarity** — clean, image-focused, good for tutorials
- **Hugo Blowfish** — modern, visual, good mobile experience
- **Hugo Relearn** — documentation-focused but more visual than Book
- **Custom minimal theme** — if none fit, a lightweight custom theme gives full control

---

## 4. Content Generation Approach

### Pipeline: "Code-Informed, UI-Presented"

The fp-docs plugin already excels at reading source code. User doc generation extends this with a UI layer.

### 4.1 Generation Pipeline

```
┌───────────���─────────────────────────────────────────────────┐
│                    fp-docs User Doc Pipeline                 │
│                                                             │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │ Code     │    │ UI Discovery │    │ Content          │  │
│  │ Analysis │───▶│ (Playwright) │───▶│ Synthesis        │  │
│  │          │    │              │    │ (Claude)         │  │
│  └──────────┘    └──────────────┘    └──────────────────┘  │
│       │                │                      │             │
│  Read source      Navigate site          Write markdown     │
│  Understand        Take screenshots      + embed images     │
│  feature           Capture UI state      + user language    │
│                                                             │
│  Inputs:           Inputs:              Output:             │
│  - PHP/JS source   - Live FP site       - Hugo page bundle  │
│  - Dev docs        - WP Admin           - (index.md + PNGs) │
│  - config.json     - Frontend pages     - Frontmatter       │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Stage Details

**Stage 1: Code Analysis** (existing fp-docs capability)
- Read the source files for the target feature
- Extract: what it does, what admin screens it creates, what user-facing behavior it produces
- Cross-reference existing dev docs for verified descriptions
- Output: structured feature summary (internal, not user-facing)

**Stage 2: UI Discovery** (new — Playwright-based)
- Navigate to the relevant admin screen or frontend page on `foreignpolicy.local`
- Log in to WP admin if needed (credentials from environment or config)
- Identify key UI elements (buttons, fields, menus, displays)
- Capture screenshots of each relevant UI state
- Save screenshots alongside the target page as Hugo page bundle assets
- Output: set of named PNG files + UI element inventory

**Stage 3: Content Synthesis** (Claude generation)
- Merge code analysis (Stage 1) with UI inventory (Stage 2)
- Write user-facing prose: step-by-step instructions, feature explanations
- Embed screenshots with descriptive alt text
- Use non-technical language — no code references, no function names
- Add frontmatter (title, description, weight, last_verified, screenshot metadata)
- Output: complete Hugo page bundle (index.md + co-located assets)

### 4.3 Content Types

| Type | Purpose | Example | Screenshot Density |
|---|---|---|---|
| **Feature Guide** | Explain what a feature does and how to use it | "Managing Regions and Topics" | Medium (3-6 per page) |
| **Workflow Walkthrough** | Step-by-step multi-screen process | "Publishing a Post" | High (8-12 per page) |
| **Reference Page** | Settings, options, field descriptions | "Post Editor Fields Reference" | Low-Medium (2-4 per page) |
| **Quick Start** | Get a new user oriented | "Your First Day on FP" | Medium (4-6 per page) |
| **FAQ / Troubleshooting** | Common questions and solutions | "Why can't I see my post?" | Low (1-2 per page) |

### 4.4 Key Principle: Code Informs, UI Presents

The code analysis gives Claude *accurate knowledge* of what a feature does. But the user doc never mentions code. Instead:

- Code: `register_post_type('fp_briefing', [...])` → User doc: "Briefings are a special content type for short-form analysis pieces"
- Code: `add_action('save_post', 'fp_validate_briefing')` → User doc: "When you save a Briefing, the system checks that all required fields are filled"
- Code: ACF field group registration → User doc: "You'll see these fields in the editor sidebar: Region, Topic, Featured Image..."

---

## 5. Doc Structure and Page Templates

### 5.1 Proposed Directory Structure

```
user-guide/
├── hugo.toml                        # Separate Hugo config
├── go.mod                           # Hugo module management
├── _index.md                        # Welcome / overview page
├── .gitattributes                   # Git LFS tracking rules
│
├── getting-started/
│   ├── _index.md                    # Section overview
│   ├── logging-in/
│   │   ├── index.md                 # Page content (leaf bundle)
│   │   ├── login-screen.png
│   │   └── dashboard-first-look.png
│   ├── dashboard-overview/
│   │   ├── index.md
│   │   ├── dashboard-widgets.png
│   │   └── admin-menu.png
│   └── your-profile/
│       ├── index.md
│       └── profile-settings.png
│
├── content-management/
│   ├── _index.md
│   ├── creating-posts/
│   │   ├── index.md
│   │   ├── 01-posts-menu.png
│   │   ├── 02-add-new-button.png
│   │   ├── 03-editor-screen.png
│   │   └── 04-publish-panel.png
│   ├── editing-posts/
│   │   ├── index.md
│   │   └── ...
│   ├── managing-media/
│   │   ├── index.md
│   │   └── ...
│   └── categories-and-tags/
│       ├── index.md
│       └── ...
│
├── custom-features/                 # FP-specific functionality
│   ├── _index.md
│   ├── regions-and-topics/          # Custom taxonomies
│   ├── special-post-types/          # CPTs
│   ├── content-blocks/              # ACF field groups
│   └── shortcodes/                  # User-facing shortcodes
│
├── workflows/
│   ├── _index.md
│   ├── publish-workflow/
│   ├── content-review/
│   └── bulk-operations/
│
├── site-features/
│   ├── _index.md
│   ├── search/
│   ├── navigation-menus/
│   ├── newsletters/
│   └── social-sharing/
│
├── troubleshooting/
│   ├── _index.md
│   ├── common-issues/
│   └── faq/
│
└── layouts/                         # Hugo theme overrides
    ├── shortcodes/
    │   └── recording.html           # Video embed shortcode
    └── _default/
        └── _markup/
            └── render-image.html    # Responsive image processing
```

### 5.2 Page Template

```markdown
---
title: "Creating a New Post"
description: "Step-by-step guide to creating and publishing posts on Foreign Policy"
weight: 10
category: "content-management"
content_type: "workflow-walkthrough"
last_verified: "2026-04-09"
source_features:
  - "register_post_type:post"       # Internal: which code features inform this doc
  - "acf_field_group:post_fields"   # Never shown to users — for fp-docs pipeline tracking
---

## Overview

A brief, friendly description of what this guide covers. One or two sentences max.

## Before You Begin

- You need Editor or Administrator access
- Make sure you're logged into the WordPress admin dashboard

## Steps

### 1. Open the Posts Screen

From the left sidebar, click **Posts**. You'll see a list of all existing posts.

![Posts menu in sidebar](01-posts-menu.png)

### 2. Click "Add New"

At the top of the posts list, click the **Add New** button.

![Add New button at top of posts list](02-add-new-button.png)

### 3. Write Your Content

The editor screen has several areas:
- **Title**: Enter your post title at the top
- **Content area**: Write or paste your post content
- **Sidebar fields**: Set featured image, categories, regions, and topics

![Post editor screen with fields labeled](03-editor-screen.png)

### 4. Publish

When you're ready, click **Publish** in the right sidebar. You'll be asked to confirm.

![Publish panel with confirmation](04-publish-panel.png)

## Tips

- Save drafts frequently using **Save Draft** in the publish panel
- Use **Preview** to see how your post will look before publishing

## Related Guides

- [Editing an Existing Post](../editing-posts/)
- [Managing Categories and Tags](../categories-and-tags/)
- [Featured Images](../featured-images/)
```

### 5.3 Frontmatter Fields

| Field | Required | Purpose |
|---|---|---|
| `title` | Yes | Page title (user-friendly, no code terms) |
| `description` | Yes | Short description for search and SEO |
| `weight` | Yes | Ordering within section |
| `category` | Yes | Section name (matches parent directory) |
| `content_type` | Yes | One of: feature-guide, workflow-walkthrough, reference, quick-start, faq |
| `last_verified` | Yes | Date when screenshots/content last confirmed accurate |
| `source_features` | No | Internal tracking: which code features inform this doc (for fp-docs pipeline, never rendered) |

---

## 6. Visual Asset Integration

### 6.1 Strategy: Hugo Page Bundles + Git LFS

Every page with screenshots is a **leaf bundle** (directory with `index.md` + co-located assets):

```
creating-posts/
├── index.md            # The page
├── 01-posts-menu.png   # Screenshots co-located
├── 02-add-new.png
└── 03-editor.png
```

**Why page bundles**:
- Assets version with the page — no broken paths
- Simple relative references: `![Alt](filename.png)`
- Hugo processes them automatically (can resize, optimize)
- Clear ownership — every image belongs to exactly one page
- Easy to audit: `ls creating-posts/` shows page + all its assets

### 6.2 Git LFS Configuration

```gitattributes
# user-guide/.gitattributes
*.png filter=lfs diff=lfs merge=lfs -text
*.jpg filter=lfs diff=lfs merge=lfs -text
*.jpeg filter=lfs diff=lfs merge=lfs -text
*.gif filter=lfs diff=lfs merge=lfs -text
*.webp filter=lfs diff=lfs merge=lfs -text
*.mp4 filter=lfs diff=lfs merge=lfs -text
*.webm filter=lfs diff=lfs merge=lfs -text
```

This scopes LFS to only user-guide assets. Dev docs (which have no images) are unaffected.

### 6.3 Screenshot Naming Convention

```
{step-number}-{description}.png
```

Examples:
- `01-posts-menu.png`
- `02-add-new-button.png`
- `03-editor-screen.png`
- `04-publish-confirmation.png`

Step numbers maintain visual ordering. Descriptions are kebab-case, concise, descriptive.

### 6.4 Screen Recordings

For multi-step workflows where screenshots aren't enough:

```markdown
{{< recording src="publish-workflow.mp4" caption="Complete post publishing workflow" >}}
```

Custom Hugo shortcode renders as:
```html
<figure class="recording">
  <video controls preload="metadata" playsinline>
    <source src="publish-workflow.mp4" type="video/mp4">
  </video>
  <figcaption>Complete post publishing workflow</figcaption>
</figure>
```

Formats: MP4 (broad compatibility) or WebM (smaller files). Keep recordings under 30 seconds. For longer workflows, use multiple recordings or annotated screenshot sequences.

### 6.5 Image Processing

Hugo's built-in image processing for responsive screenshots:

```html
<!-- layouts/_default/_markup/render-image.html -->
{{ $img := .Page.Resources.GetMatch .Destination }}
{{ if $img }}
  {{ $resized := $img.Resize "1200x q85" }}
  <figure>
    <img src="{{ $resized.RelPermalink }}" 
         alt="{{ .Text }}" 
         loading="lazy"
         width="{{ $resized.Width }}"
         height="{{ $resized.Height }}">
    {{ with .Title }}<figcaption>{{ . }}</figcaption>{{ end }}
  </figure>
{{ else }}
  <img src="{{ .Destination }}" alt="{{ .Text }}">
{{ end }}
```

This automatically resizes screenshots to max 1200px width and compresses to quality 85 — keeps page loads fast without manual optimization.

---

## 7. Open Questions for User

1. **GitHub LFS**: Is Git LFS enabled on the docs repo? If not, it needs to be set up before user docs can store screenshots.

2. **Theme preference**: Should we evaluate specific Hugo themes in Phase 2, or build a minimal custom theme? Custom gives full control but takes longer.

3. **Deployment URL**: Should the user guide deploy to:
   - `tomkyser.github.io/docs-foreignpolicy-com/user-guide/` (subdirectory of dev wiki)
   - A separate GitHub Pages site
   - A custom domain

4. **WP Admin credentials**: The Playwright automation needs to log in to WP admin on `foreignpolicy.local`. How should credentials be provided? Environment variable? Config file? (Security consideration.)

5. **Content priority**: Which sections should be generated first? Suggestion: start with `getting-started/` and `content-management/` as they cover the most common user workflows.

6. **Existing user documentation**: Is there any existing user-facing documentation (Google Docs, Confluence, internal wiki) that should be incorporated or used as reference?

---

## 8. Phase 2 Implementation Roadmap

Based on these decisions, Phase 2 should:

1. **Set up Hugo infrastructure** in `user-guide/`:
   - `hugo.toml` with user-friendly theme
   - `go.mod` for Hugo modules
   - `.gitattributes` for Git LFS
   - GitHub Actions workflow for deployment

2. **Create page templates** and Hugo shortcodes:
   - Recording shortcode
   - Responsive image render hook
   - Base page templates for each content type

3. **Build generation pipeline** (fp-docs command):
   - New command: `/fp-docs:user-doc` or `/fp-docs:user-guide`
   - Integrates: code analysis → Playwright UI capture → Claude synthesis
   - Outputs: Hugo page bundle (index.md + screenshots)

4. **Generate pilot content**:
   - Start with `getting-started/` section (3-4 pages)
   - Validate the full pipeline end-to-end
   - Iterate on template and generation quality

---

*End of Phase 1 User Docs Strategy Report*
