#!/bin/bash
# Reusable utility functions for docs repo remote operations
# Sourced by branch-sync-check.sh and docs-commit.sh

# Check if the remote origin is accessible for the docs repo
# Usage: check_remote_accessible <docs_root>
# Returns: 0 if accessible, 1 if not
check_remote_accessible() {
  local docs_root="$1"

  # Check if a remote is configured
  if ! git -C "$docs_root" remote get-url origin >/dev/null 2>&1; then
    format_diagnostic "no_remote" "$docs_root" ""
    return 1
  fi

  # Test remote connectivity with timeout
  local output
  output=$(timeout 10 git -C "$docs_root" ls-remote --exit-code origin HEAD 2>&1)
  local exit_code=$?

  if [ $exit_code -eq 0 ]; then
    return 0
  elif [ $exit_code -eq 124 ]; then
    # timeout killed the process
    format_diagnostic "unreachable" "$docs_root" ""
    return 1
  elif echo "$output" | grep -qi "permission denied\|authentication\|could not read from remote\|publickey"; then
    format_diagnostic "auth_failure" "$docs_root" ""
    return 1
  else
    format_diagnostic "unreachable" "$docs_root" ""
    return 1
  fi
}

# Fetch and pull latest from remote using --ff-only
# Usage: pull_latest <docs_root>
# Returns: 0 on success, 1 on failure
pull_latest() {
  local docs_root="$1"
  local branch
  branch=$(git -C "$docs_root" branch --show-current 2>/dev/null)

  # Check for uncommitted changes that would block pull
  if ! git -C "$docs_root" diff --quiet 2>/dev/null || ! git -C "$docs_root" diff --cached --quiet 2>/dev/null; then
    format_diagnostic "uncommitted" "$docs_root" "$branch"
    return 1
  fi

  # Fetch from remote
  if ! git -C "$docs_root" fetch origin 2>/dev/null; then
    format_diagnostic "unreachable" "$docs_root" "$branch"
    return 1
  fi

  # Check if remote branch exists
  if ! git -C "$docs_root" rev-parse --verify "origin/$branch" >/dev/null 2>&1; then
    # Remote branch doesn't exist yet — nothing to pull
    echo "[docs-pull: no remote branch origin/$branch — skipping pull]"
    return 0
  fi

  # Pull with --ff-only (never create merge commits)
  local pull_output
  pull_output=$(git -C "$docs_root" pull --ff-only 2>&1)
  local pull_exit=$?

  if [ $pull_exit -eq 0 ]; then
    echo "[docs-pull: pulled latest from origin/$branch]"
    return 0
  else
    # --ff-only failed — branches have diverged
    local local_count remote_count
    local_count=$(git -C "$docs_root" rev-list --count "origin/$branch..HEAD" 2>/dev/null || echo "?")
    remote_count=$(git -C "$docs_root" rev-list --count "HEAD..origin/$branch" 2>/dev/null || echo "?")
    export DIVERGE_LOCAL="$local_count"
    export DIVERGE_REMOTE="$remote_count"
    format_diagnostic "diverged" "$docs_root" "$branch"
    return 1
  fi
}

# Format diagnostic messages for remote operation failures
# Usage: format_diagnostic <failure_type> <docs_root> <branch>
format_diagnostic() {
  local failure_type="$1"
  local docs_root="$2"
  local branch="$3"

  case "$failure_type" in
    unreachable)
      cat <<DIAG
[REMOTE UNREACHABLE] Cannot connect to docs remote origin.

Troubleshooting:
  1. Check network connectivity
  2. Check VPN if required
  3. Check GitHub status: https://www.githubstatus.com/
  4. Verify remote URL: git -C "$docs_root" remote get-url origin

To work offline: pass --offline flag to skip all remote operations.
DIAG
      ;;
    auth_failure)
      cat <<DIAG
[AUTH FAILURE] Cannot authenticate with docs remote origin.

Troubleshooting:
  1. Check SSH key: ssh-add -l
  2. Test GitHub SSH access: ssh -T git@github.com
  3. If using HTTPS, verify token is valid
  4. Verify remote URL: git -C "$docs_root" remote get-url origin

To work offline: pass --offline flag to skip all remote operations.
DIAG
      ;;
    diverged)
      cat <<DIAG
[DIVERGED] Local docs branch '$branch' has diverged from remote.
  Local has ${DIVERGE_LOCAL:-?} commit(s) ahead, remote has ${DIVERGE_REMOTE:-?} commit(s) ahead.

Resolution options:
  1. Rebase local onto remote: git -C "$docs_root" pull --rebase
  2. Merge remote into local: git -C "$docs_root" merge origin/$branch
  3. Force local to match remote: git -C "$docs_root" reset --hard origin/$branch (DESTRUCTIVE)

To work offline: pass --offline flag to skip all remote operations.
DIAG
      ;;
    uncommitted)
      cat <<DIAG
[UNCOMMITTED CHANGES] Docs repo has uncommitted changes that block pull.

Resolution:
  1. Stash changes: git -C "$docs_root" stash
  2. Or commit first: git -C "$docs_root" add -A && git -C "$docs_root" commit -m "wip"

To work offline: pass --offline flag to skip all remote operations.
DIAG
      ;;
    no_remote)
      cat <<DIAG
[NO REMOTE] Docs repo has no remote origin configured.

To configure: run /fp-docs:setup to initialize the docs repo with a remote.
DIAG
      ;;
  esac
}
