# MeyFu — Tarqatuvchilik va Sotuv Boshqaruv Tizimi

Kompaniya zavodlardan **maishiy kimyo mahsulotlarini** (kir yuvish kukunlari, gellar,
sovunlar, shampunlar, yuvish vositalari) optom oladi va tarqatuvchi agentlar orqali
do'kon va bozorlarga yetkazadi. MeyFu shu jarayonning har bir bosqichini — tovar
qabulidan tortib oylik maoshgacha — bitta tizimda boshqaradi.

Loyiha **offline-first**: har bir sotuv va xarajat avval tarqatuvchining telefonidagi
lokal bazaga yoziladi, internet paydo bo'lganda serverga sinxronlanadi. Pul va tovar
jurnallari **o'zgarmas** (append-only) — xato faqat tuzatuvchi yozuv bilan to'g'rilanadi.

To'liq spetsifikatsiya: **[`CLAUDE.md`](./CLAUDE.md)** · v4 qo'shimchalari: [`docs/v4.md`](./docs/v4.md)

---

## Nima qiladi

```
1. TOVAR QABULI      Zavod nakladnoy bilan tovar keltiradi → omborchi kiritadi
                     (yoki naklitni kamera bilan skanerlaydi → OCR o'qiydi → tasdiqlaydi)
2. ERTALAB YUKLASH    Ombordan tarqatuvchiga tovar beriladi → u telefonda tasdiqlaydi
3. KUN DAVOMIDA       Marshrut bo'yicha do'konlarga sotuv (naqd/plastik/o'tkazma/qarz)
                     + yo'l xarajatlari (yoqilg'i, tushlik...) chek rasmi bilan
4. JONLI HAMYON       naqd sotuv + undirilgan qarz − xarajat − topshirilgan = qo'ldagi pul
5. KECHQURUN          Ostatka omborga qaytadi → kun yopiladi (tovar farqi, kassa farqi)
6. OYLIK              Sotuvdan foiz + bonus − ushlanmalar = maosh
```

**Buyurtma (zakaz) oqimi (v4):** tarqatuvchi avval zakaz yig'adi → menejer tasdiqlaydi →
yuklamaga birlashtiriladi → yetkazib beriladi. Zakaz olgani va yetkazgani uchun **alohida
komissiya foizlari** to'planadi.

## Rollar

| Rol | Interfeys | Asosiy imkoniyatlar |
|---|---|---|
| **SUPER_ADMIN** | Desktop | Hammasi: sozlamalar, narx, foiz, xodimlar, moliya, tasdiqlashlar |
| **MANAGER** | Desktop | Yuklash, mijoz, tovar, hisobot, kun yopish (narx/foiz o'zgartirmaydi) |
| **WAREHOUSE** | Desktop / telefon | Kirim (naklit skan), yuklash, qaytarish qabuli, inventarizatsiya |
| **DISTRIBUTOR** | Mobil PWA | Yuklama, sotuv, mijozlar, qarz undirish, xarajat, hamyon, kun yopish, o'z maoshi |
| **ACCOUNTANT** | Desktop | Kassa, qarz, xarajat, maosh, eksport |

## Holat: ✅ MVP + 2-FAZA + 3-FAZA (1–16) + v4 TUGADI

| Bosqich | Holat |
|---|---|
| 1–6 — MVP (katalog, ombor, mijoz, yuklash, sotuv+offline, kun yopish, hisobot) | ✅ |
| 7 — Xarajat va hamyon | ✅ |
| 8 — Real-time (Channels, eventlar, bildirishnomalar) | ✅ |
| 9 — Qarzdorlik va moliya (aging, kassa, P&L) | ✅ |
| 10 — Telegram bot | ✅ |
| 11 — Naklit OCR (Claude vision, fuzzy matching, alias o'rganish, metrikalar) | ✅ |
| 12 — Maosh (CommissionRule, Payroll, Advance, mobil "Mening maoshim") | ✅ |
| 13 — 360° xodim kartasi (keshli agregatsiya, tablar, solishtirish+reyting, Excel) | ✅ |
| 14 — Kengaytirilgan hisobotlar (konstruktor, ABC/Pareto, foyda-zarar, Excel+PDF) | ✅ |
| 15 — Butunlik va monitoring (`check_integrity`, tizim salomatligi sahifasi, Sentry) | ✅ |
| 16 — Yakuniy sayqal (indekslar, dashboard keshi, throttling, `check --deploy` toza) | ✅ |
| v4 — Buyurtma oqimi · ikki bosqichli maosh · mahsulot rasmlari · nakladnoy/chek PDF + muhr | ✅ |

**Keyingi qadam:** ⏸ PILOT — 1–2 tarqatuvchi bilan 2 hafta daftar bilan parallel.
Reja: [`docs/pilot.md`](./docs/pilot.md).

## Texnologiyalar

- **Backend:** Python 3.12+, Django 5, DRF, SimpleJWT, Django Channels + Daphne,
  Celery + Beat, PostgreSQL 16, Redis, drf-spectacular, Pillow + opencv, Anthropic API (OCR)
- **Frontend:** React 18 + TypeScript (strict), Vite, TanStack Query, Zustand, React Router,
  React Hook Form + Zod, Tailwind + shadcn/ui, Recharts, **Dexie.js (IndexedDB)** + vite-plugin-pwa,
  i18next (uz/ru/en)
- **DevOps:** Docker Compose (web, worker, beat, db, redis, nginx, minio, backup), Nginx, Sentry

---

## Ishga tushirish

### Variant A — Docker (prod-ga yaqin, tavsiya etiladi)

Barcha xizmatlar (Postgres, Redis, MinIO, Celery, Nginx) konteynerlarda ko'tariladi.
Migratsiya va standart admin (`ensure_superuser`) entrypoint'da avtomatik bajariladi.

```bash
cp backend/.env.example backend/.env      # kerakli sozlamalarni to'ldiring
docker compose up -d --build

docker compose exec web python manage.py seed_base   # birlik/kategoriya/ombor karkasi
# ixtiyoriy — to'liq demo ma'lumot (4 rol + 5 kunlik sotuv tarixi):
docker compose exec web python manage.py seed_demo
```

| Xizmat | Manzil |
|---|---|
| API | http://localhost:8000/api/v1/ |
| Swagger / Redoc | http://localhost:8000/api/docs/ · `/api/redoc/` |
| Django admin | http://localhost:8000/admin/ |
| Health | http://localhost:8000/api/v1/health/ |
| MinIO konsoli | http://localhost:9001 |

### Variant B — Lokal dev, Docker'siz (eng tez, tashqi xizmatlarsiz)

`config.settings.local` — **sqlite + xotiradagi kesh/navbat**, Postgres yoki Redis kerak emas.
Frontend bilan tez sinov uchun eng qulay yo'l.

**Backend:**
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows
# source .venv/bin/activate       # macOS / Linux
pip install -r requirements/dev.txt

python manage.py migrate     --settings=config.settings.local
python manage.py seed_demo   --settings=config.settings.local   # 4 rol + demo ma'lumot
python manage.py runserver 8000 --settings=config.settings.local
```

> `--settings=config.settings.local` ni har safar yozmaslik uchun `backend/.env` ga
> `DJANGO_SETTINGS_MODULE=config.settings.local` qo'shing.

**Frontend (alohida terminal):**
```bash
cd frontend
cp .env.example .env
npm install
npm run dev          # http://localhost:5173  (API so'rovlari 8000-portga proxy qilinadi)
```

Frontend'ni prod uchun yig'ish: `npm run build` → `frontend/dist/`.

### Kirish ma'lumotlari

| Manba | Telefon (login) | Parol |
|---|---|---|
| `ensure_superuser` (Docker) | `+998900000000` | `admin12345` (`.env` da o'zgartiring) |
| `seed_demo` — SUPER_ADMIN | `+998900000000` | `demo12345` |
| `seed_demo` — MANAGER | `+998901000000` | `demo12345` |
| `seed_demo` — WAREHOUSE | `+998902000000` | `demo12345` |
| `seed_demo` — DISTRIBUTOR | `+998903000000` | `demo12345` |

> ⚠️ Login maydoniga telefonни **probel va tiresiz** kiriting: `+998900000000`.
> `seed_demo --fresh` demo foydalanuvchilarni qayta yaratadi.

---

## Testlar

```bash
cd backend
pytest                              # config.settings.test (sqlite, tashqi xizmatlarsiz)
# yoki: docker compose exec web pytest
```

Kritik yo'llar qoplangan: narx limiti, VanStock yetarliligi, qarz limiti, kun yopish
formulalari, hamyon balansi butunligi, append-only jurnal himoyasi, offline dublikat
(bir xil `client_uuid`), konflikt, atomarlik, maosh formulasi, OCR qator moslashtirish,
rol ruxsatlari. **CI da avtomatik ishlaydi.**

## Loyiha strukturasi

```
backend/
  config/            settings (base/dev/local/test/prod), urls, asgi, wsgi, celery
  apps/
    core/            BaseModel, AppendOnlyModel, AuditLog, Setting, DocumentSequence,
                     CompanySettings, pagination, exceptions (javob formati),
                     viewsets (envelope), permissions (rol), pdf (ReportLab),
                     /health/ (db+redis+disk+celery), services/integrity
                     (balans == jurnal), tasks.check_integrity (tungi),
                     `python manage.py check_integrity [--fix-dry-run|--fix]`
    users/           User (telefon login), DistributorProfile (order/delivery foizi), JWT
    catalog/         Category, Brand, Unit, Product, ProductPrice, ProductImage (galereya),
                     ProductAlias · CRUD + /products/{id}/stock + /sync/catalog
    warehouse/       Warehouse, Supplier, Stock, StockMovement (append-only),
                     Purchase + confirm, Loading + send/confirm, VanStock,
                     nakladnoy/yuklama PDF (?stamp=1) · services (atomik)
    clients/         Route, Client, ClientVisit (GPS check-in) · /sync/clients/
    sales/           Sale/SaleItem, SaleReturn, Debt/DebtPayment
                     services/ (create_sale — biznes qoidalari, atomik, idempotent;
                     sync — /sales/bulk-sync/ offline outbox)
    orders/          Order/OrderItem (DRAFT→PLACED→APPROVED→LOADED→DELIVERED),
                     place/approve/cancel/fulfill, build_loading_from_orders
    dayclose/        DayClose, DailyReturn, CashHandover · services (formulalar)
    wallet/          DistributorWallet, WalletTransaction (append-only)
    expenses/        ExpenseCategory, DistributorExpense, FuelLog · create/approve/reject
    finance/         CashAccount, CashTransaction (append-only), CompanyExpense
    payroll/         CommissionRule, Payroll (ikki bosqichli: ORDER/DELIVERY), Advance
    reports/         dashboard, sales-summary, debt-aging, profit (P&L), expenses,
                     query (konstruktor), abc (Pareto), distributor 360°,
                     export (Excel + PDF)
    notifications/   Notification + notify() (DB + WS + Telegram)
    telegram_bot/    webhook + link kodi + kunlik xulosa/eslatma (token bo'sh → no-op)
    ocr/             InvoiceScan/Line/Page — Claude vision (kalit yo'q → mock),
                     opencv preprocess, rapidfuzz matching, ProductAlias o'rganish,
                     cost limit, metrikalar (line_accuracy, correction_rate, ...)
  realtime/          JWTAuthMiddleware, EventConsumer (ws/events/), broadcast(),
                     tasks (dashboard_tick 30s, check_overdue_debts)
  tests/             pytest — kritik yo'llar
docker/              Dockerfile, entrypoint, nginx
scripts/             backup.sh, backup-cron.sh, restore-test.sh
docs/                deploy.md, restore.md, security.md, performance.md, pilot.md, v4.md
frontend/src/
  app/               router (rol bo'yicha admin / mobil layout), providers
  shared/            api (axios interceptor + crud), store (auth), components, lib, types
  features/auth/     LoginPage
  admin/             AdminLayout, Dashboard (real-time), products/, warehouse/, clients/,
                     routes/, sales/, orders/, dayclose/, expenses/, finance/, ocr/,
                     payroll/, distributors/ (360° karta), reports/, system/, SettingsPage
  mobile/            NewSale (30-soniya oqimi), NewOrder, MyOrders, DayCloseWizard,
                     MyLoading, MyVanStock, MyClients (GPS), MyPayroll, MyReport,
                     ScanInvoice (kamera), ReceiptButtons (offline PDF), SyncPage
  offline/           db (Dexie), outbox, sync, actions — sotuv avval lokal bazaga,
                     keyin bulk-sync (CLAUDE.md 4)
  locales/           uz / ru / en
```

---

## Backup (1-kundan — CLAUDE.md 16)

`backup` konteyneri har kuni 02:00 (Asia/Tashkent) da `pg_dump | gzip` bajaradi,
30 kun saqlaydi (7 kunlik kunlik + 4 haftalik). Tiklash: [`docs/restore.md`](./docs/restore.md).

## Monitoring (CLAUDE.md 15, 16)

- **Butunlik:** har kecha 02:30 da `check_integrity` `DistributorWallet` / `Stock` /
  `VanStock` / `CashAccount` denormalized balansini jurnal yig'indisi bilan solishtiradi.
  Farq → adminga bildirishnoma + `AuditLog` + WS eventi.
  Qo'lda: `python manage.py check_integrity [--fix-dry-run|--fix]`.
- **Tizim salomatligi sahifasi** (`/admin/system`): xizmatlar, butunlik natijasi, backup
  holati, sinxronizatsiya ziddiyatlari, OCR navbati, Sentry holati.
- **`/api/v1/health/`** — ochiq; `?deep=1` celery ishchisini ham tekshiradi.
- **Sentry** — `SENTRY_DSN` berilsa prod'da yoqiladi.

## Xavfsizlik

- Rate limiting: `anon 30/min`, `user 1000/min`, `login 10/min`, `ocr 20/min`
- JWT: access 15 min + refresh rotatsiya · prod: HSTS, secure cookie, JSON-only API
- `python manage.py check --deploy` — 0 ogohlantirish
- `.env` git'da yo'q · media fayllarga rolli kirish · HTTPS majburiy (prod)
- Batafsil: [`docs/security.md`](./docs/security.md) · [`docs/performance.md`](./docs/performance.md)

## Deploy

Ishlab chiqarishga chiqarish qo'llanmasi: [`docs/deploy.md`](./docs/deploy.md).
