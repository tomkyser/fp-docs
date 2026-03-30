<purpose>
Run the full 10-point verification checklist against documentation files. Read-only operation
that checks file existence, orphans, index completeness, appendix spot-checks, link validation,
changelog, citation format, API reference provenance, locals contracts, and verbosity compliance.
</purpose>

<required_reading>
Read all files referenced by the invoking command's execution_context.
</required_reading>

<process>

<step name="initialize" priority="first">
## 1. Initialize
```bash
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init read-op verify "$ARGUMENTS")
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
  prompt="Analyze source code for verify operation.
    Scope: {target_scope}
    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/codebase-analysis-guide.md
    </files_to_read>
    Save analysis via: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs plans save-analysis --operation verify --content {analysis}",
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
  prompt="Design execution strategy for verify operation (read-only).
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
## 4. Execute Verification
```bash
VALIDATOR_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-validator --raw)
```
Spawn validator agent:
```
Agent(
  prompt="Execute verify operation -- 10-point verification checklist.
    Scope: {target_scope}
    Plan: {plan-file-path}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/validation-rules.md
    - ${CLAUDE_PLUGIN_ROOT}/references/validation-algorithm.md
    - ${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
    - ${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
    </files_to_read>

    Run all 10 verification checks:
    - Check 1: File Existence
    - Check 2: Orphan Check
    - Check 3: Index Completeness
    - Check 4: Appendix Spot-Check (SKIP if standalone)
    - Check 5: Link Validation
    - Check 6: Changelog Check (SKIP if standalone)
    - Check 7: Citation Format Validation
    - Check 8: API Reference Provenance Validation
    - Check 9: Locals Contracts Completeness
    - Check 10: Verbosity Compliance

    If scope specified, limit checks to those files.
    Report each check as PASS, FAIL, or SKIP with details.
    Give overall PASS or FAIL.

    For each FAIL, recommend the specific /fp-docs: command to fix it:
    - Check 2 (Orphan) -> /fp-docs:deprecate or /fp-docs:add
    - Check 3 (Index) -> /fp-docs:update-index
    - Check 5 (Links) -> /fp-docs:revise
    - Check 7 (Citations) -> /fp-docs:citations generate or update
    - Check 8 (API Ref) -> /fp-docs:api-ref
    - Check 9 (Locals) -> /fp-docs:locals
    - Check 10 (Verbosity) -> /fp-docs:revise

    If any checks failed, append Remediation section.

    Read-only -- do NOT modify any files.",
  agent="fp-docs-validator",
  model="${VALIDATOR_MODEL}"
)
```
</step>

</process>

<success_criteria>
- [ ] All 10 verification checks executed (or appropriately skipped)
- [ ] Each check reported as PASS, FAIL, or SKIP
- [ ] Overall PASS/FAIL determination made
- [ ] Failed checks include remediation command recommendations
- [ ] No files modified (read-only)
</success_criteria>
