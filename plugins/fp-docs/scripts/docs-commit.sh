#!/bin/bash
# Commit and push docs changes to the docs repo on the current branch
# Usage: bash docs-commit.sh "commit message" [--no-push]
# Called by engines after pipeline completion

CODEBASE_ROOT=$(git -C "${PWD}" rev-parse --show-toplevel 2>/dev/null)
DOCS_ROOT="${CODEBASE_ROOT}/themes/foreign-policy-2017/docs"

if [ ! -d "${DOCS_ROOT}/.git" ]; then
  echo "Error: Docs repo not found at ${DOCS_ROOT}" >&2
  exit 1
fi

COMMIT_MSG="${1:-fp-docs: automated update}"

# Parse --no-push flag from any argument position
NO_PUSH=false
for arg in "$@"; do
  if [ "$arg" = "--no-push" ]; then
    NO_PUSH=true
  fi
done

BRANCH=$(git -C "${DOCS_ROOT}" branch --show-current)

cd "${DOCS_ROOT}"
git add -A
if git diff --cached --quiet; then
  echo "No docs changes to commit."
  exit 0
fi

git commit -m "${COMMIT_MSG}"
echo "Committed to docs repo (branch: ${BRANCH}): ${COMMIT_MSG}"

# Push to remote unless --no-push was passed
if [ "$NO_PUSH" = true ]; then
  echo "[docs-push: skipped] (--no-push flag)"
else
  if git remote get-url origin >/dev/null 2>&1; then
    if git push 2>&1; then
      echo "[docs-push: pushed] (branch: ${BRANCH})"
    else
      echo "[docs-push: failed] Push failed — commit is safe locally. Check remote connectivity." >&2
    fi
  else
    echo "[docs-push: skipped] No remote configured."
  fi
fi
