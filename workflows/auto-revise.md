<purpose>
Process the needs-revision tracker, selecting pending items and executing revise operations
for each. Supports selecting all items, specific items by number or name, or ranges.
Each item gets its own revise cycle with pipeline enforcement.
</purpose>

<required_reading>
Read all files referenced by the invoking command's execution_context.
</required_reading>

<process>

<step name="initialize" priority="first">
## 1. Initialize
```bash
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init write-op auto-revise "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```
Parse JSON for: operation, engine, target_files, pipeline_config, feature_flags.

Check for flags:
- `--item N`: Select the Nth pending item (1-based)
- `--item "name"`: Select item matching heading (case-insensitive)
- `--range N-M`: Select items N through M inclusive
- `--dry-run`: Show what would be revised without executing
- `--no-research`: Skip research phase
- `--plan-only`: Stop after plan phase
</step>

<step name="research">
## 2. Research Phase
Skip if `--no-research` or `researcher.enabled` is false.

```bash
RESEARCHER_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-researcher --raw)
```
Spawn researcher to analyze source code for all pending tracker items:
```
Agent(
  prompt="Analyze source code for auto-revise operation.
    Pending tracker items: {items from init}
    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/codebase-analysis-guide.md
    </files_to_read>
    Save analysis via: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs plans save-analysis --operation auto-revise --content {analysis}",
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
  prompt="Design execution strategy for auto-revise operation.
    Pending items: {selected items}
    Research Analysis: {analysis-file-path or 'none'}
    Flags: {flags}
    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/pipeline-enforcement.md
    </files_to_read>
    Save plan via: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs plans save '{plan-json}'",
  agent="fp-docs-planner",
  model="${PLANNER_MODEL}"
)
```
If `--plan-only`: display plan summary and STOP.
If `--dry-run`: display selected items and STOP.
</step>

<step name="execute-write-phase">
## 4. Write Phase (Stages 1-3)
```bash
MODIFIER_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-modifier --raw)
```
For each selected tracker item, spawn modifier agent:
```
Agent(
  prompt="Execute revise operation for tracker item with pipeline stages 1-3.
    Tracker item: {item description}
    Plan: {plan-file-path}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
    - ${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
    - ${CLAUDE_PLUGIN_ROOT}/references/verbosity-algorithm.md
    - ${CLAUDE_PLUGIN_ROOT}/references/citation-algorithm.md
    - ${CLAUDE_PLUGIN_ROOT}/references/api-ref-algorithm.md
    </files_to_read>

    Primary operation steps:
    1. Read docs/needs-revision-tracker.md. Parse the specific pending item.
    2. Treat the tracker entry description as the revision request.
    3. Execute the revise procedure: identify files, read doc and source, compare,
       build scope manifest, make targeted edits.
    4. Follow all formatting rules from doc-standards.

    Pipeline enforcement (stages 1-3):
    - Stage 1 (Verbosity): Enforce verbosity against scope manifest
    - Stage 2 (Citations): Update citations for changed sections
    - Stage 3 (API Refs): Verify API reference is current

    Do NOT run stages 4-8. Return a Delegation Result.",
  agent="fp-docs-modifier",
  model="${MODIFIER_MODEL}"
)
```
After all items processed, update the tracker:
- Move successfully revised items from Pending to Completed with completion date.
- Leave failed items in Pending with failure note.
</step>

<step name="execute-review-phase">
## 5. Review Phase (Stages 4-5)
```bash
VALIDATOR_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-validator --raw)
```
Spawn ONE validator for ALL modified files:
```
Agent(
  prompt="Validate all files modified by the auto-revise operation.
    Target files: {all files from write phase}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/validation-rules.md
    - ${CLAUDE_PLUGIN_ROOT}/references/validation-algorithm.md
    - ${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
    - ${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
    </files_to_read>

    Run sanity-check (stage 4) on all target files.
    Run 10-point verification (stage 5) on all target files.
    Return a Pipeline Validation Report.",
  agent="fp-docs-validator",
  model="${VALIDATOR_MODEL}"
)
```
</step>

<step name="execute-finalize-phase">
## 6. Finalize Phase (Stages 6-8)
```bash
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline init --operation auto-revise --files {files} --changelog-summary "{summary}"
```
Loop through pipeline next until complete. Single changelog entry covers all items.
</step>

</process>

<success_criteria>
- [ ] Selected tracker items identified and processed
- [ ] Each item revised with full pipeline enforcement (stages 1-3)
- [ ] Tracker updated: successful items moved to Completed, failed items noted
- [ ] Final validation (stages 4-5) covers all changes
- [ ] Single changelog entry for all items
- [ ] Docs committed and pushed
</success_criteria>
