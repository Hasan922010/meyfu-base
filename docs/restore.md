# Ma'lumotni tiklash (Restore) qo'llanmasi

> CLAUDE.md 16: tiklash sinovi kamida bir marta amalda bajarilishi va bu yerda
> hujjatlashtirilishi shart.

## 1. Zaxiralar qayerda saqlanadi

| Nima | Format | Jild | Jadval |
|---|---|---|---|
| PostgreSQL dump | `db_*.sql.gz` | Docker `backups` volume (`/backups`) | Har kuni 02:00 (Asia/Tashkent) |
| Universal JSON dump | `db_*.json.gz` | `backend/backups` yoki `/backups` | Talabga binoan / Celery / CLI |
| Himoya zaxiralari | `safety_*.gz` | `/backups` | Har bir tiklashdan oldin avtomatik |
| Media (naklit/cheklar) | Rasmlar | MinIO `meyfu-media` bucket | Haftalik to'liq + kunlik inkremental |

Saqlanish muddati: 30 kunlik avtomatik rotatsiya (kamida oxirgi 3 ta va barcha himoya nusxalari doimiy saqlanadi).

---

## 2. Tiklash usullari

### Usul A: Web Admin UI orqali (Bosh Admin uchun eng qulay)

1. Tizimga **SUPER_ADMIN** roli bilan kiring.
2. Chap menyudan **Tizim salomatligi** (`/admin/system`) bo'limiga o'ting va **«Zaxira va Tiklash»** tabini tanlang (yoki Sozlamalar sahifasidagi havolani bosing).
3. Jadvaldan kerakli zaxira nusxasini tanlang va uning o'ng tomonidagi **Tiklash (RotateCcw)** tugmasini bosing.
4. Ochilgan oynada:
   - Fayl nomi, hajmi va yaratilgan vaqtini ko'zdan kechiring.
   - Tizim tiklash boshlanishidan oldin avtomatik ravishda hozirgi holatning **pre-restore safety** zaxira nusxasini yaratadi.
   - Tasdiqlash chekboksini belgilang va **«Tiklashni boshlash»** tugmasini bosing.
5. Jarayon yakunlangach, tiklangan fayl, yaratilgan himoya nusxasi va ma'lumotlar butunligi (Integrity Check) natijasi ko'rsatiladi.

---

### Usul B: Django Management Command orqali (Lokal / Server CLI)

```bash
# Eng oxirgi zaxiradan xavfsiz tiklash (himoya nusxasi bilan):
python manage.py restore_db --latest

# Aniq bir fayldan tiklash:
python manage.py restore_db db_20261004_120000.sql.gz

# Tasdiq so'ramasdan (CI / avtomatlashtirish uchun):
python manage.py restore_db --latest --noinput
```

---

### Usul C: Windows PowerShell skripti orqali

```powershell
# Oxirgi zaxiradan tiklash:
.\scripts\restore.ps1 -Latest

# Aniq zaxira faylidan tiklash:
.\scripts\restore.ps1 db_20261004_032643.json.gz
```

---

### Usul D: Docker production muhitida to'liq tiklash

```bash
# 1. Xizmatlarni to'xtatish
docker compose stop web worker beat

# 2. Oxirgi backup faylini aniqlash
docker compose run --rm --entrypoint sh backup -c 'ls -1t /backups/db_*.sql.gz | head'

# 3. Bazani qayta yaratish
docker compose exec db psql -U meyfu -d template1 -c 'DROP DATABASE meyfu WITH (FORCE);'
docker compose exec db psql -U meyfu -d template1 -c 'CREATE DATABASE meyfu;'

# 4. Dumpni yuklash
docker compose run --rm --entrypoint sh backup -c \
  'gunzip -c /backups/db_YYYYMMDD_HHMMSS.sql.gz | psql -d meyfu'

# 5. Migratsiyalarni tekshirish va xizmatlarni yoqish
docker compose start web worker beat
docker compose exec web python manage.py migrate --check
```

---

## 3. Avtomatik tiklash sinovi

Konteyner ichida test bazasiga tiklash sinovi:
```bash
docker compose run --rm --entrypoint sh backup /scripts/restore-test.sh
```

---

## 4. Sinov natijasi jurnali

| Sana | Kim | Backup turi | Backup hajmi | Tiklash vaqti | Natija |
|---|---|---|---|---|---|
| 04.10.2026 | Developer / Antigravity | JSON fixture (`db_20261004_032643.json.gz`) | 62 KB (805 obyekt) | ~11 soniya | ✅ Muvaffaqiyatli, avtomatik himoya nusxasi yaratildi, butunlik tekshiruvi: Mos (OK) |
