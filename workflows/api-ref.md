<purpose>
Manage API Reference sections in documentation files. Handles two subcommands:
generate (create/update API reference tables from source code) and
audit (compare existing tables against source for accuracy).
Generate is a write operation that delegates to specialized agents for each phase:
scope assessment, research, planning, primary API ref work, verbosity enforcement,
citation enforcement, review, and finalization.
Audit is read-only and produces a report.
</purpose>

<required_reading>
Read all files referenced by the invoking command's execution_context.
</required_reading>

<process>

<step name="initialize" priority="first">
## 1. Initialize

```bash
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init write-op api-ref "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON for: operation, agent, target_files, pipeline_config, feature_flags.

Parse the first word of `$ARGUMENTS` as the subcommand:
- `generate` -- Create or update API Reference tables from source code (write)
- `audit` -- Compare existing tables against source (read-only)

If no subcommand provided, error: "Usage: /fp-docs:api-ref <generate|audit> [target]"

Check for flags (generate only):
- `--no-research`: Skip scope-assess + research phases
- `--plan-only`: Stop after plan phase
- `--no-sanity-check`: Skip sanity-check in review phase
- `--no-verbosity`: Skip dedicated verbosity enforcement
- `--no-citations`: Skip dedicated citation enforcement

Route: generate -> step 2. audit -> step 2b directly.
</step>

<step name="subcommand-audit">
## 2b. Audit Subcommand (Read-Only)

1. Read the documentation file. Find the `## API Reference` section.
2. If no API Reference section and doc type requires one: report MISSING.
3. Parse the API reference table rows.
4. Read the corresponding source file. Extract all public functions/methods.
5. Compare:
   - Functions in source not in table: MISSING
   - Functions in table not in source: ORPHAN (code removed)
   - Functions with different signatures: STALE
   - Functions with PHPDoc provenance: verify PHPDoc matches actual behavior
6. Check Ref Source legend presence and Src column values.
7. Generate audit report.

**No pipeline.** Output the audit report and stop.
</step>

<step name="scope-assess" condition="generate-only">
## 2. Scope Assessment (generate only)
Skip if `--no-research` flag is set.

```bash
SCOPE=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" scope-assess api-ref "$ARGUMENTS")
if [[ "$SCOPE" == @file:* ]]; then SCOPE=$(cat "${SCOPE#@file:}"); fi
```
Parse JSON for: complexity, researcherCount, targets, trackerRequired, delegationPlan.

If trackerRequired:
```bash
TRACKER_ID=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" tracker create --command api-ref --complexity ${complexity})
```
</step>

<step name="research" condition="generate-only">
## 3. Research Phase (Dynamic, generate only)
Skip if `--no-research` flag is set or `researcher.enabled` is false.

```bash
RESEARCHER_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-researcher --raw)
```

For each researcher assignment in delegationPlan.researchers (1-N based on scope):
```
Agent(
  prompt="Analyze source code for api-ref generate operation.
    Targets: {researcher.targets}
    Tracker: {TRACKER_ID or 'none'}
    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/codebase-analysis-guide.md
    </files_to_read>
    Use source-map for target-to-source mapping:
    node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs source-map lookup {source-path}
    Save analysis via: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs plans save-analysis --operation api-ref --content {analysis}
    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update ${TRACKER_ID} --step research --agent researcher --status done --detail {summary}",
  agent="fp-docs-researcher",
  model="${RESEARCHER_MODEL}"
)
```

If researcherCount == 1: spawn synchronously.
If researcherCount > 1: spawn all in parallel, collect all analyses.
Extract analysis file path(s). If researcher fails, proceed without analysis.
</step>

<step name="plan" condition="generate-only">
## 4. Plan Phase (generate only)
```bash
PLANNER_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-planner --raw)
```
Spawn planner agent:
```
Agent(
  prompt="Design execution strategy for api-ref generate operation.
    Targets: {targets}
    Research: {analysis-file-paths or 'none'}
    Scope: {complexity}
    Flags: {flags}
    Tracker: {TRACKER_ID or 'none'}
    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/pipeline-enforcement.md
    </files_to_read>
    Save plan via: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs plans save '{plan-json}'
    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update ${TRACKER_ID} --step plan --agent planner --status done --detail {summary}",
  agent="fp-docs-planner",
  model="${PLANNER_MODEL}"
)
```
Extract plan_id and plan file path. Load plan: `node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs plans load {plan-id}`

If `--plan-only`: display plan summary and STOP.
</step>

<step name="execute-primary" condition="generate-only">
## 5. Write Phase (Primary Operation Only -- generate only)
```bash
APIREFS_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-api-refs --raw)
```
Spawn API refs agent:
```
Agent(
  prompt="Execute api-ref generate operation -- PRIMARY OPERATION ONLY.
    Targets: {targets}
    Plan: {plan-file-path}
    Flags: {flags}
    Tracker: {TRACKER_ID or 'none'}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/api-ref-rules.md
    - ${CLAUDE_PLUGIN_ROOT}/references/api-ref-algorithm.md
    - ${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
    </files_to_read>

    Primary operation steps:
    1. Parse scope: doc file path, --layer name, or --all.
       If doc type not listed as requiring API Reference per config scope table: report and skip.
    2. Read the documentation file. Identify source file via ## Source File header.
    3. Build scope manifest: count all public functions/methods in source file.
    4. Read source file. Extract every public function/method:
       - PHP namespaced helpers: every function in the namespace
       - PHP classes: every public method (protected only for abstract classes)
       - JavaScript: every exported function + key event handlers
    5. For each function, extract: name, parameters, return type, description
       (one-liner, present tense), provenance (PHPDoc if docblock exists, Verified if authored).
    6. Generate the API Reference section per api-ref-rules.md:
       ## API Reference
       > **Ref Source** -- Per-row provenance in Src column
       | Function | Params | Return | Description | Src |
       Rows ordered by source file line number.
    7. Insert before ## Related Docs, or update existing section.
    8. Verify row count matches scope manifest function count.

    IMPORTANT: Do NOT run pipeline enforcement stages (verbosity, citations).
    Those are handled by dedicated agents in subsequent steps.
    Do NOT run stages 4-8.
    Return a Primary Operation Result listing files modified and a brief summary.

    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update ${TRACKER_ID} --step write --agent fp-docs-api-refs --status done --detail {summary}",
  agent="fp-docs-api-refs",
  model="${APIREFS_MODEL}"
)
```
Extract: files modified, summary.
</step>

<step name="enforce-verbosity" condition="generate-only">
## 6. Verbosity Enforcement (Stage 1 -- Dedicated, generate only)
Skip if `--no-verbosity` flag is set or `verbosity.enabled` is false.

```bash
VERBOSITY_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-verbosity-enforcer --raw)
```
Spawn dedicated verbosity enforcement agent:
```
Agent(
  prompt="Enforce verbosity on files modified by api-ref generate operation.
    Target files: {files from write phase}
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

    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update ${TRACKER_ID} --step verbosity --agent fp-docs-verbosity-enforcer --status done --detail {summary}",
  agent="fp-docs-verbosity-enforcer",
  model="${VERBOSITY_MODEL}"
)
```
</step>

<step name="enforce-citations" condition="generate-only">
## 7. Citation Enforcement (Stage 2 -- Dedicated, generate only)
Skip if `--no-citations` flag is set or `citations.enabled` is false.

Note: API ref enforcement (stage 3) is skipped here since the primary agent IS the API refs specialist.

```bash
CITATIONS_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-citations --raw)
```
Spawn dedicated citations agent:
```
Agent(
  prompt="Enforce citations on files modified by api-ref generate operation.
    Target files: {files from write phase}
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

<step name="execute-review-phase" condition="generate-only">
## 8. Review Phase (Stages 4-5, generate only)
```bash
VALIDATOR_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-validator --raw)
```
Spawn validator agent:
```
Agent(
  prompt="Validate files modified by the api-ref generate operation.
    Target files: {files from write phase}
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

<step name="execute-finalize-phase" condition="generate-only">
## 9. Finalize Phase (Stages 6-8, generate only)
```bash
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline init --operation api-ref --files {files} --changelog-summary "{summary}"
```
Loop:
```bash
NEXT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline next)
# action == "execute" -> fp-tools pipeline run-stage {id}
#   Stage 6: Changelog update
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
- [ ] Subcommand correctly identified and executed
- [ ] Generate: primary API ref work completed by api-refs agent (step 5)
- [ ] Generate: verbosity enforcement completed by dedicated agent (step 6)
- [ ] Generate: citation enforcement completed by dedicated agent (step 7)
- [ ] Generate: pipeline stages 4-5 completed by validator agent (step 8)
- [ ] Generate: pipeline stages 6-8 completed via CJS pipeline loop (step 9)
- [ ] Generate: API Reference table row count matches source function count
- [ ] Generate: all provenance values are valid (PHPDoc, Verified, Authored)
- [ ] Generate: tracker updated at each phase (if created)
- [ ] Audit: comprehensive report with MISSING/ORPHAN/STALE classifications
- [ ] Changelog entry added (generate only)
- [ ] Docs committed and pushed (generate only)
</success_criteria>
