#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "================================================================"
echo "🧠 MEYFU-BASE: LOYIHA XOTIRASI VA SEANS HOLATI (SESSION MEMORY)"
echo "================================================================"
echo ""
echo "📌 Git Branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
echo "📌 Oxirgi 5 ta Commit:"
git log -n 5 --oneline 2>/dev/null || true
echo ""
echo "📌 Ishchi Katalog Holati (O'zgargan fayllar):"
git status --short 2>/dev/null | head -n 20 || true
echo ""
echo "----------------------------------------------------------------"
echo "📂 Uzoq muddatli Xotira Indeksi (.agents/memory/MEMORY.md):"
echo "----------------------------------------------------------------"
if [[ -f ".agents/memory/MEMORY.md" ]]; then
  cat ".agents/memory/MEMORY.md"
fi
echo ""
echo "----------------------------------------------------------------"
echo "🚀 Seans Holati va Davomiylik (.agents/memory/SESSION_STATE.md):"
echo "----------------------------------------------------------------"
if [[ -f ".agents/memory/SESSION_STATE.md" ]]; then
  cat ".agents/memory/SESSION_STATE.md"
fi
