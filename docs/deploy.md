# Deployment qo'llanmasi

## Talablar
- Docker + Docker Compose v2
- Domen + HTTPS (Nginx oldida Caddy yoki Traefik / Let's Encrypt)
- Kamida 2 vCPU / 4 GB RAM / 40 GB SSD (backup diski alohida bo'lgani ma'qul)

## Konfiguratsiya profillari (audit CFG-001)

`docker-compose.yml` — **ishlab chiqarish bazasi** (`config.settings.prod`, Sentry SDK,
manba bind-mount yo'q, `db`/`redis`/`minio` portlari xostga ochilmagan). Majburiy
o'zgaruvchilar (`SECRET_KEY`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`,
`CSRF_TRUSTED_ORIGINS`) repo ildizidagi `.env` da berilishi kerak.

`docker-compose.dev.yml` — **lokal ishlab chiqish override'i** (`config.settings.dev`,
`DEBUG=True`, bind-mount, ochiq portlar, standart maxfiy qiymatlar). Ishlab chiqarishда
**hech qachon** qo'llamang.

## Lokal ishlab chiqish (Docker)

```bash
cp frontend/.env.example frontend/.env
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f web
```

Qulaylik uchun: `export COMPOSE_FILE=docker-compose.yml:docker-compose.dev.yml`
(keyin oddiy `docker compose up`).

- API: http://localhost:8000/api/v1/ · Swagger: http://localhost:8000/api/docs/
- Admin: http://localhost:8000/admin/  (telefon: `+998900000000`, parol: `Hasanali.0220`)
- MinIO konsoli: http://localhost:9001
- Frontend (alohida): `cd frontend && npm install && npm run dev` → http://localhost:5173

> Docker'siz lokal backend uchun: `scripts/dev-backend.sh` /
> `scripts/dev-backend.ps1` (`config.settings.local`, sqlite).

## Ishlab chiqarish (production)

```bash
cp .env.example .env          # repo ildizida — compose shu faylni o'qiydi
# .env ni haqiqiy qiymatlar bilan to'ldiring (pastdagi ro'yxat)
docker compose up -d --build
docker compose logs -f web
```

Repo ildizidagi `.env` da majburiy:

| O'zgaruvchi | Namuna |
|---|---|
| `SECRET_KEY` | `python -c "import secrets;print(secrets.token_urlsafe(64))"` |
| `ALLOWED_HOSTS` | `api.example.com` |
| `CORS_ALLOWED_ORIGINS` | `https://app.example.com` |
| `CSRF_TRUSTED_ORIGINS` | `https://app.example.com` |
| `POSTGRES_PASSWORD` | kuchli parol (yoki tashqi DB uchun `DATABASE_URL`) |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | S3/MinIO kaliti |

Ixtiyoriy: `SENTRY_DSN`, `ADMIN_EMAILS` (500 xatolar pochtasi),
`TELEGRAM_BOT_TOKEN` + `TELEGRAM_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`.

Birinchi superuser (keyin `.env` dan olib tashlang):
`DJANGO_SUPERUSER_PHONE`, `DJANGO_SUPERUSER_PASSWORD`. Bo'sh bo'lsa `ensure_superuser`
hech narsa qilmaydi.

**Prod farqlari:** `DEBUG=False`, HSTS 1 yil + `SECURE_SSL_REDIRECT` + secure cookie
(`prod.py`), Browsable API o'chirilgan, `REQUIREMENTS=prod` (Sentry SDK). Entrypoint
har ishga tushishda `manage.py check --deploy --fail-level ERROR` bajaradi
(o'tkazib yuborish: `DEPLOY_CHECK=0`).

### Nomer 1-kun tekshiruvi
```bash
docker compose exec web python manage.py check --deploy   # 0 warning bo'lishi kerak
docker compose exec web python manage.py seed_base         # birlik/kategoriya karkasi
```
(migratsiya va superuser entrypoint tomonidan avtomatik bajariladi.)

## Xavfsizlik
Batafsil: [`security.md`](./security.md). Qisqacha:
- JWT: access 15 min + refresh rotatsiya; `.env` git'da yo'q
- Rate limiting: `anon 30/min`, `user 1000/min`, `login 10/min`, `ocr 20/min`
- Media fayllar rolli kirish orqali (`X-Accel-Redirect` yoki S3 imzoli URL)
- CORS/CSRF — faqat aniq domenlar

## Telegram bot (ixtiyoriy — CLAUDE.md 15)
1. @BotFather orqali bot yarating → tokenni `TELEGRAM_BOT_TOKEN` ga yozing
2. `TELEGRAM_BOT_USERNAME` va kuchli `TELEGRAM_WEBHOOK_SECRET` ni sozlang
3. Webhook o'rnating (HTTPS majburiy):
   ```bash
   docker compose exec web python manage.py set_telegram_webhook https://api.example.com
   ```
4. Foydalanuvchilar ilovadagi Sozlamalar → "Telegram'ni ulash" orqali bog'lanadi

Token bo'sh bo'lsa bot butunlay o'chirilgan (barcha yuborishlar no-op).

## Naklit OCR (ixtiyoriy — CLAUDE.md 9)
- `ANTHROPIC_API_KEY` — bo'sh bo'lsa **mock provider** ishlatiladi (dev/test)
- `OCR_MODEL` (default `claude-opus-5`) — `claude-sonnet-5` arzonroq
- `OCR_DAILY_COST_LIMIT_USD` / `OCR_MONTHLY_COST_LIMIT_USD` — oshsa skan `FAILED` + admin xabari
- `opencv-python-headless` bo'lmasa — rasm tayyorlash o'tkazib yuboriladi (graceful)
- Metrikalar: admin panel → Naklit skani → Metrikalar (`line_accuracy < 85%` → "qo'lda afzal")
- **Pilot uchun:** 20 ta real naklitni skanerlang, `line_accuracy` ni o'lchang

## Monitoring (CLAUDE.md 15, 16)
- `GET /api/v1/health/` — db, redis, disk (200 / 503); `?deep=1` celery ishchini ham
- **Admin → Tizim salomatligi** (`/admin/system`) — xizmatlar, butunlik, backup, sync, OCR
- Butunlik: har kecha 02:30 `check_integrity` task (balans == jurnal); farq → admin xabari.
  Qo'lda: `docker compose exec web python manage.py check_integrity [--fix-dry-run|--fix]`
- Backup jurnali: `docker compose logs backup` · tiklash: [`restore.md`](./restore.md)
- Celery navbat: `redis-cli LLEN celery` yoki tizim salomatligi sahifasida
- Telegram jurnali: Django admin → "Telegram xabarlar"
- Sentry: xatoliklar dashboardi (DSN berilgan bo'lsa)

## Demo / prezentatsiya ma'lumoti
```bash
docker compose exec web python manage.py seed_demo   # 4 rol, katalog, 5 kunlik sotuv tarixi
# parollar: demo12345
```
`--fresh` bilan demo foydalanuvchilarni qayta yaratadi. Prod bazada ishlatmang.
