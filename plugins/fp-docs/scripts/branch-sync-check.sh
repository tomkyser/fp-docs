#!/bin/bash
# SessionStart: Detect codebase branch, compare with docs branch, warn on mismatch
# Also: verify remote accessibility and pull latest from remote
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

# Source remote check utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${SCRIPT_DIR}/remote-check.sh" ]; then
  source "${SCRIPT_DIR}/remote-check.sh"
fi

# Get branch names
CODEBASE_BRANCH=$(git -C "${CODEBASE_ROOT}" branch --show-current 2>/dev/null)
DOCS_BRANCH=$(git -C "${DOCS_ROOT}" branch --show-current 2>/dev/null)

# Remote check and pull
REMOTE_STATUS="not_checked"

# Check if remote is configured
if git -C "${DOCS_ROOT}" remote get-url origin >/dev/null 2>&1; then
  # Remote is configured — check accessibility
  if type check_remote_accessible >/dev/null 2>&1; then
    DIAG_OUTPUT=$(check_remote_accessible "${DOCS_ROOT}" 2>&1)
    if [ $? -eq 0 ]; then
      REMOTE_STATUS="accessible"
      # Pull latest
      PULL_OUTPUT=$(pull_latest "${DOCS_ROOT}" 2>&1)
      if [ $? -eq 0 ]; then
        REMOTE_STATUS="pulled"
      else
        # Pull failed — halt with diagnostic
        cat <<EOF
{
  "additionalContext": "Docs repo: ${DOCS_ROOT}. Codebase: ${CODEBASE_BRANCH}, Docs: ${DOCS_BRANCH}. Remote: pull failed.",
  "stopMessage": "Docs remote pull failed. ${PULL_OUTPUT}\n\nPass --offline to any fp-docs command to work without remote sync."
}
EOF
        exit 0
      fi
    else
      # Remote unreachable — halt with diagnostic
      cat <<EOF
{
  "additionalContext": "Docs repo: ${DOCS_ROOT}. Codebase: ${CODEBASE_BRANCH}, Docs: ${DOCS_BRANCH}. Remote: unreachable.",
  "stopMessage": "Docs remote is unreachable. ${DIAG_OUTPUT}\n\nPass --offline to any fp-docs command to work without remote sync."
}
EOF
      exit 0
    fi
  else
    REMOTE_STATUS="utils_unavailable"
  fi
else
  # No remote configured — warn but continue
  REMOTE_STATUS="no_remote"
fi

if [ "$CODEBASE_BRANCH" = "$DOCS_BRANCH" ]; then
  # Branches match — inject context and proceed
  cat <<EOF
{
  "additionalContext": "Repos synced. Codebase: ${CODEBASE_BRANCH}, Docs: ${DOCS_BRANCH}. Docs git root: ${DOCS_ROOT}. Remote: ${REMOTE_STATUS}."
}
EOF
  exit 0
else
  # Branch mismatch — warn user
  cat <<EOF
{
  "additionalContext": "BRANCH MISMATCH — Codebase: ${CODEBASE_BRANCH}, Docs: ${DOCS_BRANCH}. Run /fp-docs:sync to align. Docs git root: ${DOCS_ROOT}. Remote: ${REMOTE_STATUS}.",
  "stopMessage": "Docs branch '${DOCS_BRANCH}' does not match codebase branch '${CODEBASE_BRANCH}'. Run /fp-docs:sync to create/switch the docs branch and generate a diff report. Or continue if you want to work on docs independently."
}
EOF
  exit 0
fi
