# Smart Router — Intent Matching

> Read by the orchestrate engine when `/fp-docs:do` is invoked. Routes natural language input to the most appropriate fp-docs command. This is a dispatcher — it never does the work itself.

---

## Inputs

- `$ARGUMENTS` — Freeform natural language text from the user describing what they want to do.

## Steps

### 1. Validate Input

If `$ARGUMENTS` is empty, ask via AskUserQuestion:

```
What would you like to do? Describe the task and I'll route you to the right fp-docs command.
```

Wait for response before continuing.

### 2. Evaluate Against Routing Rules

Evaluate `$ARGUMENTS` against the routing rules table below. Apply the **first matching** rule — scan from top to bottom and stop at the first rule whose description matches the user's intent.

| If the text describes... | Route to | Why |
|--------------------------|----------|-----|
| Fixing, correcting, or updating existing docs that are wrong or outdated | `/fp-docs:revise` | Known issue with specific docs |
| Creating new documentation for undocumented code | `/fp-docs:add` | New docs creation |
| Detecting what docs need updating from recent code changes, auto-update | `/fp-docs:auto-update` | Git-diff-based detection |
| Processing the needs-revision tracker, batch revise | `/fp-docs:auto-revise` | Batch tracker processing |
| Removing, deprecating, or archiving documentation | `/fp-docs:deprecate` | Lifecycle end |
| Comparing docs to source code, checking accuracy, deep audit | `/fp-docs:audit` | Read-only comparison |
| Running verification checks, checking doc quality, 10-point check | `/fp-docs:verify` | 10-point verification |
| Checking for hallucinations, mismatches, sanity checking | `/fp-docs:sanity-check` | Zero-tolerance accuracy check |
| Testing against live environment, runtime validation, ddev | `/fp-docs:test` | Runtime testing |
| Managing citations, adding code references, citation audit | `/fp-docs:citations` | Citation lifecycle |
| Managing API references, function signatures, API tables | `/fp-docs:api-ref` | API reference tables |
| Managing locals, template contracts, $locals variables | `/fp-docs:locals` | Locals contracts |
| Checking verbosity, scanning for gaps, anti-summarization | `/fp-docs:verbosity-audit` | Anti-compression audit |
| Updating the project index, refreshing index | `/fp-docs:update-index` | Index refresh |
| Updating CLAUDE.md template, regenerating claude | `/fp-docs:update-claude` | CLAUDE.md generation |
| Updating or regenerating skills, skill refresh | `/fp-docs:update-skills` | Skill regeneration |
| Setting up, first-time configuration, initial setup | `/fp-docs:setup` | Initial setup |
| Syncing branches, checking remote state, git sync | `/fp-docs:sync` | Git sync |
| Running multiple operations in parallel, batch processing | `/fp-docs:parallel` | Batch operations |
| Fixing audit issues, remediating findings, resolving audit results, following up on audit, batch fixing docs | `/fp-docs:remediate` | Audit follow-up dispatch |
| Checking for or installing plugin updates, self-update, version check | `/fp-docs:update` | Plugin self-update |
| Listing commands, getting help, what can you do, how does this work | `/fp-docs:help` | Command reference |

### 3. Handle Ambiguity

If the text could reasonably match 2 or more rules equally well, do NOT guess. Ask the user via AskUserQuestion showing the top 2-3 candidate commands. Each candidate must show the command name and its description. Format:

```
Your request could match several commands:

1. /fp-docs:revise -- Fix specific documentation you know is wrong or outdated
2. /fp-docs:auto-update -- Detect and update docs affected by recent code changes
3. /fp-docs:audit -- Compare documentation against source code and report discrepancies

Which command best fits what you need?
```

After the user selects, proceed to Step 4 with the chosen command.

### 4. Display Routing Banner

Before dispatching, display this banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 fp-docs > ROUTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Input:** {first 80 characters of $ARGUMENTS}
**Routing to:** {chosen /fp-docs:command}
**Reason:** {one-line explanation of why this command was selected}

### 5. Auto-Dispatch

Invoke the chosen `/fp-docs:{command}` immediately after displaying the banner. Pass the original `$ARGUMENTS` as the arguments. Do NOT ask for confirmation — the banner is informational only.

### 6. Self-Reference Guard

If the user asks to "route", "dispatch", or "relay" something, or if the matched command would be `/fp-docs:do` itself, explain that they are already in the router. Do NOT self-reference `/fp-docs:do` in dispatch. This prevents circular routing.

## Output

The output is the routing banner followed by the dispatched command's output. This instruction file produces no output of its own beyond the banner.
