<purpose>
Capture or refresh screenshots for user guide page(s). Uses Playwright MCP to navigate
the WordPress admin and capture current UI state. Updates page frontmatter and screenshot
references. Delegates screenshot capture to fp-docs-ug-writer and verification to
fp-docs-ug-validator. Commits updated screenshots and frontmatter to docs repo.
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
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init write-op ug-screenshot "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```
Parse JSON for: operation, agent, target_scope, pipeline_config, feature_flags.

Check for flags:
- `--all`: Process all user guide pages
- `--replace`: Always overwrite existing screenshots (otherwise only replace if UI changed)
- `--dry-run`: Report what would be captured without actually capturing
</step>

<step name="identify-targets">
## 2. Identify Target Page Bundle(s)
```bash
DOCS_ROOT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" paths docs-root)
```

If `--all`: target all page bundles under `user-guide/content/`.
If page path specified: target that specific page bundle.
If no match found: report error and stop.

For each target page bundle:
1. Verify `index.md` exists
2. Parse frontmatter for `source_features` and `last_verified`
3. Parse content for image references (screenshot filenames)
4. List existing image files in the page bundle directory
</step>

<step name="execute-capture">
## 3. Capture Screenshots
```bash
WRITER_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-ug-writer --raw)
```
Spawn writer agent:
```
Agent(
  prompt="Execute ug-screenshot operation -- capture or refresh screenshots.
    Target page bundles: {target paths}
    Mode: {--replace: always overwrite, default: only if changed}
    Dry run: {true if --dry-run}
    Tracker: {TRACKER_ID or 'none'}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/ug-standards.md
    - ${CLAUDE_PLUGIN_ROOT}/references/ug-ui-verification.md
    - ${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
    </files_to_read>

    For each target page:
    1. Read index.md and parse all image references
    2. For each referenced screenshot:
       a. Determine the admin screen URL from the surrounding context
          (navigation path, feature references, source_features mapping)
       b. If Playwright MCP available:
          - Navigate to the admin screen
          - Wait 2000ms for dynamic content
          - Capture at 1280x900 viewport
          - Save as {NN}-{slug}.png in the page bundle directory
       c. If Playwright unavailable:
          - Report that manual capture is needed
          - Do NOT create placeholder files
    3. If --replace: overwrite all existing screenshots
       If default: compare captured screenshot with existing, only overwrite if different
    4. If --dry-run: report what would be captured without saving files
    5. Update page frontmatter:
       - last_verified: today's date
       - screenshot_count: actual count of screenshot files
    6. Identify orphan images (files in bundle not referenced by index.md)
    7. Execute write-phase pipeline stage 2 (Screenshot Currency):
       - Verify all references resolve to actual files
       - Check naming convention compliance

    Return result with:
    - Screenshots captured (count, filenames)
    - Screenshots skipped (unchanged)
    - Orphan images found
    - Pages needing manual capture (if Playwright unavailable)

    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update ${TRACKER_ID} --step write --agent fp-docs-ug-writer --status done --detail {summary}",
  agent="fp-docs-ug-writer",
  model="${WRITER_MODEL}"
)
```
Extract: files modified, screenshots captured/skipped, orphan list.

If `--dry-run`: display report and STOP (no pipeline or commit).
</step>

<step name="pipeline-enforcement">
## 4. Pipeline Enforcement (Stages 3-4)
Skip if `--dry-run`.

```bash
VALIDATOR_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-ug-validator --raw)
```
Spawn validator agent:
```
Agent(
  prompt="Execute user guide pipeline stages 3-4 on pages with refreshed screenshots.
    Target files: {files from capture phase}
    Tracker: {TRACKER_ID or 'none'}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/ug-validation-rules.md
    - ${CLAUDE_PLUGIN_ROOT}/references/ug-standards.md
    </files_to_read>

    Stage 3 -- Jargon & Tone Check:
    Quick scan of any updated content (frontmatter changes, caption updates).
    Report violations if found.

    Stage 4 -- Completeness Check:
    Verify screenshot_count frontmatter matches actual file count.
    Verify all image references resolve to files.
    Check for orphan assets.

    Return per-stage PASS/WARN/FAIL.

    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update ${TRACKER_ID} --step validate --agent fp-docs-ug-validator --status done --detail {summary}",
  agent="fp-docs-ug-validator",
  model="${VALIDATOR_MODEL}"
)
```
</step>

<step name="finalize">
## 5. Finalize (Stage 5 -- Changelog + Commit)
Skip if `--dry-run`.

```bash
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline init --operation ug-screenshot --files {files} --changelog-summary "Refresh screenshots: {page-titles}"
```
Loop:
```bash
NEXT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline next)
# action == "execute" -> fp-tools pipeline run-stage {id}
#   ug-commit stage: update last_verified, update changelog, commit to docs repo
# action == "complete" -> done, extract completion marker
# action == "blocked" -> halt
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
- [ ] Target page bundles identified and parsed for image references
- [ ] Screenshots captured via Playwright (or manual capture noted)
- [ ] Existing screenshots compared before overwriting (unless --replace)
- [ ] Orphan images identified and reported
- [ ] Page frontmatter updated (last_verified, screenshot_count)
- [ ] Pipeline stage 2 (screenshot currency) passed
- [ ] Pipeline stages 3-4 passed
- [ ] Pipeline stage 5 (changelog + commit) completed
- [ ] Tracker updated at each phase (if created)
- [ ] Docs committed and pushed (unless --dry-run)
</success_criteria>
