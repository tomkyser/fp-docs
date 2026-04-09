# Design: Deterministic Execution System

> Task #4 deliverable — Engineer
> Date: 2025-04-09

---

## Problem Statement

When a user invokes a team workflow, Claude must:
1. Use **TeamCreate** (real parallel agents) — NOT the Agent tool (sequential subagents)
2. Follow the workflow document **step-by-step** — no freelancing
3. Not do work itself that should be delegated to teammates
4. Maintain the state board throughout execution

The core challenge: Claude is an LLM. It will take shortcuts, combine steps, do work itself, or use Agent instead of TeamCreate unless we **structurally prevent** these behaviors.

---

## Enforcement Architecture Overview

Four layers, each reinforcing the others:

```
Layer 1: SLASH COMMAND (tool stripping + directive)
  ↓
Layer 2: PreToolUse HOOK (Agent tool blocker)
  ↓
Layer 3: TeammateIdle / TaskCompleted HOOKS (output verification)
  ↓
Layer 4: POST-COMPLETION VERIFICATION (state board audit)
```

No single layer is sufficient alone. Together they create a system where the path of least resistance IS the correct path.

---

## Layer 1: Slash Command (The Dispatcher Pattern)

### The fp-docs Precedent

fp-docs solved the "Claude does work instead of delegating" problem with the **dispatcher pattern**:

```yaml
allowed-tools:
  - Bash
  - Task
```

By stripping Read/Write/Edit/Grep/Glob from the command's allowed tools, the main thread **cannot** read files, write files, or analyze code. It is structurally forced to delegate all real work to subagents.

### Adapting for Agent Teams

The team workflow slash command needs a similar constraint. The dispatcher must be able to:
- **Use**: `TeamCreate`, `TaskCreate`, `TaskUpdate`, `TaskList`, `SendMessage`, `Bash` (for detection script), `Read` (for loading workflow doc)
- **NOT use**: `Agent` (forces TeamCreate instead), `Write`, `Edit`, `Grep`, `Glob` (prevents doing implementation work itself)

```yaml
# Slash command frontmatter
---
name: team-work
description: Launch a 3-person agent team to execute a multi-phase task
argument-hint: "task description and phase breakdown"
allowed-tools:
  - TeamCreate
  - TaskCreate
  - TaskUpdate
  - TaskList
  - TaskGet
  - SendMessage
  - Bash
  - Read
---
```

**Key insight**: By including `TeamCreate` but excluding `Agent`, the command literally cannot spawn sequential subagents. It MUST create a team.

### Why Read is Allowed

The dispatcher needs to:
1. Read the workflow document to know what steps to follow
2. Read TEAM-STATE.json to check progress
3. Read phase plans to create accurate task assignments

But it CANNOT Write/Edit, so it cannot do implementation work itself.

### Why Bash is Allowed

The dispatcher needs Bash for:
1. Running the tmux detection script (`detectTeamEnvironment()`)
2. Running verification commands after completion
3. Git operations (only the lead does this, but the dispatcher orchestrates it)

Bash is controlled by PreToolUse hooks (git-guard, etc.) so it's not a free pass.

---

## Layer 2: PreToolUse Hook — Agent Tool Blocker

### The Problem

Even with `allowed-tools` in the slash command, Claude might try to use the `Agent` tool if it's available in the session. The slash command's tool list is advisory in some contexts — hooks are the hard enforcement.

### Design: `team-agent-blocker` Hook

A PreToolUse hook that blocks the `Agent` tool when a team workflow is active.

```javascript
// Hook: PreToolUse, matcher: "Agent"
// Registered in ~/.claude/settings.json (or project settings.json)

function handlePreToolUseAgentBlock(input) {
  // Check if a team workflow is currently active
  const stateFile = findTeamStateFile(); // looks for TEAM-STATE.json
  if (!stateFile) {
    // No active team — allow Agent tool normally
    return { allowed: true, reason: 'no active team workflow' };
  }

  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  if (state.status === 'active') {
    return {
      allowed: false,
      reason: 'BLOCKED: Agent tool is disabled during team workflows. ' +
              'Use TeamCreate for parallel execution or SendMessage to ' +
              'communicate with existing teammates. The team workflow ' +
              'requires real parallel agents, not sequential subagents.'
    };
  }

  return { allowed: true, reason: 'team workflow not active' };
}
```

### Hook Registration

```json
{
  "PreToolUse": [
    {
      "matcher": "Agent",
      "hooks": [{
        "type": "command",
        "command": "node \"$HOME/.claude/hooks/team-agent-blocker.js\"",
        "timeout": 5
      }]
    }
  ]
}
```

### State Detection: How Does the Hook Know a Team is Active?

The hook reads `TEAM-STATE.json` (written by the slash command at team creation). Location options:

- **Option A**: `$CWD/.team-state.json` — project-local, simple
- **Option B**: `~/.claude/team-state.json` — global, one team at a time
- **Option C**: `$CWD/.fp-docs/TEAM-STATE.json` — namespaced under fp-docs

**Recommendation: Option A** (`$CWD/.team-state.json`). It's the simplest. The hook checks `process.cwd()` for the file. Multiple projects can have independent team states.

However, the Architect is designing the state system (Task #2), so this should align with their schema. The hook just needs a file path and a `status` field.

---

## Layer 3: TeammateIdle and TaskCompleted Hooks

These hooks verify that teammates are actually doing their jobs and following the workflow protocol.

### TeammateIdle Hook

Fires when a teammate signals it has no more work. The hook verifies:

1. **Task completion**: Did the teammate complete all tasks assigned to it?
2. **Result structure**: Does the teammate's output include expected markers?
3. **Phase board update**: Did the teammate update TEAM-STATE / phase status?

```javascript
function handleTeammateIdle(input) {
  const transcript = input.transcript || '';
  const teammateName = input.teammate_name || '';
  const warnings = [];

  // Check 1: Teammate should have completed assigned tasks
  // (TaskList check — look for uncompleted tasks owned by this teammate)

  // Check 2: Teammate output should include work summary
  if (!/## (Phase|Task|Work) (Complete|Summary|Result)/i.test(transcript)) {
    warnings.push(`Teammate '${teammateName}' went idle without posting a work summary`);
  }

  // Check 3: For dev teammates, verify they didn't touch git
  if (teammateName !== 'Lead') {
    if (/git\s+(commit|push|tag|merge)/i.test(transcript)) {
      warnings.push(`VIOLATION: Teammate '${teammateName}' appears to have used git write commands (only Lead may commit)`);
    }
  }

  if (warnings.length > 0) {
    process.stderr.write(warnings.join('\n') + '\n');
    process.exit(2); // Block — teammate needs to finish properly
  }
  process.exit(0);
}
```

### TaskCompleted Hook

Fires when a task is marked complete. The hook verifies:

1. **Deliverable exists**: If the task specified file outputs, check they exist
2. **No hallucination markers**: Task output doesn't contain known bad patterns
3. **Schema compliance**: Task metadata matches expected structure

```javascript
function handleTaskCompleted(input) {
  const transcript = input.transcript || '';
  const subject = input.subject || '';
  const warnings = [];

  // Check 1: Implementation tasks should report files modified
  if (/implement|build|create|write|fix/i.test(subject)) {
    if (!/files? (modified|created|changed|written)/i.test(transcript)) {
      warnings.push(`Task '${subject}' completed without reporting file modifications`);
    }
  }

  // Check 2: Review tasks should report pass/fail
  if (/review|verify|validate|audit/i.test(subject)) {
    if (!/PASS|FAIL|approved|rejected|issues found/i.test(transcript)) {
      warnings.push(`Task '${subject}' completed without review verdict`);
    }
  }

  // Check 3: No HALLUCINATION markers
  if (/HALLUCINATION/i.test(transcript)) {
    warnings.push(`Task '${subject}' contains HALLUCINATION markers`);
  }

  if (warnings.length > 0) {
    process.stderr.write(warnings.join('\n') + '\n');
    process.exit(2);
  }
  process.exit(0);
}
```

---

## Layer 4: Post-Completion Verification

After the team finishes all phases, the dispatcher runs a verification sweep before declaring success.

### Verification Checklist

```
1. TEAM-STATE.json: status === "complete"
2. All phases have completion summaries in state
3. Phase status entries exist for every planned phase
4. Git log shows only Lead committed (check git log --format='%an')
5. Retrospective section exists in state or separate file
6. No orphaned tasks (all tasks in completed or deleted state)
```

### Implementation

This runs as a Bash command from the dispatcher (which has Bash access):

```bash
# verify-team-completion.sh (or inline in CJS module)
# Checks state file, git log, task list for protocol compliance

node -e "
  const state = JSON.parse(require('fs').readFileSync('.team-state.json', 'utf8'));
  const errors = [];

  if (state.status !== 'complete') errors.push('Team state not marked complete');
  if (!state.phases || state.phases.length === 0) errors.push('No phase records');

  for (const phase of (state.phases || [])) {
    if (!phase.completionSummary) errors.push('Phase ' + phase.id + ': missing completion summary');
  }

  if (!state.retrospective) errors.push('No retrospective recorded');

  if (errors.length > 0) {
    console.error('VERIFICATION FAILED:');
    errors.forEach(e => console.error('  - ' + e));
    process.exit(1);
  }
  console.log('VERIFICATION PASSED: All checks green.');
"
```

---

## Anti-Freelancing: The Key Constraint

### What "Freelancing" Looks Like

Claude freelances when it:
- Reads source code and writes implementation itself instead of assigning to a teammate
- Combines multiple phases into one step
- Skips the research/plan phase and jumps to implementation
- Does review work instead of waiting for the Lead teammate

### Three-Pronged Prevention

**Prong 1: Tool Stripping (Layer 1)**
The dispatcher cannot Write/Edit/Grep/Glob. It literally cannot implement code. This is the strongest guarantee — it's structural, not behavioral.

**Prong 2: Directive Reinforcement (Slash Command Body)**
The slash command body includes a `<delegation_protocol>` block (identical to fp-docs pattern):

```xml
<delegation_protocol>
YOU ARE A DISPATCHER. You do NOT read source code, write implementation,
or do any task work yourself. Your ONLY job is to:
1. Create the team via TeamCreate
2. Create tasks and assign them to teammates
3. Monitor progress via TaskList
4. Send messages to coordinate
5. Run verification after completion

DO NOT:
- Read any source files beyond the workflow document
- Write or edit any implementation files
- Skip phases or combine steps
- Do work that a teammate should do

DO:
- Follow the workflow document step-by-step
- Create clear, scoped tasks for each teammate
- Wait for teammates to complete before advancing phases
- Run post-completion verification
</delegation_protocol>
```

**Prong 3: Hook Enforcement (Layers 2-3)**
If despite tool stripping and directives, Claude somehow tries to use Agent (subagent) instead of TeamCreate, the PreToolUse hook blocks it with a clear error message redirecting to TeamCreate.

### Why This Works

The fp-docs dispatcher pattern has been battle-tested across hundreds of operations. By stripping tools, the LLM's "path of least resistance" becomes delegation — because it cannot do the work any other way. Adding the Agent-blocker hook closes the last escape hatch (using subagents instead of teams).

---

## Slash Command Structure

### Execution Flow

```
/team-work "Build feature X across phases 1-4"
  │
  Step 0: Detect environment (tmux nudge — see Task #3 design)
  │
  Step 1: Read workflow document
  │       → Read AGENT-TEAM-WORKFLOW.md (or project-specific variant)
  │       → Parse team structure, phase protocol, communication norms
  │
  Step 2: Initialize state
  │       → Write TEAM-STATE.json with: status=active, phases=[], team={}
  │       → (Uses Bash to run: node team-state.cjs init <args>)
  │
  Step 3: Create team
  │       → TeamCreate with 3 teammates: Architect, Engineer, Lead
  │       → Each teammate gets: role description, phase plan, workflow rules
  │
  Step 4: Create Phase 1 tasks
  │       → TaskCreate for each Phase 1 task
  │       → Assign owners (Architect, Engineer)
  │
  Step 5: Monitor execution
  │       → TaskList polling to track progress
  │       → SendMessage for phase transitions
  │       → Lead reviews completed phases in parallel
  │
  Step 6: Phase transitions
  │       → When Phase N completes: create Phase N+1 tasks
  │       → Update state via Bash (node team-state.cjs advance-phase)
  │
  Step 7: Final phase completes → ALL STOP
  │       → Wait for Lead to finish all reviews
  │       → Second pass on minor items
  │
  Step 8: Retrospective
  │       → Team discusses and records findings
  │
  Step 9: Verification
  │       → Run post-completion verification (Layer 4)
  │       → Report results
  │
  Step 10: Cleanup
          → Update TEAM-STATE.json status=complete
          → Final summary to user
```

### Teammate Prompts

Each teammate receives a structured prompt at TeamCreate time:

```markdown
## Your Role: {Architect|Engineer|Lead}

### Identity
{Role description from AGENT-TEAM-WORKFLOW.md}

### Current Phase: {N} — {name}
{Phase description and goals}

### Your Tasks
Check TaskList for tasks assigned to you. Complete them in order.

### Communication Protocol
- Message teammates freely via SendMessage
- Update task status via TaskUpdate as you progress
- Post work summaries when tasks complete

### Rules
- Follow the task descriptions exactly
- Do not skip steps or combine tasks
- {Role-specific rules: e.g., "Only Lead commits to git"}
- When your tasks are done, post a summary and wait for next phase
```

---

## Hook Registration Summary

All hooks registered in `~/.claude/settings.json` (user scope, cross-project):

```json
{
  "PreToolUse": [
    {
      "matcher": "Agent",
      "hooks": [{
        "type": "command",
        "command": "node \"$HOME/.claude/hooks/team-agent-blocker.js\"",
        "timeout": 5
      }]
    }
  ],
  "TeammateIdle": [
    {
      "hooks": [{
        "type": "command",
        "command": "node \"$HOME/.claude/hooks/team-teammate-idle.js\"",
        "timeout": 10
      }]
    }
  ],
  "TaskCompleted": [
    {
      "hooks": [{
        "type": "command",
        "command": "node \"$HOME/.claude/hooks/team-task-completed.js\"",
        "timeout": 10
      }]
    }
  ]
}
```

**Note**: These hooks live at the user level (`~/.claude/hooks/`), not inside fp-docs. They are cross-project by design. The Architect's task (#1) determines the exact file layout.

---

## Open Questions for Architect

1. **State file location**: I recommend `$CWD/.team-state.json`. Does this align with the state schema (Task #2)?

2. **State mutation**: The dispatcher uses `Bash` to run CJS state commands (`node team-state.cjs init|advance-phase|complete`). The dispatcher itself never writes the file directly (no Write tool). Is this the right pattern?

3. **Hook file layout**: I assumed `~/.claude/hooks/team-*.js` for cross-project hooks. Does the layout design (Task #1) place them differently?

4. **Teammate prompt source**: Should teammate role descriptions live in the workflow markdown doc, or in separate agent definition files? The current AGENT-TEAM-WORKFLOW.md has the role table inline.

---

## Risk Assessment

| Risk | Mitigation | Severity |
|------|-----------|----------|
| Claude ignores allowed-tools and uses Agent anyway | PreToolUse hook blocks Agent when team is active | High → mitigated |
| Claude does implementation work itself via Bash | Bash commands are visible in transcript; TeammateIdle hook checks for this | Medium |
| Teammates don't follow workflow protocol | TaskCompleted hook verifies output markers | Medium |
| State file gets corrupted mid-execution | CJS state module uses atomic writes (write to tmp, rename) | Low |
| User aborts mid-workflow | State file preserves progress; can resume or clean up | Low |
| Multiple team workflows launched simultaneously | State file uses team ID; hooks check active team ID | Low |

---

## Summary of Enforcement Mechanisms

| Mechanism | What it prevents | Type |
|-----------|-----------------|------|
| `allowed-tools` in slash command | Dispatcher doing implementation work | Structural (hard) |
| `Agent` tool excluded from allowed-tools | Using subagents instead of teams | Structural (hard) |
| PreToolUse hook on Agent | Backup blocker if tool list is bypassed | Runtime (hard) |
| `<delegation_protocol>` directive | Claude freelancing or skipping steps | Behavioral (soft) |
| TeammateIdle hook | Teammates going idle without finishing | Runtime (hard) |
| TaskCompleted hook | Tasks accepted without deliverables | Runtime (hard) |
| Post-completion verification | Missing phase summaries, protocol violations | Audit (post-hoc) |
| State file tracking | Drift from workflow, skipped phases | Observability |
