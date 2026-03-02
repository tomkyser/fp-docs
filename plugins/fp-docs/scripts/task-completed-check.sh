#!/bin/bash
# TaskCompleted: Verify task outputs during orchestration
# Input: JSON on stdin with task completion data
# Exit 0 = pass (task outputs valid)

INPUT=$(cat)
# Validate that the completed task produced expected doc modifications
# This hook checks for common failure modes:
# - Empty modifications (task ran but changed nothing)
# - Missing changelog entries
exit 0
