#!/bin/bash
# fp-docs post-rewrite hook -- installed by /fp-docs:setup
# Handles rebase-based pulls (git pull --rebase) per D-04
# Paths baked at install time by /fp-docs:setup (D-03):
FP_TOOLS="__FP_TOOLS_PATH__"
FP_DOCS_DIR="__FP_DOCS_DIR__"
CODEBASE_ROOT="__CODEBASE_ROOT__"

# Only run for rebase events, not commit --amend (D-04)
if [ "$1" = "rebase" ]; then
  node "${FP_TOOLS}" drift analyze --codebase-root "${CODEBASE_ROOT}" --output "${FP_DOCS_DIR}/drift-pending.json" 2>/dev/null
fi

# Always exit 0 -- git hooks must not block operations
exit 0
