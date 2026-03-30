<purpose>
Process the needs-revision tracker, selecting pending items and executing revise operations
for each. Supports selecting all items, specific items by number or name, or ranges.
Each item gets its own revise cycle. Delegates to specialized agents for each phase:
scope assessment, research, planning, primary modification (batch-aware with per-item spawns),
verbosity enforcement, citation enforcement, API reference enforcement, review, and finalization.
</purpose>

<required_reading>
Read all files referenced by the invoking command's execution_context.
</required_reading>

<process>

<step name="initialize" priority="first">
## 1. Initialize
```bash
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init write-op auto-revise "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```
Parse JSON for: operation, agent, target_files, pipeline_config, feature_flags.

Check for flags:
- `--item N`: Select the Nth pending item (1-based)
- `--item "name"`: Select item matching heading (case-insensitive)
- `--range N-M`: Select items N through M inclusive
- `--dry-run`: Show what would be revised without executing
- `--no-research`: Skip scope-assess + research phases
- `--plan-only`: Stop after plan phase
- `--no-sanity-check`: Skip sanity-check in review phase
- `--no-verbosity`: Skip dedicated verbosity enforcement
- `--no-citations`: Skip dedicated citation enforcement
- `--no-api-ref`: Skip dedicated API reference enforcement
</step>

<step name="scope-assess">
## 2. Scope Assessment
Skip if `--no-research` flag is set.

```bash
SCOPE=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" scope-assess auto-revise "$ARGUMENTS")
if [[ "$SCOPE" == @file:* ]]; then SCOPE=$(cat "${SCOPE#@file:}"); fi
```
Parse JSON for: complexity, researcherCount, targets, trackerRequired, delegationPlan.

The scope assessment uses the selected tracker items to determine:
- How many revision targets exist (drives parallelism in write phase)
- How many researchers to spawn (one per cluster of related targets)
- Whether a tracker is needed for this batch operation

If trackerRequired:
```bash
TRACKER_ID=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" tracker create --command auto-revise --complexity ${complexity})
```
</step>

<step name="research">
## 3. Research Phase (Dynamic)
Skip if `--no-research` flag is set or `researcher.enabled` is false.

```bash
RESEARCHER_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-researcher --raw)
```

For each researcher assignment in delegationPlan.researchers (1-N based on scope):
```
Agent(
  prompt="Analyze source code for auto-revise operation.
    Targets: {researcher.targets}
    Pending tracker items: {items from init}
    Tracker: {TRACKER_ID or 'none'}
    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/codebase-analysis-guide.md
    </files_to_read>
    Use source-map for target-to-source mapping:
    node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs source-map lookup {source-path}
    Save analysis via: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs plans save-analysis --operation auto-revise --content {analysis}
    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update ${TRACKER_ID} --step research --agent researcher --status done --detail {summary}",
  agent="fp-docs-researcher",
  model="${RESEARCHER_MODEL}"
)
```

If researcherCount == 1: spawn synchronously.
If researcherCount > 1: spawn all in parallel, collect all analyses.
Extract analysis file path(s). If researcher fails, proceed without analysis.
</step>

<step name="plan">
## 4. Plan Phase
```bash
PLANNER_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-planner --raw)
```
Spawn planner agent:
```
Agent(
  prompt="Design execution strategy for auto-revise operation.
    Pending items: {selected items}
    Research: {analysis-file-paths or 'none'}
    Scope: {complexity}
    Flags: {flags}
    Tracker: {TRACKER_ID or 'none'}
    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/pipeline-enforcement.md
    </files_to_read>
    Group related tracker items where possible (same doc file = one modifier).
    Save plan via: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs plans save '{plan-json}'
    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update ${TRACKER_ID} --step plan --agent planner --status done --detail {summary}",
  agent="fp-docs-planner",
  model="${PLANNER_MODEL}"
)
```
Extract plan_id and plan file path. Load plan: `node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs plans load {plan-id}`

If `--plan-only`: display plan summary and STOP.
If `--dry-run`: display selected items and plan summary, then STOP.
</step>

<step name="execute-primary">
## 5. Write Phase (Primary Operation Only -- Per-Item Spawns)
```bash
MODIFIER_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-modifier --raw)
```

For each selected tracker item (or group of related items per plan), spawn modifier agent:
```
Agent(
  prompt="Execute revise operation for tracker item -- PRIMARY OPERATION ONLY.
    Tracker item: {item description}
    Plan: {plan-file-path}
    Flags: {flags}
    Tracker: {TRACKER_ID or 'none'}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
    - ${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
    </files_to_read>

    Primary operation steps:
    1. Read docs/needs-revision-tracker.md. Parse the specific pending item.
    2. Treat the tracker entry description as the revision request.
    3. Execute the revise procedure: identify files, read doc and source, compare,
       make targeted edits.
    4. Follow all formatting rules from doc-standards.

    IMPORTANT: Do NOT run pipeline enforcement stages (verbosity, citations, API refs).
    Those are handled by dedicated agents in subsequent steps.
    Do NOT run stages 4-8.
    Return a Primary Operation Result listing files modified and a brief summary.

    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update ${TRACKER_ID} --step write --agent fp-docs-modifier --status done --detail {summary}",
  agent="fp-docs-modifier",
  model="${MODIFIER_MODEL}"
)
```

After all items processed, update the needs-revision tracker:
- Move successfully revised items from Pending to Completed with completion date.
- Leave failed items in Pending with failure note.

Collect summaries from all spawns. Merge file lists for enforcement agents.
</step>

<step name="enforce-verbosity">
## 6. Verbosity Enforcement (Stage 1 -- Dedicated)
Skip if `--no-verbosity` flag is set or `verbosity.enabled` is false.

```bash
VERBOSITY_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-verbosity --raw)
```
Spawn ONE dedicated verbosity agent for ALL files from write phase:
```
Agent(
  prompt="Enforce verbosity on files modified by auto-revise operation.
    Target files: {all files from write phase -- merged across items}
    Tracker: {TRACKER_ID or 'none'}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/verbosity-rules.md
    - ${CLAUDE_PLUGIN_ROOT}/references/verbosity-algorithm.md
    - ${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
    </files_to_read>

    For each target file:
    1. Identify the corresponding source file(s) via source-map lookup
    2. Build scope manifest: count every documentable item in source
    3. Compare against documentation: verify 100% coverage
    4. Scan for banned summarization phrases
    5. If gaps found: fix them (add missing items, expand summaries)

    Return a Verbosity Enforcement Result with per-file status (PASS/FIXED/FAIL).

    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update ${TRACKER_ID} --step verbosity --agent fp-docs-verbosity --status done --detail {summary}",
  agent="fp-docs-verbosity",
  model="${VERBOSITY_MODEL}"
)
```
</step>

<step name="enforce-citations">
## 7. Citation Enforcement (Stage 2 -- Dedicated)
Skip if `--no-citations` flag is set or `citations.enabled` is false.

```bash
CITATIONS_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-citations --raw)
```
Spawn ONE dedicated citations agent for ALL files:
```
Agent(
  prompt="Enforce citations on files modified by auto-revise operation.
    Target files: {all files from write phase -- merged across items}
    Tracker: {TRACKER_ID or 'none'}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/citation-rules.md
    - ${CLAUDE_PLUGIN_ROOT}/references/citation-algorithm.md
    - ${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
    </files_to_read>

    For each target file:
    1. Parse existing citation blocks
    2. Check staleness against current source (Fresh/Stale/Drifted/Broken/Missing)
    3. Update stale/drifted citations with current source
    4. Generate missing citations for undocumented elements
    5. Verify citation format compliance

    Return a Citation Enforcement Result with per-file status.

    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update ${TRACKER_ID} --step citations --agent fp-docs-citations --status done --detail {summary}",
  agent="fp-docs-citations",
  model="${CITATIONS_MODEL}"
)
```
</step>

<step name="enforce-api-refs">
## 8. API Reference Enforcement (Stage 3 -- Dedicated)
Skip if `--no-api-ref` flag is set or `api_ref.enabled` is false.
Also skip if no target files require API Reference sections (per doc type).

```bash
APIREFS_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-api-refs --raw)
```
Spawn dedicated API refs agent:
```
Agent(
  prompt="Enforce API references on files modified by auto-revise operation.
    Target files: {files from write phase that require API Reference}
    Tracker: {TRACKER_ID or 'none'}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/api-ref-rules.md
    - ${CLAUDE_PLUGIN_ROOT}/references/api-ref-algorithm.md
    - ${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
    </files_to_read>

    For each target file that requires API Reference:
    1. Verify API Reference section exists
    2. Extract function signatures from source code
    3. Compare against documented signatures
    4. Update stale rows, add missing rows
    5. Verify provenance column is populated

    Return an API Reference Enforcement Result with per-file status.

    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update ${TRACKER_ID} --step api-refs --agent fp-docs-api-refs --status done --detail {summary}",
  agent="fp-docs-api-refs",
  model="${APIREFS_MODEL}"
)
```
</step>

<step name="execute-review-phase">
## 9. Review Phase (Stages 4-5)
```bash
VALIDATOR_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-validator --raw)
```
Spawn ONE validator for ALL modified files:
```
Agent(
  prompt="Validate all files modified by the auto-revise operation.
    Target files: {all files from write phase}
    Tracker: {TRACKER_ID or 'none'}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/validation-rules.md
    - ${CLAUDE_PLUGIN_ROOT}/references/validation-algorithm.md
    - ${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
    - ${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
    </files_to_read>

    Run sanity-check (stage 4) on all target files.
    Run 10-point verification (stage 5) on all target files.
    Return a Pipeline Validation Report.

    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update ${TRACKER_ID} --step review --agent fp-docs-validator --status done --detail {summary}",
  agent="fp-docs-validator",
  model="${VALIDATOR_MODEL}"
)
```
If sanity-check confidence is LOW: retry once. If still LOW, report without committing.
</step>

<step name="execute-finalize-phase">
## 10. Finalize Phase (Stages 6-8)
```bash
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline init --operation auto-revise --files {files} --changelog-summary "{summary}"
```
Loop:
```bash
NEXT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline next)
# action == "execute" -> fp-tools pipeline run-stage {id}
#   Stage 6: Changelog update (single entry covers all revised items)
#   Stage 7: Index update
#   Stage 8: Docs commit and push
# action == "complete" -> done, extract completion marker
# action == "blocked" -> HALLUCINATION detected, halt
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
- [ ] Selected tracker items identified and processed
- [ ] Each item revised by modifier agent (step 5)
- [ ] Needs-revision tracker updated: successful items to Completed, failed items noted
- [ ] Verbosity enforcement completed by dedicated agent (step 6)
- [ ] Citation enforcement completed by dedicated agent (step 7)
- [ ] API reference enforcement completed by dedicated agent (step 8)
- [ ] Pipeline stages 4-5 completed by validator agent (step 9)
- [ ] Pipeline stages 6-8 completed via CJS pipeline loop (step 10)
- [ ] Tracker updated at each phase (if created)
- [ ] Single changelog entry for all items
- [ ] Docs committed and pushed
</success_criteria>
