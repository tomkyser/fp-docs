<purpose>
Generate a new user guide page for a feature or workflow. Dev specifies what to document;
the system analyzes source code, discovers UI paths via Playwright or code trace, captures
screenshots, and writes content using the appropriate page template. Full user guide pipeline
enforcement (UI verification, screenshot currency, jargon/tone, completeness) and git commit.
Delegates code analysis to fp-docs-researcher, content creation to fp-docs-ug-writer, and
pipeline validation to fp-docs-ug-validator.
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
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init write-op ug-generate "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```
Parse JSON for: operation, agent, target_scope, pipeline_config, feature_flags.

Check for flags:
- `--type feature-guide|workflow|quick-start|reference|faq`: Page type (default: inferred from target)
- `--no-screenshots`: Skip screenshot capture (use placeholders)
- `--plan-only`: Stop after scope inference, display analysis and stop
- `--no-tone-check`: Skip jargon & tone pipeline stage
</step>

<step name="scope-inference">
## 2. Scope Inference
If the user gave a vague target (e.g., "the region stuff"), resolve it to specific features.

```bash
SCOPE=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" scope-assess ug-generate "$ARGUMENTS")
if [[ "$SCOPE" == @file:* ]]; then SCOPE=$(cat "${SCOPE#@file:}"); fi
```
Parse JSON for: complexity, targets, trackerRequired, delegationPlan.

If trackerRequired:
```bash
TRACKER_ID=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" tracker create --command ug-generate --complexity ${complexity})
```

Use source-map to identify specific feature area, admin pages, and UI entry points:
```bash
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" source-map lookup {source-path}
```

Determine page type if not specified via `--type`:
- Feature with admin screen -> feature-guide
- Multi-step process -> workflow-walkthrough
- Onboarding or setup -> quick-start
- Glossary or lookup -> reference
- Questions -> faq
</step>

<step name="code-analysis">
## 3. Code Analysis
```bash
RESEARCHER_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-researcher --raw)
```
Spawn researcher agent:
```
Agent(
  prompt="Analyze source code for ug-generate operation.
    Target feature: {target}
    Source files: {targets from scope}
    Tracker: {TRACKER_ID or 'none'}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/codebase-analysis-guide.md
    </files_to_read>

    Focus on user-visible aspects of this feature:
    1. Admin menu registrations (add_menu_page, add_submenu_page)
    2. Form fields and meta boxes (add_meta_box, field definitions)
    3. Custom post types and taxonomies (register_post_type, register_taxonomy)
    4. Shortcode handlers (add_shortcode) with user-facing attributes
    5. Settings pages (add_options_page, register_setting)
    6. Capabilities that control access to this feature
    7. Admin column customizations
    8. Dashboard widgets

    Output a structured analysis with:
    - Feature name and admin URL(s)
    - Navigation path from Dashboard
    - All user-visible fields, buttons, and controls
    - Default values and constraints
    - Related features (if any)

    Save analysis via: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs plans save-analysis --operation ug-generate --content {analysis}
    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update ${TRACKER_ID} --step research --agent researcher --status done --detail {summary}",
  agent="fp-docs-researcher",
  model="${RESEARCHER_MODEL}"
)
```
Extract analysis file path. If researcher fails, proceed with limited context.

If `--plan-only`: display analysis summary and STOP.
</step>

<step name="ui-discovery">
## 4. UI Discovery & Content Synthesis (Write Phase)
```bash
WRITER_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-ug-writer --raw)
```
Spawn writer agent:
```
Agent(
  prompt="Execute ug-generate operation -- create new user guide page.
    Target feature: {target}
    Page type: {type}
    Research analysis: {analysis-file-path}
    Screenshots: {enabled unless --no-screenshots}
    Tracker: {TRACKER_ID or 'none'}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/ug-standards.md
    - ${CLAUDE_PLUGIN_ROOT}/references/ug-ui-verification.md
    - ${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
    </files_to_read>

    Steps:
    1. Read the research analysis for feature details
    2. Select page template from scaffolds/user-guide/templates/ based on page type
    3. If Playwright MCP available: navigate to admin screens, capture navigation
       path, screenshot key states (overview, editing, result)
    4. If Playwright unavailable: use code analysis to infer navigation paths,
       create placeholder screenshot references
    5. Create page bundle: {user-guide-root}/{section}/{page-name}/index.md
    6. Write content using the template structure:
       - Complete frontmatter (title, description, weight, content_type,
         last_verified, screenshot_count, source_features)
       - All required sections for the content type
       - Screenshots referenced by {NN}-{slug}.png filenames
    7. Execute write-phase pipeline stages 1-2:
       - Stage 1 (UI Behavior Verification): verify all documented paths
       - Stage 2 (Screenshot Currency): verify all screenshot references
    8. Return result with files created and pipeline stage results

    IMPORTANT: Write from the USER's perspective. No code identifiers, no dev jargon.
    Use the page template structure. Every navigation path must be verified.

    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update ${TRACKER_ID} --step write --agent fp-docs-ug-writer --status done --detail {summary}",
  agent="fp-docs-ug-writer",
  model="${WRITER_MODEL}"
)
```
Extract: files created, screenshots captured, pipeline stage 1-2 results.
</step>

<step name="pipeline-enforcement">
## 5. Pipeline Enforcement (Stages 3-4)
```bash
VALIDATOR_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-ug-validator --raw)
```
Spawn validator agent:
```
Agent(
  prompt="Execute user guide pipeline stages 3-4 on newly generated page.
    Target files: {files from write phase}
    Flags: {--no-tone-check if set}
    Tracker: {TRACKER_ID or 'none'}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/ug-validation-rules.md
    - ${CLAUDE_PLUGIN_ROOT}/references/ug-standards.md
    </files_to_read>

    Stage 3 -- Jargon & Tone Check (skip if --no-tone-check):
    Scan page body for banned patterns from ug-validation-rules.
    Flag PHP/JS identifiers, dev jargon, technical terminology.
    Respect allowed exceptions. Report violations by severity.

    Stage 4 -- Completeness Check:
    Verify all required sections present for the page's content_type.
    Check frontmatter completeness.
    Validate structural quality (step count, screenshot presence).

    Return per-stage PASS/WARN/FAIL with specific issues.

    If any FAIL issues found, list the specific text and suggested fix.

    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update ${TRACKER_ID} --step validate --agent fp-docs-ug-validator --status done --detail {summary}",
  agent="fp-docs-ug-validator",
  model="${VALIDATOR_MODEL}"
)
```
If validator reports FAIL on jargon/tone: re-spawn writer to fix violations before proceeding.
</step>

<step name="fix-violations">
## 6. Fix Pipeline Violations (Conditional)
Only execute if Step 5 reported FAIL on any stage.

Re-spawn writer agent with violation list:
```
Agent(
  prompt="Fix pipeline violations found in user guide page.
    Target files: {files from write phase}
    Violations: {violation list from step 5}
    Tracker: {TRACKER_ID or 'none'}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/ug-standards.md
    </files_to_read>

    For each violation:
    - Jargon/tone: Replace technical term with plain-language equivalent
    - Missing section: Add the required section with appropriate content
    - Frontmatter: Add missing fields

    Do NOT rewrite sections that passed validation.

    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update ${TRACKER_ID} --step fix --agent fp-docs-ug-writer --status done --detail {summary}",
  agent="fp-docs-ug-writer",
  model="${WRITER_MODEL}"
)
```
</step>

<step name="finalize">
## 7. Finalize (Stage 5 -- Changelog + Commit)
```bash
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline init --operation ug-generate --files {files} --changelog-summary "Add user guide page: {page-title}"
```
Loop:
```bash
NEXT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline next)
# action == "execute" -> fp-tools pipeline run-stage {id}
#   ug-commit stage: update last_verified frontmatter, update user-guide changelog
#   (if exists), commit to docs repo via git -C {docs-root}
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
- [ ] Target feature identified and scoped via code analysis
- [ ] Page template selected matching content type
- [ ] Page bundle created with index.md and screenshots (or placeholders)
- [ ] Content written from user perspective with no dev jargon
- [ ] All required sections present for content type
- [ ] Pipeline stage 1 (UI verification) passed
- [ ] Pipeline stage 2 (screenshot currency) passed
- [ ] Pipeline stage 3 (jargon/tone) passed (or skipped with --no-tone-check)
- [ ] Pipeline stage 4 (completeness) passed
- [ ] Pipeline stage 5 (changelog + commit) completed
- [ ] Tracker updated at each phase (if created)
- [ ] Docs committed and pushed
</success_criteria>
