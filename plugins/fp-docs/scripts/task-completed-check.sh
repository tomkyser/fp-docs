#!/bin/bash
# TaskCompleted: Verify task outputs during orchestration
# Input: JSON on stdin with task completion data
# Exit 0 = pass, Exit 2 = warn

INPUT=$(cat)
TRANSCRIPT=$(echo "$INPUT" | jq -r '.transcript // ""')
TASK_SUBJECT=$(echo "$INPUT" | jq -r '.subject // ""')

WARNINGS=""

# Check that the task produced file modifications (for write tasks)
if echo "$TASK_SUBJECT" | grep -qi "revise\|add\|update\|generate\|annotate\|contracts\|shapes\|deprecate"; then
  if ! echo "$TRANSCRIPT" | grep -qi "files modified\|changes made\|delegation result"; then
    WARNINGS="${WARNINGS}Warning: write task '${TASK_SUBJECT}' completed without reporting file modifications\n"
  fi
fi

# Check for HALLUCINATION markers in results
if echo "$TRANSCRIPT" | grep -qi "HALLUCINATION"; then
  WARNINGS="${WARNINGS}Warning: task '${TASK_SUBJECT}' contains HALLUCINATION markers in results\n"
fi

# Check for missing changelog entries (for tasks that should have them)
if echo "$TASK_SUBJECT" | grep -qi "revise\|add\|update\|deprecate"; then
  if echo "$TRANSCRIPT" | grep -qi "changelog.*missing\|no changelog"; then
    WARNINGS="${WARNINGS}Warning: task '${TASK_SUBJECT}' may be missing changelog entry\n"
  fi
fi

if [ -n "$WARNINGS" ]; then
  echo -e "$WARNINGS" >&2
  exit 2
fi

exit 0
