<purpose>
Locate, update, and validate documentation that the user identifies as wrong or outdated.
Handles research, planning, modification, pipeline enforcement (verbosity, citations, API refs,
sanity-check, verification), changelog, index update, and git commit.
</purpose>

<required_reading>
Read all files referenced by the invoking command's execution_context.
</required_reading>

<process>

<step name="initialize" priority="first">
## 1. Initialize
```bash
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init write-op revise "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```
Parse JSON for: operation, engine, target_files, pipeline_config, feature_flags.

Check for flags:
- `--visual`: Enable visual verification after primary operation
- `--no-research`: Skip research phase
- `--plan-only`: Stop after plan phase
- `--no-sanity-check`: Skip sanity-check in review phase
</step>

<step name="research">
## 2. Research Phase
Skip if `--no-research` flag is set or `researcher.enabled` is false in config.

```bash
RESEARCHER_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-researcher --raw)
```
Spawn researcher agent:
```
Agent(
  prompt="Analyze source code for revise operation.
    Target: {target from init}
    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/codebase-analysis-guide.md
    </files_to_read>
    Use source-map for target-to-source mapping:
    node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs source-map lookup {source-path}
    Save analysis via: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs plans save-analysis --operation revise --content {analysis}",
  agent="fp-docs-researcher",
  model="${RESEARCHER_MODEL}"
)
```
Extract analysis file path from result. If researcher fails, proceed without analysis.
</step>

<step name="plan">
## 3. Plan Phase
```bash
PLANNER_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-planner --raw)
```
Spawn planner agent with research results:
```
Agent(
  prompt="Design execution strategy for revise operation.
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
Extract plan_id and plan file path. Load plan: `node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs plans load {plan-id}`

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
  prompt="Execute revise operation with pipeline stages 1-3.
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
    1. Parse the user request. Identify which doc file(s) need revision, what is incorrect,
       and what source file(s) are relevant (use source-map lookup).
    2. Read the current documentation file(s).
    3. Read the corresponding source code file(s).
    4. Compare and identify specific discrepancies between doc claims and source code.
    5. Build a scope manifest per verbosity-algorithm. Count documentable items, establish binding targets.
    6. Make targeted edits to correct discrepancies:
       - Follow all formatting and content rules from doc-standards.
       - Preserve all content that is still accurate.
       - If revision touches hooks, shortcodes, REST routes, constants, ACF groups, or feature templates,
         check appendix cross-reference table and update the relevant appendix.
    7. If doc type requires API Reference: verify API Reference section exists and is current.
    8. If --visual flag present: perform visual verification against foreignpolicy.local.

    Pipeline enforcement (stages 1-3):
    - Stage 1 (Verbosity): Enforce verbosity against scope manifest
    - Stage 2 (Citations): Update citations for changed sections
    - Stage 3 (API Refs): Verify API reference is current

    Do NOT run stages 4-8. Return a Delegation Result.",
  agent="fp-docs-modifier",
  model="${MODIFIER_MODEL}"
)
```
Extract summary: files modified, stage statuses, issue count.
</step>

<step name="execute-review-phase">
## 5. Review Phase (Stages 4-5)
```bash
VALIDATOR_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-validator --raw)
```
Spawn validator agent:
```
Agent(
  prompt="Validate files modified by the revise operation.
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
If sanity-check confidence is LOW: retry once. If still LOW, report without committing.
</step>

<step name="execute-finalize-phase">
## 6. Finalize Phase (Stages 6-8)
```bash
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline init --operation revise --files {files} --changelog-summary "{summary}"
```
Loop:
```bash
NEXT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline next)
# action == "execute" -> fp-tools pipeline run-stage {id}
#   Stage 6: Changelog update
#   Stage 7: Index update (may need index agent spawn)
#   Stage 8: Docs commit and push
# action == "complete" -> done, extract completion marker
# action == "blocked" -> HALLUCINATION detected, halt
```
Include completion marker verbatim in final report.
</step>

</process>

<success_criteria>
- [ ] Target documentation identified and updated
- [ ] All source code claims verified against actual source
- [ ] Pipeline stages 1-3 completed by modifier agent
- [ ] Pipeline stages 4-5 completed by validator agent
- [ ] Pipeline stages 6-8 completed via CJS pipeline loop
- [ ] Changelog entry added
- [ ] Docs committed and pushed
</success_criteria>
