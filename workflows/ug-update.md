<purpose>
Update an existing user guide page after codebase changes. Detects what changed since
last_verified, re-verifies UI paths, refreshes stale screenshots, and updates affected
sections. Full user guide pipeline enforcement (UI verification, screenshot currency,
jargon/tone, completeness) and git commit. Delegates diff analysis and content updates
to fp-docs-ug-writer and pipeline validation to fp-docs-ug-validator.
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
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init write-op ug-update "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```
Parse JSON for: operation, agent, target_scope, pipeline_config, feature_flags.

Check for flags:
- `--refresh-screenshots`: Force screenshot recapture even if not stale
- `--no-tone-check`: Skip jargon & tone pipeline stage
</step>

<step name="identify-target">
## 2. Identify Target Page(s)
Resolve the argument to specific user guide page(s):

```bash
DOCS_ROOT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" paths docs-root)
```

If argument is a page path: target that specific page bundle.
If argument is a feature name: search `user-guide/content/` for pages with matching
`source_features` frontmatter or matching title.
If no match found: report error and stop.

Verify target page(s) exist.
</step>

<step name="diff-analysis">
## 3. Diff Analysis
For each target page, determine what changed:

```bash
RESEARCHER_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-researcher --raw)
```
Spawn researcher agent:
```
Agent(
  prompt="Analyze codebase changes affecting user guide page(s).
    Target pages: {target page paths}
    Tracker: {TRACKER_ID or 'none'}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/codebase-analysis-guide.md
    </files_to_read>

    For each target page:
    1. Read the page's frontmatter to get source_features and last_verified date
    2. Use source-map to find corresponding source files:
       node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs source-map reverse-lookup {page-path}
    3. Run git log since last_verified on those source files:
       git -C {codebase-root} log --oneline --since='{last_verified}' -- {source-files}
    4. For each changed source file, identify what changed:
       - New/removed/renamed admin menus or pages
       - Changed form fields or meta boxes
       - Modified post type or taxonomy registrations
       - Changed capability requirements
       - New/removed UI elements

    Output: per-page change summary with affected sections and severity
    (MAJOR: feature restructured, MINOR: field added/changed, COSMETIC: label/text change)

    Save analysis via: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs plans save-analysis --operation ug-update --content {analysis}
    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update ${TRACKER_ID} --step research --agent researcher --status done --detail {summary}",
  agent="fp-docs-researcher",
  model="${RESEARCHER_MODEL}"
)
```
Extract analysis file path. If no changes found, report page is current and stop.
</step>

<step name="impact-assessment">
## 4. Impact Assessment
From the diff analysis, determine which page sections need updating:

Parse the change summary. Map each code change to the page section(s) it affects:
- Menu/page changes -> "Where to Find" or navigation sections
- Field changes -> "Key Fields" or form sections
- Capability changes -> "Prerequisites" or access sections
- Feature removal -> section removal or deprecation note
- New sub-feature -> new section addition

Prepare a targeted update plan listing:
- Sections to update (with what changed)
- Sections to leave unchanged
- Screenshots to refresh (if UI changed or --refresh-screenshots)
</step>

<step name="execute-update">
## 5. Execute Update (Write Phase)
```bash
WRITER_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-ug-writer --raw)
```
Spawn writer agent:
```
Agent(
  prompt="Execute ug-update operation -- update existing user guide page(s).
    Target pages: {target page paths}
    Change analysis: {analysis-file-path}
    Update plan: {sections to update, sections to preserve}
    Refresh screenshots: {true if --refresh-screenshots or UI changed}
    Tracker: {TRACKER_ID or 'none'}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/ug-standards.md
    - ${CLAUDE_PLUGIN_ROOT}/references/ug-ui-verification.md
    - ${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
    </files_to_read>

    For each target page:
    1. Read the existing page content
    2. Update ONLY the sections identified in the update plan
    3. Preserve all unaffected sections verbatim
    4. Re-verify UI paths for updated sections:
       - If Playwright available: navigate and verify
       - If not: trace code registrations
    5. If screenshots need refresh:
       - Capture new screenshots via Playwright (or note as needing manual capture)
       - Update screenshot references in content
       - Update screenshot_count frontmatter
    6. Update last_verified to today's date
    7. Execute write-phase pipeline stages 1-2:
       - Stage 1 (UI Behavior Verification): verify all documented paths
       - Stage 2 (Screenshot Currency): verify all screenshot references
    8. Return result with files modified and pipeline stage results

    IMPORTANT: Do NOT rewrite sections that haven't changed. Targeted updates only.
    Write from the USER's perspective. No code identifiers, no dev jargon.

    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update ${TRACKER_ID} --step write --agent fp-docs-ug-writer --status done --detail {summary}",
  agent="fp-docs-ug-writer",
  model="${WRITER_MODEL}"
)
```
Extract: files modified, screenshots refreshed, pipeline stage 1-2 results.
</step>

<step name="pipeline-enforcement">
## 6. Pipeline Enforcement (Stages 3-4)
```bash
VALIDATOR_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-ug-validator --raw)
```
Spawn validator agent:
```
Agent(
  prompt="Execute user guide pipeline stages 3-4 on updated page(s).
    Target files: {files from write phase}
    Flags: {--no-tone-check if set}
    Tracker: {TRACKER_ID or 'none'}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/ug-validation-rules.md
    - ${CLAUDE_PLUGIN_ROOT}/references/ug-standards.md
    </files_to_read>

    Stage 3 -- Jargon & Tone Check (skip if --no-tone-check):
    Scan page body for banned patterns. Flag violations. Report by severity.

    Stage 4 -- Completeness Check:
    Verify all required sections present for the page's content_type.
    Check frontmatter completeness. Validate structural quality.

    Return per-stage PASS/WARN/FAIL with specific issues.

    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update ${TRACKER_ID} --step validate --agent fp-docs-ug-validator --status done --detail {summary}",
  agent="fp-docs-ug-validator",
  model="${VALIDATOR_MODEL}"
)
```
If validator reports FAIL: re-spawn writer to fix violations (same pattern as ug-generate step 6).
</step>

<step name="finalize">
## 7. Finalize (Stage 5 -- Changelog + Commit)
```bash
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline init --operation ug-update --files {files} --changelog-summary "Update user guide: {page-title} ({change-summary})"
```
Loop:
```bash
NEXT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline next)
# action == "execute" -> fp-tools pipeline run-stage {id}
#   ug-commit stage: update last_verified, update changelog, commit to docs repo
# action == "complete" -> done, extract completion marker
# action == "blocked" -> validation failure, halt
```

If tracker exists:
```bash
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" tracker update ${TRACKER_ID} --step finalize --agent workflow --status done --detail '{commit-hash}'
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" tracker complete ${TRACKER_ID}
```

Include completion marker verbatim in final report.
</step>

</process>

<success_criteria>
- [ ] Target page(s) identified and resolved
- [ ] Codebase changes since last_verified analyzed
- [ ] Impact assessment completed -- affected sections identified
- [ ] Only affected sections updated (unaffected preserved)
- [ ] Screenshots refreshed where UI changed (or --refresh-screenshots)
- [ ] Pipeline stage 1 (UI verification) passed
- [ ] Pipeline stage 2 (screenshot currency) passed
- [ ] Pipeline stage 3 (jargon/tone) passed (or skipped with --no-tone-check)
- [ ] Pipeline stage 4 (completeness) passed
- [ ] Pipeline stage 5 (changelog + commit) completed
- [ ] last_verified updated to today on all modified pages
- [ ] Tracker updated at each phase (if created)
- [ ] Docs committed and pushed
</success_criteria>
