<purpose>
Cross-reference every factual claim in documentation against source code. Classifies each claim
as VERIFIED, MISMATCH, HALLUCINATION, or UNVERIFIED. Zero-tolerance accuracy check that is the
foundation of the fp-docs accuracy guarantee.
</purpose>

<required_reading>
Read all files referenced by the invoking command's execution_context.
</required_reading>

<process>

<step name="initialize" priority="first">
## 1. Initialize
```bash
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init read-op sanity-check "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```
Parse JSON for: operation, engine, target_scope, validation_config.

Check for flags:
- Scope from $ARGUMENTS (file path or section)
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
  prompt="Analyze source code for sanity-check operation.
    Scope: {target_scope}
    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/codebase-analysis-guide.md
    </files_to_read>
    Save analysis via: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs plans save-analysis --operation sanity-check --content {analysis}",
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
  prompt="Design execution strategy for sanity-check operation (read-only).
    Scope: {target_scope}
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
## 4. Execute Sanity Check
```bash
VALIDATOR_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-validator --raw)
```
Spawn validator agent:
```
Agent(
  prompt="Execute sanity-check operation -- zero-tolerance accuracy check.
    Scope: {target_scope}
    Plan: {plan-file-path}

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

    Read-only -- do NOT modify any files.",
  agent="fp-docs-validator",
  model="${VALIDATOR_MODEL}"
)
```
</step>

</process>

<success_criteria>
- [ ] Every factual claim in scope checked against source code
- [ ] Claims classified as VERIFIED, MISMATCH, HALLUCINATION, or UNVERIFIED
- [ ] Confidence level (HIGH/LOW) determined
- [ ] Remediation commands recommended for each issue
- [ ] No files modified (read-only)
</success_criteria>
