#!/usr/bin/env bash
# MeyFu backend — lokal dev (Docker'siz, sqlite). macOS / Linux.
# Windows uchun: scripts/dev-backend.ps1
#
# Foydalanish:
#   scripts/dev-backend.sh                 # oddiy ishga tushirish
#   PORT=8001 scripts/dev-backend.sh       # boshqa port
#   FRESH=1 scripts/dev-backend.sh         # seed_demo --fresh
#   SKIP_INSTALL=1 scripts/dev-backend.sh  # pip install'siz (tezroq)
set -euo pipefail

PORT="${PORT:-8000}"
ADMIN_PW="${ADMIN_PW:-Hasanali.0220}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
cd "$BACKEND_DIR"

export DJANGO_SETTINGS_MODULE=config.settings.local
export PYTHONUTF8=1

PY=".venv/bin/python"

step() { printf '\033[36m==> %s\033[0m\n' "$1"; }

# 1. venv
if [ ! -x "$PY" ]; then
  step "Virtual muhit (.venv) yaratilmoqda..."
  python3 -m venv .venv
  SKIP_INSTALL=""
fi

if [ -z "${SKIP_INSTALL:-}" ]; then
  step "Bog'liqliklar o'rnatilmoqda (requirements/dev.txt)..."
  "$PY" -m pip install --upgrade pip --quiet
  "$PY" -m pip install -r requirements/dev.txt --quiet
fi

# 2. migratsiya
step "Migratsiyalar qo'llanmoqda..."
"$PY" manage.py migrate --noinput

# 3. seed
USER_COUNT="$("$PY" manage.py shell -c 'from django.contrib.auth import get_user_model; print(get_user_model().objects.count())' | tail -n1 | tr -d '[:space:]')"
if [ -n "${FRESH:-}" ]; then
  step "seed_demo --fresh..."
  "$PY" manage.py seed_demo --fresh
elif [ "$USER_COUNT" = "0" ]; then
  step "Baza bo'sh — seed_demo..."
  "$PY" manage.py seed_demo
else
  echo "    Foydalanuvchilar mavjud ($USER_COUNT ta) — seed o'tkazib yuborildi."
fi

# 4. admin parol
step "SUPER_ADMIN paroli tekshirilmoqda ($ADMIN_PW)..."
MEYFU_ADMIN_PW="$ADMIN_PW" "$PY" manage.py shell -c 'import os; from django.contrib.auth import get_user_model, authenticate; p=os.environ["MEYFU_ADMIN_PW"]; U=get_user_model(); u=U.objects.filter(phone="+998900000000").first(); print("YOQ") if not u else (print("OK") if authenticate(username="+998900000000", password=p) else (u.set_password(p), setattr(u,"is_active",True), u.save(), print("TIKLANDI")))'

# 5. server
echo
echo "  Kirish:  http://localhost:5173  (frontend)"
echo "  API:     http://localhost:$PORT/api/v1/"
echo "  Admin:   +998900000000  /  $ADMIN_PW"
echo "  Boshqa rollar (seed_demo): +99890100/200/300 0000  /  demo12345"
echo "  To'xtatish: Ctrl+C"
echo
step "runserver 0.0.0.0:$PORT"
exec "$PY" manage.py runserver "0.0.0.0:$PORT"
