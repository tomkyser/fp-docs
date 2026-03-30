<purpose>
Mark documentation as deprecated or removed. For deprecated code (still in codebase), adds
[LEGACY] markers and deprecation notices. For removed code (deleted from codebase), adds
REMOVED notices and removes from indexes. Updates cross-references and appendices.
</purpose>

<required_reading>
Read all files referenced by the invoking command's execution_context.
</required_reading>

<process>

<step name="initialize" priority="first">
## 1. Initialize
```bash
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init write-op deprecate "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```
Parse JSON for: operation, engine, target_files, pipeline_config, feature_flags.

Check for flags:
- `--no-research`: Skip research phase
- `--plan-only`: Stop after plan phase
</step>

<step name="research">
## 2. Research Phase
Skip if `--no-research` or `researcher.enabled` is false.

```bash
RESEARCHER_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-researcher --raw)
```
Spawn researcher to analyze the deprecated/removed code:
```
Agent(
  prompt="Analyze source code for deprecate operation.
    Target: {target from init}
    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/codebase-analysis-guide.md
    </files_to_read>
    Determine: is the code deprecated (still in codebase) or removed (deleted)?
    What is the replacement, if any?
    Save analysis via: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs plans save-analysis --operation deprecate --content {analysis}",
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
  prompt="Design execution strategy for deprecate operation.
    Target: {target}
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

<step name="execute-write-phase">
## 4. Write Phase (Stages 1-3)
```bash
MODIFIER_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-modifier --raw)
```
Spawn modifier agent:
```
Agent(
  prompt="Execute deprecate operation with pipeline stages 1-3.
    Target: {target}
    Plan: {plan-file-path}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
    - ${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
    - ${CLAUDE_PLUGIN_ROOT}/references/verbosity-algorithm.md
    - ${CLAUDE_PLUGIN_ROOT}/references/citation-algorithm.md
    - ${CLAUDE_PLUGIN_ROOT}/references/api-ref-algorithm.md
    </files_to_read>

    Primary operation steps:
    1. Parse the request. Identify which code/docs are being deprecated or removed,
       whether the code is deprecated (still in codebase) or removed (deleted),
       and what the replacement is.
    2. For deprecated code (still in codebase):
       a. Read the current documentation file.
       b. Add [LEGACY] to the document title.
       c. Add deprecation notice after the title: > **Deprecated**: [YYYY-MM-DD]. [Replacement info]
       d. Update parent _index.md entry to include [LEGACY].
       e. Update About.md entry to include [LEGACY].
    3. For removed code (deleted from codebase):
       a. Read the current documentation file.
       b. Add REMOVED notice at top: > **REMOVED**: This file was deleted on [YYYY-MM-DD].
       c. Remove the entry from parent _index.md.
       d. Remove the entry from About.md.
    4. Update cross-references: search for docs linking to the deprecated/removed doc.
       Update link text with [LEGACY] or remove link as appropriate.
    5. Check appendices: if the deprecated/removed code registered hooks, shortcodes,
       REST routes, constants, ACF groups, or feature templates, update the relevant appendix.

    Pipeline enforcement (stages 1-3):
    - Stage 1 (Verbosity): Enforce verbosity against scope manifest
    - Stage 2 (Citations): Update citations for changed sections
    - Stage 3 (API Refs): Verify API reference is current

    Do NOT run stages 4-8. Return a Delegation Result.",
  agent="fp-docs-modifier",
  model="${MODIFIER_MODEL}"
)
```
</step>

<step name="execute-review-phase">
## 5. Review Phase (Stages 4-5)
```bash
VALIDATOR_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-validator --raw)
```
Spawn validator agent:
```
Agent(
  prompt="Validate files modified by the deprecate operation.
    Target files: {files from write phase}

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
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline init --operation deprecate --files {files} --changelog-summary "{summary}"
```
Loop through pipeline next until complete. Stage 7 (index update) always triggers for structural changes.
</step>

</process>

<success_criteria>
- [ ] Deprecated code marked with [LEGACY] or REMOVED notice
- [ ] Cross-references updated throughout docs
- [ ] Appendices updated for hook/shortcode/route removals
- [ ] Pipeline stages 1-8 completed
- [ ] Changelog entry added
- [ ] Docs committed and pushed
</success_criteria>
