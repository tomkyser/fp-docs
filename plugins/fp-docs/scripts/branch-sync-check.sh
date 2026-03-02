#!/bin/bash
# SessionStart: Detect codebase branch, compare with docs branch, warn on mismatch
# Runs AFTER inject-manifest.sh
# Output: JSON with additionalContext (branch info) and optional stopMessage

# Find codebase root (wp-content/)
CODEBASE_ROOT=$(git -C "${PWD}" rev-parse --show-toplevel 2>/dev/null)
if [ -z "$CODEBASE_ROOT" ]; then
  exit 0  # Not in a git repo, skip silently
fi

# Resolve docs path
DOCS_ROOT="${CODEBASE_ROOT}/themes/foreign-policy-2017/docs"
if [ ! -d "${DOCS_ROOT}/.git" ]; then
  # Docs repo not set up — not an error, just skip
  cat <<EOF
{
  "additionalContext": "Docs repo not detected at ${DOCS_ROOT}. Run /fp-docs:setup to initialize."
}
EOF
  exit 0
fi

# Get branch names
CODEBASE_BRANCH=$(git -C "${CODEBASE_ROOT}" branch --show-current 2>/dev/null)
DOCS_BRANCH=$(git -C "${DOCS_ROOT}" branch --show-current 2>/dev/null)

if [ "$CODEBASE_BRANCH" = "$DOCS_BRANCH" ]; then
  # Branches match — inject context and proceed
  cat <<EOF
{
  "additionalContext": "Repos synced. Codebase: ${CODEBASE_BRANCH}, Docs: ${DOCS_BRANCH}. Docs git root: ${DOCS_ROOT}"
}
EOF
  exit 0
else
  # Branch mismatch — warn user
  cat <<EOF
{
  "additionalContext": "BRANCH MISMATCH — Codebase: ${CODEBASE_BRANCH}, Docs: ${DOCS_BRANCH}. Run /fp-docs:sync to align. Docs git root: ${DOCS_ROOT}",
  "stopMessage": "Docs branch '${DOCS_BRANCH}' does not match codebase branch '${CODEBASE_BRANCH}'. Run /fp-docs:sync to create/switch the docs branch and generate a diff report. Or continue if you want to work on docs independently."
}
EOF
  exit 0
fi
