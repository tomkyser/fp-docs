# Write Workflow Template v2

> Template for redesigned write workflows.
> Created: 2026-03-30 (Round 2, Phase 2)
> Status: Pattern spec for 9 write workflow redesigns

---

## Overview

The v2 write workflow expands from 6 steps to 10 steps. The key structural change: pipeline enforcement stages 1-3 (verbosity, citations, API refs) each get their own dedicated agent spawn instead of being folded into the modifier agent.

```
v1: init → research(1) → plan → write+stages1-3 → review(4-5) → finalize(6-8)
v2: init → scope-assess → research(1-N) → plan → write(primary only) → verbosity(dedicated) → citations(dedicated) → api-refs(dedicated) → review(4-5) → finalize(6-8)
```

**Why isolate pipeline stages?** In v1, the modifier agent handles primary operation + 3 enforcement stages. This overloads a single agent context with too many concerns. The modifier needs to hold doc-standards, fp-project, AND all three algorithm references simultaneously. By splitting, each agent loads only the references it needs and does one job well.

---

## Step-by-Step Template

```xml
<purpose>
{Operation-specific description. What this workflow does.}
</purpose>

<required_reading>
Read all files referenced by the invoking command's execution_context.
</required_reading>

<process>

<step name="initialize" priority="first">
## 1. Initialize
```bash
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init write-op {command} "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```
Parse JSON for: operation, agent, target_files, pipeline_config, feature_flags.

Check for flags:
- `--visual`: Enable visual verification
- `--no-research`: Skip scope-assess + research phases
- `--plan-only`: Stop after plan phase
- `--no-sanity-check`: Skip sanity-check in review phase
- `--no-verbosity`: Skip dedicated verbosity stage
- `--no-citations`: Skip dedicated citations stage
- `--no-api-ref`: Skip dedicated API refs stage
</step>

<step name="scope-assess">
## 2. Scope Assessment
Skip if `--no-research` flag is set.

```bash
SCOPE=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" scope-assess {command} "$ARGUMENTS")
if [[ "$SCOPE" == @file:* ]]; then SCOPE=$(cat "${SCOPE#@file:}"); fi
```
Parse JSON for: complexity, researcherCount, targets, trackerRequired, delegationPlan.

If trackerRequired:
```bash
TRACKER_ID=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" tracker create --command {command} --complexity {complexity})
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
  prompt="Analyze source code for {command} operation.
    Targets: {researcher.targets}
    Tracker: {TRACKER_ID or 'none'}
    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/codebase-analysis-guide.md
    </files_to_read>
    Use source-map for target-to-source mapping:
    node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs source-map lookup {source-path}
    Save analysis via: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs plans save-analysis --operation {command} --content {analysis}
    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update {TRACKER_ID} --step research --agent researcher --status done --detail {summary}",
  agent="fp-docs-researcher",
  model="${RESEARCHER_MODEL}"
)
```

If researcherCount == 1: spawn synchronously.
If researcherCount > 1: spawn all, collect all analyses.
</step>

<step name="plan">
## 4. Plan Phase
```bash
PLANNER_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-planner --raw)
```
Spawn planner agent:
```
Agent(
  prompt="Design execution strategy for {command} operation.
    Targets: {targets}
    Research: {analysis-file-paths or 'none'}
    Scope: {complexity}
    Flags: {flags}
    Tracker: {TRACKER_ID or 'none'}
    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/pipeline-enforcement.md
    </files_to_read>
    Save plan via: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs plans save '{plan-json}'
    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update {TRACKER_ID} --step plan --agent planner --status done --detail {summary}",
  agent="fp-docs-planner",
  model="${PLANNER_MODEL}"
)
```
Extract plan_id and plan file path.

If `--plan-only`: display plan summary and STOP.
</step>

<step name="execute-primary">
## 5. Write Phase (Primary Operation Only)
```bash
MODIFIER_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model {primary-agent} --raw)
```
Spawn primary specialist agent:
```
Agent(
  prompt="Execute {command} operation -- PRIMARY OPERATION ONLY.
    Targets: {targets}
    Plan: {plan-file-path}
    Flags: {flags}
    Tracker: {TRACKER_ID or 'none'}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
    - ${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
    </files_to_read>

    {Operation-specific primary steps here.}

    IMPORTANT: Do NOT run pipeline enforcement stages (verbosity, citations, API refs).
    Those are handled by dedicated agents in subsequent steps.
    Do NOT run stages 4-8.
    Return a Primary Operation Result listing files modified and a brief summary.

    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update {TRACKER_ID} --step write --agent {primary-agent} --status done --detail {summary}",
  agent="{primary-agent}",
  model="${MODIFIER_MODEL}"
)
```
Extract: files modified, summary. These feed into the dedicated enforcement agents.
</step>

<step name="enforce-verbosity">
## 6. Verbosity Enforcement (Stage 1 -- Dedicated)
Skip if `--no-verbosity` flag is set or `verbosity.enabled` is false.

```bash
VERBOSITY_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-verbosity-enforcer --raw)
```
Spawn dedicated verbosity agent:
```
Agent(
  prompt="Enforce verbosity on files modified by {command} operation.
    Target files: {files from write phase}
    Tracker: {TRACKER_ID or 'none'}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/verbosity-rules.md
    - ${CLAUDE_PLUGIN_ROOT}/references/verbosity-algorithm.md
    - ${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
    </files_to_read>

    For each target file:
    1. Identify the corresponding source file(s) via source-map lookup
    2. Build scope manifest: count every documentable item in source
    3. Compare against documentation: verify 100% coverage
    4. Scan for banned summarization phrases
    5. If gaps found: fix them (add missing items, expand summaries)

    Return a Verbosity Enforcement Result with per-file status (PASS/FIXED/FAIL).

    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update {TRACKER_ID} --step verbosity --agent fp-docs-verbosity-enforcer --status done --detail {summary}",
  agent="fp-docs-verbosity-enforcer",
  model="${VERBOSITY_MODEL}"
)
```
Note: fp-docs-verbosity-enforcer is write-capable (has Write/Edit tools). fp-docs-verbosity remains read-only for audit commands.
</step>

<step name="enforce-citations">
## 7. Citation Enforcement (Stage 2 -- Dedicated)
Skip if `--no-citations` flag is set or `citations.enabled` is false.

```bash
CITATIONS_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-citations --raw)
```
Spawn dedicated citations agent:
```
Agent(
  prompt="Enforce citations on files modified by {command} operation.
    Target files: {files from write phase}
    Tracker: {TRACKER_ID or 'none'}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/citation-rules.md
    - ${CLAUDE_PLUGIN_ROOT}/references/citation-algorithm.md
    - ${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
    </files_to_read>

    For each target file:
    1. Parse existing citation blocks
    2. Check staleness against current source (Fresh/Stale/Drifted/Broken/Missing)
    3. Update stale/drifted citations with current source
    4. Generate missing citations for undocumented elements
    5. Verify citation format compliance

    Return a Citation Enforcement Result with per-file status.

    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update {TRACKER_ID} --step citations --agent fp-docs-citations --status done --detail {summary}",
  agent="fp-docs-citations",
  model="${CITATIONS_MODEL}"
)
```
</step>

<step name="enforce-api-refs">
## 8. API Reference Enforcement (Stage 3 -- Dedicated)
Skip if `--no-api-ref` flag is set or `api_ref.enabled` is false.
Also skip if no target files require API Reference sections (per doc type).

```bash
APIREFS_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-api-refs --raw)
```
Spawn dedicated API refs agent:
```
Agent(
  prompt="Enforce API references on files modified by {command} operation.
    Target files: {files from write phase}
    Tracker: {TRACKER_ID or 'none'}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/api-ref-rules.md
    - ${CLAUDE_PLUGIN_ROOT}/references/api-ref-algorithm.md
    - ${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
    </files_to_read>

    For each target file that requires API Reference:
    1. Verify API Reference section exists
    2. Extract function signatures from source code
    3. Compare against documented signatures
    4. Update stale rows, add missing rows
    5. Verify provenance column is populated

    Return an API Reference Enforcement Result with per-file status.

    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update {TRACKER_ID} --step api-refs --agent fp-docs-api-refs --status done --detail {summary}",
  agent="fp-docs-api-refs",
  model="${APIREFS_MODEL}"
)
```
</step>

<step name="execute-review-phase">
## 9. Review Phase (Stages 4-5)
```bash
VALIDATOR_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-validator --raw)
```
Spawn validator agent:
```
Agent(
  prompt="Validate files modified by the {command} operation.
    Target files: {all files from write phase}
    Tracker: {TRACKER_ID or 'none'}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/validation-rules.md
    - ${CLAUDE_PLUGIN_ROOT}/references/validation-algorithm.md
    - ${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
    - ${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
    </files_to_read>

    Run sanity-check (stage 4) on all target files.
    Run 10-point verification (stage 5) on all target files.
    Return a Pipeline Validation Report.

    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update {TRACKER_ID} --step review --agent fp-docs-validator --status done --detail {summary}",
  agent="fp-docs-validator",
  model="${VALIDATOR_MODEL}"
)
```
If sanity-check confidence is LOW: retry once.
</step>

<step name="execute-finalize-phase">
## 10. Finalize Phase (Stages 6-8)
```bash
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline init --operation {command} --files {files} --changelog-summary "{summary}"
```
Loop:
```bash
NEXT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline next)
# action == "execute" -> fp-tools pipeline run-stage {id}
#   Stage 6: Changelog update
#   Stage 7: Index update
#   Stage 8: Docs commit and push
# action == "complete" -> done
# action == "blocked" -> halt
```

If tracker exists:
```bash
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" tracker update {TRACKER_ID} --step finalize --agent workflow --status done --detail '{commit-hash}'
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" tracker complete {TRACKER_ID}
```

Include completion marker verbatim in final report.
</step>

</process>

<success_criteria>
- [ ] {Operation-specific criteria}
- [ ] All source code claims verified against actual source
- [ ] Primary operation completed by specialist agent (step 5)
- [ ] Verbosity enforcement completed by dedicated agent (step 6)
- [ ] Citation enforcement completed by dedicated agent (step 7)
- [ ] API reference enforcement completed by dedicated agent (step 8)
- [ ] Pipeline stages 4-5 completed by validator agent (step 9)
- [ ] Pipeline stages 6-8 completed via CJS pipeline loop (step 10)
- [ ] Tracker updated at each phase (if created)
- [ ] Changelog entry added
- [ ] Docs committed and pushed
</success_criteria>
```

---

## Agent Definition Status

**Resolved (Phase 2):** Option A implemented -- `fp-docs-verbosity-enforcer` agent created with Write/Edit tools for pipeline stage 1 enforcement. `fp-docs-verbosity` remains read-only for `/fp-docs:verbosity-audit`.

---

## Which Workflows Use This Template

| Workflow | Primary Agent | Notes |
|----------|---------------|-------|
| `revise.md` | fp-docs-modifier | Standard template |
| `add.md` | fp-docs-modifier | Standard template |
| `auto-update.md` | fp-docs-modifier | Batch-aware (parallel modifiers for multi-file) |
| `auto-revise.md` | fp-docs-modifier | Reads needs-revision-tracker for targets |
| `deprecate.md` | fp-docs-modifier | Standard template |
| `citations.md` | fp-docs-citations | Subcommand-based; generate/update use pipeline, verify/audit are read-only |
| `api-ref.md` | fp-docs-api-refs | Subcommand-based; generate uses pipeline, audit is read-only |
| `locals.md` | fp-docs-locals | Subcommand-based; annotate/contracts use pipeline, validate/coverage are read-only |
| `remediate.md` | (varies per issue) | Batch remediation; delegates to multiple specialists |

### Special cases

- **citations.md, api-ref.md, locals.md**: These are subcommand-based workflows. Write subcommands use the full v2 template. Read subcommands skip steps 5-8 and go straight to step 9 (or just produce a report with no pipeline at all).

- **auto-update.md**: Batch-aware. When multiple files are affected, the write phase (step 5) may spawn multiple modifier agents in parallel. Steps 6-8 (enforcement) still run once across all modified files.

- **remediate.md**: The primary agent varies per remediation issue type. The workflow reads the remediation plan and delegates to the appropriate specialist for each issue.

---

## Transition Notes

- Steps 6/7/8 (dedicated enforcement agents) are new. They replace the enforcement work that was previously bundled into step 5 (modifier + stages 1-3).
- The modifier agent's prompt MUST explicitly say "Do NOT run pipeline enforcement stages" to prevent it from doing the old behavior.
- The finalize phase (step 10) is unchanged from v1 except for tracker updates.
- The overall agent count per write operation increases from 5 (workflow + researcher + planner + modifier + validator) to 8 (workflow + researcher + planner + modifier + verbosity + citations + api-refs + validator). Enforcement stages that are skipped (via flags or config) reduce this count.
