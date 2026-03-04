#!/bin/bash
# Safety-net check: ensure locals CLI artifacts are cleaned up after engine stops
# Fires as SubagentStop hook for the locals engine
#
# If the locals engine stopped without running teardown (error, timeout, etc.),
# this hook auto-cleans orphaned artifacts and reports the recovery.

CODEBASE_ROOT=$(git -C "${PWD}" rev-parse --show-toplevel 2>/dev/null)
THEME_ROOT="${CODEBASE_ROOT}/themes/foreign-policy-2017"
CLI_TARGET="${THEME_ROOT}/inc/cli/class-locals-cli.php"
FUNCTIONS_FILE="${THEME_ROOT}/functions.php"

ORPHANED=false
CLEANUP_LOG=""

# Check for orphaned CLI file
if [ -f "$CLI_TARGET" ] 2>/dev/null; then
  ORPHANED=true
  rm -f "$CLI_TARGET"
  CLEANUP_LOG="${CLEANUP_LOG} Removed orphaned CLI file."
fi

# Check for orphaned functions.php registration
if [ -f "$FUNCTIONS_FILE" ] && grep -q "class-locals-cli.php" "$FUNCTIONS_FILE" 2>/dev/null; then
  ORPHANED=true
  sed -i '' '/class-locals-cli\.php/d' "$FUNCTIONS_FILE"
  CLEANUP_LOG="${CLEANUP_LOG} Removed orphaned require_once from functions.php."
fi

if [ "$ORPHANED" = true ]; then
  echo "{\"additionalContext\": \"SubagentStop safety check for locals engine: WARNING — Locals CLI teardown was not completed by the engine. Auto-cleaned:${CLEANUP_LOG} The CLI tool is ephemeral and must never persist in the theme.\"}"
else
  echo "{\"additionalContext\": \"SubagentStop check for locals engine: Locals CLI teardown verified — no orphaned artifacts. Engine completed cleanly.\"}"
fi
