# Audit hisoboti — MeyFu (Distribution & Sales Management System)

Sana: 2026-09-09 | Commit: `34b4bb8` | Django 5.1.6 | React 18.3 | TypeScript 5.7 | DRF 3.15

Audit AUDIT_PROMPT_REACT_TS_DJANGO.md bo'yicha, Bosqich 0–9. Bosqich 10 (tuzatish sikli)
`docs/FIXES.md` da alohida boshqariladi.

---

## Xulosa

- **Jami topilma: 20** — Kritik: 3, Yuqori: 4, O'rta: 7, Past: 6.
- Eng xavfli 3 muammo:
  1. **`docker-compose.yml` ishlab chiqarishda `config.settings.dev` bilan ishlaydi** —
     `DEBUG=True`, `ALLOWED_HOSTS=['*']`, xavfsizlik sarlavhalarisiz, `SECRET_KEY`
     ma'lum standart qiymat bilan (`CFG-001`).
  2. **Haqiqiy Telegram bot tokeni git'da** — `backend/.env.example` da ochiq token,
     git tarixida ham bor (`SEC-001`).
  3. **Konteyner ishga tushganda SUPER_ADMIN avtomatik ma'lum parol bilan yaratiladi**
     (`+998900000000` / `Hasanali.0220`, ikkalasi ham repo va hujjatlarda) (`SEC-002`).

### Boshlang'ich holat (Bosqich 0)

| Tekshiruv | Natija |
|---|---|
| `python manage.py check` (local) | ✅ 0 muammo |
| `python manage.py check --deploy` (prod, to'g'ri SECRET_KEY bilan) | ✅ 0 xavfsizlik ogohlantirishi (faqat 5 ta `drf_spectacular` enum nomlash ogohlantirishi) |
| `makemigrations --check --dry-run` | ✅ "No changes detected" |
| `pytest` (backend) | ✅ **229 passed** in ~40s |
| `tsc -b --noEmit` (frontend) | ✅ 0 xato (`strict: true`, juda qattiq konfiguratsiya) |
| `npm run lint` | ✅ 0 ogohlantirish (`--max-warnings 0`) |
| `npm run build` | ✅ muvaffaqiyatli; PWA 15 fayl / ~1.7 MB precache |
| `npm audit` | ⚠️ 2 moderate (`react-router` — `DEP-001`) |
| Frontend testlari | ❌ **umuman yo'q** (vitest/jest o'rnatilmagan) |
| Playwright E2E (Bosqich 8) | ⏸️ **bajarilmadi** — quyida "Bosqich 8" ga qarang |

---

## 0. Loyiha xaritasi

### Arxitektura

- **Backend:** Django 5.1 + DRF, 16 lokal app (`users, catalog, warehouse, clients, sales,
  orders, dayclose, wallet, expenses, finance, reports, notifications, telegram_bot, ocr,
  payroll, core`). Settings: `base/dev/local/test/prod`. Channels + Daphne (ASGI),
  Celery + Beat, PostgreSQL 16, Redis (cache + channel layer + broker).
- **Auth:** SimpleJWT (access 15 min, refresh 7 kun, `ROTATE_REFRESH_TOKENS=True`,
  `BLACKLIST_AFTER_ROTATION=False`). Custom `users.User` (telefon = login).
- **DRF global:** `DEFAULT_PERMISSION_CLASSES = IsAuthenticated`, throttle
  `anon 30/min · user 1000/min · login 10/min · ocr 20/min`, javob konverti
  `{success, data}` / `{success:false, error:{code,message,details}}`.
- **Service layer** naqshi izchil qo'llanilgan: biznes mantiq `apps/*/services/` da,
  `transaction.atomic()` + `select_for_update()` pul/qoldiq o'zgarishlarida.
- **Append-only jurnallar:** `core.AuditLog`, `wallet.WalletTransaction`,
  `warehouse.StockMovement` — `AppendOnlyModel.save()` mavjud yozuvni bloklaydi (test bor).
- **DB butunligi:** `Stock` va `VanStock` da `CheckConstraint(quantity >= 0)`;
  `DocumentSequence` da `UniqueConstraint(prefix, year)`; `Sale.client_uuid` unique
  (idempotentlik).

- **Frontend:** React 18 + Vite + TS (strict), TanStack Query, Zustand (`persist` →
  `localStorage`), React Router v6, Tailwind, Dexie (offline), vite-plugin-pwa.
  Ikki interfeys: `src/admin/*` (desktop) va `src/mobile/*` (PWA).
- **Offline:** `src/offline/` — Dexie bazasi + outbox pattern + `POST /sales/bulk-sync/`.
  Frontend UUID generatsiya qiladi, server `client_uuid` unique bilan idempotent.

### Asosiy endpoint ↔ frontend hook/API mosligi (namuna)

| Endpoint | Frontend | Tip manbai | Izoh |
|---|---|---|---|
| `POST /auth/login` | `features/auth`, `authStore` | `shared/types/api` (qo'lda) | Javob `{success,data:{access,refresh,user}}` |
| `POST /auth/refresh` | `shared/api/client.ts` interceptor | inline `{access}` | Konvertsiz (stock `TokenRefreshView`) |
| `GET /sales/` | `admin/sales`, `mobile` | `shared/types/sales.ts` (qo'lda) | **Tip drift** — `API-001` |
| `POST /sales/bulk-sync/` | `offline/sync.ts` | `shared/types/api.ts` | Outbox; `sale, expense, debt_payment, visit, sale_return, order_*` |
| `GET /sync/catalog`, `/sync/clients`, `/van-stock/my` | `offline/sync.ts pullReferenceData` | qo'lda | 500 tadan `page_size` bilan tortadi |
| `GET /day-close/my-today` (preview) | `mobile/DayCloseWizard` | `shared/types/dayclose.ts` | `cash_expected` backenddan olinadi (yaxshi) |
| `GET /reports/distributor/{id}/full` | `admin/distributors/DistributorCardPage` | `shared/api/reports360.ts` | IDOR himoyasi bor (`_DistributorScopedView`) |

Tiplar **hammasi qo'lda yozilgan**, OpenAPI generatsiyasi yo'q. `drf-spectacular`
o'rnatilgan lekin `npx openapi-typescript` oqimi qurilmagan → `TS-001`.

---

## Jadval

| ID | Sarlavha | Turkum | Jiddiylik | Manzil | Holat |
|----|----------|--------|-----------|--------|-------|
| CFG-001 | Docker-compose ishlab chiqarishda `settings.dev` bilan ishlaydi | Konfiguratsiya | Kritik | `docker-compose.yml`, `config/asgi.py:5`, `docker/entrypoint.sh` | Ochiq |
| SEC-001 | Haqiqiy Telegram bot tokeni git'da (`.env.example` + tarix) | Xavfsizlik | Kritik | `backend/.env.example:39` | Ochiq |
| SEC-002 | Konteyner ma'lum parolli SUPER_ADMIN yaratadi | Xavfsizlik | Kritik | `apps/users/management/commands/ensure_superuser.py:17`, `docker/entrypoint.sh:12` | Ochiq |
| SEC-003 | `SECRET_KEY` uchun xavfsiz bo'lmagan standart fallback | Xavfsizlik | Yuqori | `config/settings/base.py:24`, `docker-compose.yml` | Ochiq |
| SEC-004 | `TELEGRAM_WEBHOOK_SECRET` standart `"dev-webhook-secret"`, webhook `AllowAny` | Xavfsizlik | Yuqori | `config/settings/base.py:263`, `apps/telegram_bot/views.py:25` | Ochiq |
| FE-001 | React `ErrorBoundary` / router `errorElement` umuman yo'q | React | Yuqori | `src/app/router.tsx`, `src/app/providers.tsx` | Ochiq |
| TS-001 | API javoblari runtime'da tekshirilmaydi; frontend testlari yo'q | Tip xavfsizligi | Yuqori | `src/shared/types/*`, `src/shared/api/*`, `package.json` | Ochiq |
| API-001 | `Sale` / `SaleItem` TS tiplari serializer maydonlariga mos emas | API kontrakti | O'rta | `src/shared/types/sales.ts` ↔ `apps/sales/serializers.py:20` | Ochiq |
| UX-001 | Backend maydon-validatsiya xatolari formaga bog'lanmaydi | UX | O'rta | `src/shared/api/client.ts:78`, `apps/core/exceptions.py:101` | Ochiq |
| DC-001 | Kun yopish snapshot'i `confirm` dan keyin qayta hisoblanmaydi | Hisob-kitob | O'rta | `apps/dayclose/services/close.py:146`, `snapshot.py:119` | Ochiq |
| OFF-001 | Outbox backoff formulasi noto'g'ri; `attempts>=20` operatsiyalar qotib qoladi | Offline | O'rta | `src/offline/outbox.ts:42-56` | Ochiq |
| ORM-001 | Ro'yxat endpointlarida `assertNumQueries` qamrovi yo'q (N+1 kuzatilmaydi) | DB/So'rov | O'rta | `backend/tests/`, `apps/reports/services/` | Ochiq |
| DEP-001 | `react-router` 6.28 — 2 ta moderate CVE | Xavfsizlik | O'rta | `frontend/package.json` | Ochiq |
| CFG-002 | `local.py` da `CORS_ALLOW_ALL_ORIGINS=True` + `CORS_ALLOW_CREDENTIALS=True` | Konfiguratsiya | O'rta | `config/settings/local.py:27` | Ochiq |
| CALC-001 | Yaxlitlash rejimi frontend/backend'da har xil (`Math.round` ↔ `ROUND_HALF_EVEN`) | Hisob-kitob | Past | `src/shared/lib/format.ts:64`, `apps/sales/models.py:133` | Ochiq |
| SEC-005 | `/health/` `AllowAny` — infra holatini anonim ochib beradi | Xavfsizlik | Past | `apps/core/views.py:29` | Ochiq |
| SEC-006 | Webhook siri `!=` bilan solishtiriladi (constant-time emas) | Xavfsizlik | Past | `apps/telegram_bot/views.py:25` | Ochiq |
| CFG-003 | Django admin standart `/admin/` manzilida | Konfiguratsiya | Past | `config/urls.py:34` | Ochiq |
| CFG-004 | `dev.py` da `ALLOWED_HOSTS=['*']` | Konfiguratsiya | Past | `config/settings/dev.py:5` | Ochiq |
| PERF-001 | Katta bundle bo'laklari (`DistributorCardPage` 458 KB, `receiptPdf` 463 KB) | Perf | Past | `npm run build` chiqishi | Ochiq |

---

## Batafsil topilmalar

### CFG-001 — Docker-compose ishlab chiqarishda `settings.dev` bilan ishlaydi · Kritik

- **Manzil:** `docker-compose.yml` (`DJANGO_SETTINGS_MODULE: config.settings.dev`),
  `config/asgi.py:5`, `config/wsgi.py:5`, `config/celery.py:5`
  (`os.environ.setdefault(..., "config.settings.dev")`), `docker/entrypoint.sh`.
- **Tavsif:** Loyihada `config/settings/prod.py` mavjud (HSTS, `SECURE_SSL_REDIRECT`,
  secure cookie, `DEBUG=False`), lekin **birorta ishga tushirish yo'li uni ishlatmaydi**.
  Yagona `docker-compose.yml` `dev` ni qattiq belgilaydi; `docker-compose.prod.yml`
  yoki override yo'q. `deploy.md` "birinchi ishga tushirish" bo'limi aynan shu
  compose'ni tavsiya qiladi.
- **Isbot:** `docker-compose.yml` → `DJANGO_SETTINGS_MODULE: config.settings.dev`;
  `dev.py` → `DEBUG = True`, `ALLOWED_HOSTS = ["*"]`; `base.py` → `DEBUG=True` bo'lganda
  `BrowsableAPIRenderer` yoqiladi.
- **Ta'sir:** Ishlab chiqarishda: 500 xatolarda to'liq stack trace + settings dump
  (`DEBUG=True`), Host header injection (`ALLOWED_HOSTS=['*']`), HSTS/secure-cookie/
  SSL-redirect yo'q, Browsable API orqali ma'lumot va CSRF yuzasi.
- **Yechim:** `docker-compose.yml` da `config.settings.prod`; alohida
  `docker-compose.override.yml` (dev uchun) yoki `.dev.yml`; `asgi/wsgi/celery` da
  `setdefault` ni `prod` ga o'zgartirish yoki olib tashlash; `entrypoint` da
  `check --deploy` ni majburiy qilish.

### SEC-001 — Haqiqiy Telegram bot tokeni git'da · Kritik

- **Manzil:** `backend/.env.example:39` —
  `TELEGRAM_BOT_TOKEN="<REDACTED — 8568…VXr0 formatidagi haqiqiy token>"`.
- **Tavsif:** `.env.example` namuna bo'lishi kerak, lekin unda haqiqiy Telegram bot
  tokeni (`<bot_id>:<35-belgi>` formati) bor. `git log -p` bo'yicha token birinchi
  commitdan beri tarixda.
- **Isbot:** `git log -p f9188ab -- backend/.env.example` → `+TELEGRAM_BOT_TOKEN="857…"`.
- **Ta'sir:** Repoga kirish huquqi bo'lgan har kim bot nomidan xabar yuborishi,
  webhook o'rnatishi, foydalanuvchilar bilan yozishishi mumkin.
- **Yechim:** Tokenni @BotFather orqali **darhol bekor qilish** (`/revoke`), yangi token
  faqat `.env` (git'siz) ga. `.env.example` da `TELEGRAM_BOT_TOKEN=` (bo'sh). Tarixni
  tozalash (`git filter-repo`) yoki hech bo'lmasa tokenni almashtirilgan deb belgilash.

### SEC-002 — Konteyner ma'lum parolli SUPER_ADMIN yaratadi · Kritik

- **Manzil:** `apps/users/management/commands/ensure_superuser.py:16-17`,
  `docker/entrypoint.sh:12` (`python manage.py ensure_superuser || true`).
- **Tavsif:** `entrypoint.sh` har ishga tushganda `ensure_superuser` chaqiradi.
  Env o'zgaruvchilari (`DJANGO_SUPERUSER_PHONE/PASSWORD`) `.env.example` da ham,
  `docker-compose.yml` da ham yo'q → standart `+998900000000` / `Hasanali.0220`
  ishlatiladi. Parol `deploy.md:20` da ham ochiq yozilgan va commit
  `2dd1e40` da o'zgartirilgan.
- **Isbot:** `ensure_superuser.py:17` →
  `os.environ.get("DJANGO_SUPERUSER_PASSWORD", "Hasanali.0220")`.
- **Ta'sir:** Yangi o'rnatishda to'liq admin kirish umumga ma'lum. `/admin/` ochiq
  (`CFG-003`) → to'liq ma'lumotlar bazasiga kirish.
- **Yechim:** Standart parolni olib tashlash — env berilmasa buyruq **xato bilan
  to'xtasin** (`raise CommandError`). `.env.example` ga majburiy
  `DJANGO_SUPERUSER_PASSWORD=` (izoh bilan). Mavjud o'rnatishlarda admin parolini
  almashtirish.

### SEC-003 — `SECRET_KEY` uchun xavfsiz bo'lmagan standart fallback · Yuqori

- **Manzil:** `config/settings/base.py:24` —
  `SECRET_KEY = env("SECRET_KEY", default="insecure-dev-key-change-me")`;
  `docker-compose.yml` — `SECRET_KEY: ${SECRET_KEY:-insecure-dev-key-change-me}`.
- **Tavsif:** `SECRET_KEY` env'da bo'lmasa ma'lum qiymat bilan **jimgina** ishga
  tushadi. `prod.py` buni qayta talab qilmaydi. Compose ham aynan shu qiymatni
  in'ektsiya qiladi.
- **Ta'sir:** Ma'lum `SECRET_KEY` → sessiya/CSRF/`signing` tokenlarini soxtalashtirish,
  parol tiklash tokenlarini yasash.
- **Yechim:** `prod.py` da fallbacksiz `SECRET_KEY = env("SECRET_KEY")` (yo'q bo'lsa
  `ImproperlyConfigured`). Compose'dan `:-insecure…` ni olib tashlash.

### SEC-004 — `TELEGRAM_WEBHOOK_SECRET` standart qiymati va ochiq webhook · Yuqori

- **Manzil:** `config/settings/base.py:263`
  (`default="dev-webhook-secret"`), `apps/telegram_bot/urls.py:11`
  (`telegram/webhook/<str:secret>/`), `apps/telegram_bot/views.py:20-25`
  (`authentication_classes=[]`, `permission_classes=[AllowAny]`).
- **Tavsif:** Webhook URL siri env'da o'rnatilmasa taxmin qilinadigan
  `"dev-webhook-secret"` bo'ladi. Endpoint autentifikatsiyasiz.
- **Ta'sir:** Sir topilsa/standart qolsa — soxta Telegram `update`lar yuborib,
  bot mantiqini (masalan xarajat tasdiqlash `callback_data`) qo'zg'atish mumkin.
- **Yechim:** `prod.py` da fallbacksiz talab qilish; `secrets.compare_digest`
  (`SEC-006`); Telegram `X-Telegram-Bot-Api-Secret-Token` sarlavhasini ham tekshirish.

### FE-001 — `ErrorBoundary` umuman yo'q · Yuqori

- **Manzil:** butun `frontend/src` — `grep -rn "ErrorBoundary"` → 0 natija; router'da
  `errorElement` yo'q (`src/app/router.tsx`).
- **Tavsif:** Bitta komponentda render vaqtidagi istisno (masalan kutilmagan API
  javob shakli, `undefined.map`) butun SPA'ni oq ekranga aylantiradi.
- **Isbot:** `react-error-boundary` `package.json` da yo'q; `providers.tsx` da
  `QueryClientProvider` + router, boundary yo'q.
- **Ta'sir:** Har qanday runtime xato = ilova to'liq ishlamay qoladi, foydalanuvchi
  daftarga qaytadi (CLAUDE.md 3 ga zid).
- **Yechim:** Ildiz `ErrorBoundary` (fallback UI + "Qayta yuklash") + har bosh marshrut
  atrofida; TanStack Query `QueryErrorResetBoundary`. Mos ravishda `TS-001` (runtime
  validatsiya) xato ehtimolini kamaytiradi.

### TS-001 — Runtime validatsiya yo'q; frontend testlari yo'q · Yuqori

- **Manzil:** `src/shared/types/*.ts` (barchasi qo'lda), `src/shared/api/*.ts`
  (`response.data` to'g'ridan-to'g'ri `as` bilan), `package.json` (test skripti yo'q).
- **Tavsif:** `zod` bog'liqlik sifatida o'rnatilgan lekin **hech qayerda ishlatilmaydi**
  (`grep -rn "from 'zod'"` → 0). API javoblari tipga ishonib olinadi, tekshirilmaydi.
  Frontendda birorta test yo'q (vitest/jest yo'q).
- **Ta'sir:** Backend serializer o'zgarsa (`API-001` allaqachon mavjud drift) —
  TS kompilyatsiyada emas, foydalanuvchi brauzerida jimgina buziladi.
- **Yechim:** `drf-spectacular` sxemasidan `openapi-typescript` bilan tip generatsiyasi
  (bir marta qurish); yoki kritik javoblar uchun `zod` sxemalari + `.parse()`
  API qatlamida. Vitest + kamida hisob-kitob va offline util testlari (Bosqich 4.5).

### API-001 — `Sale` / `SaleItem` TS tiplari serializer bilan mos emas · O'rta

- **Manzil:** `src/shared/types/sales.ts:4-39` ↔ `apps/sales/serializers.py:20-63`.
- **Tavsif:** Serializer qaytaradi, TS tipida yo'q:
  `SaleItem.discount_percent`; `Sale.order`, `order_number`, `latitude`, `longitude`,
  `client_uuid`, `is_synced`, `device_time`.
- **Ta'sir:** Qo'shimcha maydonlar runtime'da zarar bermaydi, lekin `discount_percent`
  ni UI ko'rsata olmaydi; tip drift kelajakdagi xatolarni yashiradi.
- **Yechim:** Tiplarni to'ldirish yoki generatsiyaga o'tish (`TS-001`).

### UX-001 — Backend maydon xatolari formaga bog'lanmaydi · O'rta

- **Manzil:** `src/shared/api/client.ts:78` (`extractApiError` faqat
  `error.error.message` ni o'qiydi), `apps/core/exceptions.py:101-108`
  (maydon xatolari `details` ichiga, `message` = "So'rovda xatolik bor.").
- **Tavsif:** DRF `{"phone": ["Bu telefon band."]}` kabi xatolar `error.details` ga
  tushadi, lekin frontend uni hech qayerda o'qimaydi (`grep "setError"` → 0,
  `grep "error.details"` → 0). Foydalanuvchi umumiy toast ko'radi.
- **Ta'sir:** Forma xatolarida qaysi maydon noto'g'ri ekani ko'rinmaydi (CLAUDE.md 20
  "aniq va ayblovsiz" ga zid).
- **Yechim:** `extractApiError` yoniga `extractFieldErrors(error)` — `error.details` dan
  `{field: message}` qaytarib, react-hook-form `setError` bilan bog'lash.

### DC-001 — Kun yopish snapshot'i `confirm` dan keyin qayta hisoblanmaydi · O'rta

- **Manzil:** `apps/dayclose/services/close.py:146` (`confirm_day_close`),
  `_fill_snapshot` faqat `submit_day_close` da (`close.py:83`).
- **Tavsif:** `submit` paytida `cash_expected`/`cash_difference` hisoblanadi.
  `confirm_day_close` o'sha kunning `PENDING` xarajatlarini `day_close` ga bog'laydi
  (`close.py:173`), lekin `snapshot.py` `expense_approved_amount` faqat
  `status=APPROVED` ni hisoblaydi. Agar admin `submit` va `confirm` orasida xarajatni
  tasdiqlasa yoki `confirm` dan keyin tasdiqlasa — `cash_expected` eskirgan bo'ladi va
  saqlangan `cash_difference` hamyon jurnaliga mos kelmaydi.
- **Ta'sir:** "Kassa farqi" raqami xodim va admin ko'rgan holatga bog'liq; butunlik
  tekshiruvi (`check_integrity`) va 360° karta bilan ziddiyat.
- **Yechim:** `confirm_day_close` oxirida snapshot'ni qayta hisoblab saqlash; yoki
  `cash_expected` ni doim jurnaldan hosil qilib, denormalizatsiyani olib tashlash.
  Biznes qoidasi (tasdiqlanmagan xarajat `cash_expected` ga kiradimi?) — **aniqlashtirish
  kerak**.

### OFF-001 — Outbox backoff va "qotib qolgan" operatsiyalar · O'rta

- **Manzil:** `src/offline/outbox.ts:42-56` (`dueOps`, `backoffElapsed`).
- **Tavsif:** (1) `backoffElapsed` `op.created_at` dan hisoblaydi va oxirgi urinish
  vaqtini saqlamaydi; formula `Date.now() - created_at - wait*(attempts-1) > wait`
  kümülatif va noto'g'ri — real qayta urinish oralig'i kutilganidan farq qiladi.
  (2) `dueOps` `attempts < 20` ni filtrlaydi — 20 martadan keyin operatsiya `dueOps`
  dan tushib qoladi, lekin `pendingCount()` uni sanaydi va `retryFailed()` faqat
  `FAILED`/`CONFLICT` statusni tiklaydi (status hali `FAILED`, shuning uchun tiklanadi,
  lekin `attempts` 20 da qoladi → yana darhol tushadi). Alohida "20 urinish tugadi"
  UI holati yo'q.
- **Ta'sir:** Doimiy xato beradigan operatsiya "N kutmoqda" da abadiy osilib qoladi,
  foydalanuvchiga aniq harakat taklif qilinmaydi (CLAUDE.md 4.2/4.5).
- **Yechim:** `last_attempt_at` maydonini saqlash, backoff'ni undan hisoblash;
  `attempts >= 20` uchun `status: 'DEAD'` + Sinxronizatsiya ekranida alohida ko'rsatish
  va "Admin bilan bog'laning" / "O'chirish" tugmasi.

### ORM-001 — `assertNumQueries` qamrovi yo'q · O'rta

- **Manzil:** `backend/tests/`, `backend/apps/*/tests*` — `grep -rn "assertNumQueries"`
  → 0; `django_assert_num_queries` fixture ishlatilmaydi.
- **Tavsif:** `SaleViewSet` va boshqalar `select_related`/`prefetch_related` bilan
  yozilgan (yaxshi), lekin N+1 regressiyasini ushlaydigan test yo'q. `reports/services/`
  da ba'zi funksiyalar (`distributor.py` timeline, `aggregates.py`) sikl ichida
  agregatsiya qiladi.
- **Ta'sir:** Kelajakdagi serializer o'zgarishi jimgina N+1 kiritishi mumkin.
- **Yechim:** Asosiy ro'yxat endpointlari (`/sales/`, `/clients/`, `/day-close/`,
  `/reports/dashboard/`) uchun `django_assert_num_queries` testlari.

### DEP-001 — `react-router` 6.28 CVE'lari · O'rta

- **Manzil:** `frontend/package.json` — `react-router-dom ^6.28.1`.
- **Tavsif:** `npm audit` → 2 moderate:
  GHSA-wrjc-x8rr-h8h6 (`<Link>`/`useNavigate` da backslash orqali open redirect),
  GHSA-337j-9hxr-rhxg (SSR hydration'da konstruktor in'ektsiyasi — bu loyiha SSR
  ishlatmaydi, ta'sir past).
- **Ta'sir:** Open redirect — agar foydalanuvchi kiritgan qiymat `to=` ga tushsa.
  Kod bazasida `navigate(userInput)` topilmadi, shuning uchun amaliy ta'sir cheklangan.
- **Yechim:** `react-router-dom@7` ga yangilash (breaking) yoki 6.x patch versiyasini
  kuzatish; navigatsiya manzillari doim ichki konstantalardan ekanini tasdiqlash.

### CFG-002 — `local.py` da kreditsialli wildcard CORS · O'rta

- **Manzil:** `config/settings/local.py:27` — `CORS_ALLOW_ALL_ORIGINS = True`;
  `base.py:249` — `CORS_ALLOW_CREDENTIALS = True`.
- **Tavsif:** `local` — `deploy.md` da hujjatlashtirilgan `runserver` konfiguratsiyasi.
  `django-cors-headers` kreditsial bilan wildcard yubormaydi (origin'ni aks ettiradi),
  natijada **har qanday sayt** brauzer sessiyasidagi cookie/token bilan API'ga
  so'rov yubora oladi.
- **Ta'sir:** Faqat `local` profilida; developerning brauzeridagi boshqa sayt
  API'ga kredential bilan kira oladi.
- **Yechim:** `local.py` da ham aniq `CORS_ALLOWED_ORIGINS` ro'yxati (5173/5174).

### CALC-001 — Yaxlitlash rejimi mos emas · Past

- **Manzil:** `src/shared/lib/format.ts:64` (`money()` → `Math.round`),
  `apps/sales/models.py:133` (`SaleItem.compute()` — `quantize()` yo'q, DB maydoniga
  ishonadi → Django `ROUND_HALF_EVEN`).
- **Tavsif:** So'mda tiyin ishlatilmaydi, shuning uchun UI butun songacha yaxlitlaydi.
  Backend `DecimalField(decimal_places=2)` — `.50` saqlashi mumkin. `.5` chegara
  holatlarida UI (`Math.round`, yarim yuqoriga) va DB (`ROUND_HALF_EVEN`, juftga)
  farq qilishi mumkin — 1 so'm.
- **Ta'sir:** Amaliy jihatdan kichik (narxlar butun so'mda), lekin chegara test
  qoplanmagan.
- **Yechim:** Narxlarni butun so'mda majburlash (`DecimalField(decimal_places=0)` yoki
  serializer validatsiyasi) yoki `compute()` da aniq `quantize(Decimal("1"),
  ROUND_HALF_UP)` va frontendda bir xil qoidani hujjatlashtirish. Bosqich 4.5 bo'yicha
  bitta ma'lumot to'plami bilan backend+frontend testi.

### SEC-005 — `/health/` anonim, infra holatini ochadi · Past

- **Manzil:** `apps/core/views.py:29` (`permission_classes = [AllowAny]`),
  `?deep=1` — celery ishchisini ham tekshiradi.
- **Tavsif:** Anonim so'rov `db`, `redis`, `celery`, `disk` holatini qaytaradi.
- **Ta'sir:** Infratuzilma va'zi haqida ma'lumot (recon).
- **Yechim:** Sodda `200/503` (tafsilotsiz) anonimlar uchun; to'liq tafsilot faqat
  autentifikatsiyalangan admin/monitoring token uchun.

### SEC-006 — Webhook siri constant-time bo'lmagan solishtiruv · Past

- **Manzil:** `apps/telegram_bot/views.py:25` — `if secret != settings...`.
- **Yechim:** `secrets.compare_digest(secret, settings.TELEGRAM_WEBHOOK_SECRET)`.

### CFG-003 — Django admin standart manzilda · Past

- **Manzil:** `config/urls.py:34` — `path("admin/", admin.site.urls)`.
- **Yechim:** Admin URL'ni env orqali sozlanadigan tasodifiy prefiksga.

### CFG-004 — `dev.py` da `ALLOWED_HOSTS=['*']` · Past

- **Manzil:** `config/settings/dev.py:5`. `CFG-001` bilan birga xavfli (compose `dev`
  ishlatadi). `CFG-001` tuzatilsa ta'sir yo'qoladi.

### PERF-001 — Katta bundle bo'laklari · Past

- **Manzil:** `npm run build` — `DistributorCardPage-*.js` 458 KB (gzip 121 KB),
  `receiptPdf-*.js` 463 KB (jspdf, gzip 166 KB), `index-*.js` 416 KB. Jami precache
  ~1.7 MB. `companyCache.ts` bir vaqtda statik (`offline/sync.ts`) va dinamik
  (`ReceiptButtons.tsx`) import qilinadi → bo'lak ajralmaydi.
- **Yechim:** `DistributorCardPage` tablarini `lazy()`; `companyCache` importini
  bittalashtirish; jspdf allaqachon alohida bo'lakda (yaxshi).

---

## Bosqich bo'yicha izohlar

### Bosqich 1 — Settings

`prod.py` juda yaxshi yozilgan (HSTS, secure cookie, SSL redirect, Sentry). Yagona
muammo — **hech kim uni ishlatmaydi** (`CFG-001`). `.env` `.gitignore` da (✅),
`.env.example` da faqat `SECRET_KEY` placeholder (✅) — lekin Telegram tokeni haqiqiy
(`SEC-001`). `VITE_`/`REACT_APP_` env'da maxfiy kalit yo'q (✅). `tsconfig` `strict:true`
+ qo'shimcha qattiq bayroqlar (✅). ESLint toza (✅).

### Bosqich 2 — Modellar

Pul maydonlari hamma joyda `DecimalField(14,2)` (✅ — `_MONEY` konstantasi).
Append-only mixin + testi bor (✅). `Stock`/`VanStock` da `CheckConstraint` (✅).
`on_delete`: `Sale.distributor/client` = `PROTECT` (✅), `Debt.sale` = `CASCADE`
(sotuv bekor qilinganda qarz o'chadi — `cancel_sale` da `paid_amount>0` bo'lsa
bloklaydi, mantiqiy). Indekslar yaxshi qo'yilgan. Migration'lar toza.

### Bosqich 3 — DRF

`fields = '__all__'` topilmadi — hamma serializer aniq `fields` + `read_only_fields`
(✅). Hisoblanadigan maydonlar (`amount`, `profit`, `total_amount`) `read_only` (✅).
IDOR: distributor rolida `get_queryset()` `distributor=request.user` bilan filtrlaydi
(`SaleViewSet`, `SaleReturnViewSet`, `DebtPaymentViewSet`; `DebtViewSet` —
`client__route__distributor`), `get_object()` shu queryset'dan (✅). `perform_create`
`user` ni body'dan olmaydi (✅). `transaction.atomic()` + `select_for_update()` pul/
qoldiq o'zgarishlarida izchil (✅). Idempotentlik `client_uuid` unique bilan (✅).
Throttling `login` scope'da (✅).

### Bosqich 4 — Hisob-kitoblar

Backend `Decimal` intizomi kuchli: `_dec()` helper `Decimal(str(x))`, reports'da
`Coalesce(Sum(...), Value(0), output_field=DecimalField())`. `float(price)` yoki
`FloatField` **topilmadi** (✅). Kun yopish formulasi (`snapshot.py`) CLAUDE.md 6 ga
mos: `cash_expected = cash_sales + debt_collected − approved_expenses(CASH_ON_HAND)`,
`cash_difference = cash_handed − cash_expected`, `stock_difference = loaded − sold +
sale_returned − daily_returned`. Frontend `DayCloseWizard` `cash_expected` ni
**backenddan** oladi (takrorlanish yo'q — ✅). Mobil sotuv oqimida chegirma yo'q,
shuning uchun frontend `total = Σ qty×price` backend `Σ item.amount` ga teng.
Kamchiliklar: `DC-001` (snapshot staleness), `CALC-001` (yaxlitlash rejimi),
frontend hisob-kitob testlari yo'q (`TS-001`).

Buyurtma narxi saqlanadi: `SaleItem.price` + `cost_price` snapshot, `Debt.amount`
o'sha paytdagi qiymat (✅ — CLAUDE.md 4.4 kritik xato yo'q).

### Bosqich 5 — Xavfsizlik

Xom SQL / `pickle` / `yaml.load` / `eval` / SSRF **topilmadi** (✅). Fayl yuklash:
Pillow orqali qayta kodlash (JPEG), 15 MB limit → SVG/polyglot XSS yo'q (✅; kichik
kamchilik: `Image.MAX_IMAGE_PIXELS` decompression-bomb qo'riqchisi aniq emas).
Parol hash Django default, `AUTH_PASSWORD_VALIDATORS` yoqilgan (✅; `ChangePassword`
serializer'i `validate_password` chaqirmaydi — kichik). JWT sozlamalari oqilona,
lekin `BLACKLIST_AFTER_ROTATION=False` — logout haqiqiy bekor qilmaydi (SimpleJWT
stateless, hujjatlashtirilgan). Token `localStorage` da (`zustand/persist`) — XSS
bo'lsa o'g'irlanadi; `FE-001` bilan birga ko'rib chiqilsin. Asosiy muammolar:
`SEC-001..006`.

### Bosqich 6 — React + TypeScript

`any` / `@ts-ignore` **umuman yo'q** (✅✅ — juda yaxshi). `dangerouslySetInnerHTML`
yo'q (✅). `ProtectedRoute` bor, rol bo'yicha ham (✅). Axios interceptor 401 da bir
marta refresh, `refreshPromise` bilan single-flight, cheksiz sikl yo'q (✅). Backend
o'chiq holatida aniq xato matni (`extractApiError`) — oxirgi commit shu haqda (✅).
Kamchiliklar: `FE-001` (ErrorBoundary yo'q), `TS-001` (runtime validatsiya + testlar
yo'q), `UX-001` (maydon xatolari), `API-001` (tip drift). `console.log` da token
topilmadi (✅). Source map prod build'da yo'q (✅).

### Bosqich 7 — API kontrakti

Tiplar qo'lda, `snake_case` (backend) frontendda ham `snake_case` — konvertatsiya
yo'q, izchil (✅). `Decimal` → TS `string` sifatida to'g'ri tiplashtirilgan
(`amount: string`) (✅). `DateTimeField` → `string` (✅). Pagination
`{count, next, previous, results}` `DefaultPagination` da, frontend `.results` ni
o'qiydi (✅). Xato formati bitta (`{success:false, error}`), `extractApiError`
`!error.response` holatini ham qamraydi (✅). Kamchilik: `API-001`, va OpenAPI→TS
generatsiya oqimi qurilmagan (`TS-001` tavsiyasi).

### Bosqich 8 — Brauzerda real test

⏸️ **Bajarilmadi.** Sabab: audit muhitida PostgreSQL/Redis yo'q, `docker compose`
ishga tushirilmagan, Playwright o'rnatilmagan, backend to'liq bog'liqliklari (celery,
channels-redis, anthropic, opencv) qisman. `config.settings.local` (sqlite + locmem)
bilan backend'ni ko'tarib, `npm run dev` bilan frontendni ishga tushirish va
`@playwright/test` bilan smoke testlar yozish mumkin — bu `docs/FIXES.md` da alohida
vazifa (`E2E-001`) sifatida rejalashtirilgan.

Statik tahlildan brauzerga tegishli xavflar: `FE-001` (oq ekran), `UX-001` (forma
xatolari), `OFF-001` (offline navbat). Double-submit: mobil formalar `disabled={saving}`
/ `isPending` ishlatadi (✅ tekshirildi namunada).

### Bosqich 9 — Hisobot

Ushbu fayl + `docs/FIXES.md`.

---

## Muhit cheklovlari (shaffoflik uchun)

- Audit muhitida Django 6.0 (tizim) va 5.1.6 (loyiha, `--user`) yonma-yon; testlar
  5.1.6 bilan ishga tushirildi.
- `celery`, `channels-redis`, `anthropic`, `opencv-python-headless` audit uchun to'liq
  o'rnatilmadi — bu app'lar (`ocr`, `realtime` chuqur qismlari) faqat statik o'qildi.
- PostgreSQL yo'q → `assertNumQueries` / real DB xatti-harakati sinovdan o'tmadi;
  testlar sqlite'da (`:memory:`).
- Playwright / Lighthouse ishlatilmadi (Bosqich 8).
