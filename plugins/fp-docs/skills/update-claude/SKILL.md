---
description: Regenerate the CLAUDE.md template with current skill inventory, documentation links, and project configuration.
argument-hint: ""
context: fork
agent: orchestrate
---

Engine: index
Operation: update-example-claude
Instruction: framework/instructions/index/update-example-claude.md

Read the project's CLAUDE.md and the plugin manifest at `framework/manifest.md`.
Regenerate the Documentation Skills section of CLAUDE.md to reflect current plugin skills.
Update any paths or references that have changed.
