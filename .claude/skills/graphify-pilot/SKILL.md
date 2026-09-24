---
name: graphify-pilot
description: Autopilot for coding in a project with graphify (Graphify-Labs/graphify knowledge graph). Installs and maintains graphify by itself, then answers and edits code by querying the graph instead of reading whole files, to save tokens. Use this skill for ANY coding task in a repository — "fix", "add", "refactor", "explain", "find", "qayerda", "tuzat", "qo'sh", "o'zgartir", "tushuntir" — even if the user never mentions graphify. The user only says WHAT to do; Claude handles setup, graph queries and updates on its own.
---

# graphify-pilot

The user gives short commands ("login sahifasiga parol tiklash qo'sh", "fix the checkout bug").
Your job: do the task end-to-end with the fewest tokens possible, using graphify as the map.
Never ask the user to run setup commands — do it yourself. Reply in the user's language.

## 0. Preflight (every session, once — cheap)

```bash
command -v graphify >/dev/null && [ -f graphify-out/graph.json ] && echo OK || echo SETUP
```

- `SETUP` → run the bundled script (quiet, idempotent, 0 LLM tokens):
  `bash <this-skill-dir>/scripts/setup.sh .`
  It installs the `graphifyy` CLI (uv → pipx → pip), builds a code-only graph,
  adds `graphify-out/` to `.claudeignore`, installs the project skill, the CLAUDE.md
  hook and git hooks. Read only its summary lines. On error, read the last 20 lines of
  `graphify-out/pilot-setup.log`, fix, re-run once.
- Windows PowerShell without bash: run the same steps manually —
  `uv tool install graphifyy`, `graphify extract . --code-only`, `graphify install --project`,
  `graphify claude install`, `graphify hook install`. Use `graphify`, never `/graphify` in PowerShell.
- `OK` → continue. Do not re-run setup.

## 1. Token rules (the whole point)

1. **Graph first, files second.** Before any Read/Grep/Glob of source, ask the graph:
   - `graphify query "<question>" --budget 800` — scoped subgraph for a question
   - `graphify explain "<Symbol>"` — one node: file, line, connections
   - `graphify path "A" "B"` — how two things connect
   Pipe long output: `... | head -60`. Raise `--budget` only if the answer is clearly cut off.
2. **Read narrowly.** The graph gives `file Lnnn`. Read only that range (±30 lines),
   not the whole file. Open a whole file only if it is small (<150 lines) or you must edit most of it.
3. **Never load big artifacts:** do not open `graph.json`, `graph.html`, `graphify-out/cache/`.
   Do not read `GRAPH_REPORT.md` in full; if an architecture overview is really needed,
   `grep -A15 "God nodes" graphify-out/GRAPH_REPORT.md` or similar.
4. **Max 3 graph calls per sub-question.** If the graph still has no answer, fall back to a
   targeted `grep -n` — not to reading directories.
5. **Semantic (LLM) passes cost tokens.** Default is code-only. Run `/graphify . --update`
   on docs/PDFs only when the user asks about docs or explicitly allows it.
6. **Quiet commands.** Redirect noisy installs/builds to a log; show the user only results.

## 2. Task loop

1. Restate the task to yourself in one line. No clarifying questions unless the task is
   genuinely ambiguous or destructive.
2. Locate: `graphify query` / `explain` → list of files + lines.
3. Impact check before editing a shared symbol: `graphify explain "<Symbol>"` and look at
   incoming edges (`<--`) — these are the callers you might break.
4. Read narrow ranges → edit.
5. Verify: run the project's existing tests/linter if present (only the relevant subset when possible).
6. Refresh the map: `graphify update . >/dev/null 2>&1` (AST only, free).
   Git hooks also rebuild on commit; after `git pull` always run `graphify update .`.
7. Report in ≤5 lines: what changed (files), how verified, anything the user must decide.

## 3. When the graph looks wrong

| Symptom | Fix |
|---|---|
| Symbol you just added is missing | `graphify update .` then re-query |
| Deleted files still show up | `graphify update . --force` |
| `graphify: command not found` | `export PATH="$HOME/.local/bin:$PATH"` or `uv tool update-shell` |
| Skill/package version warning | `uv tool upgrade graphifyy && graphify install --project` |
| Huge repo, slow build | add `.graphifyignore` (gitignore syntax: `node_modules/`, `dist/`, build dirs) then `graphify update .` |
| Graph useless for this question | skip it, use targeted `grep -n`, don't loop |

## 4. Don'ts

- Don't explain graphify to the user unless asked; just use it.
- Don't paste graph output to the user — summarize.
- Don't run `graphify uninstall --purge` or delete `graphify-out/` without the user's OK.
