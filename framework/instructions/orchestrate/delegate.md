# Master Delegation Algorithm

> Read by the orchestrate engine for every invocation. Defines the complete delegation protocol.
> Updated Phase 6.1: Subagent-always execution model (D-06), batch-mode flag (D-08), context offloading (D-09).

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

### Architectural Rule (D-06)

**The orchestrator NEVER directly executes fp-docs operations.** All work is delegated to subagents via the Agent tool. The orchestrator is a pure dispatcher: it decides what to do, spawns agents to do it, and aggregates results.

## Step 4: Construct Delegation Prompts

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

## Step 5: Execute Delegation

### Subagent Mode (default -- D-06, D-08)

#### For scope = 1 file:
1. Spawn primary engine with Write Phase prompt via Agent tool
2. Extract summary from Delegation Result (see Step 5a)
3. Spawn validate engine with Review Phase prompt via Agent tool
4. Extract summary from Pipeline Validation Report
5. If sanity-check confidence is LOW: retry once (see Error Recovery)
6. Execute Finalize Phase directly (changelog, index, git)

#### For scope = 2-8 files:
1. Partition files into logical groups (by section when possible, max 3 per group)
2. Spawn multiple primary engines in PARALLEL via multiple Agent tool calls
3. Extract summaries from all Delegation Results
4. Spawn ONE validate engine for ALL modified files
5. Handle validation issues (same retry logic)
6. Execute ONE Finalize Phase covering all changes

#### For scope = 9+ files:
1. Partition files into batches (max 5 per batch)
2. Execute batches in waves of max 5 concurrent Agent calls
3. Wait for each wave to complete before starting next wave
4. Extract summaries from all Delegation Results
5. Spawn ONE validate engine for ALL modified files
6. Execute ONE Finalize Phase covering all changes

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
5. Spawn ONE validate engine for ALL modified files
6. Execute ONE Finalize Phase
7. Clean up team

**Critical constraint:** Teammates cannot spawn their own subagents or teams. Each teammate IS the specialist -- it reads the instruction file and does the work directly.

### Sequential Mode (D-08)

1. For each file in scope:
   a. Spawn single specialist subagent via Agent tool
   b. Wait for completion
   c. Extract summary from Delegation Result
   d. Proceed to next file
2. Spawn ONE validate engine for ALL modified files
3. Execute ONE Finalize Phase

### 5a. Context Offloading: Extracting Summaries (D-09)

When a subagent returns a Delegation Result, do NOT retain the full result in your context. Extract only:

1. **Files modified** -- list of file paths (not descriptions)
2. **Stage status** -- PASS/FAIL for each enforcement stage
3. **Issue count** -- number of issues flagged
4. **Overall status** -- success or failure

Discard the detailed descriptions, full issue text, and enforcement stage details. The subagent's context held the full picture during its lifecycle.

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
   - Pipeline is done. Proceed to Step 7 (Aggregate Report).

   **If action = "blocked"**:
   - A HALLUCINATION was detected during sanity-check. Report the diagnostic to the user.
   - Do NOT commit. Do NOT continue the pipeline.

   **If action = "error"**:
   - No active pipeline. Report error.

3. Repeat from step 1 until action is "complete" or "blocked".

## Step 7: Aggregate Report

Combine all subagent summaries into the Orchestration Report format defined in the orchestrate engine system prompt. Include the pipeline completion marker for hook validation.

Use only the summary metrics extracted in Step 5a -- not full delegation results.

## Error Recovery Protocol

1. **Specialist failure**: Log error, report to user, do not commit partial changes
2. **Validation failure**: Retry once. If still failing, report without committing
3. **Git failure**: Report diagnostic, halt. Never force-push or override
4. **Teammate failure**: Collect results from successful teammates, note failure, proceed with partial results (user decides whether to commit)
5. **Timeout**: If a specialist doesn't respond within reasonable time, report as failed
