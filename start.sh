#!/usr/bin/env bash
# MeyFu loyihasini (backend + frontend) Linux (Ubuntu) da BITTA fayl bilan ishga tushirish.
#
# Foydalanish:
#   ./start.sh                 # oddiy ishga tushirish
#   FRESH=1 ./start.sh         # demo ma'lumotlarni yangidan yaratib ishga tushirish
#   PORT=8001 ./start.sh       # boshqa backend portida ishga tushirish
set -euo pipefail

export PATH="$HOME/.local/node22/bin:$HOME/.local/bin:$PATH"

PORT="${PORT:-8001}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
ADMIN_PW="${ADMIN_PW:-Hasanali.0220}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
FRONTEND_DIR="$REPO_ROOT/frontend"

if [ -x "$REPO_ROOT/.venv/bin/python" ]; then
  PY="$REPO_ROOT/.venv/bin/python"
elif [ -x "$BACKEND_DIR/.venv/bin/python" ]; then
  PY="$BACKEND_DIR/.venv/bin/python"
else
  echo "Xatolik: .venv topilmadi. Avval 'uv sync --python 3.12' bajaring."
  exit 1
fi

step() { printf '\033[36m==> %s\033[0m\n' "$1"; }

# ==========================================================================
# 1. BACKEND — migratsiya, demo ma'lumot (seed_demo), admin parol
# ==========================================================================
cd "$BACKEND_DIR"
export DJANGO_SETTINGS_MODULE=config.settings.local
export PYTHONUTF8=1

step "Backend: migratsiyalar qo'llanmoqda..."
"$PY" manage.py migrate --noinput

USER_COUNT="$("$PY" manage.py shell -c 'from django.contrib.auth import get_user_model; print(get_user_model().objects.count())' | tail -n1 | tr -d '[:space:]')"
if [ -n "${FRESH:-}" ]; then
  step "Backend: seed_demo --fresh (demo ma'lumotlar yangilanmoqda)..."
  "$PY" manage.py seed_demo --fresh
elif [ "$USER_COUNT" = "0" ]; then
  step "Backend: baza bo'sh — seed_demo ishga tushirilmoqda..."
  "$PY" manage.py seed_demo
else
  echo "    Backend: foydalanuvchilar mavjud ($USER_COUNT ta) — seed o'tkazib yuborildi."
fi

step "Backend: SUPER_ADMIN paroli tekshirilmoqda..."
MEYFU_ADMIN_PW="$ADMIN_PW" "$PY" manage.py shell -c 'import os; from django.contrib.auth import get_user_model, authenticate; p=os.environ["MEYFU_ADMIN_PW"]; U=get_user_model(); u=U.objects.filter(phone="+998900000000").first(); print("YOQ") if not u else (print("OK") if authenticate(username="+998900000000", password=p) else (u.set_password(p), setattr(u,"is_active",True), u.save(), print("TIKLANDI")))' >/dev/null

# ==========================================================================
# 2. Ikkala serverni birga ishga tushirish (Ctrl+C ikkalasini ham yopadi)
# ==========================================================================
echo
echo "  ============================================================"
echo "  🚀 MeyFu tizimi ishga tushmoqda!"
echo "  🌐 Frontend (Web ilova):  http://localhost:$FRONTEND_PORT"
echo "  🔌 Backend API:           http://localhost:$PORT/api/v1/"
echo "  📚 Swagger Docs:          http://localhost:$PORT/api/docs/"
echo "  👤 Bosh Admin kirish:     +998900000000  /  $ADMIN_PW"
echo "  👥 Demo rollar:           +998901000000 (Menejer), +998903000001 (Tarqatuvchi) / demo12345"
echo "  🛑 To'xtatish uchun:      Ctrl+C bosing"
echo "  ============================================================"
echo

BACKEND_PID=""
cleanup() {
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo
    step "Backend server to'xtatilmoqda (PID: $BACKEND_PID)..."
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

step "Eski jarayonlar (agar ochiq qolgan bo'lsa) tozalanmoqda..."
pkill -f "manage.py runserver" 2>/dev/null || true
pkill -f "vite --port $FRONTEND_PORT" 2>/dev/null || true
sleep 1

step "Backend: runserver 0.0.0.0:$PORT (fon rejimida)"
"$PY" manage.py runserver "0.0.0.0:$PORT" &
BACKEND_PID=$!

cd "$FRONTEND_DIR"
export VITE_PROXY_TARGET="http://127.0.0.1:$PORT"
step "Frontend: npm run dev (port $FRONTEND_PORT -> backend $VITE_PROXY_TARGET)"
npm run dev -- --port "$FRONTEND_PORT" --strictPort

