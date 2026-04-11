---
command: ug-generate
engine: ug-writer
operation: ug-generate
workflow: workflows/ug-generate.md
agent: fp-docs-ug-writer
type: write
pipeline_stages: [ug-ui-verify, ug-screenshots, ug-tone, ug-completeness, ug-commit]
subcommands: none
flags: --type feature-guide|workflow-walkthrough|quick-start|reference|faq, --no-screenshots, --plan-only
---

# /fp-docs:ug-generate - Behavioral Specification

## Routing Path

1. User invokes `/fp-docs:ug-generate "feature or workflow to document" [--type <type>] [--no-screenshots] [--plan-only]`
2. Command file loads workflow `workflows/ug-generate.md` via `@-reference`
3. Workflow initializes via `fp-tools init write-op ug-generate`
4. Workflow spawns fp-docs-researcher for codebase analysis (admin menus, post types, form fields, capabilities)
5. Workflow spawns fp-docs-ug-writer for Write Phase (content creation + stages 1-2)
6. Workflow spawns fp-docs-ug-validator for Finalize Phase (stages 3-4)
7. Workflow handles stage 5 (changelog + commit) via orchestrator

## Pipeline Stages

User guide pipeline (5 stages, 2 phases):

- Stage 1: UI Behavior Verification — verify every documented nav path against live UI (Playwright) or code registrations (fallback)
- Stage 2: Screenshot Currency — verify all image references resolve to files, naming follows `{NN}-{slug}.png`, no orphan assets
- Stage 3: Jargon & Tone Check — scan page body for banned patterns (PHP/JS identifiers, dev jargon), respect allowed exceptions
- Stage 4: Completeness Check — verify all required sections present for content type, structural quality checks (step count, screenshot presence, table presence)
- Stage 5: Changelog + Commit — update `last_verified` frontmatter, commit to docs repo via `git -C {docs-root}`

## Expected Markers

- Pipeline completion: `Pipeline complete: [ui-verify: PASS] [screenshots: ...] [tone: ...] [completeness: ...] [commit: ...]`
- Changelog: `last_verified updated` or `frontmatter updated`
- Delegation: `delegation result` or `agents used`
- Git: `docs commit` or `committed to docs repo`

## Files Typically Touched

- New page bundle directory: `user-guide/content/{section}/{page-name}/`
- New page file: `user-guide/content/{section}/{page-name}/index.md`
- Screenshots: `user-guide/content/{section}/{page-name}/{NN}-{slug}.png` (if Playwright available and --no-screenshots not set)
- Section index: `user-guide/content/{section}/_index.md` (add link to new page)

## Error Paths

- Feature not found in codebase: researcher reports empty analysis, writer uses `[NEEDS VERIFICATION]` tags
- Playwright MCP unavailable: writer falls back to code-based verification, creates screenshot placeholders
- Invalid `--type` value: reports error with valid content types
- Target page already exists: reports conflict, suggests using `ug-update` instead
- Scaffold not bootstrapped: triggers auto-bootstrap from `scaffolds/user-guide/` before proceeding
- Template not found for content type: reports missing template in `scaffolds/user-guide/templates/`

## Edge Cases

- Generate with `--plan-only`: produces analysis and plan but does not write files
- Generate with `--no-screenshots`: skips Playwright capture, creates text-only page, sets `screenshot_count: 0`
- Generate with `--type`: overrides auto-detected content type
- Feature with no admin UI (e.g., shortcode-only): writer documents from content editor perspective, skips admin nav paths
- Feature spanning multiple admin screens: writer creates single page with multiple nav paths documented
- Generate when codebase root unavailable: can still create page from user-provided description, all UI paths marked `[NEEDS VERIFICATION]`
