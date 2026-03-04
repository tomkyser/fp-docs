#!/bin/bash
# SubagentStop: Validate orchestrate pipeline completion
# Input: JSON on stdin with agent transcript summary
# Exit 0 = pass, Exit 2 = warn

INPUT=$(cat)
TRANSCRIPT=$(echo "$INPUT" | jq -r '.transcript // ""')

WARNINGS=""

# Check for pipeline completion marker
if ! echo "$TRANSCRIPT" | grep -q "Pipeline complete:"; then
  WARNINGS="${WARNINGS}Warning: orchestrate completed without pipeline completion marker\n"
fi

# Check for changelog update (write operations only)
if echo "$TRANSCRIPT" | grep -qi "write phase\|delegation result\|files modified"; then
  if ! echo "$TRANSCRIPT" | grep -qi "changelog.*updated\|updated.*changelog"; then
    WARNINGS="${WARNINGS}Warning: write operation completed without changelog update\n"
  fi
fi

# Check that subagents were used (multi-agent is the default)
if ! echo "$TRANSCRIPT" | grep -qi "agents\? used\|delegation result\|pipeline validation"; then
  WARNINGS="${WARNINGS}Warning: orchestrate may not have delegated to specialist engines\n"
fi

if [ -n "$WARNINGS" ]; then
  echo -e "$WARNINGS" >&2
  exit 2
fi

exit 0
