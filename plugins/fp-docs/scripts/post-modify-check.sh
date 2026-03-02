#!/bin/bash
# SubagentStop: Validate docs-modify pipeline completion
# Input: JSON on stdin with agent transcript summary
# Exit 0 = pass, Exit 2 = warn

INPUT=$(cat)
TRANSCRIPT=$(echo "$INPUT" | jq -r '.transcript // ""')

# Check for changelog update marker
if echo "$TRANSCRIPT" | grep -qi "changelog.*updated\|updated.*changelog"; then
  exit 0
else
  echo "Warning: docs-modify completed without changelog update confirmation" >&2
  exit 2
fi
