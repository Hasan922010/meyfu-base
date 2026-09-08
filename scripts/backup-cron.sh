#!/bin/sh
# Backup konteyneri uchun oddiy scheduler (tashqi cron shart emas).
# Har kuni 02:00 (Asia/Tashkent ≈ UTC+5 → 21:00 UTC) da backup.sh chaqiradi.
set -eu

echo "backup-cron ishga tushdi. Kunlik 02:00 (Asia/Tashkent) rejasi."

# Konteyner ko'tarilganda darhol bittasini olamiz (1-kundan backup — CLAUDE.md 16).
sh /scripts/backup.sh || echo "boshlang'ich backup muvaffaqiyatsiz" >&2

while true; do
  NOW_UTC_HOUR="$(date -u +%H)"
  NOW_UTC_MIN="$(date -u +%M)"
  # 21:00 UTC = 02:00 Asia/Tashkent
  if [ "$NOW_UTC_HOUR" = "21" ] && [ "$NOW_UTC_MIN" = "00" ]; then
    sh /scripts/backup.sh || echo "kunlik backup muvaffaqiyatsiz" >&2
    sleep 60
  fi
  sleep 30
done
