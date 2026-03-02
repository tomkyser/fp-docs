#!/bin/bash
# Commit docs changes to the docs repo on the current branch
# Usage: bash docs-commit.sh "commit message"
# Called by engines after pipeline completion

CODEBASE_ROOT=$(git -C "${PWD}" rev-parse --show-toplevel 2>/dev/null)
DOCS_ROOT="${CODEBASE_ROOT}/themes/foreign-policy-2017/docs"

if [ ! -d "${DOCS_ROOT}/.git" ]; then
  echo "Error: Docs repo not found at ${DOCS_ROOT}" >&2
  exit 1
fi

COMMIT_MSG="${1:-fp-docs: automated update}"
BRANCH=$(git -C "${DOCS_ROOT}" branch --show-current)

cd "${DOCS_ROOT}"
git add -A
if git diff --cached --quiet; then
  echo "No docs changes to commit."
  exit 0
fi

git commit -m "${COMMIT_MSG}"
echo "Committed to docs repo (branch: ${BRANCH}): ${COMMIT_MSG}"
