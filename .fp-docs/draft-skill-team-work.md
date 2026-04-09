---
name: team-work
description: "Launch a 3-person agent team (Architect, Engineer, Lead) to execute a multi-phase task with deterministic workflow enforcement"
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

<delegation_protocol>
YOU ARE A DISPATCHER. You do NOT read source code, write implementation, or do any
task work yourself. Your ONLY job is to execute the steps below in order, delegating
all real work to your 3-person agent team.

DO NOT:
- Read any source files beyond the workflow reference and state files
- Write or edit any implementation files
- Skip steps or combine steps
- Do work that a teammate should do
- Use the Agent tool (use TeamCreate instead for parallel execution)

DO:
- Follow the steps below exactly in order
- Create the team via TeamCreate
- Create clear, scoped tasks for each teammate
- Monitor progress via TaskList and SendMessage
- Run post-completion verification
- Report status between steps
</delegation_protocol>

<workflow>

## Step 0: Environment Detection

Run tmux/terminal detection to determine display mode:

```bash
node -e "
const tmux = !!process.env.TMUX;
const iterm2 = process.env.TERM_PROGRAM === 'iTerm2' || !!process.env.ITERM_SESSION_ID;
const terminal = process.env.TERM_PROGRAM || 'unknown';
let tmuxInstalled = false;
try { require('child_process').execSync('which tmux', { stdio: 'ignore' }); tmuxInstalled = true; } catch {}
const capable = tmux || iterm2;
console.log(JSON.stringify({ mode: tmux ? 'tmux' : iterm2 ? 'iterm2' : 'none', capable, tmuxInstalled, terminal }));
"
```

- If `capable: true`: Proceed. Claude Code's `teammateMode: "auto"` handles split panes.
- If `capable: false` and `tmuxInstalled: true`: Print advisory:
  > Agent Teams work best with tmux split panes. You're not in tmux, but it's installed.
  > To get split panes: exit, run `tmux new-session -s team && claude`, re-invoke /team-work.
  > Proceeding with in-process mode.
- If `capable: false` and `tmuxInstalled: false`: Print advisory:
  > Running in-process mode. For split panes, install tmux: `brew install tmux`
  > Proceeding with in-process mode.

Proceed regardless of result. The nudge is advisory, not blocking.

## Step 1: Check for Existing State

```bash
test -f ".claude/team-state/config.json" && cat ".claude/team-state/config.json" || echo '{"exists":false}'
```

- If state exists with `status: "active"`: Ask user -- Resume, Archive, or Discard?
  - Resume: Continue from current phase (skip to Step 4 with existing team config)
  - Archive: Run `node -e "require('$HOME/.claude/lib/team-state.cjs').cmdTeamState('archive', [])"` then continue to Step 2
  - Discard: Run `node -e "require('$HOME/.claude/lib/team-state.cjs').cmdTeamState('reset', [])"` then continue to Step 2
- If no state exists: Continue to Step 2

## Step 2: Parse Task and Plan Phases

Read the user's `$ARGUMENTS` and break them into phases. Ask clarifying questions ONLY if the task is genuinely ambiguous. For each phase, determine:
- Phase number and name
- High-level goal
- Which role (Architect/Engineer) owns each task

Create a phases JSON array:
```
[
  { "number": 1, "name": "Phase name", "tasks": [{ "description": "...", "owner": "Architect|Engineer" }] },
  ...
]
```

## Step 3: Initialize State

```bash
node -e "require('$HOME/.claude/lib/team-state.cjs').cmdTeamState('init', ['$TEAM_NAME', '$PHASES_JSON'])"
```

Where `$TEAM_NAME` is a short kebab-case name and `$PHASES_JSON` is the JSON array from Step 2 (single-quoted to preserve structure).

This creates:
- `.claude/team-state/config.json` with team configuration
- `.claude/team-state/PHASE-STATUS.md` with initial status board

## Step 4: Read Workflow Reference

```
Read ~/.claude/lib/team-workflow-reference.md
```

This contains the team structure, phase protocol, communication norms, and git protocol that all teammates must follow.

## Step 5: Create Team

Use `TeamCreate` to create the 3-person team. Each teammate gets:
- Their role identity (from the workflow reference)
- The current project context (working directory, task description)
- Phase 1 task assignments
- The workflow rules (communication norms, git protocol, state update requirements)

Teammate prompts must include:
1. Role and identity section
2. Project context: what we're building and why
3. Phase plan: which phase, what tasks, who owns what
4. Workflow rules: communication norms, git protocol, state management
5. File paths to key resources (state files, project root)
6. Instructions to check TaskList for assigned tasks

## Step 6: Create Phase 1 Tasks

Use `TaskCreate` for each task in Phase 1. Each task must have:
- Clear subject line
- Description with acceptance criteria
- Owner set to the appropriate role (Architect or Engineer)
- Metadata: `{ "phase": 1, "phaseStatusRow": N }`

Also create a Lead task for Phase 1 review:
- "Review Phase 1: [phase name]"
- Owner: Lead
- Blocked by all Phase 1 dev tasks

## Step 7: Monitor Execution

Poll `TaskList` periodically to track progress. When all Phase N dev tasks complete:

1. Send message to Lead: "Phase {N} dev work complete. Ready for review."
2. Create Phase N+1 tasks (if more phases remain)
3. Send messages to Architect and Engineer with Phase N+1 assignments
4. Update state:
   ```bash
   node -e "require('$HOME/.claude/lib/team-state.cjs').cmdTeamState('advance', [])"
   ```

Repeat until all phases complete.

## Step 8: Final Phase -- ALL STOP

When the final phase dev work completes:
1. Send message to all: "Final phase complete. ALL STOP. Waiting for Lead to finish reviews."
2. Wait for Lead to complete all pending review tasks
3. Lead conducts second pass on logged minor items
4. Lead coordinates retrospective with all three teammates

## Step 9: Record Retrospective

After the team retrospective:
```bash
node -e "require('$HOME/.claude/lib/team-state.cjs').cmdTeamState('complete', [])"
```

This transitions state to `complete` and renders the retrospective template.

## Step 10: Post-Completion Verification

```bash
node -e "
const s = require('$HOME/.claude/lib/team-state.cjs');
const config = s.readState(process.cwd());
const checks = [];
checks.push({ check: 'status-complete', pass: config && config.status === 'complete' });
checks.push({ check: 'retrospective-exists', pass: require('fs').existsSync(s.getRetrospectivePath(process.cwd())) });
const phases = (config && config.phases) || [];
checks.push({ check: 'all-phases-reviewed', pass: phases.every(p => p.reviewStatus && p.reviewStatus !== 'pending') });
const passed = checks.filter(c => c.pass).length;
console.log(JSON.stringify({ checks, passed, failed: checks.length - passed }));
"
```

Verification checks:
1. State status is `complete`
2. Retrospective file exists
3. All phases have review results recorded

Report the verification result to the user. If any check fails, flag it but do not block -- the work is done, these are protocol compliance checks.

## Step 11: Summary

Present final summary to user:
- Phases completed: N
- Tasks completed: M
- Files created/modified (from phase summaries)
- Verification result
- Location of state files for reference

</workflow>

<success_criteria>
- Team was created via TeamCreate (not Agent)
- All phases completed with task tracking
- PHASE-STATUS.md has completion summaries for every phase
- Lead reviewed every phase (PASS, PASS WITH NOTES, or BLOCKED+resolved)
- Retrospective recorded
- Post-completion verification passed or issues flagged
- State file shows status: complete
</success_criteria>
