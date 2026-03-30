<purpose>
Manage $locals contract documentation for PHP template components. Handles six subcommands:
annotate (add @locals PHPDoc blocks to PHP files), contracts (generate Locals Contracts sections in docs),
coverage (report annotation and documentation coverage), cross-ref (validate caller-callee relationships),
shapes (manage shared $locals shapes), validate (verify contracts against actual code).
Write subcommands (annotate, contracts, shapes) delegate to specialized agents for each phase:
scope assessment, research, planning, primary locals work, verbosity enforcement, citation
enforcement, API reference enforcement, review, and finalization.
Read subcommands (coverage, cross-ref, validate) produce reports only.
All subcommands support ephemeral WP-CLI tool for ground-truth extraction with manual fallback.
</purpose>

<required_reading>
Read all files referenced by the invoking command's execution_context.
</required_reading>

<process>

<step name="initialize" priority="first">
## 1. Initialize

```bash
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init write-op locals "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON for: operation, agent, target_files, pipeline_config, feature_flags.

Parse the first word of `$ARGUMENTS` as the subcommand:
- `annotate` -- Add/update @locals PHPDoc blocks in component PHP files (write)
- `contracts` -- Generate/update Locals Contracts sections in component docs (write)
- `coverage` -- Report annotation and documentation coverage (read-only)
- `cross-ref` -- Validate caller-callee relationships (read-only)
- `shapes` -- Manage shared $locals shapes in _locals-shapes.md (write)
- `validate` -- Verify documented contracts against actual code (read-only)

If no subcommand provided, error: "Usage: /fp-docs:locals <annotate|contracts|coverage|cross-ref|shapes|validate> [target]"

Check for flags (write subcommands only):
- `--no-research`: Skip scope-assess + research phases
- `--plan-only`: Stop after plan phase
- `--no-sanity-check`: Skip sanity-check in review phase
- `--no-verbosity`: Skip dedicated verbosity enforcement
- `--no-citations`: Skip dedicated citation enforcement
- `--no-api-ref`: Skip dedicated API reference enforcement

Route: write subcommands -> step 2 (CLI setup). Read subcommands -> step 2 (CLI setup) then step 3c/3d/3f directly.
</step>

<step name="cli-setup">
## 2. CLI Tool Setup (all subcommands)

Attempt to install the ephemeral WP-CLI tool for ground-truth extraction:
```bash
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" locals-cli setup
```

If setup fails (ddev not running, path error): fall back to manual extraction.
Report extraction method to user.
</step>

<step name="subcommand-coverage">
## 3c. Coverage Subcommand (Read-Only)

**CLI path:** Run `ddev wp fp-locals coverage --format=json` for ground-truth coverage data.

Cross-check against documentation:
1. Per-directory breakdown from CLI data
2. Inline annotation coverage (@locals blocks in PHP files)
3. Documentation coverage (contract entries in component docs)
4. Combined coverage (both annotation AND doc entry)
5. Highlight directories with 0% coverage

**MANDATORY teardown:** `node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" locals-cli teardown`
**No pipeline.** Output coverage report and stop.
</step>

<step name="subcommand-cross-ref">
## 3d. Cross-Reference Subcommand (Read-Only)

**CLI path:** Run `ddev wp fp-locals cross-ref "components/<dir>/" --recursive` for caller-callee data.

Cross-validate:
1. Every caller listed in Data Flow must appear in CLI output
2. Every caller in CLI output should be in Data Flow
3. Keys passed by each caller must match documented keys
4. Required keys not passed by any caller -> flag as data flow gap
5. Shape references must resolve to `_locals-shapes.md`

**MANDATORY teardown:** `node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" locals-cli teardown`
**No pipeline.** Output cross-reference report and stop.
</step>

<step name="subcommand-validate">
## 3f. Validate Subcommand (Read-Only)

**CLI path:** Run `ddev wp fp-locals validate "<file_or_dir>" --recursive` then `ddev wp fp-locals extract "<file_or_dir>" --recursive --format=json`.

For each component doc in scope:
1. Compare each documented key against CLI-extracted ground truth
2. Verify key exists, type matches, Required/Optional matches, default matches
3. Check for undocumented keys
4. Cross-reference: shape references resolve, all contract keys exist in extraction

**MANDATORY teardown:** `node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" locals-cli teardown`
**No pipeline.** Output validation report and stop.
</step>

<step name="scope-assess" condition="write-subcommands-only">
## 3. Scope Assessment (annotate/contracts/shapes only)
Skip if `--no-research` flag is set.

```bash
SCOPE=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" scope-assess locals "$ARGUMENTS")
if [[ "$SCOPE" == @file:* ]]; then SCOPE=$(cat "${SCOPE#@file:}"); fi
```
Parse JSON for: complexity, researcherCount, targets, trackerRequired, delegationPlan.

If trackerRequired:
```bash
TRACKER_ID=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" tracker create --command locals --complexity ${complexity})
```
</step>

<step name="research" condition="write-subcommands-only">
## 4. Research Phase (Dynamic, annotate/contracts/shapes only)
Skip if `--no-research` flag is set or `researcher.enabled` is false.

```bash
RESEARCHER_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-researcher --raw)
```

For each researcher assignment in delegationPlan.researchers (1-N based on scope):
```
Agent(
  prompt="Analyze source code for locals {subcommand} operation.
    Targets: {researcher.targets}
    Tracker: {TRACKER_ID or 'none'}
    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/codebase-analysis-guide.md
    </files_to_read>
    Use source-map for target-to-source mapping:
    node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs source-map lookup {source-path}
    Save analysis via: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs plans save-analysis --operation locals --content {analysis}
    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update ${TRACKER_ID} --step research --agent researcher --status done --detail {summary}",
  agent="fp-docs-researcher",
  model="${RESEARCHER_MODEL}"
)
```

If researcherCount == 1: spawn synchronously.
If researcherCount > 1: spawn all in parallel, collect all analyses.
Extract analysis file path(s). If researcher fails, proceed without analysis.
</step>

<step name="plan" condition="write-subcommands-only">
## 5. Plan Phase (annotate/contracts/shapes only)
```bash
PLANNER_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-planner --raw)
```
Spawn planner agent:
```
Agent(
  prompt="Design execution strategy for locals {subcommand} operation.
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

<step name="execute-primary" condition="write-subcommands-only">
## 6. Write Phase (Primary Operation Only -- annotate/contracts/shapes only)
```bash
LOCALS_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-locals --raw)
```
Spawn locals agent:
```
Agent(
  prompt="Execute locals {subcommand} operation -- PRIMARY OPERATION ONLY.
    Targets: {targets}
    Plan: {plan-file-path}
    Flags: {flags}
    Tracker: {TRACKER_ID or 'none'}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/locals-rules.md
    - ${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
    </files_to_read>

    For ANNOTATE subcommand:
    CLI path: Run ddev wp fp-locals extract '<file_or_dir>' --format=json --recursive for ground-truth data.
    Manual fallback: Read PHP files, scan for $locals['key'] patterns.
    For each component PHP file:
    1. Check if @locals { ... } PHPDoc block exists
    2. If no block: generate new one from extraction data per locals-rules.md format
    3. If block exists: merge -- preserve human descriptions, update keys/types/required
    4. Insert annotation in file-level PHPDoc comment
    5. Run CLI validation: ddev wp fp-locals validate '<file_or_dir>' --recursive

    For CONTRACTS subcommand:
    CLI path: Run ddev wp fp-locals extract 'components/<dir>/' --recursive --format=json.
    For each component doc in scope:
    1. Generate/update ## Locals Contracts section using locals-rules.md grammar
    2. Create per-file subsection with table: Key | Type | Req? | Default | Description
    3. Add shape references where keys match shared shapes
    4. Generate/update ## Data Flow section using ddev wp fp-locals cross-ref for caller data
    5. Replace existing sections entirely with regenerated versions

    For SHAPES subcommand:
    1. Read docs/05-components/_locals-shapes.md
    2. If --all: analyze all component contracts to discover shared key patterns
    3. For each identified shape: verify definition matches actual keys, update if changed
    4. Generate/update shape entries

    MANDATORY teardown: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs locals-cli teardown

    IMPORTANT: Do NOT run pipeline enforcement stages (verbosity, citations, API refs).
    Those are handled by dedicated agents in subsequent steps.
    Do NOT run stages 4-8.
    Return a Primary Operation Result listing files modified and a brief summary.

    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update ${TRACKER_ID} --step write --agent fp-docs-locals --status done --detail {summary}",
  agent="fp-docs-locals",
  model="${LOCALS_MODEL}"
)
```
Extract: files modified, summary.
</step>

<step name="enforce-verbosity" condition="write-subcommands-only">
## 7. Verbosity Enforcement (Stage 1 -- Dedicated, annotate/contracts/shapes only)
Skip if `--no-verbosity` flag is set or `verbosity.enabled` is false.

```bash
VERBOSITY_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-verbosity --raw)
```
Spawn dedicated verbosity enforcement agent:
```
Agent(
  prompt="Enforce verbosity on files modified by locals {subcommand} operation.
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

    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update ${TRACKER_ID} --step verbosity --agent fp-docs-verbosity --status done --detail {summary}",
  agent="fp-docs-verbosity",
  model="${VERBOSITY_MODEL}"
)
```
</step>

<step name="enforce-citations" condition="write-subcommands-only">
## 8. Citation Enforcement (Stage 2 -- Dedicated, annotate/contracts/shapes only)
Skip if `--no-citations` flag is set or `citations.enabled` is false.

```bash
CITATIONS_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-citations --raw)
```
Spawn dedicated citations agent:
```
Agent(
  prompt="Enforce citations on files modified by locals {subcommand} operation.
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

<step name="enforce-api-refs" condition="write-subcommands-only">
## 9. API Reference Enforcement (Stage 3 -- Dedicated, annotate/contracts/shapes only)
Skip if `--no-api-ref` flag is set or `api_ref.enabled` is false.
Also skip if no target files require API Reference sections (per doc type).

```bash
APIREFS_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-api-refs --raw)
```
Spawn dedicated API refs agent:
```
Agent(
  prompt="Enforce API references on files modified by locals {subcommand} operation.
    Target files: {files from write phase}
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

<step name="execute-review-phase" condition="write-subcommands-only">
## 10. Review Phase (Stages 4-5, annotate/contracts/shapes only)
```bash
VALIDATOR_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-validator --raw)
```
Spawn validator agent:
```
Agent(
  prompt="Validate files modified by the locals {subcommand} operation.
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

<step name="execute-finalize-phase" condition="write-subcommands-only">
## 11. Finalize Phase (Stages 6-8, annotate/contracts/shapes only)
```bash
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline init --operation locals --files {files} --changelog-summary "{summary}"
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
- [ ] CLI tool teardown completed (even on failure)
- [ ] Write operations: primary locals work completed by locals agent (step 6)
- [ ] Write operations: verbosity enforcement completed by dedicated agent (step 7)
- [ ] Write operations: citation enforcement completed by dedicated agent (step 8)
- [ ] Write operations: API ref enforcement completed by dedicated agent (step 9)
- [ ] Write operations: pipeline stages 4-5 completed by validator agent (step 10)
- [ ] Write operations: pipeline stages 6-8 completed via CJS pipeline loop (step 11)
- [ ] Write operations: tracker updated at each phase (if created)
- [ ] Read operations: comprehensive report generated, no pipeline
- [ ] Extraction method reported (CLI or manual fallback)
- [ ] Changelog entry added (write operations)
- [ ] Docs committed and pushed (write operations)
</success_criteria>
