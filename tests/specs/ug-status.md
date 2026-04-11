---
command: ug-status
engine: ug-validator
operation: ug-status
workflow: workflows/ug-status.md
agent: fp-docs-ug-validator
type: read
pipeline_stages: none
subcommands: none
flags: --verbose
---

# /fp-docs:ug-status - Behavioral Specification

## Routing Path

1. User invokes `/fp-docs:ug-status [--verbose]`
2. Command file loads workflow `workflows/ug-status.md` via `@-reference`
3. Workflow initializes via `fp-tools init read-op`
4. Workflow spawns fp-docs-ug-validator with references: ug-standards.md, ug-validation-rules.md, fp-project.md
5. No pipeline stages triggered -- read operations skip full pipeline

## Pipeline Stages

None. Read operations use the fast path. The agent collects health metrics:
1. Verify user-guide scaffold exists in docs root
2. Count pages, screenshots, and content types used
3. Report `last_verified` statistics (oldest, newest, average age, pages exceeding staleness threshold)
4. Report coverage percentage (documented features / total user-visible features) if codebase available
5. Report section breakdown (page count per section)

## Expected Markers

- No `Pipeline complete:` marker (read operations skip full pipeline)
- No `changelog updated` marker
- Agents used marker: `2 agents used` (orchestrator + ug-validator)

## Files Typically Touched

- No files modified (read-only operation)
- Reads all `user-guide/content/**/_index.md` and `user-guide/content/**/index.md` files
- Reads `last_verified` and `content_type` frontmatter from each page
- Counts screenshot files in page bundle directories

## Error Paths

- User guide scaffold not bootstrapped: agent reports scaffold missing, suggests running ug-generate or bootstrap
- Codebase root unavailable: agent reports coverage percentage as unavailable, still reports page metrics
- Page with missing or invalid frontmatter: counted but flagged in structural health section

## Edge Cases

- Status with `--verbose`: includes per-page detail (title, content type, last_verified, screenshot count)
- Status without `--verbose`: summary metrics only
- Empty user guide (scaffold exists but no pages): reports 0 pages, 0 coverage, scaffold healthy
- All pages current (within staleness threshold): reports 100% freshness
- Mixed freshness: groups pages by staleness band (current, approaching stale, stale)
- Section with `_index.md` but no child pages: flagged as empty section in structural health
