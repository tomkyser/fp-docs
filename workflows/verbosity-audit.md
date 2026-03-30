<purpose>
Scan documentation for verbosity violations: banned summarization phrases, incomplete
enumerations, missing API Reference rows, and scope manifest shortfalls. Read-only operation
that reports gaps between source code item counts and documented item counts. Delegates to
specialized agents for each phase: scope assessment, research, planning, and audit execution.
</purpose>

<required_reading>
Read all files referenced by the invoking command's execution_context.
</required_reading>

<process>

<step name="initialize" priority="first">
## 1. Initialize
```bash
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init read-op verbosity-audit "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```
Parse JSON for: operation, agent, target_scope, validation_config, feature_flags.

Check for flags:
- `--depth quick|standard|deep`: Scan depth (default: standard)
- Scope from $ARGUMENTS (file path, directory, or "all")
- `--no-research`: Skip scope-assess + research phases
- `--plan-only`: Stop after plan phase
</step>

<step name="scope-assess">
## 2. Scope Assessment
Skip if `--no-research` flag is set.

```bash
SCOPE=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" scope-assess verbosity-audit "$ARGUMENTS")
if [[ "$SCOPE" == @file:* ]]; then SCOPE=$(cat "${SCOPE#@file:}"); fi
```
Parse JSON for: complexity, researcherCount, targets, trackerRequired, delegationPlan.

If trackerRequired:
```bash
TRACKER_ID=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" tracker create --command verbosity-audit --complexity ${complexity})
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
  prompt="Analyze source code for verbosity-audit operation.
    Targets: {researcher.targets}
    Tracker: {TRACKER_ID or 'none'}
    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/codebase-analysis-guide.md
    </files_to_read>
    Focus on counting public functions, parameters, hooks, constants, and enumerables
    in each source file. These counts become the binding targets for verbosity checking.
    Use source-map for target-to-source mapping:
    node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs source-map lookup {source-path}
    Save analysis via: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs plans save-analysis --operation verbosity-audit --content {analysis}
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
  prompt="Design execution strategy for verbosity-audit operation (read-only).
    Targets: {targets}
    Depth: {depth}
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
## 5. Execute Verbosity Audit
```bash
VERBOSITY_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-verbosity --raw)
```
Spawn verbosity agent (read-only):
```
Agent(
  prompt="Execute verbosity-audit operation.
    Targets: {targets}
    Depth: {depth}
    Plan: {plan-file-path}
    Tracker: {TRACKER_ID or 'none'}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/verbosity-rules.md
    - ${CLAUDE_PLUGIN_ROOT}/references/verbosity-algorithm.md
    - ${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
    - ${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
    </files_to_read>

    Verbosity audit steps:
    1. Parse depth and scope.
    2. For each doc in scope:
       a. Identify source file(s) via source-map lookup.
       b. Count public functions/methods in source.
       c. Count documented items in doc (API Reference rows, function descriptions).
       d. Calculate gap: (source count - doc count) / source count.
    3. Scan each doc for banned summarization phrases from verbosity-rules:
       'and more', 'etc.', 'various', 'among others', 'and so on', etc.
    4. Detect unexpanded enumerables: find arrays, switch statements, if/elseif chains
       in source that should be enumerated in docs but use vague language instead.
    5. Classify findings:
       - MISSING: source items not documented
       - SUMMARIZED: banned phrase detected
       - UNEXPANDED: enumerable not fully expanded
       - Severity: low (<5% gap), medium (5-10%), high (>10%)
    6. Generate verbosity audit report.

    Read-only -- do NOT modify any files.

    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update ${TRACKER_ID} --step execute --agent fp-docs-verbosity --status done --detail {summary}",
  agent="fp-docs-verbosity",
  model="${VERBOSITY_MODEL}"
)
```

If tracker exists:
```bash
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" tracker complete ${TRACKER_ID}
```
</step>

</process>

<success_criteria>
- [ ] All docs in scope scanned for verbosity violations
- [ ] Source code counts established as binding targets
- [ ] Coverage gaps identified (expected vs actual counts)
- [ ] Banned phrase/pattern violations flagged with line numbers
- [ ] Findings classified by type and severity
- [ ] Tracker updated at each phase (if created)
- [ ] No files modified (read-only)
</success_criteria>
