# Design: Tmux Detection and Nudge UX

> Task #3 deliverable — Engineer
> Date: 2025-04-09

---

## Research Findings

### Environment Detection Signals

| Signal | What it tells us | Reliability |
|--------|-----------------|-------------|
| `$TMUX` env var | Session is running inside tmux | High — set by tmux itself |
| `$TMUX_PANE` env var | Which pane within tmux | High — set by tmux |
| `$TERM_PROGRAM` | Terminal emulator name | Medium — not all terminals set it |
| `$ITERM_SESSION_ID` | Running inside iTerm2 | High — iTerm2-specific |
| `$TERM` | Terminal type string | Low — often generic |
| `which tmux` | tmux is installed | High — binary check |
| `tmux list-sessions` | tmux is running (even if we're not inside it) | High |

### Claude Code teammateMode Behavior

Claude Code's `teammateMode` setting controls how Agent Team teammates are displayed:

- **`"auto"` (default)**: Uses split panes if inside tmux or iTerm2; falls back to in-process otherwise
- **`"in-process"`**: All teammates run in the same process (no visual separation)
- **`"tmux"`**: Force tmux split panes (fails if not in tmux)

Key discovery: **Claude Code already auto-detects tmux**. The `"auto"` setting handles this natively. Our job is not to configure Claude Code — it's to **nudge the user** to start their session in tmux when they're not, so they get the best experience.

### Critical Constraint

**Cannot convert a running Claude Code session into tmux.** Once Claude Code starts outside tmux, you must exit and restart inside tmux to get split-pane teammates. This means the nudge must happen **before team creation**, not after.

### Terminal Support Matrix

| Terminal | Split pane support | Detection method |
|----------|-------------------|------------------|
| tmux | Native split panes | `$TMUX` is set |
| iTerm2 | Native split panes | `$TERM_PROGRAM === "iTerm2"` or `$ITERM_SESSION_ID` is set |
| Ghostty | No split pane API | `$TERM_PROGRAM === "ghostty"` — cannot use tmux mode |
| Terminal.app | No split pane API | `$TERM_PROGRAM === "Apple_Terminal"` |
| VS Code terminal | No split pane API | `$TERM_PROGRAM === "vscode"` |
| Any other | Unknown | Fall back to in-process |

**Split-pane capable**: tmux, iTerm2
**Not capable**: Everything else (Ghostty, Terminal.app, VS Code, etc.)

---

## Design Decision: Where Does the Nudge Live?

### Option A: SessionStart Hook
- Fires every session, even when user doesn't want to use teams
- Creates noise for non-team workflows
- **Rejected**: Too broad

### Option B: Part of the Slash Command (Recommended)
- Fires only when user invokes `/team-work`
- Can gate team creation on detection result
- Natural place — user is explicitly asking for team mode
- **Selected**: Right scope, right timing

### Option C: Separate Pre-flight Skill
- User runs `/team-preflight` before `/team-work`
- Extra step, user will forget
- **Rejected**: Friction without benefit

---

## Detection Logic

```
detectTeamEnvironment():
  1. Check $TMUX → if set: return { mode: "tmux", capable: true }
  2. Check $ITERM_SESSION_ID or $TERM_PROGRAM === "iTerm2" → if set: return { mode: "iterm2", capable: true }
  3. Check `which tmux` → tmuxInstalled = (exit code 0)
  4. Return { mode: "none", capable: false, tmuxInstalled }
```

This is a pure function. No side effects. Returns a struct the slash command can act on.

---

## UX Flow

```
User invokes /team-work <task description>
  │
  ├─ detectTeamEnvironment()
  │
  ├─ capable: true (tmux or iTerm2)
  │   └─ Proceed directly to team creation
  │      (Claude Code's teammateMode: "auto" handles split panes)
  │
  └─ capable: false
      │
      ├─ tmuxInstalled: true
      │   └─ Show NUDGE_TMUX_AVAILABLE message
      │      → User decides: (a) exit + restart in tmux, or (b) proceed in-process
      │
      └─ tmuxInstalled: false
          └─ Show NUDGE_NO_TMUX message
             → Proceed in-process mode (no choice to offer)
```

### Decision: Do NOT Block

The nudge is **advisory**, not blocking. The user can always proceed with in-process mode. Rationale:
- In-process mode works fine — it's just less visible
- Blocking would be hostile UX for users who know what they're doing
- The goal is to inform, not gatekeep

---

## Nudge Message Copy

### NUDGE_TMUX_AVAILABLE

```
Agent Teams work best with tmux split panes — each teammate gets its own
visible pane so you can watch all three working in parallel.

You're not currently in a tmux session, but tmux is installed.

To get split panes:
  1. Exit this session (Ctrl+C or /exit)
  2. Run: tmux new-session -s team && claude
  3. Re-invoke /team-work

Or proceed now with in-process mode (teammates run in background,
same results, just less visible).

Proceeding with in-process mode...
```

### NUDGE_NO_TMUX

```
Agent Teams will run in-process mode. For the best experience with
visible parallel panes, install tmux:
  brew install tmux    # macOS
  apt install tmux     # Linux

Then start Claude Code inside a tmux session.

Proceeding with in-process mode...
```

---

## Helper Script: `claude-team`

A convenience script that handles the tmux setup automatically. Optional — users can always do it manually.

```bash
#!/bin/bash
# claude-team — launch Claude Code inside tmux for agent team split panes
# Install: cp claude-team ~/.local/bin/ && chmod +x ~/.local/bin/claude-team

SESSION_NAME="${1:-claude-team}"

# Already in tmux? Just launch claude
if [ -n "$TMUX" ]; then
  echo "Already in tmux. Launching Claude Code..."
  claude "${@:2}"
  exit 0
fi

# tmux installed?
if ! command -v tmux &>/dev/null; then
  echo "tmux not found. Install with: brew install tmux"
  echo "Launching Claude Code without tmux..."
  claude "$@"
  exit 0
fi

# Check if session already exists
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  echo "Attaching to existing session '$SESSION_NAME'..."
  tmux attach-session -t "$SESSION_NAME"
else
  echo "Creating tmux session '$SESSION_NAME'..."
  tmux new-session -s "$SESSION_NAME" -d
  tmux send-keys -t "$SESSION_NAME" "claude ${*:2}" Enter
  tmux attach-session -t "$SESSION_NAME"
fi
```

### Recommendation on Helper Script

**Include it as a reference, not a required dependency.** The slash command works without it. Users who want the convenience can install it. The nudge message tells users what to do manually — the script is a bonus.

---

## CJS Module Interface

The detection function belongs in a CJS module (e.g., `lib/team-env.cjs`) so it can be called by both the slash command flow and hooks.

```javascript
/**
 * Detect whether the current terminal supports agent team split panes.
 *
 * @returns {{ mode: string, capable: boolean, tmuxInstalled: boolean, terminal: string }}
 */
function detectTeamEnvironment() {
  const tmux = !!process.env.TMUX;
  const iterm2 = process.env.TERM_PROGRAM === 'iTerm2' || !!process.env.ITERM_SESSION_ID;
  const terminal = process.env.TERM_PROGRAM || 'unknown';

  if (tmux) return { mode: 'tmux', capable: true, tmuxInstalled: true, terminal };
  if (iterm2) return { mode: 'iterm2', capable: true, tmuxInstalled: true, terminal };

  // Check if tmux binary exists
  let tmuxInstalled = false;
  try {
    require('child_process').execSync('which tmux', { stdio: 'ignore' });
    tmuxInstalled = true;
  } catch {
    tmuxInstalled = false;
  }

  return { mode: 'none', capable: false, tmuxInstalled, terminal };
}
```

---

## Integration Points

1. **Slash command** (`/team-work`): Calls `detectTeamEnvironment()` as step 1. If not capable, prints nudge. Then proceeds regardless.

2. **State tracking**: The detection result gets written to `TEAM-STATE.json` so hooks can reference what mode the team is running in (tmux vs in-process). Useful for hook behavior that differs by mode.

3. **No SessionStart hook needed**: Detection is on-demand only when the user wants a team.

---

## Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Nudge placement | Inside slash command | Right scope — only fires when user wants teams |
| Nudge behavior | Advisory, not blocking | In-process mode works; don't gatekeep |
| Detection targets | tmux + iTerm2 | Only terminals with split-pane support |
| Helper script | Optional convenience | Nice-to-have, not required |
| CJS module | `detectTeamEnvironment()` | Reusable by command + hooks |
| teammateMode config | Leave as "auto" | Claude Code handles this natively |
