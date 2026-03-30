<purpose>
Create new documentation for undocumented code. Reads source code, finds sibling docs for format
templates, creates complete documentation, then runs the full pipeline enforcement.
</purpose>

<required_reading>
Read all files referenced by the invoking command's execution_context.
</required_reading>

<process>

<step name="initialize" priority="first">
## 1. Initialize
```bash
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init write-op add "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```
Parse JSON for: operation, engine, target_files, pipeline_config, feature_flags.

Check for flags:
- `--visual`: Enable visual verification after creation
- `--no-research`: Skip research phase
- `--plan-only`: Stop after plan phase
</step>

<step name="research">
## 2. Research Phase
Skip if `--no-research` flag is set or `researcher.enabled` is false.

```bash
RESEARCHER_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-researcher --raw)
```
Spawn researcher agent to analyze the new source code:
```
Agent(
  prompt="Analyze source code for add (new documentation) operation.
    Target: {target from init}
    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/codebase-analysis-guide.md
    </files_to_read>
    Use source-map for target-to-source mapping.
    Save analysis via: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs plans save-analysis --operation add --content {analysis}",
  agent="fp-docs-researcher",
  model="${RESEARCHER_MODEL}"
)
```
Extract analysis file path. If researcher fails, proceed without analysis.
</step>

<step name="plan">
## 3. Plan Phase
```bash
PLANNER_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-planner --raw)
```
Spawn planner agent:
```
Agent(
  prompt="Design execution strategy for add operation.
    Target: {target}
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
</step>

<step name="execute-write-phase">
## 4. Write Phase (Stages 1-3)
```bash
MODIFIER_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-modifier --raw)
```
Spawn modifier agent:
```
Agent(
  prompt="Execute add operation with pipeline stages 1-3.
    Target: {target}
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
    1. Parse the user request. Identify what new code was added (file paths, system type)
       and which docs section it belongs in (use source-map lookup).
    2. Read PROJECT-INDEX.md to discover existing files in the target source directory.
    3. Find an existing sibling doc in the same section. Read it for the format template.
    4. Read the new source code file(s). Every detail must come from actual source code.
    5. Build a scope manifest per verbosity-algorithm. Count documentable items.
    6. Create the documentation file at the correct path:
       - Follow the format template from sibling doc and doc-standards.
       - Meet all depth requirements.
       - Use [NEEDS INVESTIGATION] for anything unclear -- never fabricate.
    7. If doc type requires API Reference: generate per api-ref-algorithm.
    8. Update links: add new doc to parent _index.md and About.md if new section.
    9. If --visual flag: perform visual verification against foreignpolicy.local.

    Pipeline enforcement (stages 1-3):
    - Stage 1 (Verbosity): Enforce verbosity against scope manifest
    - Stage 2 (Citations): Generate citations for new doc
    - Stage 3 (API Refs): Verify API reference completeness

    Do NOT run stages 4-8. Return a Delegation Result.",
  agent="fp-docs-modifier",
  model="${MODIFIER_MODEL}"
)
```
Extract summary: files created/modified, stage statuses, issue count.
</step>

<step name="execute-review-phase">
## 5. Review Phase (Stages 4-5)
```bash
VALIDATOR_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-validator --raw)
```
Spawn validator agent:
```
Agent(
  prompt="Validate files created/modified by the add operation.
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
If sanity-check confidence is LOW: retry once.
</step>

<step name="execute-finalize-phase">
## 6. Finalize Phase (Stages 6-8)
```bash
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline init --operation add --files {files} --changelog-summary "{summary}"
```
Loop:
```bash
NEXT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline next)
# action == "execute" -> fp-tools pipeline run-stage {id}
#   Stage 6: Changelog update
#   Stage 7: Index update (structural change -- always triggers)
#   Stage 8: Docs commit and push
# action == "complete" -> done
# action == "blocked" -> halt
```
</step>

</process>

<success_criteria>
- [ ] New documentation file created at correct path
- [ ] All content derived from actual source code
- [ ] Format matches sibling docs and doc-standards
- [ ] Pipeline stages 1-8 completed
- [ ] Parent index and About.md updated
- [ ] Changelog entry added
- [ ] Docs committed and pushed
</success_criteria>
