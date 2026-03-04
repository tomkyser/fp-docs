---
description: "Manage code citations in documentation files. Subcommands: generate (create new), update (refresh stale), verify (check format), audit (deep accuracy check)."
argument-hint: "generate|update|verify|audit [scope]"
context: fork
agent: orchestrate
---

Engine: citations
Operation: (subcommand)
Instruction: framework/instructions/citations/{subcommand}.md

$ARGUMENTS

Parse the first word as the subcommand (generate|update|verify|audit).
Pass remaining arguments as scope.
