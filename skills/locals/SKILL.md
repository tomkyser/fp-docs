---
description: "Manage locals contract documentation for WordPress template components. Subcommands: annotate, contracts, cross-ref, validate, shapes, coverage."
argument-hint: "annotate|contracts|cross-ref|validate|shapes|coverage [scope]"
context: fork
agent: orchestrate
---

Engine: locals
Operation: (subcommand)
Instruction: framework/instructions/locals/{subcommand}.md

$ARGUMENTS

Parse the first word as the subcommand (annotate|contracts|cross-ref|validate|shapes|coverage).
Pass remaining arguments as scope.
