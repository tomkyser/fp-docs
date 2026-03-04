#!/bin/bash
# SessionStart: Detect codebase branch, compare with docs branch, warn on mismatch
# Also: verify remote accessibility, pull latest from remote, and check sync watermark
# Runs AFTER inject-manifest.sh
# Output: JSON with additionalContext (branch info, watermark state) and optional stopMessage

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

# Read watermark state to detect codebase changes since last sync
WATERMARK_INFO="none"
WATERMARK_FILE="${DOCS_ROOT}/.sync-watermark"
if [ -f "$WATERMARK_FILE" ]; then
  WM_COMMIT=$(grep '^codebase_commit=' "$WATERMARK_FILE" 2>/dev/null | cut -d'=' -f2)
  if [ -n "$WM_COMMIT" ]; then
    CODEBASE_HEAD=$(git -C "${CODEBASE_ROOT}" rev-parse HEAD 2>/dev/null)
    if [ "$WM_COMMIT" = "$CODEBASE_HEAD" ]; then
      WATERMARK_INFO="current"
    elif git -C "${CODEBASE_ROOT}" cat-file -t "$WM_COMMIT" >/dev/null 2>&1; then
      WM_COMMITS=$(git -C "${CODEBASE_ROOT}" rev-list --count "${WM_COMMIT}..HEAD" 2>/dev/null || echo "?")
      WATERMARK_INFO="stale (${WM_COMMITS} new codebase commits since last sync)"
    else
      WATERMARK_INFO="invalid (watermark commit not found in codebase history)"
    fi
  else
    WATERMARK_INFO="malformed (missing codebase_commit value)"
  fi
fi

if [ "$CODEBASE_BRANCH" = "$DOCS_BRANCH" ]; then
  # Branches match — check watermark for codebase changes
  if [[ "$WATERMARK_INFO" == stale* ]]; then
    # Branches match but codebase has new changes since last sync
    cat <<EOF
{
  "additionalContext": "Branches aligned (${CODEBASE_BRANCH}). Docs git root: ${DOCS_ROOT}. Remote: ${REMOTE_STATUS}. Watermark: ${WATERMARK_INFO}. Run /fp-docs:sync to detect affected docs."
}
EOF
  else
    cat <<EOF
{
  "additionalContext": "Repos synced. Codebase: ${CODEBASE_BRANCH}, Docs: ${DOCS_BRANCH}. Docs git root: ${DOCS_ROOT}. Remote: ${REMOTE_STATUS}. Watermark: ${WATERMARK_INFO}."
}
EOF
  fi
  exit 0
else
  # Branch mismatch — warn user (watermark info included for context)
  cat <<EOF
{
  "additionalContext": "BRANCH MISMATCH — Codebase: ${CODEBASE_BRANCH}, Docs: ${DOCS_BRANCH}. Run /fp-docs:sync to align. Docs git root: ${DOCS_ROOT}. Remote: ${REMOTE_STATUS}. Watermark: ${WATERMARK_INFO}.",
  "stopMessage": "Docs branch '${DOCS_BRANCH}' does not match codebase branch '${CODEBASE_BRANCH}'. Run /fp-docs:sync to create/switch the docs branch and generate a diff report. Or continue if you want to work on docs independently."
}
EOF
  exit 0
fi
