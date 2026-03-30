<purpose>
Test documentation claims against the live local development environment. Supports testing
REST API endpoints, CLI commands, template file existence, and visual page rendering via
Playwright. Requires ddev running with foreignpolicy.local accessible.
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
Parse JSON for: operation, engine, target_scope, validation_config.

Check for flags:
- Test scope from $ARGUMENTS: rest-api | cli | templates | visual | all
- `--no-research`: Skip research phase
- `--plan-only`: Stop after plan phase
</step>

<step name="research">
## 2. Research Phase
Skip if `--no-research` or `researcher.enabled` is false.

```bash
RESEARCHER_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-researcher --raw)
```
Spawn researcher:
```
Agent(
  prompt="Analyze source code for test operation.
    Test scope: {scope}
    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/codebase-analysis-guide.md
    </files_to_read>
    Save analysis via: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs plans save-analysis --operation test --content {analysis}",
  agent="fp-docs-researcher",
  model="${RESEARCHER_MODEL}"
)
```
</step>

<step name="plan">
## 3. Plan Phase
```bash
PLANNER_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-planner --raw)
```
Spawn planner:
```
Agent(
  prompt="Design execution strategy for test operation (read-only).
    Test scope: {scope}
    Research Analysis: {analysis-file-path or 'none'}
    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/pipeline-enforcement.md
    </files_to_read>
    Save plan via: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs plans save '{plan-json}'",
  agent="fp-docs-planner",
  model="${PLANNER_MODEL}"
)
```
If `--plan-only`: display plan summary and STOP.
</step>

<step name="execute">
## 4. Execute Tests
```bash
VALIDATOR_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-validator --raw)
```
Spawn validator agent:
```
Agent(
  prompt="Execute test operation -- live environment testing.
    Test scope: {scope}
    Plan: {plan-file-path}

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

    Read-only -- modifies nothing except running test commands and saving screenshots.",
  agent="fp-docs-validator",
  model="${VALIDATOR_MODEL}"
)
```
</step>

</process>

<success_criteria>
- [ ] Local development environment checked for availability
- [ ] All test scopes executed (or skipped with reason)
- [ ] Per-scope pass/fail results reported
- [ ] Visual tests include screenshot evidence (if visual scope)
- [ ] No documentation files modified (read-only)
</success_criteria>
