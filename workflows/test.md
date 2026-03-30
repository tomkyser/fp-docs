<purpose>
Test documentation claims against the live local development environment. Supports testing
REST API endpoints, CLI commands, template file existence, and visual page rendering via
Playwright. Requires ddev running with foreignpolicy.local accessible. Delegates to specialized
agents for each phase: scope assessment, research, planning, and test execution.
</purpose>

<required_reading>
Read all files referenced by the invoking command's execution_context.
</required_reading>

<process>

<step name="initialize" priority="first">
## 1. Initialize
```bash
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init read-op test "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```
Parse JSON for: operation, agent, target_scope, validation_config, feature_flags.

Check for flags:
- Test scope from $ARGUMENTS: rest-api | cli | templates | visual | all
- `--no-research`: Skip scope-assess + research phases
- `--plan-only`: Stop after plan phase
</step>

<step name="scope-assess">
## 2. Scope Assessment
Skip if `--no-research` flag is set.

```bash
SCOPE=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" scope-assess test "$ARGUMENTS")
if [[ "$SCOPE" == @file:* ]]; then SCOPE=$(cat "${SCOPE#@file:}"); fi
```
Parse JSON for: complexity, researcherCount, targets, trackerRequired, delegationPlan.

If trackerRequired:
```bash
TRACKER_ID=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" tracker create --command test --complexity ${complexity})
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
  prompt="Analyze source code for test operation.
    Targets: {researcher.targets}
    Test scope: {scope}
    Tracker: {TRACKER_ID or 'none'}
    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/codebase-analysis-guide.md
    </files_to_read>
    Use source-map for target-to-source mapping:
    node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs source-map lookup {source-path}
    Save analysis via: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs plans save-analysis --operation test --content {analysis}
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
  prompt="Design execution strategy for test operation (read-only).
    Targets: {targets}
    Test scope: {scope}
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
## 5. Execute Tests
```bash
VALIDATOR_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-validator --raw)
```
Spawn validator agent:
```
Agent(
  prompt="Execute test operation -- live environment testing.
    Targets: {targets}
    Test scope: {scope}
    Plan: {plan-file-path}
    Tracker: {TRACKER_ID or 'none'}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/validation-rules.md
    - ${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
    - ${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
    </files_to_read>

    Test steps:
    1. Check local development environment availability:
       - Verify local URL: curl -sk https://foreignpolicy.local/
       - Verify WP-CLI: ddev wp cli version
       - If unavailable: report skip with reason and exit.

    2. Parse test scope from arguments.

    3. For rest-api scope:
       - Read REST endpoint docs in docs/09-api/
       - For each documented endpoint: make a curl request, verify response shape matches doc
       - Report pass/fail per endpoint

    4. For cli scope:
       - Read CLI docs in docs/15-cli/
       - For each documented command: run with --help, verify args and description match doc
       - Report pass/fail per command

    5. For templates scope:
       - Read component/layout docs
       - Verify template files exist at documented paths
       - Report pass/fail per template

    6. For visual scope (requires visual.enabled = true):
       a. Check prerequisites: visual.enabled config, Playwright MCP tools available,
          foreignpolicy.local reachable.
       b. Read component/layout docs that describe rendered UI elements.
       c. For each documented page/component with a determinable URL:
          - Navigate via browser_navigate
          - Capture accessibility snapshot via browser_snapshot
          - Take screenshot via browser_take_screenshot
          - Structural verify: compare documented elements against accessibility tree
          - Visual analyze: verify layout matches documentation claims
       d. Save screenshots to .fp-docs/screenshots/test-{timestamp}/
       e. Report pass/fail per page/component with screenshot references

    7. Generate test report with passed, failed, skipped counts.

    Read-only -- modifies nothing except running test commands and saving screenshots.

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
- [ ] Local development environment checked for availability
- [ ] All test scopes executed (or skipped with reason)
- [ ] Per-scope pass/fail results reported
- [ ] Visual tests include screenshot evidence (if visual scope)
- [ ] Tracker updated at each phase (if created)
- [ ] No documentation files modified (read-only)
</success_criteria>
