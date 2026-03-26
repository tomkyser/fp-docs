---
description: "Display all fp-docs commands grouped by type with descriptions. Quick reference for discovering available documentation operations."
argument-hint: ""
context: fork
agent: orchestrate
---

Engine: orchestrate
Operation: help
Instruction: none

Run the following Bash command to get the grouped command list:

```bash
node "{plugin-root}/fp-tools.cjs" help grouped --raw
```

Present the markdown output directly to the user as a formatted command reference.

Additionally, mention these two meta-commands that are not listed in the standard reference:
- `/fp-docs:do "description"` -- Route natural language to the right command. Describe what you want in plain English and the smart router will match it to the appropriate fp-docs operation.
- `/fp-docs:help` -- This command. Display the grouped command reference.
