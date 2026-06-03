---
command: do
engine: none
operation: do
workflow: workflows/do.md
agent: none
type: meta
pipeline_stages: none
subcommands: none
flags: none
---

# /fp-docs:do - Behavioral Specification

## Routing Path

1. User invokes `/fp-docs:do "natural language description"`
2. Command file loads workflow `workflows/do.md` via `@-reference`
3. Workflow executes inline (no agent spawning)
4. Workflow evaluates `$ARGUMENTS` against routing rules table
5. First-match-wins: best matching command is selected
6. If ambiguous: AskUserQuestion shows 2-3 candidates for user to choose
7. Routing banner displayed showing input, chosen command, and reason
8. Chosen `/fp-docs:{command}` is auto-dispatched with original `$ARGUMENTS`

## Expected Markers

- Routing banner: `fp-docs > ROUTING` followed by Input, Routing to, Reason fields
- Dispatch: the output of whichever `/fp-docs:{command}` was selected

## Error Paths

- Empty `$ARGUMENTS`: AskUserQuestion prompts for input
- Ambiguous intent: AskUserQuestion with 2-3 candidates
- Self-referential request ("route this"): explains user is already in the router
- No match: falls through to `/fp-docs:help` as catch-all

## Edge Cases

- Input that matches `/fp-docs:do` itself: self-reference guard prevents circular routing
- Input "help": routes to `/fp-docs:help` (last rule in table)
- Very short input ("audit"): routes to `/fp-docs:audit` if unambiguous
