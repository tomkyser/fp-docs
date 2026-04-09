# Dev Wiki Research Report — Phase 1

> **Author**: Architect (team-architect)
> **Date**: 2026-04-09
> **Status**: Complete
> **Scope**: Evaluate static site generators for auto-generated developer wiki from docs repo

---

## 1. Requirements Summary

| Requirement | Weight | Notes |
|---|---|---|
| GitHub Pages deployment | Must-have | Docs repo is on GitHub (tomkyser/docs-foreignpolicy-com) |
| Raw markdown sourcing | Must-have | ~200+ existing .md files, no frontmatter |
| Auto-update on push | Must-have | GitHub Actions CI/CD on docs repo |
| Good UI/UX | High | Navigation, search, dark mode, responsive |
| Minimal maintenance | High | Team doesn't want to manage a build system |
| `_index.md` support | High | Docs use `_index.md` as section landing pages |
| Numbered directory ordering | High | Dirs named `00-getting-started/` through `23-htmx/` |
| Relative `.md` link handling | High | Links like `../06-helpers/posts.md`, `../02-post-types/_index.md` |
| Nested subdirectories | Medium | Up to 3 levels deep (e.g., `09-api/custom-endpoints/`) |
| No runtime dependencies | Nice | Fewer moving parts = less maintenance |

## 2. Docs Repo Structure Analysis

```
docs-foreignpolicy-com/
├── About.md                    # Root landing page / TOC
├── 00-getting-started/         # 5 files
├── 01-architecture/            # 6 files
├── 02-post-types/              # 21 files + _index.md
│   ...
├── 23-htmx/                    # 3 files + _index.md
├── appendices/                 # 7 files (A-G)
├── changelog.md
├── FLAGGED CONCERNS/           # Internal tracking (exclude from wiki)
├── claude-code-docs-system/    # Internal tracking (exclude from wiki)
├── diffs/                      # Internal tracking (exclude from wiki)
└── needs-revision-tracker.md   # Internal tracking (exclude from wiki)
```

**Key observations**:
- 24 numbered sections + appendices = well-organized, hierarchical content
- `_index.md` files in each numbered directory serve as section landing pages
- No YAML frontmatter in docs — just raw markdown with `# Heading` at top
- Relative links use `../` with `.md` extensions (e.g., `../06-helpers/posts.md`)
- Some links reference `_index.md` explicitly (e.g., `../02-post-types/_index.md`)
- Nested subdirectories: `04-custom-fields/field-groups/`, `08-hooks/actions/`, `09-api/custom-endpoints/`, `17-frontend-assets/javascript/`, `17-frontend-assets/styles/`
- Internal/transient files (FLAGGED CONCERNS, diffs, claude-code-docs-system, needs-revision-tracker) should be excluded from the wiki
- `About.md` at root is a comprehensive TOC with tables linking to every document

## 3. Candidate Evaluation

### 3.1 Hugo

| Criterion | Score | Details |
|---|---|---|
| `_index.md` support | **Native** | Hugo uses `_index.md` as its section landing page convention — exact match |
| Numbered directories | **Excellent** | `weight` in front matter or filename-based ordering; can strip prefixes via URL config |
| Relative links | Good | Handles `../` links; may need `relref` shortcode for full robustness |
| GitHub Pages | Good | Via GitHub Actions (not native like Jekyll, but well-documented) |
| Search | Good | Client-side search via themes (Docsy, Book) or Pagefind/Lunr |
| UI/UX | **Excellent** | Docsy theme (Google's docs standard), Book theme (Gitbook-like), Geekdoc |
| Build speed | **Fastest** | ~200 files builds in <1 second |
| Maintenance | Low | Single binary, no runtime dependencies, Go-based |
| Frontmatter-free | Moderate | Works without frontmatter but ordering/titles default to filename |
| Link rewriting | Moderate | `_index.md` links work natively; `.md` extension links configurable |

**Key advantage**: Hugo is the ONLY SSG that natively uses `_index.md` for section pages. This means zero renaming of existing files.

**Key concern**: Relative links to `.md` files (e.g., `../06-helpers/posts.md`) need `markup.goldmark.extensions.linkify` or custom render hook to strip `.md` from URLs. Solvable with a 5-line render hook template.

### 3.2 MkDocs + Material Theme

| Criterion | Score | Details |
|---|---|---|
| `_index.md` support | **Poor** | MkDocs expects `index.md`, not `_index.md`. Requires renaming ALL section files or a plugin |
| Numbered directories | Good | `awesome-pages` plugin handles ordering; can strip number prefixes via config |
| Relative links | Good | Handles relative `.md` links natively |
| GitHub Pages | **Excellent** | `mkdocs gh-deploy` or GitHub Actions — very well documented |
| Search | **Excellent** | Built-in search with code block search, offline support |
| UI/UX | **Excellent** | Material theme is best-in-class: dark mode, navigation tabs, TOC, code highlighting |
| Build speed | Good | Python-based, ~200 files in seconds |
| Maintenance | Low-Medium | Requires Python + pip (can be Docker-ized in Actions) |
| Frontmatter-free | Good | Infers titles from first `# Heading` |
| Link rewriting | Good | `.md` links converted to HTML links automatically |

**Key advantage**: Best UI/UX out of the box. Material theme is the gold standard for developer docs.

**Key concern**: `_index.md` → `index.md` renaming. Every section landing page would need to be renamed, AND every internal link referencing `_index.md` would need updating. This is a one-time migration but affects ~20+ files plus their inbound links.

### 3.3 Jekyll + Just the Docs

| Criterion | Score | Details |
|---|---|---|
| `_index.md` support | **Poor** | Jekyll uses `index.md`. Same renaming problem as MkDocs |
| Numbered directories | Poor | Numbers appear in URLs unless custom permalinks configured per-file (frontmatter required) |
| Relative links | Moderate | Works but `.md` extension handling is inconsistent |
| GitHub Pages | **Native** | Zero-config deployment, built into GitHub Pages |
| Search | Good | Just the Docs has built-in Lunr.js search |
| UI/UX | Good | Clean, functional, but less polished than Material |
| Build speed | **Slow** | Ruby-based, ~200 files takes seconds to tens of seconds |
| Maintenance | Medium | Ruby + Bundler dependency; version pinning headaches |
| Frontmatter-free | **Poor** | Requires `title`, `nav_order`, `parent` in every file for proper navigation |
| Link rewriting | Poor | Relative `.md` links don't auto-convert |

**Key concern**: Jekyll requires YAML frontmatter in EVERY file for navigation ordering. Adding `nav_order` and `parent` to 200+ files is a major migration effort. The docs currently have zero frontmatter.

### 3.4 Docusaurus

| Criterion | Score | Details |
|---|---|---|
| `_index.md` support | **Poor** | Uses `_category_.json` for sections, not `_index.md` |
| Numbered directories | Good | Supports number-prefixed directories for ordering natively |
| Relative links | Good | Handles relative `.md` links well |
| GitHub Pages | Good | Official deployment guide, requires Node.js build in Actions |
| Search | Good | Algolia (free for OSS) or local search plugins |
| UI/UX | Excellent | Modern React-based UI, versioning, i18n |
| Build speed | Moderate | Node.js/React build, heavier than Hugo/MkDocs |
| Maintenance | **High** | Node.js + React + npm dependencies. Regular updates needed |
| Frontmatter-free | Good | Infers from headings, numbered dirs handle ordering |
| Link rewriting | Good | `.md` links auto-converted |

**Key concern**: Heaviest option. Full Node.js/React build pipeline. Over-engineered for a private docs repo that doesn't need versioning or i18n. `_category_.json` files needed per directory.

### 3.5 VitePress

| Criterion | Score | Details |
|---|---|---|
| `_index.md` support | **Poor** | Uses `index.md`, not `_index.md` |
| Numbered directories | Moderate | Requires plugin (vitepress-sidebar) for auto-generation |
| Relative links | Good | Handles relative `.md` links |
| GitHub Pages | Good | Via GitHub Actions, well-documented |
| Search | Good | Built-in local search (MiniSearch) |
| UI/UX | Excellent | Clean Vue-based UI, fast |
| Build speed | **Excellent** | Vite-powered, very fast |
| Maintenance | Medium | Node.js + Vue ecosystem |
| Frontmatter-free | Good | Infers titles from headings |
| Link rewriting | Good | `.md` links auto-converted |

**Key concern**: No native sidebar generation — requires third-party plugin. `_index.md` renaming needed. Smaller ecosystem than MkDocs or Hugo for docs-specific use cases.

### 3.6 mdBook

| Criterion | Score | Details |
|---|---|---|
| `_index.md` support | N/A | Uses `SUMMARY.md` for all navigation — fundamentally different model |
| Numbered directories | N/A | Ignores directory structure; relies on `SUMMARY.md` |
| GitHub Pages | Good | Simple static output |
| Search | Good | Built-in |
| UI/UX | Moderate | Gitbook-style, functional but dated |
| Build speed | Fast | Rust-based |
| Maintenance | Low | Single binary |

**Key concern**: Requires manually maintaining a `SUMMARY.md` table of contents for 200+ files. Every new doc means editing SUMMARY.md. Not viable for auto-generation from raw markdown.

## 4. Comparison Matrix

| Criterion | Hugo | MkDocs Material | Jekyll JTD | Docusaurus | VitePress | mdBook |
|---|---|---|---|---|---|---|
| `_index.md` native | **YES** | no | no | no | no | N/A |
| No frontmatter needed | mostly | **yes** | **no** | mostly | yes | N/A |
| Numbered dir ordering | **yes** | plugin | poor | **yes** | plugin | N/A |
| Relative `.md` links | hook | **native** | poor | **native** | **native** | N/A |
| GitHub Pages ease | good | **excellent** | **native** | good | good | good |
| Search quality | good | **excellent** | good | good | good | good |
| UI/UX quality | **excellent** | **excellent** | good | excellent | excellent | moderate |
| Build speed | **<1s** | seconds | slow | moderate | fast | fast |
| Maintenance burden | **low** | low-med | medium | **high** | medium | low |
| Migration effort | **minimal** | moderate | **heavy** | moderate | moderate | heavy |

## 5. Recommendation

### Winner: Hugo with Book or Docsy Theme

**Hugo is the clear choice** for this docs repo. The decisive factor is **native `_index.md` support** — Hugo is the only SSG where the existing docs structure works with zero file renaming.

#### Why Hugo wins:

1. **Zero file migration**: The docs already use `_index.md` for section pages. Hugo expects this exact convention. Every other SSG requires renaming these to `index.md` and updating all links that reference them.

2. **Fastest builds**: <1 second for ~200 files. Important for CI/CD pipeline speed.

3. **No runtime dependencies**: Single Go binary. No Python, Ruby, or Node.js to manage in CI.

4. **Excellent docs themes**: Hugo Book (Gitbook-style, clean) or Docsy (Google's docs standard, full-featured).

5. **Minimal maintenance**: Binary download in Actions, no `npm install` or `pip install` step.

#### What needs solving:

1. **Relative `.md` link rewriting**: Internal links like `../06-helpers/posts.md` need `.md` stripped in HTML output. Solved with a render hook template (~5 lines of Go template):
   ```
   layouts/_default/_markup/render-link.html
   ```

2. **Number prefix stripping** (optional): URLs like `/02-post-types/post/` can optionally have `02-` stripped via `url` front matter or a URL-cleaning config. Or keep the numbers — they provide useful ordering context in URLs.

3. **Exclude internal dirs**: `FLAGGED CONCERNS/`, `claude-code-docs-system/`, `diffs/`, `needs-revision-tracker.md` should be excluded via `.hugo.toml` `ignoreFiles` config.

4. **About.md as homepage**: Map `About.md` to `_index.md` at root (Hugo's homepage), or create a lightweight `_index.md` that redirects/includes it.

### Runner-up: MkDocs + Material

If the user values UI/UX above all else and is willing to do a one-time file rename migration (`_index.md` → `index.md`), MkDocs Material is the second choice. Its search and Material theme are best-in-class. But the migration cost tips the scale toward Hugo.

## 6. Proposed Implementation Architecture

### 6.1 Files to Add to Docs Repo

```
docs-foreignpolicy-com/
├── hugo.toml                           # Hugo configuration
├── .github/
│   └── workflows/
│       └── deploy-wiki.yml             # GitHub Actions workflow
├── layouts/
│   └── _default/
│       └── _markup/
│           └── render-link.html        # .md link rewriting hook
├── themes/                             # Git submodule or Hugo module
│   └── hugo-book/                      # (or docsy)
└── [existing docs unchanged]
```

### 6.2 Hugo Configuration (`hugo.toml`)

```toml
baseURL = "https://tomkyser.github.io/docs-foreignpolicy-com/"
languageCode = "en-us"
title = "Foreign Policy Theme — Developer Docs"
theme = "hugo-book"

[params]
  BookSection = "/"
  BookToC = true
  BookSearch = true

[markup.goldmark.renderer]
  unsafe = true    # Allow raw HTML in markdown if present

# Exclude internal/transient directories
ignoreFiles = [
  "FLAGGED CONCERNS/",
  "claude-code-docs-system/",
  "diffs/",
  "needs-revision-tracker\\.md"
]

[menu]
  # Top-level navigation auto-generated from section structure
```

### 6.3 GitHub Actions Workflow

```yaml
name: Deploy Wiki to GitHub Pages

on:
  push:
    branches: [main, master]
  workflow_dispatch:  # Manual trigger

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: true  # If theme is a submodule
          fetch-depth: 0

      - name: Setup Hugo
        uses: peaceiris/actions-hugo@v3
        with:
          hugo-version: 'latest'
          extended: true

      - name: Build
        run: hugo --minify

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./public

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### 6.4 Render Hook for `.md` Link Rewriting

```html
<!-- layouts/_default/_markup/render-link.html -->
{{- $url := .Destination -}}
{{- if strings.HasSuffix $url ".md" -}}
  {{- $url = strings.TrimSuffix ".md" $url -}}
  {{- $url = printf "%s/" $url -}}
{{- end -}}
<a href="{{ $url | safeURL }}"{{ with .Title }} title="{{ . }}"{{ end }}>
  {{- .Text | safeHTML -}}
</a>
```

### 6.5 Exclusion Directories

These should be excluded from the wiki build (internal fp-docs tooling artifacts):
- `FLAGGED CONCERNS/` — internal issue tracking
- `claude-code-docs-system/` — fp-docs plugin metadata
- `diffs/` — diff reports from documentation operations
- `needs-revision-tracker.md` — internal revision tracking
- `.fp-docs-branch/` — fp-docs branch-scoped data (Wave 1)

## 7. Implementation Steps (Phase 2)

1. **Add Hugo config** (`hugo.toml`) to docs repo
2. **Add theme** as Hugo module or git submodule (hugo-book recommended)
3. **Add render hook** for `.md` link rewriting
4. **Create root `_index.md`** (or configure `About.md` as homepage)
5. **Add `.github/workflows/deploy-wiki.yml`**
6. **Enable GitHub Pages** on the docs repo (Settings → Pages → Source: GitHub Actions)
7. **Test locally** with `hugo server` before pushing
8. **Push and verify** automated deployment

## 8. Open Questions for User

1. **Theme preference**: Hugo Book (clean, Gitbook-style) vs Docsy (full-featured, Google-style) vs Geekdoc (modern, minimal)?
2. **URL style**: Keep number prefixes in URLs (`/02-post-types/post/`) or strip them (`/post-types/post/`)?
3. **Custom domain**: Use default `tomkyser.github.io/docs-foreignpolicy-com/` or a custom domain?
4. **Access control**: Docs repo is private — GitHub Pages on private repos requires GitHub Pro/Team/Enterprise. Is this available?
5. **Search**: Built-in Hugo search sufficient, or want Pagefind/Algolia integration?

---

*End of Phase 1 Wiki Research Report*
