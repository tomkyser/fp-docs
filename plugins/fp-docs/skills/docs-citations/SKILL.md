---
name: docs-citations
description: Manage code citations in documentation files. Subcommands: generate (create new), update (refresh stale), verify (check format), audit (deep accuracy check).
argument-hint: "generate|update|verify|audit [scope]"
context: fork
agent: docs-citations
---

$ARGUMENTS

Parse the first word as the subcommand (generate|update|verify|audit).
Read the instruction file at `framework/instructions/citations/{subcommand}.md` and follow it exactly.
Pass remaining arguments as scope.
