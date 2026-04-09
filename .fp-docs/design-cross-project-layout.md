# Design: Cross-Project Placement and System Layout

> Task #1 deliverable. Architect (Phase 1).
> Defines where every component of the Agent Team Workflow system lives, why, and how Claude discovers it.

---

## Design Principles

1. **Zero coupling to GSD or fp-docs.** The system must work in any project directory, even ones without `.planning/` or fp-docs plugins installed.
2. **Global components in `~/.claude/`.** Slash command, agent definitions, hooks, and CJS modules live at the user level so they're available everywhere.
3. **Project state in `.claude/` within the working directory.** Each project gets its own team state. Never pollute the project root.
4. **Convention over configuration.** Fixed paths, fixed filenames, no config file needed to locate things.
5. **Claude Code native primitives only.** Skills, agents, hooks, settings.json -- no custom loaders.

---

## Global File Layout

```
~/.claude/
  skills/
    team-work/
      SKILL.md                    # Slash command: /team-work
  agents/
    team-architect.md             # Agent definition: Architect role
    team-engineer.md              # Agent definition: Engineer role  
    team-lead.md                  # Agent definition: Lead role
  hooks/
    team-workflow-enforce.js      # TeammateIdle hook: enforce delegation result structure
    team-task-enforce.js          # TaskCompleted hook: verify task output quality
    team-session-init.js          # SessionStart hook: detect existing team state, inject context
  lib/
    team-state.cjs                # CJS module: state CRUD, lifecycle transitions, cleanup
    team-templates.cjs            # CJS module: template rendering for PHASE-STATUS, retrospective
  settings.json                   # Hook registrations added here (existing file, merge into)
```

### Rationale

| Component | Location | Why |
|-----------|----------|-----|
| `/team-work` skill | `~/.claude/skills/team-work/SKILL.md` | Standard Claude Code skill path. Discovered automatically. Available in every project via `/team-work`. |
| Agent definitions | `~/.claude/agents/team-{role}.md` | Standard Claude Code agent path. `TeamCreate` references agents by name; Claude discovers them from `~/.claude/agents/`. Prefixed `team-` to avoid collision with GSD agents. |
| Enforcement hooks | `~/.claude/hooks/team-*.js` | Same pattern as existing GSD hooks. Registered in `settings.json` under TeammateIdle, TaskCompleted, SessionStart. |
| CJS modules | `~/.claude/lib/team-*.cjs` | **New directory.** GSD uses `get-shit-done/bin/lib/` but that couples to GSD. A top-level `lib/` under `~/.claude/` is the clean cross-project location. If `~/.claude/lib/` doesn't exist yet, the SessionStart hook or skill creates it on first run. |
| Workflow reference | `~/.claude/lib/team-workflow-reference.md` | Lives in `lib/` alongside the CJS modules. Deliberate choice: the slash command reads it via `Read` tool, not `require()`. It's a reference doc consumed by the dispatcher, not a standalone user-facing doc. Placing it in `lib/` keeps all team-workflow runtime assets together. A `~/.claude/references/` dir would be premature -- only one file would live there. |
| Templates | Inside `team-templates.cjs` | Embedded in the CJS module as template strings. No separate template directory needed -- keeps the footprint small. |

### Why NOT These Alternatives

| Alternative | Rejected Because |
|-------------|-----------------|
| `~/.claude/get-shit-done/references/` | Couples to GSD. System must work without GSD installed. |
| `~/.claude/team-workflow/` (custom top-level) | Claude Code doesn't auto-discover custom directories. Would need a loader. |
| Plugin distribution (`~/.claude/plugins/`) | Overkill for a user-level tool. Plugins need marketplace packaging. |
| Project-local skill (`.claude/commands/`) | Would need to be copied into every project. Global skill is the right call. |

---

## Project-Local State Layout

When `/team-work` is invoked in a project, state is created here:

```
{project-root}/
  .claude/
    team-state/
      config.json                 # Team configuration (created at init)
      PHASE-STATUS.md             # Living status board (the core artifact)
      retrospective.md            # Written after final phase (created at team-complete)
      archive/                    # Completed team runs (moved here after archive)
        {timestamp}-{team-name}/
          PHASE-STATUS.md
          retrospective.md
```

### Rationale

| Decision | Why |
|----------|-----|
| `.claude/team-state/` not `.claude/team/` | Explicit name avoids collision with any future Claude Code feature. `team-state` says what it is. |
| Flat structure (no nesting per team name) | Only one team runs at a time per project. The `config.json` tracks the active team name. |
| `archive/` subdirectory | Completed runs are preserved for reference but moved out of the active path. Timestamped to avoid collision. |
| `config.json` at team-state root | Stores team name, member count, display mode preference, start timestamp, current phase number. Read by hooks and CJS modules. |
| No `phases/` subdirectory | PHASE-STATUS.md is append-only for completed phases. History is in the file, not in separate phase directories. This matches the original workflow doc pattern. |

### config.json Schema

```json
{
  "teamName": "wave-0",
  "memberCount": 3,
  "roles": ["Architect", "Engineer", "Lead"],
  "displayMode": "auto",
  "startedAt": "2026-04-09T17:00:00Z",
  "currentPhase": 1,
  "status": "active",
  "phases": [
    { "number": 1, "name": "Research and Design", "status": "in-progress" },
    { "number": 2, "name": "Implementation", "status": "pending" }
  ]
}
```

---

## Discovery and Loading

### How Claude Finds Each Component

| Component | Discovery Mechanism | When |
|-----------|-------------------|------|
| `/team-work` slash command | Claude Code auto-discovers `~/.claude/skills/*/SKILL.md` | User types `/team-work` |
| Agent definitions | `TeamCreate` tool references agent names; Claude resolves from `~/.claude/agents/` | Skill invokes `TeamCreate` with `team-architect`, `team-engineer`, `team-lead` |
| Hooks | Registered in `~/.claude/settings.json` under event names | Fires automatically on TeammateIdle, TaskCompleted, SessionStart |
| CJS modules | `require()` from hook JS files and skill process steps | Called by hooks and by Bash commands in the skill workflow |
| Project state | Hooks and skill read `{cwd}/.claude/team-state/` | SessionStart hook checks if state exists; skill creates it if not |

### SessionStart Hook Behavior

The `team-session-init.js` hook runs on every session start:

1. Check if `{cwd}/.claude/team-state/config.json` exists
2. If yes and `status === "active"`:
   - Inject context: "Active team workflow detected: {teamName}, Phase {N}, Status: {status}"
   - Include last 10 lines of PHASE-STATUS.md as context
3. If no or `status !== "active"`:
   - No output (silent, zero cost)

This is a **read-only, advisory** hook. It never blocks.

---

## Integration Points

### With Claude Code Task System

The slash command uses `TaskCreate` / `TaskUpdate` for phase tasks. These are the Claude Code native tasks visible in the UI. PHASE-STATUS.md is the **richer** tracking layer that adds:
- Task claiming (who owns what)
- Phase completion summaries
- Cross-phase history
- Retrospective notes

The two systems complement each other:
- Claude tasks = real-time execution tracking (what's happening now)
- PHASE-STATUS.md = persistent record (what happened, decisions, discoveries)

### With Git

The Lead agent is the only one that touches git. The slash command workflow includes git protocol instructions in the Lead agent definition. No hooks enforce this -- it's agent-level instruction, same as the original workflow doc.

### With Tmux

Display mode detection is handled at skill invocation time, not by the state system. The skill checks `$TMUX` env var and adjusts `TeamCreate` parameters accordingly. State layout is the same regardless of display mode.

---

## File Inventory (Complete)

### Global (created once, used everywhere)

| File | Size Est. | Purpose |
|------|-----------|---------|
| `~/.claude/skills/team-work/SKILL.md` | ~3KB | Slash command definition |
| `~/.claude/agents/team-architect.md` | ~2KB | Architect agent system prompt |
| `~/.claude/agents/team-engineer.md` | ~2KB | Engineer agent system prompt |
| `~/.claude/agents/team-lead.md` | ~2KB | Lead agent system prompt |
| `~/.claude/hooks/team-workflow-enforce.js` | ~2KB | TeammateIdle enforcement |
| `~/.claude/hooks/team-task-enforce.js` | ~2KB | TaskCompleted enforcement |
| `~/.claude/hooks/team-session-init.js` | ~1.5KB | SessionStart context injection |
| `~/.claude/lib/team-state.cjs` | ~4KB | State management module |
| `~/.claude/lib/team-env.cjs` | ~1KB | Environment detection (tmux/iTerm2) |
| `~/.claude/lib/team-workflow-reference.md` | ~3KB | Workflow reference loaded by slash command |

### Per-Project (created per team invocation)

| File | Size Est. | Purpose |
|------|-----------|---------|
| `.claude/team-state/config.json` | ~0.5KB | Team configuration |
| `.claude/team-state/PHASE-STATUS.md` | Growing | Living status board |
| `.claude/team-state/retrospective.md` | ~2KB | Post-completion retrospective |
