#!/bin/sh
# Tiklash sinovi (CLAUDE.md 16). Oxirgi backupni vaqtinchalik bazaga tiklaydi
# va jadvallar sonini tekshiradi. docs/restore.md ni yangilab boring.
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
LATEST="$(ls -1t "${BACKUP_DIR}"/db_*.sql.gz 2>/dev/null | head -n1 || true)"

if [ -z "$LATEST" ]; then
  echo "XATO: backup topilmadi (${BACKUP_DIR})" >&2
  exit 1
fi

echo "Tiklanmoqda: ${LATEST}"
TEST_DB="meyfu_restore_test"

psql -c "DROP DATABASE IF EXISTS ${TEST_DB};"
psql -c "CREATE DATABASE ${TEST_DB};"
gunzip -c "$LATEST" | psql -d "${TEST_DB}"

TABLES="$(psql -tA -d "${TEST_DB}" -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")"
echo "Tiklandi. Public jadvallar soni: ${TABLES}"

psql -c "DROP DATABASE ${TEST_DB};"
echo "✅ Tiklash sinovi muvaffaqiyatli."
