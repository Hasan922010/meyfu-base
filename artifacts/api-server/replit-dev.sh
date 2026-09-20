#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR/backend"

export DJANGO_SETTINGS_MODULE=config.settings.replit
export DEBUG=True
export STATIC_ROOT="${TMPDIR:-/tmp}/meyfu-staticfiles-dev"

python manage.py migrate --noinput
rm -rf "$STATIC_ROOT"
python manage.py collectstatic --noinput
python manage.py seed_base
python manage.py ensure_superuser

exec daphne -b 0.0.0.0 -p "${PORT:?PORT is required}" config.asgi:application
