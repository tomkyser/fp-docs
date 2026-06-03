---
command: ug-preview
engine: system
operation: ug-preview
workflow: workflows/ug-preview.md
agent: fp-docs-system
type: admin
pipeline_stages: none
subcommands: none
flags: --local, --deploy, --stop
---

# /fp-docs:ug-preview - Behavioral Specification

## Routing Path

1. User invokes `/fp-docs:ug-preview [--local] [--deploy] [--stop]`
2. Command file loads workflow `workflows/ug-preview.md` via `@-reference`
3. Workflow initializes via `fp-tools init admin-op`
4. Workflow verifies user-guide scaffold exists (auto-bootstraps if missing)
5. Workflow spawns fp-docs-system for preview execution
6. No pipeline triggered -- admin operation with direct execution

## Pipeline Stages

None. Admin operations execute directly without the pipeline.

## Expected Markers

- No `Pipeline complete:` marker (admin operation)
- Server start: `Hugo server running at http://localhost:{port}/` (for --local)
- Deploy trigger: `Workflow triggered: deploy-user-guide-preview.yml` (for --deploy)
- Server stop: `Hugo server stopped` (for --stop)

## Files Typically Touched

- No documentation files modified
- Hugo may generate files in `user-guide/public/` (gitignored, ephemeral build output)

## Error Paths

- Hugo not installed: reports error with installation instructions
- User-guide scaffold missing: triggers auto-bootstrap from `scaffolds/user-guide/`, then proceeds
- Port already in use (--local): reports conflict, suggests alternate port or --stop first
- `gh` CLI not available (--deploy): reports error, suggests installing GitHub CLI
- Deploy workflow file not found in repo: reports missing `.github/workflows/deploy-user-guide-preview.yml`
- No content pages exist: Hugo starts but serves empty site, warns user

## Edge Cases

- Preview with no flags (default --local): starts Hugo dev server in background, reports URL
- Preview with --local: starts `hugo server` from `{docs-root}/user-guide/` in background
- Preview with --deploy: triggers `deploy-user-guide-preview.yml` workflow via `gh workflow run`
- Preview with --stop: finds and kills running Hugo server process
- Preview with --stop when no server running: reports no server found, exits cleanly
- Preview with --local when server already running: reports existing server URL, does not start duplicate
- Preview after scaffold bootstrap: scaffold includes Hugo config, server starts with default theme (Relearn)
