---
command: ug-validate
engine: ug-validator
operation: ug-validate
workflow: workflows/ug-validate.md
agent: fp-docs-ug-validator
type: read
pipeline_stages: none
subcommands: none
flags: --depth quick|standard|deep, --all, --no-tone-check
---

# /fp-docs:ug-validate - Behavioral Specification

## Routing Path

1. User invokes `/fp-docs:ug-validate "page path or section" [--depth quick|standard|deep] [--all]`
2. Command file loads workflow `workflows/ug-validate.md` via `@-reference`
3. Workflow initializes via `fp-tools init read-op`
4. Workflow spawns fp-docs-ug-validator with references: ug-standards.md, ug-validation-rules.md, fp-project.md
5. No pipeline stages triggered -- read operations skip full pipeline

## Pipeline Stages

None. Read operations use the fast path. However, the agent internally runs the 4 user guide validation checks in order:
- Stage 1: UI Path Verification (Playwright or code trace)
- Stage 2: Screenshot Currency (staleness + file integrity)
- Stage 3: Jargon & Tone (banned pattern scan, skippable with `--no-tone-check`)
- Stage 4: Completeness (required sections per content type)

## Expected Markers

- No `Pipeline complete:` marker (read operations skip full pipeline)
- No `changelog updated` marker
- Agents used marker: `2 agents used` (orchestrator + ug-validator)

## Files Typically Touched

- No files modified (read-only operation)
- Reads target `user-guide/content/{section}/{page}/index.md` files
- Reads source files referenced in `source_features` frontmatter
- Checks screenshot file existence in page bundle directories

## Error Paths

- Target resolves to no pages: agent reports empty scope
- Page missing `content_type` frontmatter: agent reports frontmatter validation error
- Source file in `source_features` not found: agent classifies as UNKNOWN (cannot check staleness)
- Playwright MCP unavailable for `--depth deep`: falls back to code-based verification, notes degraded confidence

## Edge Cases

- Validate with `--depth quick`: frontmatter + completeness only (stages 3-4), skips UI and screenshot checks
- Validate with `--depth deep`: all 4 stages with Playwright MCP when available
- Validate with `--all`: runs against every page in `user-guide/content/`
- Validate with `--no-tone-check`: skips stage 3 jargon scan
- Page with `screenshot_count: 0` and no images: screenshot currency passes (no references to break)
- Page with stale `last_verified` but no source changes: classified as AGE STALE (LOW severity)
- User guide scaffold not bootstrapped: agent reports no content to validate
