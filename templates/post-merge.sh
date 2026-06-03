#!/bin/bash
# fp-docs post-merge hook -- installed by /fp-docs:setup
# Detects source changes and maps them to affected docs
# Paths baked at install time by /fp-docs:setup (D-03):
FP_TOOLS="__FP_TOOLS_PATH__"
FP_DOCS_DIR="__FP_DOCS_DIR__"
CODEBASE_ROOT="__CODEBASE_ROOT__"

# Run drift analysis (lightweight, no network calls per D-02)
node "${FP_TOOLS}" drift analyze --codebase-root "${CODEBASE_ROOT}" --output "${FP_DOCS_DIR}/drift-pending.json" 2>/dev/null

# Always exit 0 -- git hooks must not block the merge
exit 0
