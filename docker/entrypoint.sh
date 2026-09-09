#!/usr/bin/env bash
set -e

echo "⏳ PostgreSQL kutilmoqda..."
until pg_isready -h "${POSTGRES_HOST:-db}" -p "${POSTGRES_PORT:-5432}" -q; do
  sleep 1
done
echo "✅ PostgreSQL tayyor"

# Ishlab chiqarish tekshiruvi — noto'g'ri sozlanган muhitni erta ushlaydi
# (audit CFG-001). ERROR darajasidagi muammo bo'lsa konteyner ishga tushmaydi.
# O'tkazib yuborish: DEPLOY_CHECK=0
if [ "${DEPLOY_CHECK:-1}" = "1" ]; then
  echo "🔍 manage.py check --deploy"
  python manage.py check --deploy --fail-level ERROR
fi

if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  python manage.py migrate --noinput
  python manage.py ensure_superuser || true
  python manage.py collectstatic --noinput || true
fi

exec "$@"
