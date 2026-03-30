---
command: help
engine: none
operation: help
workflow: workflows/help.md
agent: none
type: meta
pipeline_stages: none
subcommands: none
flags: none
---

# /fp-docs:help - Behavioral Specification

## Routing Path

1. User invokes `/fp-docs:help`
2. Command file loads workflow `workflows/help.md` via `@-reference`
3. Workflow executes inline (no agent spawning)
4. Workflow runs `fp-tools.cjs help grouped --raw` via Bash
5. Workflow presents the grouped markdown output to the user

## Expected Markers

- Output contains `# fp-docs Command Reference` heading
- Output contains type-group headings (Documentation Creation & Modification, Validation & Auditing, System & Maintenance, Batch Operations, Utility & Routing)
- Output contains all 23 routing-table commands in markdown tables

## Error Paths

- fp-tools.cjs not found: Bash command fails, engine reports error
- Plugin root not set: paths.cjs getPluginRoot() throws

## Edge Cases

- Running with no arguments: displays full reference (no arguments expected)
- CJS output includes pipe-delimited markdown tables that render in Claude Code
