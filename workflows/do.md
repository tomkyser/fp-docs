<purpose>
Smart router that matches freeform natural language input to the most appropriate fp-docs
command. This is a dispatcher -- it never does the work itself. Routes to one of the 22
other fp-docs commands based on intent matching.
</purpose>

<required_reading>
Read all files referenced by the invoking command's execution_context.
</required_reading>

<process>

<step name="validate-input" priority="first">
## 1. Validate Input
If $ARGUMENTS is empty, ask the user:
```
What would you like to do? Describe the task and I'll route you to the right fp-docs command.
```
Wait for response before continuing.
</step>

<step name="match-intent">
## 2. Evaluate Against Routing Rules

Evaluate $ARGUMENTS against the routing rules table below. Apply the **first matching** rule --
scan top to bottom, stop at the first match.

| If the text describes... | Route to |
|--------------------------|----------|
| Fixing, correcting, or updating existing docs that are wrong or outdated | `/fp-docs:revise` |
| Creating new documentation for undocumented code | `/fp-docs:add` |
| Detecting what docs need updating from recent code changes, auto-update | `/fp-docs:auto-update` |
| Processing the needs-revision tracker, batch revise | `/fp-docs:auto-revise` |
| Removing, deprecating, or archiving documentation | `/fp-docs:deprecate` |
| Comparing docs to source code, checking accuracy, deep audit | `/fp-docs:audit` |
| Running verification checks, checking doc quality, 10-point check | `/fp-docs:verify` |
| Checking for hallucinations, mismatches, sanity checking | `/fp-docs:sanity-check` |
| Testing against live environment, runtime validation, ddev | `/fp-docs:test` |
| Managing citations, adding code references, citation audit | `/fp-docs:citations` |
| Managing API references, function signatures, API tables | `/fp-docs:api-ref` |
| Managing locals, template contracts, $locals variables | `/fp-docs:locals` |
| Checking verbosity, scanning for gaps, anti-summarization | `/fp-docs:verbosity-audit` |
| Updating the project index, refreshing index | `/fp-docs:update-index` |
| Updating CLAUDE.md template, regenerating claude | `/fp-docs:update-claude` |
| Updating or regenerating skills, skill refresh | `/fp-docs:update-skills` |
| Setting up, first-time configuration, initial setup | `/fp-docs:setup` |
| Syncing branches, checking remote state, git sync | `/fp-docs:sync` |
| Running multiple operations in parallel, batch processing | `/fp-docs:parallel` |
| Fixing audit issues, remediating findings, batch fixing docs | `/fp-docs:remediate` |
| Checking for or installing plugin updates, self-update | `/fp-docs:update` |
| Listing commands, getting help, what can you do | `/fp-docs:help` |
</step>

<step name="handle-ambiguity">
## 3. Handle Ambiguity

If the text could reasonably match 2 or more rules equally well, do NOT guess. Ask the user
showing the top 2-3 candidate commands with descriptions:

```
Your request could match several commands:

1. /fp-docs:revise -- Fix specific documentation you know is wrong or outdated
2. /fp-docs:auto-update -- Detect and update docs affected by recent code changes
3. /fp-docs:audit -- Compare documentation against source code and report discrepancies

Which command best fits what you need?
```

After the user selects, proceed to Step 4 with the chosen command.
</step>

<step name="display-and-dispatch">
## 4. Display Routing Banner and Dispatch

Display this banner before dispatching:

```
---
fp-docs > ROUTING
---
Input: {first 80 characters of $ARGUMENTS}
Routing to: {chosen /fp-docs:command}
Reason: {one-line explanation of why this command was selected}
```

Invoke the chosen `/fp-docs:{command}` immediately. Pass the original $ARGUMENTS.
Do NOT ask for confirmation -- the banner is informational only.
</step>

<step name="self-reference-guard">
## 5. Self-Reference Guard

If the user asks to "route", "dispatch", or "relay" something, or if the matched command
would be `/fp-docs:do` itself, explain that they are already in the router.
Do NOT self-reference `/fp-docs:do` in dispatch. This prevents circular routing.
</step>

</process>

<success_criteria>
- [ ] User intent matched to correct fp-docs command
- [ ] Routing banner displayed before dispatch
- [ ] No ambiguous routing -- either clear match or user asked to disambiguate
- [ ] No circular self-reference to /fp-docs:do
- [ ] Original $ARGUMENTS passed through to dispatched command
</success_criteria>
