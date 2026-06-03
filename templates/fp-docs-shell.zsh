# fp-docs shell integration -- installed by /fp-docs:setup
# Single source for drift notifications + branch sync RPROMPT
# Paths baked at install time by installShellIntegration():

_FP_CODEBASE_ROOT="__CODEBASE_ROOT__"
_FP_DOCS_DIR="__FP_DOCS_DIR__"
_FP_DOCS_ROOT="__DOCS_ROOT__"

# Branch sync status for RPROMPT (merged from fp-docs-prompt.zsh)
fp_docs_status() {
  # Only run when inside the codebase directory
  [[ "$PWD" == "$_FP_CODEBASE_ROOT"* ]] || return

  if [[ ! -d "$_FP_DOCS_ROOT/.git" ]]; then
    echo " %F{red}[docs:missing]%f"
    return
  fi

  local cb=$(git -C "$_FP_CODEBASE_ROOT" branch --show-current 2>/dev/null)
  local db=$(git -C "$_FP_DOCS_ROOT" branch --show-current 2>/dev/null)

  if [[ -z "$cb" || -z "$db" ]]; then
    echo " %F{yellow}[docs:detached]%f"
  elif [[ "$cb" == "$db" ]]; then
    local dirty=$(git -C "$_FP_DOCS_ROOT" status --porcelain 2>/dev/null | head -1)
    if [[ -n "$dirty" ]]; then
      echo " %F{yellow}[docs:$db*]%f"
    else
      echo " %F{green}[docs:$db]%f"
    fi
  else
    echo " %F{red}[docs:$db!=$cb]%f"
  fi
}

# Combined precmd hook (D-01: single hook registration)
_fp_docs_precmd() {
  # --- Drift notification (once per session, Phase 7 D-14) ---
  if [[ -z "${_FP_DOCS_DRIFT_SHOWN}" ]]; then
    # D-13: Only run in codebase directory tree
    local repo_root
    repo_root="$(git rev-parse --show-toplevel 2>/dev/null)"
    if [[ "${repo_root}" == "${_FP_CODEBASE_ROOT}" ]]; then
      local staleness="${_FP_DOCS_DIR}/staleness.json"
      if [[ -f "${staleness}" ]]; then
        local count
        count=$(node -e "try{const d=JSON.parse(require('fs').readFileSync('${staleness}','utf-8'));console.log((d.signals||[]).length)}catch{console.log(0)}" 2>/dev/null)
        if [[ "${count}" != "0" && -n "${count}" ]]; then
          export _FP_DOCS_DRIFT_SHOWN=1
          printf '\033[33m[fp-docs]\033[0m %s doc%s may need attention. Run Claude Code and use /fp-docs:drift status\n' "${count}" "$([[ "${count}" = "1" ]] && echo '' || echo 's')"
        fi
      fi
    fi
  fi

  # --- Branch sync RPROMPT (merged from fp-docs-prompt.zsh) ---
  _FP_DOCS_PROMPT="$(fp_docs_status)"
}

# Single hook registration (idempotent)
autoload -Uz add-zsh-hook
add-zsh-hook precmd _fp_docs_precmd

# Usage: append ${_FP_DOCS_PROMPT} to your PROMPT or RPROMPT
# Example: RPROMPT='${_FP_DOCS_PROMPT}'
