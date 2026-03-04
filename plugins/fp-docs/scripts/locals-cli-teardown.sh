#!/bin/bash
# Remove the ephemeral wp fp-locals CLI tool from the theme
# Usage: bash locals-cli-teardown.sh
#
# This script:
# 1. Removes the require_once line for class-locals-cli.php from functions.php
# 2. Deletes the copied CLI file from inc/cli/
# 3. Verifies that no traces remain
#
# CRITICAL: This script MUST run after every locals CLI operation, whether the
# operation succeeded or failed. The CLI file and functions.php edit must NOT
# persist. This script is idempotent — safe to run multiple times.

set -uo pipefail
# Note: not using -e because we want to continue cleanup even if individual steps fail

# --- Path resolution ---
CODEBASE_ROOT=$(git -C "${PWD}" rev-parse --show-toplevel 2>/dev/null)
if [ -z "$CODEBASE_ROOT" ]; then
  echo "WARNING: Could not determine codebase root. Attempting fallback paths." >&2
fi

THEME_ROOT="${CODEBASE_ROOT}/themes/foreign-policy-2017"
CLI_TARGET="${THEME_ROOT}/inc/cli/class-locals-cli.php"
FUNCTIONS_FILE="${THEME_ROOT}/functions.php"

CLEANED=false
ERRORS=false

# --- Step 1: Remove require_once from functions.php ---
if [ -f "$FUNCTIONS_FILE" ]; then
  if grep -q "class-locals-cli.php" "$FUNCTIONS_FILE" 2>/dev/null; then
    # Remove the line containing class-locals-cli.php
    sed -i '' '/class-locals-cli\.php/d' "$FUNCTIONS_FILE"
    if grep -q "class-locals-cli.php" "$FUNCTIONS_FILE" 2>/dev/null; then
      echo "ERROR: Failed to remove class-locals-cli.php reference from functions.php" >&2
      ERRORS=true
    else
      echo "[locals-cli-teardown: removed require_once from functions.php]"
      CLEANED=true
    fi
  else
    echo "[locals-cli-teardown: functions.php clean — no reference to remove]"
  fi
else
  echo "WARNING: functions.php not found at ${FUNCTIONS_FILE}" >&2
fi

# --- Step 2: Delete the copied CLI file ---
if [ -f "$CLI_TARGET" ]; then
  rm -f "$CLI_TARGET"
  if [ -f "$CLI_TARGET" ]; then
    echo "ERROR: Failed to delete CLI file at ${CLI_TARGET}" >&2
    ERRORS=true
  else
    echo "[locals-cli-teardown: deleted ${CLI_TARGET}]"
    CLEANED=true
  fi
else
  echo "[locals-cli-teardown: CLI file already absent — nothing to delete]"
fi

# --- Step 3: Clean up empty directory ---
if [ -d "${THEME_ROOT}/inc/cli" ]; then
  # Only remove if empty (don't delete other CLI files that may exist)
  if [ -z "$(ls -A "${THEME_ROOT}/inc/cli" 2>/dev/null)" ]; then
    rmdir "${THEME_ROOT}/inc/cli" 2>/dev/null || true
  fi
fi

# --- Step 4: Verify ---
if [ "$ERRORS" = true ]; then
  echo "[locals-cli-teardown: COMPLETED WITH ERRORS — manual cleanup may be needed]"
  exit 1
fi

if [ "$CLEANED" = true ]; then
  echo "[locals-cli-teardown: cleanup complete]"
else
  echo "[locals-cli-teardown: nothing to clean — environment was already clean]"
fi
