# Distribution & Sales Management System (MeyFu)

Maishiy kimyo mahsulotlarini optom olib, tarqatuvchi agentlar orqali do'kon va
bozorlarga yetkazish jarayonini boshqaruvchi tizim.

To'liq spetsifikatsiya: **[`CLAUDE.md`](./CLAUDE.md)**.

## Holat: ✅ MVP + 2-FAZA + 3-FAZA (1–16) TUGADI

| Bosqich | Holat |
|---|---|
| 1–6 — MVP | ✅ Tayyor |
| 7 — Xarajat va hamyon | ✅ Tayyor |
| 8 — Real-time (Channels, eventlar, bildirishnomalar) | ✅ Tayyor |
| 9 — Qarzdorlik va moliya (aging, kassa, P&L) | ✅ Tayyor |
| 10 — Telegram bot | ✅ Tayyor |
| 11 — Naklit OCR (Claude vision, fuzzy matching, alias o'rganish, metrikalar) | ✅ Tayyor |
| 12 — Maosh (CommissionRule, Payroll, Advance, mobil "Mening maoshim") | ✅ Tayyor |
| 13 — 360° xodim kartasi (keshli agregatsiya, tablar, solishtirish+reyting, Excel, mobil "Mening hisobotim") | ✅ Tayyor |
| 14 — Kengaytirilgan hisobotlar (konstruktor, ABC/Pareto tahlil, foyda-zarar, Excel+PDF eksport) | ✅ Tayyor |
| 15 — Butunlik va monitoring (`check_integrity` task+command, tizim salomatligi sahifasi, kengaytirilgan `/health/`, Sentry) | ✅ Tayyor |
| 16 — Yakuniy sayqal (indekslar, dashboard keshi, throttling, `seed_demo` tarixi, `check --deploy` toza, docs) | ✅ Tayyor |

### v4 qo'shimcha (buyurtma oqimi · ikki bosqichli maosh · mahsulot rasmlari · PDF & muhr) — ✅ Tayyor

Buyurtma (zakaz→yetkazish) oqimi, zakaz/yetkazish uchun alohida komissiya foizlari,
mahsulot rasmlari galereyasi, kompaniya rekvizitlari + muhr, nakladnoy/yuklama PDF
(rasm bilan) va mobil offline chek PDF. Yo'riqnoma: [`docs/v4.md`](./docs/v4.md) ·
spetsifikatsiya: [`distribution-app-prompt-v4.md`](./distribution-app-prompt-v4.md).

**Keyingi qadam:** ⏸ PILOT — 1–2 tarqatuvchi bilan 2 hafta daftar bilan parallel.
To'liq reja: [`docs/pilot.md`](./docs/pilot.md).

## Texnologiyalar

- **Backend:** Python 3.12, Django 5, DRF, SimpleJWT, Channels, Celery, PostgreSQL 16, Redis
- **Frontend:** React 18 + TypeScript (strict), Vite, TanStack Query, Zustand, React Router, Tailwind, i18next
- **DevOps:** Docker Compose (web, worker, beat, db, redis, minio, nginx, backup)

## Ishga tushirish

### 1. Docker bilan (tavsiya etiladi)

```bash
cp backend/.env.example backend/.env
docker compose up -d --build
```

| Xizmat | Manzil |
|---|---|
| API | http://localhost:8000/api/v1/ |
| Swagger | http://localhost:8000/api/docs/ |
| Redoc | http://localhost:8000/api/redoc/ |
| Django admin | http://localhost:8000/admin/ |
| Health | http://localhost:8000/api/v1/health/ |
| MinIO konsoli | http://localhost:9001 |

Standart admin: telefon `+998900000000`, parol `admin12345` (`.env` da o'zgartiring).

Boshlang'ich katalog karkasi (birlik, kategoriya, ombor):
```bash
docker compose exec web python manage.py seed_base
```

### 2. Frontend (dev)

```bash
cd frontend
cp .env.example .env
npm install
npm run dev        # http://localhost:5173
```

### 3. Backend'ni lokal (Docker'siz)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements/dev.txt
# PostgreSQL va Redis ishlab turishi kerak; DATABASE_URL/REDIS_URL ni moslang
python manage.py migrate
python manage.py ensure_superuser
python manage.py runserver
```

## Testlar

```bash
cd backend
pytest                       # yoki: docker compose exec web pytest
```

## Loyiha strukturasi

```
backend/
  config/            settings (base/dev/prod), urls, asgi, wsgi, celery
  apps/
    core/            BaseModel, AppendOnlyModel, AuditLog, Setting, DocumentSequence,
                     pagination, exceptions (javob formati), viewsets (envelope),
                     permissions (rol), /health/ (db+redis+disk+celery),
                     services/integrity (balans == jurnal), services/system_status,
                     tasks.check_integrity (tungi), `python manage.py check_integrity
                     [--fix-dry-run|--fix]`, /system/status/, /system/integrity/
    users/           User (telefon login), DistributorProfile, JWT auth
    catalog/         Category, Brand, Unit, Product, ProductPrice
                     CRUD + /products/{id}/stock, /products/search, /sync/catalog
    warehouse/       Warehouse, Supplier, Stock, StockMovement (append-only),
                     Purchase + confirm, Loading + send/confirm, VanStock
                     services/ (apply_movement, reserve/release, van_apply — atomik)
    clients/         Route, Client, ClientVisit (GPS check-in)
                     tarqatuvchi ko'rish doirasi cheklangan, /sync/clients/
    sales/           Sale/SaleItem, SaleReturn, Debt/DebtPayment
                     services/ (create_sale — biznes qoidalari, atomik, idempotent;
                     sync — /sales/bulk-sync/ offline outbox)
    dayclose/        DayClose, DailyReturn, CashHandover
                     services/ (build_snapshot — formulalar; submit/confirm)
    wallet/          DistributorWallet, WalletTransaction (append-only)
                     services (wallet_apply — balance == SUM(transactions))
    expenses/        ExpenseCategory, DistributorExpense, FuelLog
                     services (create/approve/reject — hamyonga ta'sir CASH_ON_HAND'da)
    finance/         CashAccount, CashTransaction (append-only), CompanyExpense
                     services (cash_apply — balance == SUM; kun yopish → kassa)
    reports/         dashboard, sales-summary, debt-aging, profit (P&L), expenses,
                     query (konstruktor — dimension+filtr), abc (Pareto tahlil),
                     distributor 360°, export (Excel + PDF: sales|distributor|
                     query|abc|pnl)
    notifications/   Notification + notify() (DB + WS + Telegram) + /notifications/
    telegram_bot/    webhook + link kodi + kunlik xulosa/eslatma tasklari
                     (aiogram'siz — webhook + httpx). Token bo'sh bo'lsa no-op
    ocr/             InvoiceScan/Line/Page — Claude vision (kalit yo'q → mock),
                     opencv preprocess, rapidfuzz matching, ProductAlias o'rganish,
                     cost limit, metrikalar (line_accuracy, correction_rate, ...)
  realtime/          JWTAuthMiddleware, EventConsumer (ws/events/), broadcast(),
                     tasks (dashboard_tick 30s, check_overdue_debts)
  tests/             health, auth, append-only, catalog, warehouse, clients
docker/              Dockerfile, entrypoint, nginx
scripts/             backup.sh, backup-cron.sh, restore-test.sh
docs/                restore.md, deploy.md, security.md, performance.md
frontend/src/
  app/               router (rol bo'yicha admin / mobil layout), providers
  shared/            api (axios interceptor + crud), store (auth), components, lib, types
  features/auth/     LoginPage
  admin/             AdminLayout, Dashboard, products/, warehouse/, clients/, routes/
  shared/realtime/   useEventStream (WS → react-query invalidatsiya + toast),
                     RealtimeBridge; WS uzilsa ilova ishlayveradi
  admin/             + sales/, dayclose/, expenses/, finance/, ocr/ (tekshirish
                     ekrani + metrikalar), payroll/, distributors/ (360° karta),
                     reports/ (konstruktor + ABC + foyda-zarar, Excel/PDF),
                     system/ (SystemHealthPage — salomatlik, butunlik, backup, sync),
                     SettingsPage, NotificationBell
  mobile/            + ProfilePage, DebtCollectPage, ScanInvoicePage (kamera)
  mobile/            NewSale (30-soniya oqimi), DayCloseWizard (3 qadam), MyLoading,
                     MyVanStock, MyClients (GPS check-in), SyncPage, geo
  offline/           db (Dexie), outbox, sync, actions, useSync, SyncBadge
                     — sotuv avval lokal bazaga yoziladi, keyin bulk-sync (CLAUDE.md 4)
  locales/ (uz/ru/en)
```

## Backup (1-kundan — CLAUDE.md 16)

`backup` konteyneri har kuni 02:00 (Asia/Tashkent) da `pg_dump | gzip` bajaradi,
30 kun saqlaydi. Tiklash: [`docs/restore.md`](./docs/restore.md).

## Monitoring (CLAUDE.md 15, 16)

- **Butunlik:** har kecha 02:30 da `check_integrity` Celery task `DistributorWallet` /
  `Stock` / `VanStock` / `CashAccount` denormalized balansini jurnal yig'indisi bilan
  solishtiradi. Farq bo'lsa → adminga bildirishnoma + `AuditLog(action=integrity.check)`
  + `admin_dashboard` WS eventi. Qo'lda: `python manage.py check_integrity [--fix-dry-run|--fix]`.
- **Tizim salomatligi sahifasi** (`/admin/system`): xizmatlar (db/redis/disk/celery),
  butunlik natijasi, backup holati (fayl yoshi/hajmi), sinxronizatsiya ziddiyatlari,
  OCR navbati, Sentry holati. SUPER_ADMIN farqlarni shu yerdan tuzatishi mumkin
  (jurnal tegilmaydi — faqat denormalized qiymat jurnalga moslanadi).
- **`/api/v1/health/`** — ochiq; `?deep=1` celery ishchisini ham tekshiradi.
- **Sentry** — `SENTRY_DSN` berilsa prod'da yoqiladi.

## Xavfsizlik va ishlash

- Rate limiting: `anon 30/min`, `user 1000/min`, `login 10/min`, `ocr 20/min`
- JWT: access 15 min + refresh rotatsiya · prod: HSTS, secure cookie, JSON-only API
- `python manage.py check --deploy` — 0 ogohlantirish
- Batafsil: [`docs/security.md`](./docs/security.md) · [`docs/performance.md`](./docs/performance.md)

## Demo ma'lumot

```bash
docker compose exec web python manage.py seed_demo   # 4 rol, katalog, 5 kunlik sotuv tarixi
```
Parollar: `demo12345`. `--fresh` demo foydalanuvchilarni qayta yaratadi.
