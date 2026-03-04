#!/bin/bash
# TeammateIdle: Check teammate pipeline completion during orchestration
# Input: JSON on stdin with teammate state
# Exit 0 = pass, Exit 2 = warn

INPUT=$(cat)
TRANSCRIPT=$(echo "$INPUT" | jq -r '.transcript // ""')

WARNINGS=""

# Check for delegation result structure
if echo "$TRANSCRIPT" | grep -qi "mode.*delegated\|delegation"; then
  # Teammate was in delegated mode — check for proper result
  if ! echo "$TRANSCRIPT" | grep -q "## Delegation Result"; then
    WARNINGS="${WARNINGS}Warning: delegated teammate missing Delegation Result structure\n"
  fi

  # Check for enforcement stage markers
  if ! echo "$TRANSCRIPT" | grep -qi "delegation complete:\|enforcement stages"; then
    WARNINGS="${WARNINGS}Warning: delegated teammate missing enforcement stage markers\n"
  fi
fi

if [ -n "$WARNINGS" ]; then
  echo -e "$WARNINGS" >&2
  exit 2
fi

exit 0
