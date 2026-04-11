---
command: ug-screenshot
engine: ug-writer
operation: ug-screenshot
workflow: workflows/ug-screenshot.md
agent: fp-docs-ug-writer
type: write
pipeline_stages: [ug-ui-verify, ug-screenshots, ug-tone, ug-completeness, ug-commit]
subcommands: none
flags: --all, --replace, --dry-run
---

# /fp-docs:ug-screenshot - Behavioral Specification

## Routing Path

1. User invokes `/fp-docs:ug-screenshot "page path" [--all] [--replace] [--dry-run]`
2. Command file loads workflow `workflows/ug-screenshot.md` via `@-reference`
3. Workflow initializes via `fp-tools init write-op ug-screenshot`
4. Workflow identifies target page bundle(s)
5. Workflow parses `index.md` for all image references
6. Workflow spawns fp-docs-ug-writer with Playwright MCP for screenshot capture (stages 1-2)
7. Workflow spawns fp-docs-ug-validator for Finalize Phase (stages 3-4)
8. Workflow handles stage 5 (frontmatter update + commit) via orchestrator

## Pipeline Stages

User guide pipeline (5 stages, 2 phases):

- Stage 1: UI Behavior Verification — navigate to each admin screen referenced by the page, verify screen loads and elements exist before capturing
- Stage 2: Screenshot Currency — capture fresh screenshots at configured viewport (1280x900), wait 2000ms after navigation, save with `{NN}-{slug}.png` naming, compare with existing files
- Stage 3: Jargon & Tone Check — runs on page content (not screenshots), typically passes since page text is not modified
- Stage 4: Completeness Check — verify page structure unchanged by screenshot operations
- Stage 5: Changelog + Commit — update `last_verified` and `screenshot_count` frontmatter, commit to docs repo

## Expected Markers

- Pipeline completion: `Pipeline complete: [ui-verify: PASS] [screenshots: ...] [tone: ...] [completeness: ...] [commit: ...]`
- Screenshot capture: `captured {N} screenshots` or `screenshots refreshed`
- Delegation: `delegation result` or `agents used`
- Git: `docs commit` or `committed to docs repo`

## Files Typically Touched

- Screenshots: `user-guide/content/{section}/{page-name}/{NN}-{slug}.png` (created or replaced)
- Page frontmatter: `user-guide/content/{section}/{page-name}/index.md` (last_verified + screenshot_count updated)

## Error Paths

- Playwright MCP unavailable: reports error — this command requires Playwright for screenshot capture, cannot fall back to code-based verification
- Target page not found: reports error with valid page paths
- Admin screen fails to load (404, permission error): reports BROKEN path per screenshot, continues with remaining screens
- Navigation path changed: reports STALE path, captures screenshot of current state with warning

## Edge Cases

- Screenshot with `--dry-run`: navigates and verifies screens but does not save files, reports what would be captured
- Screenshot with `--replace`: always overwrites existing screenshots, even if UI appears unchanged
- Screenshot with `--all`: processes every page in `user-guide/content/` that has image references
- Screenshot without `--replace`: only replaces screenshots where the UI has visibly changed (comparison left to writer agent)
- Page with no image references: skips capture, reports no screenshots to take
- Page with broken image references (file missing): captures and creates the missing file
- Sensitive data in admin screen: writer must blur/crop before saving (per ug-standards.md capture rules)
- Multiple pages with `--all`: processes sequentially, reuses Playwright session for efficiency
