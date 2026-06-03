<purpose>
Create new documentation for undocumented code. Reads source code, finds sibling docs for format
templates, creates complete documentation. Delegates to specialized agents for each phase:
scope assessment, research, planning, primary creation, verbosity enforcement, citation
enforcement, API reference enforcement, review, and finalization.
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
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init write-op add "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```
Parse JSON for: operation, agent, target_files, pipeline_config, feature_flags.

Check for flags:
- `--visual`: Enable visual verification after creation
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
SCOPE=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" scope-assess add "$ARGUMENTS")
if [[ "$SCOPE" == @file:* ]]; then SCOPE=$(cat "${SCOPE#@file:}"); fi
```
Parse JSON for: complexity, researcherCount, targets, trackerRequired, delegationPlan.

If trackerRequired:
```bash
TRACKER_ID=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" tracker create --command add --complexity ${complexity})
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
  prompt="Analyze source code for add (new documentation) operation.
    Targets: {researcher.targets}
    Tracker: {TRACKER_ID or 'none'}
    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/codebase-analysis-guide.md
    </files_to_read>
    Use source-map for target-to-source mapping.
    Save analysis via: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs plans save-analysis --operation add --content {analysis}
    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update ${TRACKER_ID} --step research --agent researcher --status done --detail {summary}",
  agent="fp-docs-researcher",
  model="${RESEARCHER_MODEL}"
)
```

If researcherCount == 1: spawn synchronously.
If researcherCount > 1: spawn all in parallel, collect all analyses.
</step>

<step name="plan">
## 4. Plan Phase
```bash
PLANNER_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-planner --raw)
```
Spawn planner agent:
```
Agent(
  prompt="Design execution strategy for add operation.
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
If `--plan-only`: display plan summary and STOP.
</step>

<step name="execute-primary">
## 5. Write Phase (Primary Operation Only)
```bash
MODIFIER_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-modifier --raw)
```
Spawn modifier agent:
```
Agent(
  prompt="Execute add operation -- PRIMARY OPERATION ONLY.
    Target: {target}
    Plan: {plan-file-path}
    Flags: {flags}
    Tracker: {TRACKER_ID or 'none'}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
    - ${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
    </files_to_read>

    Primary operation steps:
    1. Parse the user request. Identify what new code was added (file paths, system type)
       and which docs section it belongs in (use source-map lookup).
    2. Read PROJECT-INDEX.md to discover existing files in the target source directory.
    3. Find an existing sibling doc in the same section. Read it for the format template.
    4. Read the new source code file(s). Every detail must come from actual source code.
    5. Create the documentation file at the correct path:
       - Follow the format template from sibling doc and doc-standards.
       - Meet all depth requirements.
       - Use [NEEDS INVESTIGATION] for anything unclear -- never fabricate.
    6. Update links: add new doc to parent _index.md and README.md if new section.
    7. If --visual flag: perform visual verification against foreignpolicy.local.

    IMPORTANT: Do NOT run pipeline enforcement stages (verbosity, citations, API refs).
    Those are handled by dedicated agents in subsequent steps.
    Do NOT run stages 4-8.
    Return a Primary Operation Result listing files created/modified and a brief summary.

    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update ${TRACKER_ID} --step write --agent fp-docs-modifier --status done --detail {summary}",
  agent="fp-docs-modifier",
  model="${MODIFIER_MODEL}"
)
```
Extract: files created/modified, summary.
</step>

<step name="enforce-verbosity">
## 6. Verbosity Enforcement (Stage 1 -- Dedicated)
Skip if `--no-verbosity` flag is set or `verbosity.enabled` is false.

```bash
VERBOSITY_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-verbosity-enforcer --raw)
```
Spawn dedicated verbosity enforcement agent:
```
Agent(
  prompt="Enforce verbosity on files created/modified by add operation.
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

<step name="enforce-citations">
## 7. Citation Enforcement (Stage 2 -- Dedicated)
Skip if `--no-citations` flag is set or `citations.enabled` is false.

```bash
CITATIONS_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-citations --raw)
```
Spawn dedicated citations agent:
```
Agent(
  prompt="Enforce citations on files created/modified by add operation.
    Target files: {files from write phase}
    Tracker: {TRACKER_ID or 'none'}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/citation-rules.md
    - ${CLAUDE_PLUGIN_ROOT}/references/citation-algorithm.md
    - ${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
    </files_to_read>

    For each target file:
    1. Identify documentable elements in the new documentation
    2. Generate citation blocks for each element from source code
    3. Determine citation tier per rules (Full/Signature/Reference based on line count)
    4. Insert citations at correct positions
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
  prompt="Enforce API references on files created by add operation.
    Target files: {files from write phase}
    Tracker: {TRACKER_ID or 'none'}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/api-ref-rules.md
    - ${CLAUDE_PLUGIN_ROOT}/references/api-ref-algorithm.md
    - ${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
    </files_to_read>

    For each target file that requires API Reference:
    1. Read source file, extract all public functions/methods
    2. Generate API Reference section per rules
    3. Verify row count matches scope manifest
    4. Verify provenance column is populated

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
Spawn validator agent:
```
Agent(
  prompt="Validate files created/modified by the add operation.
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
If sanity-check confidence is LOW: retry once.
</step>

<step name="execute-finalize-phase">
## 10. Finalize Phase (Stages 6-8)
```bash
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline init --operation add --files {files} --changelog-summary "{summary}"
```
Loop:
```bash
NEXT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline next)
# action == "execute" -> fp-tools pipeline run-stage {id}
#   Stage 6: Changelog update
#   Stage 7: Index update (structural change -- always triggers)
#   Stage 8: Docs commit and push
# action == "complete" -> done
# action == "blocked" -> halt
```

If tracker exists:
```bash
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" tracker update ${TRACKER_ID} --step finalize --agent workflow --status done --detail '{commit-hash}'
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" tracker complete ${TRACKER_ID}
```
</step>

</process>

<success_criteria>
- [ ] New documentation file created at correct path
- [ ] All content derived from actual source code
- [ ] Format matches sibling docs and doc-standards
- [ ] Primary operation completed by modifier agent (step 5)
- [ ] Verbosity enforcement completed by dedicated agent (step 6)
- [ ] Citation enforcement completed by dedicated agent (step 7)
- [ ] API reference enforcement completed by dedicated agent (step 8)
- [ ] Pipeline stages 4-5 completed by validator agent (step 9)
- [ ] Pipeline stages 6-8 completed via CJS pipeline loop (step 10)
- [ ] Parent index and README.md updated
- [ ] Tracker updated at each phase (if created)
- [ ] Changelog entry added
- [ ] Docs committed and pushed
</success_criteria>
