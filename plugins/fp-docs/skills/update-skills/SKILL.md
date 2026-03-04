---
description: Regenerate all plugin skills from the current prompt definitions. Syncs skill files with the source-of-truth prompts.
argument-hint: ""
context: fork
agent: orchestrate
---

Engine: system
Operation: update-skills
Instruction: framework/instructions/system/update-skills.md

Read the current prompt definitions and regenerate all skill SKILL.md files.
Preserve any customizations in existing files.
Report what changed.
