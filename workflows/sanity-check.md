<purpose>
Cross-reference every factual claim in documentation against source code. Classifies each claim
as VERIFIED, MISMATCH, HALLUCINATION, or UNVERIFIED. Zero-tolerance accuracy check that is the
foundation of the fp-docs accuracy guarantee. Delegates to specialized agents for each phase:
scope assessment, research, planning, and sanity-check execution.
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
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init read-op sanity-check "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```
Parse JSON for: operation, agent, target_scope, validation_config, feature_flags.

Check for flags:
- Scope from $ARGUMENTS (file path or section)
- `--no-research`: Skip scope-assess + research phases
- `--plan-only`: Stop after plan phase
</step>

<step name="scope-assess">
## 2. Scope Assessment
Skip if `--no-research` flag is set.

```bash
SCOPE=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" scope-assess sanity-check "$ARGUMENTS")
if [[ "$SCOPE" == @file:* ]]; then SCOPE=$(cat "${SCOPE#@file:}"); fi
```
Parse JSON for: complexity, researcherCount, targets, trackerRequired, delegationPlan.

If trackerRequired:
```bash
TRACKER_ID=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" tracker create --command sanity-check --complexity ${complexity})
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
  prompt="Analyze source code for sanity-check operation.
    Targets: {researcher.targets}
    Tracker: {TRACKER_ID or 'none'}
    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/codebase-analysis-guide.md
    </files_to_read>
    Use source-map for target-to-source mapping:
    node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs source-map lookup {source-path}
    Save analysis via: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs plans save-analysis --operation sanity-check --content {analysis}
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
  prompt="Design execution strategy for sanity-check operation (read-only).
    Targets: {targets}
    Research: {analysis-file-paths or 'none'}
    Scope: {complexity}
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

<step name="execute">
## 5. Execute Sanity Check
```bash
VALIDATOR_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-validator --raw)
```
Spawn validator agent:
```
Agent(
  prompt="Execute sanity-check operation -- zero-tolerance accuracy check.
    Targets: {targets}
    Plan: {plan-file-path}
    Tracker: {TRACKER_ID or 'none'}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/validation-rules.md
    - ${CLAUDE_PLUGIN_ROOT}/references/validation-algorithm.md
    - ${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
    - ${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
    </files_to_read>

    Sanity-check steps:
    1. Identify the documentation files to check from scope.
    2. For each doc, find the corresponding source file(s) via source-map lookup.
    3. Cross-reference every factual claim against source code:
       - Function signatures, hook names/priorities, file paths, meta keys
       - REST routes, shortcode attributes, defaults, constants
       - Classify each: VERIFIED, MISMATCH, HALLUCINATION, UNVERIFIABLE
    4. For UNVERIFIABLE claims: trace call chains, check related files, search codebase.
       Reclassify as VERIFIED, MISMATCH, HALLUCINATION, or UNVERIFIED.
    5. Cross-reference related docs for contradictions.
    6. Assess complexity: if >5 docs or >3 sections affected, note multi-agent recommendation.
    7. Generate sanity check report with confidence level (HIGH/LOW).

    For each MISMATCH or HALLUCINATION, recommend the specific /fp-docs: command:
    - MISMATCH (function signature) -> /fp-docs:revise
    - MISMATCH (hook name/priority) -> /fp-docs:revise
    - MISMATCH (citation line range) -> /fp-docs:citations update
    - HALLUCINATION (non-existent function/file) -> /fp-docs:revise

    If confidence is LOW, append Remediation section with command list
    and /fp-docs:remediate suggestion.

    Read-only -- do NOT modify any files.

    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update ${TRACKER_ID} --step execute --agent fp-docs-validator --status done --detail {summary}",
  agent="fp-docs-validator",
  model="${VALIDATOR_MODEL}"
)
```

If tracker exists:
```bash
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" tracker complete ${TRACKER_ID}
```
</step>

</process>

<success_criteria>
- [ ] Every factual claim in scope checked against source code
- [ ] Claims classified as VERIFIED, MISMATCH, HALLUCINATION, or UNVERIFIED
- [ ] Confidence level (HIGH/LOW) determined
- [ ] Remediation commands recommended for each issue
- [ ] Tracker updated at each phase (if created)
- [ ] No files modified (read-only)
</success_criteria>
