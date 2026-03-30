---
name: fp-docs:sanity-check
description: Validate that documentation claims match actual source code. Zero-tolerance mode flags any discrepancy.
argument-hint: "scope like docs/06-helpers/posts.md"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - Task
---

<objective>
Cross-reference every factual claim in documentation against source code. Classifies each
claim as VERIFIED, MISMATCH, HALLUCINATION, or UNVERIFIED. This is the foundation of
the fp-docs accuracy guarantee.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/workflows/sanity-check.md
@${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
@${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
@${CLAUDE_PLUGIN_ROOT}/references/validation-rules.md
</execution_context>

<context>
Arguments: $ARGUMENTS
Operation type: read-only (no pipeline, no git operations)
</context>

<process>
Execute the sanity-check workflow from @${CLAUDE_PLUGIN_ROOT}/workflows/sanity-check.md end-to-end.
No files are modified. Report only.
</process>

<success_criteria>
- [ ] Every factual claim in scope checked against source code
- [ ] Claims classified (VERIFIED, MISMATCH, HALLUCINATION, UNVERIFIED)
- [ ] Confidence level determined (HIGH/LOW)
- [ ] No files modified
</success_criteria>
