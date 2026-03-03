---
name: docs-locals
description: "Manage locals contract documentation for WordPress template components. Subcommands: annotate, contracts, cross-ref, validate, shapes, coverage."
argument-hint: "annotate|contracts|cross-ref|validate|shapes|coverage [scope]"
context: fork
agent: docs-locals
---

$ARGUMENTS

Parse the first word as the subcommand (annotate|contracts|cross-ref|validate|shapes|coverage).
Read the instruction file at `framework/instructions/locals/{subcommand}.md` and follow it exactly.
Pass remaining arguments as scope.
