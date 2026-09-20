#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR/backend"

export DJANGO_SETTINGS_MODULE=config.settings.replit
export DEBUG=False

python manage.py ensure_superuser

exec daphne -b 0.0.0.0 -p "${PORT:?PORT is required}" config.asgi:application
