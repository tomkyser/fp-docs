#!/bin/bash
# SessionStart: Inject plugin root path and manifest into session context
# Input: JSON on stdin with session metadata
# Output: JSON with additionalContext field

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
MANIFEST_CONTENT=$(cat "${PLUGIN_ROOT}/framework/manifest.md" 2>/dev/null || echo "Manifest not found")

cat <<EOF
{
  "additionalContext": "fp-docs plugin root: ${PLUGIN_ROOT}\n\n${MANIFEST_CONTENT}"
}
EOF
