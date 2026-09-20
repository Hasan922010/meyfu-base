#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR/backend"

export DJANGO_SETTINGS_MODULE=config.settings.replit
export DEBUG=False
export STATIC_ROOT="$ROOT_DIR/backend/staticfiles"

python manage.py check --deploy --fail-level ERROR
rm -rf "$STATIC_ROOT"
python manage.py collectstatic --noinput
