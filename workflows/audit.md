<purpose>
Compare documentation against source code and report discrepancies. Read-only operation that
identifies MISSING, STALE, BROKEN, and ORPHAN docs. Supports quick, standard, and deep depth
levels. Generates remediation recommendations with specific command suggestions. Delegates to
specialized agents for each phase: scope assessment, research, planning, and audit execution.
</purpose>

<required_reading>
Read all files referenced by the invoking command's execution_context.
</required_reading>

<process>

<step name="initialize" priority="first">
## 1. Initialize
```bash
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init read-op audit "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```
Parse JSON for: operation, agent, target_scope, validation_config, feature_flags.

Check for flags:
- `--depth quick|standard|deep`: Audit depth level (default: standard)
- `--section NN`: Limit to specific docs section
- `--no-research`: Skip scope-assess + research phases
- `--plan-only`: Stop after plan phase
</step>

<step name="scope-assess">
## 2. Scope Assessment
Skip if `--no-research` flag is set.

```bash
SCOPE=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" scope-assess audit "$ARGUMENTS")
if [[ "$SCOPE" == @file:* ]]; then SCOPE=$(cat "${SCOPE#@file:}"); fi
```
Parse JSON for: complexity, researcherCount, targets, trackerRequired, delegationPlan.

If trackerRequired:
```bash
TRACKER_ID=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" tracker create --command audit --complexity ${complexity})
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
  prompt="Analyze source code for audit operation.
    Targets: {researcher.targets}
    Depth: {depth}
    Tracker: {TRACKER_ID or 'none'}
    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/codebase-analysis-guide.md
    </files_to_read>
    Use source-map for target-to-source mapping:
    node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs source-map lookup {source-path}
    Save analysis via: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs plans save-analysis --operation audit --content {analysis}
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
  prompt="Design execution strategy for audit operation (read-only).
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
## 5. Execute Audit
```bash
VALIDATOR_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-validator --raw)
```
Spawn validator agent:
```
Agent(
  prompt="Execute audit operation.
    Targets: {targets}
    Depth: {depth}
    Plan: {plan-file-path}
    Tracker: {TRACKER_ID or 'none'}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/validation-rules.md
    - ${CLAUDE_PLUGIN_ROOT}/references/validation-algorithm.md
    - ${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
    - ${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
    </files_to_read>

    Audit steps by depth:

    For quick depth:
    a. Read PROJECT-INDEX.md for source file inventory.
    b. Read docs/About.md. Verify every linked doc file exists on disk.
    c. Cross-reference source-to-doc mapping via source-map lookup.
       Identify MISSING (source exists, no doc) and ORPHAN (doc exists, no source).
    d. Validate all relative markdown links.

    For standard depth (includes quick):
    a. Run git log for last 30 days to find changed source files.
    b. Filter to documentation-relevant files using fp-project mapping.
    c. For each changed file with a doc: read both, compare, flag discrepancies.

    For deep depth (includes standard):
    a. For EVERY doc file (or docs in --section): read doc and source, compare all claims.
    b. Check citation coverage and health.

    Generate audit report with categories:
    MISSING, STALE, BROKEN, ORPHAN, CITATION COVERAGE, CITATION HEALTH.
    Include summary counts and recommended actions.

    For each issue, recommend the specific /fp-docs: command to resolve it:
    - MISSING -> /fp-docs:add
    - STALE -> /fp-docs:revise (or /fp-docs:citations update if only citations stale)
    - BROKEN (link) -> /fp-docs:revise (or /fp-docs:update-index if index link)
    - ORPHAN -> /fp-docs:deprecate
    - CITATION COVERAGE -> /fp-docs:citations generate
    - CITATION HEALTH -> /fp-docs:citations update

    Append a Remediation Summary section:
    - Issues by command
    - Execution order (Tier 1 accuracy, Tier 2 enrichment, Tier 3 structural)
    - Quick Fix: /fp-docs:remediate suggestion

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
- [ ] All docs in scope scanned at requested depth
- [ ] Source-to-doc mapping checked via source-map
- [ ] Issues categorized (MISSING, STALE, BROKEN, ORPHAN, CITATION)
- [ ] Each issue has a specific remediation command recommendation
- [ ] Remediation Summary with execution order appended
- [ ] Tracker updated at each phase (if created)
- [ ] No files modified (read-only)
</success_criteria>
