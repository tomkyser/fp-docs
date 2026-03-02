---
name: setup
description: Initialize or verify the fp-docs plugin installation. Checks all required files exist and validates configuration.
argument-hint: ""
context: fork
agent: docs-system
---

Operation: setup

Verify the fp-docs plugin installation:
1. Check all required directories exist (agents/, skills/, hooks/, scripts/, framework/)
2. Validate plugin.json manifest
3. Verify all 8 engine agent files exist
4. Verify all 18 user skill files exist
5. Verify all 10 shared module files exist
6. Verify hooks.json is valid JSON
7. Verify all hook scripts are executable
8. Report any missing or misconfigured components
