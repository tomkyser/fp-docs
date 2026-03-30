<purpose>
Scan documentation for verbosity violations: banned summarization phrases, incomplete
enumerations, missing API Reference rows, and scope manifest shortfalls. Read-only operation
that reports gaps between source code item counts and documented item counts.
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
Parse JSON for: operation, engine, target_scope, validation_config.

Check for flags:
- `--depth quick|standard|deep`: Scan depth (default: standard)
- Scope from $ARGUMENTS (file path, directory, or "all")
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
  prompt="Analyze source code for verbosity-audit operation.
    Scope: {target_scope}
    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/codebase-analysis-guide.md
    </files_to_read>
    Focus on counting public functions, parameters, hooks, constants, and enumerables
    in each source file. These counts become the binding targets for verbosity checking.
    Save analysis via: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs plans save-analysis --operation verbosity-audit --content {analysis}",
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
  prompt="Design execution strategy for verbosity-audit operation (read-only).
    Scope: {target_scope}
    Depth: {depth}
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
## 4. Execute Verbosity Audit
```bash
VERBOSITY_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-verbosity --raw)
```
Spawn verbosity agent:
```
Agent(
  prompt="Execute verbosity-audit operation.
    Scope: {target_scope}
    Depth: {depth}
    Plan: {plan-file-path}

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

    Read-only -- do NOT modify any files.",
  agent="fp-docs-verbosity",
  model="${VERBOSITY_MODEL}"
)
```
</step>

</process>

<success_criteria>
- [ ] All docs in scope scanned for verbosity violations
- [ ] Source code counts established as binding targets
- [ ] Coverage gaps identified (expected vs actual counts)
- [ ] Banned phrase/pattern violations flagged with line numbers
- [ ] Findings classified by type and severity
- [ ] No files modified (read-only)
</success_criteria>
