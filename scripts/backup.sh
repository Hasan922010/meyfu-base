#!/bin/sh
# PostgreSQL dump — har kuni 02:00 (CLAUDE.md 16).
# gzip + rotatsiya. Ishlamasa exit != 0 → cron/monitoring xabar beradi.
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="${BACKUP_DIR}/db_${STAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date -Iseconds)] backup boshlandi → ${OUT}"
pg_dump --no-owner --no-privileges | gzip > "$OUT"

# Butunlik tekshiruvi
gzip -t "$OUT"
SIZE="$(wc -c < "$OUT")"
if [ "$SIZE" -lt 1000 ]; then
  echo "XATO: backup fayli juda kichik (${SIZE} bayt)" >&2
  exit 1
fi

# Rotatsiya
find "$BACKUP_DIR" -name 'db_*.sql.gz' -mtime "+${RETENTION_DAYS}" -delete

echo "[$(date -Iseconds)] backup tayyor (${SIZE} bayt)"

# TODO(2-faza): OUT faylni S3-mos xotiraga (minio/backups bucket) yuborish.
