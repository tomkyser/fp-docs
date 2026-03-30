<purpose>
Detect documentation affected by recent code changes and update it automatically. Uses git diff
to find changed source files, maps them to documentation targets via source-map, and updates
all affected docs with full pipeline enforcement.
</purpose>

<required_reading>
Read all files referenced by the invoking command's execution_context.
</required_reading>

<process>

<step name="initialize" priority="first">
## 1. Initialize
```bash
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init write-op auto-update "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```
Parse JSON for: operation, engine, target_files, pipeline_config, feature_flags, changed_files.

Check for flags:
- `--visual`: Enable visual verification after updates
- `--no-research`: Skip research phase
- `--plan-only`: Stop after plan phase
- `--no-sanity-check`: Skip sanity-check in review phase
- Scope restriction from $ARGUMENTS
</step>

<step name="research">
## 2. Research Phase
Skip if `--no-research` or `researcher.enabled` is false.

```bash
RESEARCHER_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-researcher --raw)
```
Spawn researcher agent to analyze changed source files:
```
Agent(
  prompt="Analyze source code changes for auto-update operation.
    Changed files: {changed_files from init}
    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/codebase-analysis-guide.md
    </files_to_read>
    Save analysis via: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs plans save-analysis --operation auto-update --content {analysis}",
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
Spawn planner agent:
```
Agent(
  prompt="Design execution strategy for auto-update operation.
    Changed files: {changed_files}
    Research Analysis: {analysis-file-path or 'none'}
    Flags: {flags}
    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/pipeline-enforcement.md
    </files_to_read>
    Classify scope: single-file, multi-file, or batch based on changed file count.
    Save plan via: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs plans save '{plan-json}'",
  agent="fp-docs-planner",
  model="${PLANNER_MODEL}"
)
```
If `--plan-only`: display plan summary and STOP.
</step>

<step name="execute-write-phase">
## 4. Write Phase (Stages 1-3)
```bash
MODIFIER_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-modifier --raw)
```

Scope determines parallelism:
- 1 file: single agent spawn
- 2-8 files: parallel agent spawns
- 9+ files: batched waves (max 5 concurrent)

For each batch, spawn modifier agent:
```
Agent(
  prompt="Execute auto-update operation with pipeline stages 1-3.
    Target files: {batch assignment}
    Plan: {plan-file-path}
    Flags: {flags}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
    - ${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
    - ${CLAUDE_PLUGIN_ROOT}/references/verbosity-algorithm.md
    - ${CLAUDE_PLUGIN_ROOT}/references/citation-algorithm.md
    - ${CLAUDE_PLUGIN_ROOT}/references/api-ref-algorithm.md
    </files_to_read>

    Primary operation steps:
    1. Read docs/changelog.md. Find the most recent entry date as baseline.
    2. Review the changed files list. Filter to documentation-relevant source files
       (remove docs/, node_modules/, vendor/, public/, .git/).
    3. Map each changed source file to its doc target using source-map lookup.
       Identify additions, modifications, and removals. Apply scope restriction if present.
    4. If no changed files map to any doc targets: report 'No documentation-relevant changes found' and exit.
    5. Build scope manifests per verbosity-algorithm for each affected doc.
    6. Execute updates:
       - Modified source files: read current source, read existing doc, update doc to reflect changes.
       - New source files without docs: find sibling doc for format, create documentation.
       - Removed source files: add REMOVED notice to the doc.
    7. If doc types require API Reference: maintain API Reference sections.
    8. Update links for any docs created or removed.
    9. If --visual flag: visual verification for each updated doc page.

    Pipeline enforcement (stages 1-3):
    - Stage 1 (Verbosity): Enforce verbosity against scope manifests
    - Stage 2 (Citations): Update citations for changed sections
    - Stage 3 (API Refs): Verify API references are current

    Do NOT run stages 4-8. Return a Delegation Result.",
  agent="fp-docs-modifier",
  model="${MODIFIER_MODEL}"
)
```
Collect summaries from all spawns.
</step>

<step name="execute-review-phase">
## 5. Review Phase (Stages 4-5)
```bash
VALIDATOR_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-validator --raw)
```
Spawn ONE validator for ALL modified files:
```
Agent(
  prompt="Validate all files modified by the auto-update operation.
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
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline init --operation auto-update --files {files} --changelog-summary "{summary}"
```
Loop through pipeline next until complete.
</step>

</process>

<success_criteria>
- [ ] All documentation-relevant code changes identified
- [ ] Affected docs updated to reflect source changes
- [ ] New docs created for new source files
- [ ] Pipeline stages 1-8 completed
- [ ] Changelog entry added
- [ ] Docs committed and pushed
</success_criteria>
