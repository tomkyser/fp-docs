# Master Delegation Algorithm

> Read by the orchestrate engine for every invocation. Defines the complete delegation protocol.
> Updated Phase 16: 5-phase delegation model (D-09/D-10), researcher and planner agents, plan-based execution (D-06/D-07/D-08).

---

## Step 1: Parse Routing Information

Extract from the skill prompt:
- `Engine:` -- the specialist engine name
- `Operation:` -- the operation within that engine
- `Instruction:` -- path to the instruction file (relative to plugin root)
- User arguments -- everything after the routing metadata

If explicit routing lines are missing, infer from the prompt content:
- Look for "Operation: {name}" patterns
- Match instruction file paths to determine engine
- Fall back to content analysis if needed

## Step 2: Classify Command Type

Use the routing table in your system prompt to classify:

### Write Commands
Require full 3-phase delegation: Write Phase -> Review Phase -> Finalize Phase.

| Engine | Operations |
|--------|-----------|
| modify | revise, add, auto-update, auto-revise, deprecate |
| citations | generate, update |
| api-refs | generate |
| locals | annotate, contracts, shapes |
| orchestrate | remediate |

### Read-Only Commands
Fast path: spawn specialist in standalone mode, return report.

| Engine | Operations |
|--------|-----------|
| validate | audit, verify, sanity-check, test |
| verbosity | audit |
| citations | verify, audit |
| api-refs | audit |
| locals | cross-ref, validate, coverage |

### Administrative Commands
Spawn specialist in standalone mode -- engine handles its own workflow.

| Engine | Operations |
|--------|-----------|
| index | update-project-index, update-doc-links, update-example-claude |
| system | update-skills, setup, sync, update |

### Batch Commands
The `parallel` command and any operation with `--batch-mode team`.

### Meta-Commands (Not Delegated)

Two commands are handled directly by the orchestrate engine and do NOT follow the delegation algorithm:

| Command | Behavior |
|---------|----------|
| `/fp-docs:do` | Smart router -- orchestrate engine matches intent to a routing-table command, then re-enters delegation for the matched command |
| `/fp-docs:help` | Command reference -- orchestrate engine calls `fp-tools.cjs help grouped` and formats the output directly |

These are the only exceptions to the delegation rule. All 21 routing-table commands delegate to specialist engines. Total command count: 23 (21 routing-table + 2 meta).

## Step 3: Parse Execution Mode and Scope

### 3a. Parse --batch-mode Flag (D-08)

Scan user arguments for `--batch-mode` flag:
- `--batch-mode subagent` (or flag absent): **Subagent mode** (default)
- `--batch-mode team` (or `--use-agent-team`): **Team mode**
- `--batch-mode sequential`: **Sequential mode**

### 3b. Scope Analysis (Write Commands Only)

1. Parse the user's target to determine affected files:
   - Single file path -> 1 file
   - Directory path -> count files in directory
   - "all" or no scope -> count all doc files
   - Git diff scope -> count changed files

2. For subagent mode, scope determines parallelism level:
   - 1 file: single Agent call
   - 2-8 files: parallel Agent calls (fan-out)
   - 9+ files: parallel Agent calls in batches (max 5 concurrent)

3. For team mode, scope determines teammate count and batch size:
   - Use mod-orchestration thresholds for max_teammates and max_files_per_batch

### 3c. Parse Pre-Execution Flags

Scan user arguments for pre-execution flags:
- `--no-research`: Skip the Research Phase entirely. Planner works without source analysis.
- `--plan-only`: Stop after Plan Phase. Display plan summary. Do not execute Write/Review/Finalize phases.

Config overrides (read from system-config §9):
- `researcher.enabled = false`: Config-level equivalent of always passing --no-research
- `planner.enabled = false`: Config-level skip of Plan Phase. Orchestrator uses legacy 3-phase direct delegation.

### Architectural Rule (D-06)

**The orchestrator NEVER directly executes fp-docs operations.** All work is delegated to subagents via the Agent tool. The orchestrator is a pure dispatcher: it decides what to do, spawns agents to do it, and aggregates results.

## Step 4: Construct Delegation Prompts

### Research Phase Prompt Template (for researcher engine)

```
Mode: DELEGATED

Operation: {operation}
Target: {target-scope}
Flags: {flags}

Analyze the source code relevant to this operation. Read the codebase analysis
guide at {plugin-root}/framework/algorithms/codebase-analysis-guide.md for
scanning patterns. Use source-map for target-to-source mapping.

Produce a structured analysis document and save it via:
node {plugin-root}/fp-tools.cjs plans save-analysis --operation {operation} --content "{analysis-markdown}"

Return a Research Result with the analysis file path, source files analyzed,
key findings, and scope assessment.
```

### Plan Phase Prompt Template (for planner engine)

```
Mode: DELEGATED

Operation: {operation}
Target: {target-scope}
Flags: {flags}
Research Analysis: {analysis-file-path}

Design the execution strategy for this operation. Load the research analysis
file. Use mod-orchestration thresholds for batching decisions.

Create a plan file via:
node {plugin-root}/fp-tools.cjs plans save '{plan-json}'

Return a Plan Result with the plan ID, file path, strategy summary, and
research analysis reference.
```

### Write Phase Prompt Template (for primary engine)

```
Mode: DELEGATED

Operation: {operation}
Instruction: {instruction-file-path}
Target: {target-scope}
Flags: {flags}

You are being invoked by the orchestration engine as a specialist subagent.
Execute ONLY the primary operation AND enforcement pipeline stages (1-3: verbosity,
citations, API refs) as applicable per the pipeline trigger matrix.

Do NOT run validation stages (4-5: sanity-check, verify).
Do NOT update the changelog.
Do NOT update the index.
Do NOT commit to git.

When complete, return a structured result:

## Delegation Result
### Files Modified
- {path}: {description}
### Enforcement Stages
- Verbosity: {PASS|FAIL|SKIPPED}
- Citations: {PASS|FAIL|SKIPPED}
- API Refs: {PASS|FAIL|SKIPPED|N/A}
### Issues
- {any concerns or [NEEDS INVESTIGATION] items}

Delegation complete: [verbosity: {status}] [citations: {status}] [api-refs: {status}]
```

### Review Phase Prompt Template (for validate engine)

```
Mode: PIPELINE-VALIDATION

Target files:
{list each file path from the write phase delegation result}

You are being invoked by the orchestration engine to validate files modified
by another specialist.

Run sanity-check (stage 4) on all target files listed above.
Run 10-point verification (stage 5) on all target files listed above.

Return a structured validation report:

## Pipeline Validation Report
### Sanity Check
- Overall confidence: {HIGH|MEDIUM|LOW}
- {file}: {confidence} -- {details}
### Verification Checklist
- {file}: {PASS|FAIL} -- {check results}
### Issues Requiring Remediation
- {specific issues with file paths and descriptions}
### Recommended Commands
- {for each issue, the specific /fp-docs: command to resolve it}
```

### Teammate Prompt Template (for team mode batch operations)

```
Mode: DELEGATED

Operation: {operation}
Instruction: {instruction-file-path}
Batch assignment:
{list of files in this teammate's batch}
Flags: {flags}

You are a teammate in a batch documentation operation. Process ONLY your assigned
files above. Execute the primary operation AND enforcement pipeline stages (1-3).

Do NOT process files outside your batch.
Do NOT run validation stages (4-5).
Do NOT update the changelog.
Do NOT update the index.
Do NOT commit to git.

When complete, return a Delegation Result for your batch.
```

## Step 5: Execute Delegation (5-Phase Model)

### 5-Phase Execution (Default)

All command types (write, read-only, administrative) proceed through the 5-phase model. The phases are: Research, Plan, Write/Read/Admin, Review, Finalize. Read-only and administrative operations create minimal plans and skip the Review and Finalize phases.

#### Phase 1: Research (Researcher Engine)

If `--no-research` flag is NOT set AND `researcher.enabled` config is true:
1. Spawn the researcher engine as a subagent via Agent tool with the Research Phase prompt
2. Wait for Research Result
3. Extract analysis file path from the result
4. If researcher fails: log warning, proceed to Phase 2 without analysis (graceful degradation)

If `--no-research` IS set OR `researcher.enabled` is false:
- Skip to Phase 2 with no analysis file path

#### Phase 2: Plan (Planner Engine)

If `planner.enabled` config is true:
1. Spawn the planner engine as a subagent via Agent tool with the Plan Phase prompt
   (include the analysis file path from Phase 1, or "none" if research was skipped)
2. Wait for Plan Result
3. Extract plan_id and plan file path from the result
4. Load the plan file: `node {plugin-root}/fp-tools.cjs plans load {plan-id}`
5. Parse the plan JSON

If `--plan-only` flag IS set:
- Display the plan summary to the user
- Output: "Plan created: {plan-id}. Run without --plan-only to execute."
- STOP. Do not proceed to Phase 3.

If `planner.enabled` is false:
- Skip to Phase 3 using legacy direct delegation (construct strategy inline as before)

#### Phase 3: Write (per plan strategy)

Execute the write phase driven by the plan file's `strategy.phases` array.
For each phase entry in the plan with `phase="write"`:
- Use the engine, operation, and targets from the plan
- Construct delegation prompt as before (Write Phase Prompt Template)
- After completion, update plan: `node {plugin-root}/fp-tools.cjs plans update {plan-id} '{"completed":["write"]}'`

**Within Phase 3, the execution mode determines HOW specialist engines are spawned:**

### Subagent Mode (default -- D-06, D-08)

#### For scope = 1 file:
1. Spawn primary engine with Write Phase prompt via Agent tool
2. Extract summary from Delegation Result (see Context Offloading below)
3. Continue to Phase 4

#### For scope = 2-8 files:
1. Partition files into logical groups (by section when possible, max 3 per group)
2. Spawn multiple primary engines in PARALLEL via multiple Agent tool calls
3. Extract summaries from all Delegation Results
4. Continue to Phase 4

#### For scope = 9+ files:
1. Partition files into batches (max 5 per batch)
2. Execute batches in waves of max 5 concurrent Agent calls
3. Wait for each wave to complete before starting next wave
4. Extract summaries from all Delegation Results
5. Continue to Phase 4

### Team Mode (explicit request -- D-07, D-08)

#### Confirmation Prompt
If `--use-agent-team` or `--batch-mode team` was NOT passed:

Display to user:
```
This operation affects {N} files. Create an Agent Team for parallel processing?
Agent Teams use inter-agent coordination and are best for large, complex batches.
(Pass --use-agent-team to skip this prompt in the future.)

Proceed with Agent Team? [yes/no]
```

Wait for user confirmation. If "no", fall back to subagent mode.

#### Team Execution
1. TeamCreate("fp-docs-{operation}-{timestamp}")
2. Create Tasks via TaskCreate (one per batch of files)
3. Spawn teammates -- each teammate runs as a specialist engine in delegated mode, working on its assigned batch directly (teammates do NOT spawn sub-subagents)
4. Monitor via TaskList until all complete
5. Continue to Phase 4
6. Execute ONE Finalize Phase (Phase 5)
7. Clean up team

**Critical constraint:** Teammates cannot spawn their own subagents or teams. Each teammate IS the specialist -- it reads the instruction file and does the work directly.

### Sequential Mode (D-08)

1. For each file in scope:
   a. Spawn single specialist subagent via Agent tool
   b. Wait for completion
   c. Extract summary from Delegation Result
   d. Proceed to next file
2. Continue to Phase 4

#### Phase 4: Review (per plan strategy)

Spawn ONE validate engine for ALL modified files with the Review Phase prompt:
1. Spawn validate engine with Review Phase prompt via Agent tool
2. Extract summary from Pipeline Validation Report
3. If sanity-check confidence is LOW: retry once (see Error Recovery)
4. After completion, update plan: `node {plugin-root}/fp-tools.cjs plans update {plan-id} '{"completed":["review"]}'`

#### Phase 5: Finalize (CJS Pipeline Loop)

Execute the Finalize Phase (stages 6-8) using the CJS pipeline callback loop (see Step 6).
After completion, update plan: `node {plugin-root}/fp-tools.cjs plans update {plan-id} '{"status":"completed","completed":["write","review","finalize"]}'`

### Context Offloading: Extracting Summaries (D-09)

When a subagent returns a Delegation Result, do NOT retain the full result in your context. Extract only:

1. **Files modified** -- list of file paths (not descriptions)
2. **Stage status** -- PASS/FAIL for each enforcement stage
3. **Issue count** -- number of issues flagged
4. **Overall status** -- success or failure
5. **Analysis file path** -- from Research Result (Phase 1)
6. **Plan file path and ID** -- from Plan Result (Phase 2)

Discard the detailed descriptions, full issue text, full analysis document content, full plan file content, and enforcement stage details. The subagent's context held the full picture during its lifecycle.

For batch operations with many subagents, maintain running totals:
- Total files modified: {N}
- Total issues: {N}
- Stage pass rates: verbosity {N}/{M}, citations {N}/{M}

This keeps the orchestrator's context lean (~10-15% usage) even during large operations.

## Step 6: Finalize (CJS Pipeline Callback Loop)

After the Review Phase completes, continue the pipeline for stages 6-8 using the CJS callback loop:

0. Initialize the pipeline for finalization stages:
   ```bash
   node {plugin-root}/fp-tools.cjs pipeline init --operation {operation} --files {comma-separated list of modified files from Write Phase} --changelog-summary "{brief description of changes made}"
   ```
   Parse the JSON response. Confirm initialization succeeded by checking for a `pipeline_id` field. If the response contains `error: true`, report the error and halt finalization.

1. Run: `node {plugin-root}/fp-tools.cjs pipeline next`
2. Parse the JSON response. Based on `action`:

   **If action = "execute"** (deterministic stage):
   - Run: `node {plugin-root}/fp-tools.cjs pipeline run-stage {stage.id}`
   - Parse the result JSON.
   - If stage 7 returns `{ status: "needs_spawn" }`: spawn the index engine to run the update, then record stage result: `node {plugin-root}/fp-tools.cjs state pipeline stage_7_status=PASS`
   - For stages 6 and 8: CJS handles the work entirely. Record result: `node {plugin-root}/fp-tools.cjs state pipeline stage_{id}_status={status}`
   - Continue to step 1.

   **If action = "complete"**:
   - Extract `summary.completion_marker` from the response.
   - Include the completion marker verbatim in the Orchestration Report.
   - Pipeline is done. Proceed to Step 9 (Aggregate Report).

   **If action = "blocked"**:
   - A HALLUCINATION was detected during sanity-check. Report the diagnostic to the user.
   - Do NOT commit. Do NOT continue the pipeline.

   **If action = "error"**:
   - No active pipeline. Report error.

3. Repeat from step 1 until action is "complete" or "blocked".

## Step 7: Execute -- Read-Only Operations

For read-only commands (audit, verify, sanity-check, test, verbosity-audit, citations verify/audit, api-ref audit, locals cross-ref/validate/coverage):

1. Phase 1 (Research): Spawn researcher (unless `--no-research` or `researcher.enabled = false`)
2. Phase 2 (Plan): Spawn planner -- creates minimal 1-phase plan with specialist in standalone mode
3. If `--plan-only`: stop after plan display
4. Execute plan: Spawn specialist engine in standalone mode (existing fast-path logic)
5. Update plan status to completed: `node {plugin-root}/fp-tools.cjs plans update {plan-id} '{"status":"completed","completed":["standalone"]}'`

No pipeline stages. No changelog. No git operations.

## Step 8: Execute -- Administrative Operations

For index and system commands (setup, sync, update-skills, update, update-project-index, update-doc-links, update-example-claude):

1. Phase 1 (Research): Spawn researcher with minimal depth (unless `--no-research` or `researcher.enabled = false`)
2. Phase 2 (Plan): Spawn planner -- creates 1-phase admin plan
3. If `--plan-only`: stop after plan display
4. Execute plan: Spawn specialist engine in standalone mode
5. Update plan status to completed: `node {plugin-root}/fp-tools.cjs plans update {plan-id} '{"status":"completed","completed":["standalone"]}'`

## Step 9: Aggregate Report

Combine all subagent summaries into the Orchestration Report format defined in the orchestrate engine system prompt. Include the pipeline completion marker for hook validation.

Use only the summary metrics extracted in Context Offloading -- not full delegation results.

## Error Recovery Protocol

1. **Specialist failure**: Log error, report to user, do not commit partial changes
2. **Validation failure**: Retry once. If still failing, report without committing
3. **Git failure**: Report diagnostic, halt. Never force-push or override
4. **Teammate failure**: Collect results from successful teammates, note failure, proceed with partial results (user decides whether to commit)
5. **Timeout**: If a specialist doesn't respond within reasonable time, report as failed
