# Master Delegation Algorithm

> Read by the orchestrate engine for every invocation. Defines the complete delegation protocol.

---

## Step 1: Parse Routing Information

Extract from the skill prompt:
- `Engine:` — the specialist engine name
- `Operation:` — the operation within that engine
- `Instruction:` — path to the instruction file (relative to plugin root)
- User arguments — everything after the routing metadata

If explicit routing lines are missing, infer from the prompt content:
- Look for "Operation: {name}" patterns
- Match instruction file paths to determine engine
- Fall back to content analysis if needed

## Step 2: Classify Command Type

Use the routing table in your system prompt to classify:

### Write Commands
Require full 3-phase delegation: Write Phase → Review Phase → Finalize Phase.

| Engine | Operations |
|--------|-----------|
| modify | revise, add, auto-update, auto-revise, deprecate |
| citations | generate, update |
| api-refs | generate |
| locals | annotate, contracts, shapes |

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
Spawn specialist in standalone mode — engine handles its own workflow.

| Engine | Operations |
|--------|-----------|
| index | update-project-index, update-doc-links, update-example-claude |
| system | update-skills, setup, sync |

### Batch Commands
Use team protocol. Applies to the `parallel` command and any write operation exceeding scope thresholds.

## Step 3: Scope Analysis (Write Commands Only)

1. Parse the user's target to determine affected files:
   - Single file path → 1 file
   - Directory path → count files in directory
   - "all" or no scope → count all doc files
   - Git diff scope → count changed files

2. Read orchestration thresholds from mod-orchestration:
   - `parallel_threshold_files`: 3 (fan-out above this)
   - `team_threshold_files`: 8 (team above this)
   - `max_teammates`: 5
   - `max_files_per_teammate`: 5

3. Select strategy:
   - **scope ≤ 3**: Single specialist delegation
   - **3 < scope ≤ 8**: Fan-out (parallel Agent spawns, no Team)
   - **scope > 8**: Team creation with batched teammates

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
Do NOT commit to git or run docs-commit.sh.

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
- {file}: {confidence} — {details}
### Verification Checklist
- {file}: {PASS|FAIL} — {check results}
### Issues Requiring Remediation
- {any LOW confidence items or FAIL checks with details}
```

### Teammate Prompt Template (for batch operations)

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

### For Single Specialist (scope ≤ 3)

1. Spawn primary engine with Write Phase prompt via Agent tool
2. Collect Delegation Result
3. Spawn validate engine with Review Phase prompt via Agent tool
4. Collect Pipeline Validation Report
5. If sanity-check confidence is LOW:
   a. Spawn primary engine again with fix prompt (include specific issues)
   b. Collect updated Delegation Result
   c. Re-validate (spawn validate again)
   d. If still LOW after 1 retry, proceed but flag in report
6. Execute Finalize Phase (changelog, index, git) directly

### For Fan-Out (3 < scope ≤ 8)

1. Partition files into batches (max 3 files per batch)
2. Spawn multiple primary engines in PARALLEL via multiple Agent tool calls
3. Collect all Delegation Results
4. Spawn ONE validate engine for ALL modified files
5. Handle validation issues (same retry logic)
6. Execute ONE Finalize Phase covering all changes

### For Team (scope > 8)

1. Create Team via TeamCreate
2. Create Tasks via TaskCreate (one per batch)
3. Spawn teammates via Agent tool with team_name parameter
4. Monitor via TaskList until all complete
5. Spawn ONE validate engine for ALL modified files
6. Execute ONE Finalize Phase
7. Clean up team

## Step 6: Finalize

### Stage 6 — Changelog
- Read docs/changelog.md
- Append a new entry with today's date
- List every file created, modified, or removed
- Include operation name and summary
- Follow format from mod-changelog module

### Stage 7 — Index (conditional)
- Only trigger when structural changes occurred
- New doc files added → update PROJECT-INDEX.md
- Files removed → update PROJECT-INDEX.md
- Section reorganization → update PROJECT-INDEX.md
- Content-only changes → skip

### Stage 8 — Docs Commit & Push
- Detect docs root: {codebase-root}/themes/foreign-policy-2017/docs/
- Check for .git/ directory
- If exists:
  a. Unless --offline: fetch + pull (halt on failure)
  b. Stage all changes: `git -C {docs-root} add -A`
  c. Commit: `git -C {docs-root} commit -m "fp-docs: {operation} — {summary}"`
  d. Unless --no-push/--offline: push (halt on failure)
- If not: skip (docs repo not initialized)

## Step 7: Aggregate Report

Combine all subagent results into the Orchestration Report format defined in the orchestrate engine system prompt. Include the pipeline completion marker for hook validation.

## Error Recovery Protocol

1. **Specialist failure**: Log error, report to user, do not commit partial changes
2. **Validation failure**: Retry once. If still failing, report without committing
3. **Git failure**: Report diagnostic, halt. Never force-push or override
4. **Teammate failure**: Collect results from successful teammates, note failure, proceed with partial results (user decides whether to commit)
5. **Timeout**: If a specialist doesn't respond within reasonable time, report as failed
