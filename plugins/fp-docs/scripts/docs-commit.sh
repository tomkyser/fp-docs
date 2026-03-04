#!/bin/bash
# Commit and push docs changes to the docs repo on the current branch
# Usage: bash docs-commit.sh "commit message" [--no-push] [--offline]
# Called by engines after pipeline completion

CODEBASE_ROOT=$(git -C "${PWD}" rev-parse --show-toplevel 2>/dev/null)
DOCS_ROOT="${CODEBASE_ROOT}/themes/foreign-policy-2017/docs"

if [ ! -d "${DOCS_ROOT}/.git" ]; then
  echo "Error: Docs repo not found at ${DOCS_ROOT}" >&2
  exit 1
fi

COMMIT_MSG="${1:-fp-docs: automated update}"

# Parse flags from any argument position
NO_PUSH=false
OFFLINE=false
for arg in "$@"; do
  if [ "$arg" = "--no-push" ]; then
    NO_PUSH=true
  fi
  if [ "$arg" = "--offline" ]; then
    OFFLINE=true
  fi
done

# --offline implies --no-push
if [ "$OFFLINE" = true ]; then
  NO_PUSH=true
fi

# Source remote check utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${SCRIPT_DIR}/remote-check.sh" ]; then
  source "${SCRIPT_DIR}/remote-check.sh"
fi

BRANCH=$(git -C "${DOCS_ROOT}" branch --show-current)

# Pull latest before commit (unless --offline)
if [ "$OFFLINE" = true ]; then
  echo "[docs-pull: skipped (offline)]"
elif type pull_latest >/dev/null 2>&1 && git -C "${DOCS_ROOT}" remote get-url origin >/dev/null 2>&1; then
  PULL_OUTPUT=$(pull_latest "${DOCS_ROOT}" 2>&1)
  PULL_EXIT=$?
  if [ $PULL_EXIT -eq 0 ]; then
    echo "$PULL_OUTPUT"
  else
    echo "Error: Pull failed before commit. ${PULL_OUTPUT}" >&2
    exit 1
  fi
fi

cd "${DOCS_ROOT}"
git add -A
if git diff --cached --quiet; then
  echo "No docs changes to commit."
  exit 0
fi

git commit -m "${COMMIT_MSG}"
echo "Committed to docs repo (branch: ${BRANCH}): ${COMMIT_MSG}"

# Push to remote unless --no-push or --offline
if [ "$OFFLINE" = true ]; then
  echo "[docs-push: skipped (offline)]"
elif [ "$NO_PUSH" = true ]; then
  echo "[docs-push: skipped] (--no-push flag)"
else
  if git remote get-url origin >/dev/null 2>&1; then
    PUSH_OUTPUT=$(git push 2>&1)
    PUSH_EXIT=$?
    if [ $PUSH_EXIT -eq 0 ]; then
      echo "[docs-push: pushed] (branch: ${BRANCH})"
    else
      echo "[docs-push: HALTED] Push failed." >&2
      if type format_diagnostic >/dev/null 2>&1; then
        format_diagnostic "unreachable" "${DOCS_ROOT}" "${BRANCH}" >&2
      else
        echo "Push failed — check remote connectivity and authentication." >&2
      fi
      exit 1
    fi
  else
    echo "[docs-push: skipped] No remote configured. Run /fp-docs:setup to configure."
  fi
fi
