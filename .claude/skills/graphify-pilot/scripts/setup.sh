#!/usr/bin/env bash
# graphify-pilot: one-shot, quiet, idempotent setup of graphify in a project.
# Usage: bash setup.sh [project_dir]
# Prints only a short summary; full log goes to graphify-out/pilot-setup.log
set -uo pipefail

ROOT="${1:-.}"
cd "$ROOT" || { echo "ERR: cannot cd to $ROOT"; exit 1; }
mkdir -p graphify-out
LOG="graphify-out/pilot-setup.log"
: > "$LOG"
say() { echo "[graphify-pilot] $*"; }
run() { "$@" >>"$LOG" 2>&1; }

export PATH="$HOME/.local/bin:$PATH"

# 1) CLI (PyPI package is "graphifyy" with double y; command is "graphify")
if ! command -v graphify >/dev/null 2>&1; then
  if command -v uv >/dev/null 2>&1; then
    run uv tool install graphifyy; run uv tool update-shell
  elif command -v pipx >/dev/null 2>&1; then
    run pipx install graphifyy; run pipx ensurepath
  else
    run python3 -m pip install --user graphifyy || run python -m pip install --user graphifyy
  fi
  hash -r
fi
if ! command -v graphify >/dev/null 2>&1; then
  say "ERR: graphify not found after install. See $LOG (hint: install uv, then re-run)."
  exit 1
fi
say "cli: $(graphify --version 2>/dev/null | head -1)"

# 2) Ignore generated output so Claude Code prompt cache is not invalidated
touch .claudeignore
grep -qxF 'graphify-out/' .claudeignore || echo 'graphify-out/' >> .claudeignore
grep -qxF 'graph.json' .claudeignore || echo 'graph.json' >> .claudeignore
if [ -d .git ]; then
  touch .gitignore
  grep -qxF 'graphify-out/cost.json' .gitignore || echo 'graphify-out/cost.json' >> .gitignore
  grep -qxF 'graphify-out/pilot-setup.log' .gitignore || echo 'graphify-out/pilot-setup.log' >> .gitignore
fi

# 3) Build graph: code only, local tree-sitter AST, zero LLM tokens
if [ -f graphify-out/graph.json ]; then
  run graphify update . && say "graph: updated (AST, 0 tokens)"
else
  run graphify extract . --code-only && say "graph: built (code-only, 0 tokens)"
fi
[ -f graphify-out/graph.json ] || { say "ERR: graph.json missing. See $LOG"; exit 1; }

# 4) Project-scoped upstream skill + always-on query-first hook for Claude Code
[ -f .claude/skills/graphify/SKILL.md ] || run graphify install --project
grep -q graphify CLAUDE.md 2>/dev/null || run graphify claude install
say "claude: project skill + CLAUDE.md hook ready"

# 5) Auto-rebuild on commit / branch switch (AST only, free)
if [ -d .git ]; then
  run graphify hook install && say "git: hooks installed"
fi

SIZE=$(du -h graphify-out/graph.json 2>/dev/null | cut -f1)
say "done. graph.json=$SIZE  log=$LOG"
