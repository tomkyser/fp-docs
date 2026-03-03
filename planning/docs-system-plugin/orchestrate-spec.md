# Orchestration Layer Specification

> **Status**: DRAFT
> **Date**: 2026-03-01
> **Parent**: `proposal-spec.md`
> **Depends on**: Agent Teams (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`)

---

## 1. What Is the Orchestration Layer

The orchestration layer adds **parallel batch processing** to the docs system by using Claude Code Agent Teams. When a command affects multiple files or sections, the orchestrator creates a team, decomposes work into per-file tasks, spawns teammates that each process their assigned files independently, then synthesizes a unified report.

This is **not a 9th engine**. Engines are subagents that own a domain of responsibility. The orchestrator is a **coordination skill** that runs in the main conversation context and delegates work to teammates that behave like engine instances. It cannot be a subagent because:

1. Subagents cannot spawn other subagents (Claude Code constraint)
2. TeamCreate and Agent tool calls require the main conversation context
3. The orchestrator's job is to coordinate, not to process docs itself

### When to Use It

The orchestrator provides value when:
- **3+ doc files** need processing in a single operation
- Files are **independent** (no cross-doc dependencies in a single pass)
- Each file requires the **full pipeline** (the per-file overhead justifies parallelism)

The orchestrator does NOT help when:
- Single-file operations (overhead exceeds benefit)
- Operations with heavy cross-file dependencies
- Read-only operations on small scopes (already fast)

### Cost Trade-off

Each teammate is a separate Claude instance. A 3-teammate team costs ~3x the tokens of a single-engine invocation. The trade-off is justified when:
- Wall-clock time matters (3 teammates = ~3x faster for independent work)
- Batch size exceeds 5 files (sequential processing is slow)
- CI/CD pipelines have time limits

The `--parallel` flag is always **opt-in, never default** to protect token budgets.

---

## 2. Architecture

### Why the Orchestrator Is Not a Subagent

```
NORMAL FLOW (single file):
  Skill (context:fork) → Subagent Engine → Pipeline → Report
  ✅ Engine is a subagent — works perfectly

PARALLEL FLOW (multiple files):
  Skill (NO fork) → Main Context orchestrates:
    TeamCreate → TaskCreate (per file) → Agent (teammate per batch)
      ├── Teammate A: reads engine def → processes files 1-4
      ├── Teammate B: reads engine def → processes files 5-8
      └── Teammate C: reads engine def → processes files 9-12
    → Synthesize reports → TeamDelete
  ✅ TeamCreate/Agent require main context — cannot run from subagent
```

The critical constraint: `TeamCreate` and `Agent` (for spawning teammates) are tools that require the main conversation context. A subagent cannot use them. Therefore the orchestration skill must run **without `context: fork`**.

### Teammate Behavior

Each teammate is spawned as a `general-purpose` agent via the Agent tool. Teammates load standard project context automatically (CLAUDE.md, skills, hooks). The spawn prompt instructs each teammate to:

1. Read the target engine definition file (`agents/docs-modify.md` in the fp-docs plugin)
2. Follow the engine's system prompt and instructions
3. Process only their assigned files
4. Run the full pipeline for each file
5. Report results via SendMessage to the lead

Because teammates load plugin skills automatically, they have access to all shared modules (docs-mod-standards, docs-mod-project, docs-mod-pipeline, etc.) — the same modules a normal engine subagent would preload.

### Fallback Behavior

If Agent Teams are not available (feature disabled, environment variable not set, or error), the orchestration skill falls back to **sequential subagent invocation** — spawning one Agent call per file batch using the normal subagent pattern. This is slower but requires no experimental features.

The skill prompt includes an explicit fallback instruction:

```markdown
If TeamCreate fails or agent teams are unavailable:
  Fall back to sequential processing using the Agent tool (subagent_type: "general-purpose")
  with isolation: "worktree" for each batch of files.
  Process batches sequentially, not in parallel.
```

---

## 3. Skill Definition

### `/fp-docs:parallel`

File: `skills/parallel/SKILL.md` (plugin-relative)

```yaml
---
name: parallel
description: >
  Parallel batch processing for documentation operations. Creates an agent
  team to process multiple doc files simultaneously. Use when auto-update,
  auto-revise, audit, or sanity-check operations affect 3+ files.
  Requires CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS to be enabled.
argument-hint: "operation scope flags"
user-invocable: true
---

# Parallel Documentation Processing

You are orchestrating a parallel documentation batch operation.

## Parse the Request

$ARGUMENTS

The arguments specify:
1. **Operation**: auto-update | auto-revise | audit | sanity-check | citations-generate
2. **Scope**: specific files, sections, or --all
3. **Flags**: --no-citations, --no-sanity-check, etc. (passed through to teammates)

## Step 1: Analyze the Workload

Determine which doc files need processing:

For **auto-update**: Use git diff or file comparison to find changed source files.
Map them to doc files using the source-to-docs mapping in docs-mod-project.

For **auto-revise**: Read docs/needs-revision-tracker.md and extract all pending items.

For **audit**: Enumerate all doc files in the target scope.

For **sanity-check**: Enumerate all doc files in the target scope.

For **citations-generate**: Enumerate all doc files lacking citation blocks.

## Step 2: Decide Parallelization Strategy

Count the target files:
- **1-2 files**: Skip orchestration. Use the Agent tool with subagent_type "general-purpose"
  to invoke the appropriate engine directly (single subagent, no team).
- **3-9 files**: Create a team with 2-3 teammates, ~3-5 files each.
- **10-20 files**: Create a team with 3-4 teammates, ~5-7 files each.
- **20+ files**: Create a team with 4-5 teammates (max), distribute evenly.

Never exceed 5 teammates — coordination overhead increases faster than throughput beyond this point.

## Step 3: Determine the Engine

Map the operation to its engine:
- auto-update, auto-revise → docs-modify engine (`agents/docs-modify.md`)
- audit, sanity-check → docs-validate engine (`agents/docs-validate.md`)
- citations-generate → docs-citations engine (`agents/docs-citations.md`)

## Step 4: Create the Team

Use TeamCreate:
```
team_name: "docs-batch"
description: "Parallel documentation {operation} — {file_count} files across {teammate_count} teammates"
```

## Step 5: Create Tasks

Use TaskCreate for each file assignment. Group files into batches by section
to maximize cache efficiency (teammates reading related source files):

```
For each batch:
  TaskCreate:
    subject: "{operation}: {file_list_summary}"
    description: |
      Engine: {engine_name}
      Operation: {operation}
      Files to process:
      - {file_path_1} (source: {source_path_1})
      - {file_path_2} (source: {source_path_2})
      ...
      Flags: {flags_to_pass_through}

      Instructions:
      1. Read the engine definition at agents/{engine_name}.md
      2. For each file in your assignment, follow the engine's procedure
      3. Run the full pipeline for each file (respecting skip flags)
      4. Report your results when done
    activeForm: "Processing {section_name} docs"
```

## Step 6: Spawn Teammates

For each batch, use the Agent tool:

```
Agent:
  subagent_type: "general-purpose"
  team_name: "docs-batch"
  name: "docs-worker-{n}"
  prompt: |
    You are a documentation {operation} worker.

    Read agents/{engine_name}.md for your full operating instructions.

    Your assignment:
    {task_description}

    IMPORTANT:
    - Follow the engine instructions exactly
    - Run the full pipeline for each file (respecting flags)
    - Use your preloaded skill modules (docs-mod-standards, docs-mod-project, etc.)
    - Mark your task as completed when done
    - Send a summary message to the lead when finished
  mode: "acceptEdits"
```

For modification operations, consider adding `isolation: "worktree"` to prevent
file conflicts if teammates might touch overlapping index files.

For deep audit operations (e.g., `--depth deep` across many sections), consider
spawning teammates with `run_in_background: true` to allow the user to continue
working while the audit processes. Background teammates report results via
SendMessage when complete, and the lead synthesizes when all are done.

## Step 7: Monitor and Synthesize

Wait for all teammates to complete their tasks. As results come in:
- Track which files were processed successfully
- Track which files had issues or [NEEDS INVESTIGATION] flags
- Track pipeline stage completion across all teammates

## Step 8: Produce Consolidated Report

After all teammates finish, produce a single unified report:

```
## Parallel {Operation} Report

### Summary
- Total files processed: {count}
- Teammates used: {count}
- Processing mode: parallel (agent team)

### Results by Teammate
#### docs-worker-1 ({section})
- Files: {list}
- Status: {completed | partial | failed}
- Issues: {any [NEEDS INVESTIGATION] or failures}

#### docs-worker-2 ({section})
...

### Pipeline Compliance
- All teammates completed verification: {yes/no}
- All teammates updated changelog: {yes/no}

### Issues Requiring Attention
- {file}: {issue description}
...
```

## Step 9: Clean Up

Shut down all teammates via SendMessage (type: "shutdown_request"),
then use TeamDelete to clean up team resources.

## Fallback: Sequential Processing

If TeamCreate fails or CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS is not enabled:

1. Process files sequentially using the Agent tool (subagent_type: "general-purpose")
2. Each Agent call processes one batch of 3-5 files
3. Wait for each batch to complete before starting the next
4. Produce the same consolidated report format
```

---

## 4. Team Hooks

### 4.1 TeammateIdle Hook

Prevents a teammate from going idle before completing its assigned pipeline stages.

File: `scripts/teammate-idle-check.sh` (plugin-relative)

```bash
#!/bin/bash
# Validates that a docs teammate has completed its pipeline before going idle

INPUT=$(cat)
TEAM_NAME=$(echo "$INPUT" | jq -r '.team_name // empty')

# Only run for docs-batch teams
if [[ "$TEAM_NAME" != "docs-batch" ]]; then
  exit 0
fi

TEAMMATE_NAME=$(echo "$INPUT" | jq -r '.teammate_name // empty')

# Check that the teammate's transcript mentions pipeline completion markers
# This is a heuristic — the teammate should report pipeline stages in its output
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')

if [[ -n "$TRANSCRIPT_PATH" && -f "$TRANSCRIPT_PATH" ]]; then
  # Check for verification completion marker in the transcript
  if ! grep -q "Verification:.*completed\|Verification:.*pass\|Pipeline Stages" "$TRANSCRIPT_PATH" 2>/dev/null; then
    echo "Pipeline appears incomplete. Ensure all mandatory stages (verification, changelog) have run before stopping." >&2
    exit 2
  fi
fi

exit 0
```

### 4.2 TaskCompleted Hook

Validates that a doc processing task actually produced the expected outputs.

File: `scripts/task-completed-check.sh` (plugin-relative)

```bash
#!/bin/bash
# Validates that a docs task produced expected outputs before allowing completion

INPUT=$(cat)
TEAM_NAME=$(echo "$INPUT" | jq -r '.team_name // empty')

# Only run for docs-batch teams
if [[ "$TEAM_NAME" != "docs-batch" ]]; then
  exit 0
fi

TASK_SUBJECT=$(echo "$INPUT" | jq -r '.task_subject // empty')

# For modification tasks, check that at least one doc file was modified
if echo "$TASK_SUBJECT" | grep -qE "auto-update|auto-revise|revise|add"; then
  DOC_CHANGES=$(git diff --name-only -- "themes/foreign-policy-2017/docs/" 2>/dev/null | head -1)
  if [[ -z "$DOC_CHANGES" ]]; then
    echo "No documentation files were modified. Verify that changes were actually applied before completing this task: $TASK_SUBJECT" >&2
    exit 2
  fi
fi

exit 0
```

### 4.3 Hook Registration

In `hooks/hooks.json` (merged with other hook registrations):

```json
{
  "hooks": {
    "TeammateIdle": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/teammate-idle-check.sh",
            "statusMessage": "Checking teammate pipeline completion..."
          }
        ]
      }
    ],
    "TaskCompleted": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/task-completed-check.sh",
            "statusMessage": "Validating task outputs..."
          }
        ]
      }
    ]
  }
}
```

Note: `TeammateIdle` and `TaskCompleted` hooks do not support matchers — they fire on every occurrence. The scripts filter internally by checking `team_name == "docs-batch"`.

---

## 5. Instruction File

File: `framework/instructions/orchestrate/parallel.md` (plugin-relative)

```markdown
# Instruction: Parallel Batch Processing

## Prerequisites
- Operation: auto-update | auto-revise | audit | sanity-check | citations-generate
- Scope: multiple files (3+ recommended for parallelization benefit)
- Environment: CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS enabled (optional — falls back to sequential)

## Work Decomposition Strategy

### By Section (preferred for audit/sanity-check)
Group files by their documentation section:
- docs/02-post-types/ → one batch
- docs/06-helpers/ → one batch
- docs/05-components/ → one batch
- etc.

Advantage: teammates read related source files, maximizing context cache hits.

### By File Count (preferred for auto-update/auto-revise)
When affected files span many sections, distribute evenly:
- Count total files
- Divide by target teammate count (3-5)
- Assign each batch to a teammate

### Task Sizing Guidelines
- **Minimum per teammate**: 2 files (below this, sequential is better)
- **Maximum per teammate**: 8 files (above this, context pressure increases)
- **Sweet spot**: 4-6 files per teammate
- **Tasks per teammate**: 1 main task (the file batch), plus any follow-up tasks discovered during work

## Teammate Spawn Template

Each teammate receives this prompt structure:

```
You are a documentation {operation} worker in a parallel batch operation.

## Your Engine
Read agents/{engine_name}.md for your full operating instructions.
Follow the engine's system prompt exactly.

## Your Assignment
Process these files:
{file_list_with_source_mappings}

## Flags
{flags_to_pass_through}

## Procedure
For each file in your assignment:
1. Read the instruction file: {plugin-root}/framework/instructions/{engine_path}/{operation}.md
2. Follow the instruction steps for this file
3. Execute the post-modification pipeline (from docs-mod-pipeline)
4. Record results

## When Done
- Mark your task as completed (TaskUpdate)
- Send a summary to the lead:
  - Files processed (count and paths)
  - Pipeline stages completed per file
  - Any [NEEDS INVESTIGATION] items
  - Any errors or issues
```

## Synthesis Procedure

After all teammates complete:

1. Collect all teammate reports (from their SendMessage summaries)
2. Verify completeness:
   - All assigned files were processed
   - All mandatory pipeline stages completed
   - Changelog entries were written
3. Aggregate issues:
   - Collect all [NEEDS INVESTIGATION] items
   - Collect all verification failures
   - Note any teammate errors
4. Produce the consolidated report (format defined in skill)
5. If any issues found, add them to docs/needs-revision-tracker.md
```

---

## 6. Which Skills Gain Parallel Support

The `/fp-docs:parallel` skill is the ONLY entry point for parallel processing. Existing skills are NOT modified. Users choose parallel mode explicitly:

| Sequential (existing) | Parallel (new) | When parallel helps |
|---|---|---|
| `/fp-docs:auto-update` | `/fp-docs:parallel auto-update` | 3+ source files changed |
| `/fp-docs:auto-revise` | `/fp-docs:parallel auto-revise` | 3+ items in revision tracker |
| `/fp-docs:audit --depth deep` | `/fp-docs:parallel audit --depth deep` | auditing 3+ sections |
| `/fp-docs:sanity-check` | `/fp-docs:parallel sanity-check` | checking 3+ sections |
| `/fp-docs:citations generate` | `/fp-docs:parallel citations-generate` | 3+ files need citations |

### Why a Separate Skill (Not a `--parallel` Flag)

Claude Code skill routing is determined by YAML frontmatter (`context: fork`, `agent:`). These fields are static — they cannot be toggled by a runtime flag. Adding `--parallel` to `/fp-docs:auto-update` would require the skill to conditionally fork or not fork, which the skill system doesn't support.

A separate `/fp-docs:parallel` skill cleanly separates the two execution modes:
- **Normal skills**: `context: fork` → subagent engine → pipeline → report
- **Parallel skill**: no fork → main context orchestrates team → teammates → report

---

## 7. Worktree Isolation Strategy

### When to Use Worktrees

Teammates modifying documentation may conflict on shared files (changelog.md, About.md, _index.md files). Worktree isolation prevents this:

```
Agent:
  subagent_type: "general-purpose"
  team_name: "docs-batch"
  name: "docs-worker-1"
  isolation: "worktree"     # Each teammate gets its own repo copy
  prompt: "..."
```

With worktrees:
- Each teammate writes to its own copy of the repo
- No file conflicts during parallel work
- Changes merged back via standard git workflow after completion
- Worktrees with no changes auto-clean

### When to Skip Worktrees

For **read-only operations** (audit, sanity-check), worktrees add unnecessary overhead. Teammates only READ files, so no conflict is possible:

```
Agent:
  subagent_type: "general-purpose"
  team_name: "docs-batch"
  name: "docs-auditor-1"
  # NO isolation — read-only, no conflict risk
  prompt: "..."
```

### Decision Matrix

| Operation | Modifies files? | Use worktree? |
|---|---|---|
| auto-update | Yes | Yes — prevents changelog/index conflicts |
| auto-revise | Yes | Yes — same reason |
| audit | No (read-only) | No |
| sanity-check | No (read-only) | No |
| citations-generate | Yes | Yes — prevents citation block conflicts |

### Post-Worktree Merge

When teammates use worktrees, the lead must merge their changes after completion:

1. Each teammate's worktree produces a branch with its changes
2. The lead merges each branch sequentially (or the user does via PR)
3. Merge conflicts (if any) are in low-risk files (changelog, index) that can be concatenated

The orchestration skill instructs the lead to handle this:

```markdown
After all worktree teammates complete:
1. List the worktree branches created
2. Merge each branch into the current branch sequentially
3. If merge conflicts occur in changelog.md, concatenate both sets of entries
4. If merge conflicts occur in _index.md or About.md, merge the link additions
5. Delete merged worktree branches
```

---

## 8. CI/CD Parallel Mode

### GitHub Actions: Parallel Auto-Update

For large PRs affecting many source files, CI can use the parallel skill:

```yaml
# Addition to .github/workflows/docs-auto-update.yml
- name: Auto-update documentation (parallel)
  if: steps.changes.outputs.file_count > 5
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
    CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1"
  run: |
    cd wordpress/wp-content
    claude --headless \
      --permission-mode bypassPermissions \
      "Run /fp-docs:parallel auto-update for changed files: ${{ steps.changes.outputs.files }}"
```

### CI Cost Management

Parallel mode in CI uses more tokens. Controls:
- **File count threshold**: Only trigger parallel mode for 5+ changed files
- **Max teammates**: Set to 3 in CI (lower than interactive's 5 max)
- **MaxTurns per teammate**: Limit via prompt instructions to the orchestrator

---

## 9. Compatibility and Prerequisites

### Required

- Claude Code with Agent tool support (standard)
- fp-docs plugin installed with `agents/docs-*.md` engine definitions
- fp-docs plugin `skills/docs-mod-*/SKILL.md` shared modules

### Optional (Recommended)

- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` enabled — for true parallel execution
- Git worktree support — for modification operation isolation
- tmux or iTerm2 — for split-pane teammate display (interactive mode only)

### Graceful Degradation

| Feature Available | Behavior |
|---|---|
| Agent teams enabled | Full parallel execution via TeamCreate + Agent |
| Agent teams disabled | Sequential fallback: one Agent call per batch |
| Worktrees available | File isolation for modification teammates |
| Worktrees unavailable | Teammates share filesystem; lead assigns non-overlapping files |
| tmux/iTerm2 available | Split-pane display of teammate progress |
| tmux/iTerm2 unavailable | In-process display (Shift+Down to cycle) |

---

## 10. Known Limitations

1. **Experimental dependency**: Agent teams are experimental. The orchestrator depends on an experimental feature for its primary mode. The sequential fallback mitigates this but doesn't provide parallelism.

2. **No session resumption**: If the session is interrupted, in-process teammates cannot be resumed. The lead must re-create the team and re-process files.

3. **Changelog merge conflicts**: Multiple teammates writing to `changelog.md` simultaneously will conflict. Mitigated by worktree isolation + sequential merge, but adds post-processing complexity.

4. **Token cost**: Parallel mode costs N× tokens (where N = teammate count). Always opt-in, never default.

5. **One team per session**: The docs system can only run one parallel operation at a time. Multiple `/fp-docs:parallel` invocations in the same session require the first team to be cleaned up before the second starts.

6. **No inter-teammate communication during pipeline**: Each teammate runs its pipeline independently. If teammate A discovers that teammate B's doc has a cross-reference issue, it can only report it in its summary — it can't fix teammate B's files.

7. **Shared file bottleneck**: Even with worktrees, the final merge step is sequential. For very large batches (20+ files), the merge step may be slow.

---

## 11. Testing the Orchestration Layer

### Test 1: Small Batch (Below Threshold)

```
/fp-docs:parallel auto-update
```

With only 1-2 changed source files. **Expected**: Orchestrator detects low file count, skips team creation, processes via single Agent call.

### Test 2: Medium Batch

```
/fp-docs:parallel auto-revise
```

With 8 items in the revision tracker. **Expected**: Creates team with 2-3 teammates, assigns ~3-4 files each, runs in parallel, produces consolidated report.

### Test 3: Large Audit

```
/fp-docs:parallel audit --depth deep
```

Targeting all doc sections. **Expected**: Creates team with 4-5 teammates, each auditing a section, read-only (no worktrees needed), produces consolidated audit report.

### Test 4: Fallback (Teams Disabled)

```
# Without CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS
/fp-docs:parallel auto-update
```

With 6 changed files. **Expected**: TeamCreate fails gracefully, skill falls back to sequential Agent processing, produces same report format.

### Test 5: CI/CD Parallel Mode

```bash
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 \
claude --headless \
  --permission-mode bypassPermissions \
  "Run /fp-docs:parallel auto-update for changed files: helpers/posts.php helpers/authors.php helpers/piano.php helpers/meilisearch.php helpers/environment.php helpers/htmx.php"
```

**Expected**: Headless parallel execution, 2-3 teammates, doc changes committed.
