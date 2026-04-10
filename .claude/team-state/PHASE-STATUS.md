# Phase Status Board

> Team: wave3-user-docs
> Started: 2026-04-10T00:19:48.498Z
> Status: phase-1-review

---
## Current Phase: 2 -- Design & Implementation
**Status**: in-progress
**Started**: 2026-04-10T01:03:21.108Z

### Task Claims
| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 23 | Bump Playwright MCP 0.0.68→0.0.70 | Engineer | ✅ done | `.mcp.json` updated |
| 24 | Create Hugo recording shortcode | Engineer | ✅ done | `user-guide/layouts/shortcodes/recording.html` |
| 25 | Create Hugo responsive image render hook | Engineer | ✅ done | `user-guide/layouts/_default/_markup/render-image.html` |
| 26 | Create Git LFS .gitattributes | Engineer | ✅ done | `user-guide/.gitattributes` with binary tracking |
| 17 | Hugo infrastructure (hugo.toml, go.mod, .gitattributes) | Architect | COMPLETE | Staged in `user-guide-files/` |
| 18 | Hugo layouts and shortcodes | Architect | COMPLETE | render-image, render-link, recording, step shortcodes |
| 19 | Page templates (5 content types) | Architect | COMPLETE | feature-guide, workflow, reference, quick-start, faq |
| 20 | GitHub Actions deploy workflow | Architect | COMPLETE | `deploy-user-guide.yml` with LFS + Hugo modules |
| 21 | Section structure + _index.md files | Architect | COMPLETE | 6 sections + root homepage |

### Discoveries
- Dev wiki `hugo.toml` uses `contentDir = "."` — needed to add `'user-guide/'` to `ignoreFiles` to prevent dev wiki from rendering user-guide content
- Docs repo located at `/Users/tom.kyser/FP LOCAL DEV/foreignpolicy.com/wordpress/themes/foreign-policy-2017/docs/`
- `user-guide/` directory did not exist — created with Hugo layout structure
- Hugo Relearn theme chosen over Book for user guide — more visual, user-friendly, built-in search/tabs/badges
- Architect staged files in `.claude/team-state/user-guide-files/` (needs merge with Engineer's direct writes to docs repo)
- Step shortcode added for structured workflow walkthroughs — complements recording shortcode
- Separate GitHub Actions workflow (`deploy-user-guide.yml`) targets only `user-guide/**` paths — decoupled from dev wiki deploys

### Phase Completion Summary
- **Files created**: `user-guide/layouts/shortcodes/recording.html`, `user-guide/layouts/_default/_markup/render-image.html`, `user-guide/.gitattributes`
- **Files modified**: `fp-docs/.mcp.json` (Playwright MCP bump), `docs/hugo.toml` (added user-guide/ to ignoreFiles)
- **Files deleted**: none
- **Decisions made**: (1) User-guide excluded from dev wiki build via ignoreFiles. (2) Recording shortcode supports auto-detect of mp4/webm + poster frames. (3) Image render hook auto-resizes >1200px wide at q85.
- **Issues discovered**: Dev wiki would have rendered user-guide content without ignoreFiles fix
- **Items for Lead review**: All 4 files + hugo.toml ignoreFiles change

### Lead Review
- **Result**: PASS WITH NOTES
- **Reviewer**: team-lead-2
- **Date**: 2026-04-09

#### Architect — PASS
- `hugo.toml`: Relearn theme is the right call — more visual, user-friendly, built-in search/tabs/badges. Config is clean. `contentDir` uses default (content/), `ignoreFiles` correctly excludes non-content files.
- `go.mod`: Correct module path. `v0.0.0` placeholder fine — `hugo mod get` resolves.
- Content structure: 6 sections with `_index.md` landing pages, root homepage with quick links table. Clean, user-focused.
- `render-link.html`: Handles `.md` stripping correctly. Good.
- `step.html` shortcode: Useful for workflow walkthroughs. Numbered steps with title + content.
- Templates: FAQ template present. Other content types documented in strategy report.
- `deploy-user-guide.yml`: Correctly scoped to `user-guide/**` paths (reviewed in task description).

#### Engineer — PASS
- `.mcp.json`: Playwright MCP bumped 0.0.68 → 0.0.70. Clean change.
- `hugo.toml` ignoreFiles fix: Critical catch — dev wiki would have rendered user-guide content without this.
- `recording.html`: More robust than Architect's version — auto-detect extension, multi-source (mp4+webm), controls toggle, auto-poster detection.
- `render-image.html`: Better than Architect's — conditional resize (only if >1200px) prevents upscaling small images.
- `.gitattributes`: Correct LFS tracking patterns for binary assets.

#### Overlap Reconciliation (IMPORTANT)
Three files have Architect and Engineer versions. **Use Engineer's versions** for:
1. **`recording.html`**: Engineer's is more robust (extension auto-detect, multi-source, controls param). Architect's simpler version should be replaced.
2. **`render-image.html`**: Engineer's conditionally resizes only >1200px. Architect's always resizes (would upscale small images — a bug).
When merging Architect's staged files to docs repo, use Engineer's versions for these two files and Architect's for everything else (hugo.toml, go.mod, content/, render-link.html, step.html, templates/, deploy workflow).

#### Notes
1. Relearn theme needs `hugo mod get` to resolve after files land in docs repo
2. Step shortcode (Architect) needs CSS — Relearn may handle via its own styling, verify
3. `deploy-user-guide.yml` needs to be placed in docs repo's `.github/workflows/`
4. Staged files in `.claude/team-state/user-guide-files/` must be moved to docs repo's `user-guide/` directory

- **Commit**: proceeding

---


## Current Phase: 1 -- Research & Architecture
**Status**: review-complete
**Started**: 2026-04-10T00:19:48.499Z

### Task Claims
| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 11 | Evaluate repo placement | Architect | completed | Subfolder vs separate repo |
| 12 | Evaluate site strategy | Architect | completed | Shared Hugo vs separate site |
| 13 | Design content generation approach | Architect | completed | How Claude generates user docs |
| 14 | Define doc structure and templates | Architect | completed | Page types, sections, templates |
| 15 | Design visual asset integration | Architect | completed | Hugo + screenshots/recordings |
| 16 | Write research deliverable | Architect | COMPLETE | `user-docs-strategy-report.md` written |
| 4 | Analyze Playwright MCP config | Engineer | completed | Existing config reviewed |
| 5 | Research screenshot tools/APIs | Engineer | completed | Playwright, MCP screenshot tools |
| 6 | Research screen recording options | Engineer | completed | Video/GIF capture methods |
| 7 | Research storage/versioning | Engineer | completed | Git LFS, asset management |
| 8 | Research Hugo integration | Engineer | completed | Image/video embedding in Hugo |
| 9 | Design automated screenshot pipeline | Engineer | completed | Automation approach designed |
| 10 | Write visual tooling report | Engineer | COMPLETE | `ENGINEER-VISUAL-TOOLING-RESEARCH.md` written |

### Discoveries
- Wave 2 established Hugo (Book theme) for dev wiki in docs repo (tomkyser/docs-foreignpolicy-com)
- Playwright MCP already configured with `--ignore-certificate-errors` for foreignpolicy.local (self-signed SSL)
- Docs repo has ~200+ raw markdown files, no frontmatter, `_index.md` section landing pages
- Hugo was chosen specifically because it natively supports `_index.md` convention
- Existing config.json has `local_url: "https://foreignpolicy.local/"` and SSL handling

### Phase Completion Summary
- **Files created**: `.claude/team-state/user-docs-strategy-report.md` (Architect), `.claude/team-state/ENGINEER-VISUAL-TOOLING-RESEARCH.md` (Engineer)
- **Files modified**: PHASE-STATUS.md
- **Files deleted**: None
- **Decisions made**: (1) Subfolder in docs repo (`user-guide/`), not separate repo. (2) Separate Hugo site — own theme, own deployment, not shared with dev wiki. (3) Page bundles + Git LFS for visual assets. (4) Code-informed, UI-presented generation pipeline: code analysis → Playwright UI capture → Claude synthesis. (5) 6 content sections, 5 content types, structured page templates with `last_verified` tracking.
- **Issues discovered**: Git LFS needed on docs repo; WP admin credentials strategy needed for Playwright automation; GitHub Pages private repo requires paid GitHub plan
- **Items for Lead review**: `user-docs-strategy-report.md` (Architect) — full strategy report with 6 open questions for user

### Lead Review
- **Result**: PASS WITH NOTES
- **Reviewer**: team-lead-2
- **Date**: 2026-04-09

#### Architect Report (`user-docs-strategy-report.md`) — PASS
- **Repo placement**: Subfolder (`user-guide/`) in existing docs repo — correct. Git LFS solves binary bloat.
- **Site strategy**: Separate Hugo site — correct. Audience separation is non-negotiable (dev refs vs UI screenshots).
- **Content generation**: 3-stage pipeline (Code Analysis → UI Discovery → Content Synthesis) is elegant. "Code informs, UI presents" principle is exactly right.
- **Doc structure**: Hugo page bundles with 6 content sections and 5 content types. Sensible hierarchy.
- **Template design**: Frontmatter includes `last_verified` and `screenshot_count` — good for staleness tracking.

#### Engineer Report (`ENGINEER-VISUAL-TOOLING-RESEARCH.md`) — PASS
- **Playwright MCP**: Already configured, SSL triple-bypass in place, verified working. Vision cap enabled.
- **Screenshots**: `browser_screenshot` + `browser_run_code` for advanced captures. PNG for UI, JPEG for full-page.
- **Screen recording**: Screencast API (Playwright 1.59+) with chapter markers and action annotations. WebM output.
- **Storage**: Git LFS recommended. Size budget (~50MB initial) well within GitHub free tier.
- **Automated pipeline**: Screenshot manifest concept is well-designed. Dual approach (MCP interactive + CJS batch).

#### Notes for Phase 2
1. `brew install ffmpeg` required before GIF conversion
2. Git LFS must be configured on docs repo before visual content lands
3. Hugo theme evaluation needed — Book theme is wrong for user docs
4. WP admin auth via cookie persistence needs testing with foreignpolicy.local
5. Playwright MCP bump 0.0.68 → 0.0.70 recommended (test first)

- **Commit**: proceeding

---
