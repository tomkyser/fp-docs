# Retrospective: wave3-user-docs

> Date: 2026-04-10T01:09:39.199Z
> Duration: 49m
> Phases completed: 2

## What Went Well
- Playwright MCP already configured — saved significant research time
- Screencast API (1.59) discovery was a bonus capability not originally expected
- Hugo Relearn theme selection aligns with user's "different look" preference — good audience separation from dev wiki
- Parallel research (docs strategy + visual tooling) produced complementary findings with zero blocking
- Reports persisted to disk (lesson from Wave 2 applied)

## What Could Improve
- Engineer's Phase 1 report almost didn't get written to disk — write deliverables incrementally, not at the end
- Architect and Engineer created overlapping files (recording shortcode, render-image hook, .gitattributes) — coordinate file ownership before implementation
- 6 open questions should have been surfaced earlier — user answers came late, blocking Architect
- Lead hit 99% context — waves with heavy research exhaust context fast. Consider /compact between phases

## Patterns Discovered
- Separate Hugo builds for different audiences (dev vs user) is cleaner than shared site with sections
- Hugo Relearn for non-technical users, Hugo Book for developers — audience-appropriate theming
- `contentDir = "."` in dev wiki means new subdirectories get rendered unless explicitly excluded in `ignoreFiles`
- Page bundles (content co-located with screenshots) are the right Hugo pattern for visual docs
- Manifest-driven capture pipeline (MCP primary, CJS fallback) provides both interactive and batch capabilities

## Labor Division Notes
- Architect: Docs strategy research, Hugo Relearn config, 5 templates, 8 content stubs, CI/CD workflow, render hooks
- Engineer: Playwright MCP research, Screencast API discovery, video shortcode, image render hook, Git LFS setup, MCP version bump
- Lead: Phase 1+2 reviews, file overlap reconciliation, two commits
- Overlap zone: both created recording shortcode and render-image hook independently — Engineer's versions preferred

## Gotchas for Next Time
- Dev wiki's `contentDir = "."` silently renders user-guide content unless `ignoreFiles` updated — always check existing Hugo config scope
- Git LFS needs user buy-in before setup (storage/bandwidth implications on GitHub plan)
- WP admin auth for Playwright should reference codebase CLAUDE.md, not hardcode credentials
- Hugo module themes require Go in CI (same gotcha as Wave 2 — must have `setup-go` in Actions)
- Content priority is user-driven — don't implement content generation without user's plan

## Metrics
| Phase | Review Result | Notes |
|-------|---------------|-------|
| 1: Research & Architecture | PASS WITH NOTES | Docs strategy + visual tooling research |
| 2: Design & Implementation | PASS WITH NOTES | 20 Architect files + 5 Engineer files, overlap reconciled |

**Totals:** 1 workstream (L), ~25 files created, Hugo Relearn user docs site scaffolded, Playwright visual tooling ready
