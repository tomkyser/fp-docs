#!/bin/bash
# Install the ephemeral wp fp-locals CLI tool into the theme
# Usage: bash locals-cli-setup.sh
#
# This script:
# 1. Copies class-locals-cli.php from the plugin into the theme's inc/cli/
# 2. Registers the CLI command in functions.php inside the WP_CLI block
# 3. Verifies the command is available via ddev wp fp-locals --help
#
# The CLI tool is ephemeral — it MUST be removed after the locals operation
# completes by running locals-cli-teardown.sh. The SubagentStop hook for the
# locals engine enforces this as a safety net.

set -euo pipefail

# --- Path resolution ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CLI_SOURCE="${PLUGIN_ROOT}/framework/tools/class-locals-cli.php"

CODEBASE_ROOT=$(git -C "${PWD}" rev-parse --show-toplevel 2>/dev/null)
if [ -z "$CODEBASE_ROOT" ]; then
  echo "ERROR: Could not determine codebase root (not in a git repository)." >&2
  exit 1
fi

THEME_ROOT="${CODEBASE_ROOT}/themes/foreign-policy-2017"
CLI_TARGET="${THEME_ROOT}/inc/cli/class-locals-cli.php"
FUNCTIONS_FILE="${THEME_ROOT}/functions.php"

# The require_once line we inject
REQUIRE_LINE="	require_once( FP_PATH . '/inc/cli/class-locals-cli.php' );"

# --- Pre-flight checks ---
if [ ! -f "$CLI_SOURCE" ]; then
  echo "ERROR: CLI source not found at: ${CLI_SOURCE}" >&2
  exit 1
fi

if [ ! -d "$THEME_ROOT" ]; then
  echo "ERROR: Theme root not found at: ${THEME_ROOT}" >&2
  exit 1
fi

if [ ! -f "$FUNCTIONS_FILE" ]; then
  echo "ERROR: functions.php not found at: ${FUNCTIONS_FILE}" >&2
  exit 1
fi

# Check if ddev is running
if ! ddev status >/dev/null 2>&1; then
  echo "ERROR: ddev is not running. Start it with 'ddev start' before running locals CLI operations." >&2
  exit 1
fi

# --- Idempotency: skip if already installed ---
if [ -f "$CLI_TARGET" ] && grep -q "class-locals-cli.php" "$FUNCTIONS_FILE" 2>/dev/null; then
  echo "[locals-cli-setup: already installed — skipping]"
  # Verify it works
  if ddev wp fp-locals --help >/dev/null 2>&1; then
    echo "[locals-cli-setup: verified — wp fp-locals is available]"
    exit 0
  else
    echo "WARNING: CLI file exists and is registered but command not recognized. Re-installing." >&2
    # Fall through to reinstall
  fi
fi

# --- Step 1: Copy CLI file into theme ---
mkdir -p "${THEME_ROOT}/inc/cli"
cp "$CLI_SOURCE" "$CLI_TARGET"
echo "[locals-cli-setup: copied CLI file to ${CLI_TARGET}]"

# --- Step 2: Register in functions.php ---
# Only add if not already present
if ! grep -q "class-locals-cli.php" "$FUNCTIONS_FILE" 2>/dev/null; then
  # Find the WP_CLI block and insert after the last require_once in that block.
  # The pattern: if ( defined( 'WP_CLI' ) && WP_CLI ) { ... require_once ... }
  # We insert our line after the last existing require_once inside that block.
  #
  # Strategy: Find the line number of the last require_once that appears after
  # the WP_CLI defined check. Insert our line after it.

  # Find the WP_CLI block start line
  WP_CLI_LINE=$(grep -n "defined.*WP_CLI.*&&.*WP_CLI" "$FUNCTIONS_FILE" | tail -1 | cut -d: -f1)

  if [ -z "$WP_CLI_LINE" ]; then
    echo "ERROR: Could not find 'if ( defined( WP_CLI ) && WP_CLI )' block in functions.php" >&2
    # Clean up the copied file since we can't register it
    rm -f "$CLI_TARGET"
    exit 1
  fi

  # Find the last require_once after the WP_CLI line (within a reasonable range, say 50 lines)
  LAST_REQUIRE_LINE=$(tail -n +${WP_CLI_LINE} "$FUNCTIONS_FILE" | head -50 | grep -n "require_once" | tail -1 | cut -d: -f1)

  if [ -z "$LAST_REQUIRE_LINE" ]; then
    echo "ERROR: Could not find any require_once inside the WP_CLI block in functions.php" >&2
    rm -f "$CLI_TARGET"
    exit 1
  fi

  # Calculate absolute line number
  INSERT_AFTER=$((WP_CLI_LINE + LAST_REQUIRE_LINE - 1))

  # Insert our require_once line after the last existing one
  # Using sed to insert after the target line
  sed -i '' "${INSERT_AFTER}a\\
${REQUIRE_LINE}
" "$FUNCTIONS_FILE"

  echo "[locals-cli-setup: registered in functions.php at line $((INSERT_AFTER + 1))]"
else
  echo "[locals-cli-setup: already registered in functions.php — skipping]"
fi

# --- Step 3: Verify ---
if ddev wp fp-locals --help >/dev/null 2>&1; then
  echo "[locals-cli-setup: verified — wp fp-locals is available]"
  echo "CLI_AVAILABLE=true"
else
  echo "ERROR: wp fp-locals command not recognized after setup. Check functions.php registration." >&2
  echo "Attempting teardown to clean up..." >&2
  bash "${SCRIPT_DIR}/locals-cli-teardown.sh" 2>/dev/null || true
  echo "CLI_AVAILABLE=false"
  exit 1
fi
