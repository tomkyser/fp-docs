<purpose>
Report user guide health metrics. Produces a dashboard-style summary of the user guide
state: page counts, screenshot inventory, coverage percentage, staleness statistics, and
structural health. Read-only operation — no files are modified. Delegates to the
fp-docs-ug-validator agent for data collection.
</purpose>

<required_reading>
DO NOT read reference files yourself. Each step below specifies which files
its specialist agent will read via files_to_read. You are a dispatcher — pass
arguments and results between steps, nothing more.
</required_reading>

<process>

<step name="initialize" priority="first">
## 1. Initialize
```bash
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init read-op ug-status "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```
Parse JSON for: operation, agent, target_scope, validation_config, feature_flags.

Check for flags:
- `--verbose`: Include per-page detail in the report
</step>

<step name="execute">
## 2. Collect Health Metrics
```bash
VALIDATOR_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-ug-validator --raw)
```
Spawn validator agent:
```
Agent(
  prompt="Execute ug-status operation -- health metrics report.
    Verbose: {true if --verbose flag, false otherwise}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/ug-validation-rules.md
    - ${CLAUDE_PLUGIN_ROOT}/references/ug-standards.md
    - ${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
    </files_to_read>

    Health metrics collection steps:

    1. Verify scaffold exists:
       Check that user-guide/ directory exists in docs root.
       If missing, report 'User guide not initialized' and stop.
       Detect docs root via: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs paths docs-root

    2. Page inventory:
       - Count total pages (index.md files in user-guide/content/)
       - Count pages per section (getting-started, content-management, etc.)
       - Count content types used (feature-guide, workflow-walkthrough, etc.)
       - List orphan pages (not linked from any _index.md)

    3. Screenshot inventory:
       - Count total screenshots across all page bundles
       - Count screenshots per page (average, min, max)
       - List pages with zero screenshots
       - Check for orphan image files not referenced by any page

    4. Staleness statistics:
       - Parse last_verified from each page's frontmatter
       - Report: oldest, newest, average age
       - Count pages older than screenshot_staleness_days threshold (from config)
       - List pages that have never been verified (no last_verified)

    5. Coverage metrics (if codebase available):
       - Count documented features (from source_features frontmatter)
       - Count total user-visible features in codebase (admin menus, CPTs, etc.)
       - Calculate coverage percentage
       - If codebase unavailable, report 'Coverage metrics unavailable (no codebase)'

    6. Structural health:
       - Pages missing required sections for their content_type
       - Pages with broken screenshot references
       - Section _index.md completeness (do all sections have one?)
       - Frontmatter completeness (missing required fields)

    Format the report as:

    ## User Guide Status Report

    ### Overview
    - Total pages: {count}
    - Total screenshots: {count}
    - Coverage: {percentage}% ({documented}/{total} features)
    - Average staleness: {days} days

    ### Section Breakdown
    | Section | Pages | Screenshots | Avg Staleness |
    |---------|-------|-------------|---------------|
    | {section} | {count} | {count} | {days}d |

    ### Staleness
    - Freshest: {page} ({days}d)
    - Most stale: {page} ({days}d)
    - Pages needing refresh: {count} (>{threshold}d)

    ### Structural Issues
    - {issue count} pages missing required sections
    - {issue count} broken screenshot references
    - {issue count} incomplete frontmatter

    If --verbose, append per-page detail table:
    | Page | Type | Screenshots | Last Verified | Issues |
    |------|------|-------------|---------------|--------|

    Read-only -- do NOT modify any files.",
  agent="fp-docs-ug-validator",
  model="${VALIDATOR_MODEL}"
)
```
</step>

</process>

<success_criteria>
- [ ] Scaffold existence verified
- [ ] Page inventory complete with section breakdown
- [ ] Screenshot inventory collected
- [ ] Staleness statistics calculated from last_verified frontmatter
- [ ] Coverage percentage calculated (or unavailability noted)
- [ ] Structural health issues identified
- [ ] Report formatted as dashboard summary
- [ ] Per-page detail included if --verbose
- [ ] No files modified (read-only)
</success_criteria>
