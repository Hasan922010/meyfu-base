#!/usr/bin/env bash
set -e

echo "⏳ PostgreSQL kutilmoqda..."
until pg_isready -h "${POSTGRES_HOST:-db}" -p "${POSTGRES_PORT:-5432}" -q; do
  sleep 1
done
echo "✅ PostgreSQL tayyor"

if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  python manage.py migrate --noinput
  python manage.py ensure_superuser || true
  python manage.py collectstatic --noinput || true
fi

exec "$@"
