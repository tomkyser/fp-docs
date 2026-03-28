---
command: help
engine: orchestrate
operation: help
instruction: none
agent: orchestrate
context: fork
type: meta
pipeline_stages: none
subcommands: none
flags: none
---

# /fp-docs:help - Behavioral Specification

## Routing Path

1. User invokes `/fp-docs:help`
2. Skill SKILL.md passes to orchestrate engine
3. Orchestrate runs `fp-tools.cjs help grouped --raw` via Bash
4. Orchestrate presents the grouped markdown output to the user
5. Orchestrate appends meta-command notes (/fp-docs:do, /fp-docs:help)

## Expected Markers

- Output contains `# fp-docs Command Reference` heading
- Output contains type-group headings (Documentation Creation & Modification, Validation & Auditing, System & Maintenance, Batch Operations)
- Output contains all 21 routing-table commands in markdown tables

## Error Paths

- fp-tools.cjs not found: Bash command fails, engine reports error
- Plugin root not set: paths.cjs getPluginRoot() throws

## Edge Cases

- Running with no arguments: displays full reference (no arguments expected)
- CJS output includes pipe-delimited markdown tables that render in Claude Code
