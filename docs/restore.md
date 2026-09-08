# Ma'lumotni tiklash (Restore) qo'llanmasi

> CLAUDE.md 16: tiklash sinovi kamida bir marta amalda bajarilishi va bu yerda
> hujjatlashtirilishi shart.

## Backup qayerda

| Nima | Jild | Jadval |
|---|---|---|
| PostgreSQL dump (`db_*.sql.gz`) | `backups` volume → `/backups` | har kuni 02:00 (Asia/Tashkent) |
| Media (naklit/chek rasmlari) | MinIO `meyfu-media` bucket | 2-fazada haftalik to'liq + kunlik inkremental |

Saqlanish: 30 kun (7 kunlik kunlik + 4 haftalik).

## To'liq tiklash tartibi

```bash
# 1. Xizmatlarni to'xtatish
docker compose stop web worker beat

# 2. Oxirgi backup faylini aniqlash
#    (backup konteyneri entrypoint'i cron skript — shuning uchun --entrypoint sh)
docker compose run --rm --entrypoint sh backup -c 'ls -1t /backups/db_*.sql.gz | head'

# 3. Bazani qayta yaratish (postgres'ga template1 orqali ulanamiz)
docker compose exec db psql -U meyfu -d template1 -c 'DROP DATABASE meyfu WITH (FORCE);'
docker compose exec db psql -U meyfu -d template1 -c 'CREATE DATABASE meyfu;'

# 4. Dumpni yuklash
docker compose run --rm --entrypoint sh backup -c \
  'gunzip -c /backups/db_YYYYMMDD_HHMMSS.sql.gz | psql -d meyfu'

# 5. Migratsiyalarni tekshirish va xizmatlarni yoqish
docker compose start web worker beat
docker compose exec web python manage.py migrate --check
```

## Avtomatik tiklash sinovi

```bash
docker compose run --rm --entrypoint sh backup /scripts/restore-test.sh
```

## Sinov natijasi jurnali

| Sana | Kim | Backup hajmi | Tiklash vaqti | Natija |
|---|---|---|---|---|
| _(hali bajarilmagan — pilotdan oldin to'ldiring)_ | | | | |
