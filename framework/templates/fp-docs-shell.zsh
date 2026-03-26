# fp-docs drift notification -- installed by /fp-docs:setup
# Shows a one-liner once per terminal session when stale docs are detected.
# Works offline, zero dependencies beyond node.
# Paths baked at install time (D-03):

_fp_docs_drift_check() {
  # D-14: Only run once per terminal session
  [[ -n "${_FP_DOCS_DRIFT_SHOWN}" ]] && return

  # D-13: Only run in wp-content directory tree
  local repo_root
  repo_root="$(git rev-parse --show-toplevel 2>/dev/null)"
  [[ "${repo_root}" != "__CODEBASE_ROOT__" ]] && return

  local staleness="__FP_DOCS_DIR__/staleness.json"
  [[ ! -f "${staleness}" ]] && return

  # Quick check: count signals without heavy parsing
  local count
  count=$(node -e "try{const d=JSON.parse(require('fs').readFileSync('${staleness}','utf-8'));console.log((d.signals||[]).length)}catch{console.log(0)}" 2>/dev/null)
  [[ "${count}" = "0" || -z "${count}" ]] && return

  export _FP_DOCS_DRIFT_SHOWN=1
  printf '\033[33m[fp-docs]\033[0m %s doc%s may need attention. Run Claude Code and use /fp-docs:drift status\n' "${count}" "$([[ "${count}" = "1" ]] && echo '' || echo 's')"
}

autoload -Uz add-zsh-hook
add-zsh-hook precmd _fp_docs_drift_check
