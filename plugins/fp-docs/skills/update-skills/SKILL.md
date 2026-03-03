---
name: update-skills
description: Regenerate all plugin skills from the current prompt definitions. Syncs skill files with the source-of-truth prompts.
argument-hint: ""
context: fork
agent: system
---

Operation: update-skills

Read the current prompt definitions and regenerate all skill SKILL.md files.
Preserve any customizations in existing files.
Report what changed.
