# Tuzatish rejasi — MeyFu audit (commit `34b4bb8`)

Manba: `docs/AUDIT_REPORT.md`. Audit AUDIT_PROMPT_REACT_TS_DJANGO.md Bosqich 0–9 bo'yicha.

## Qanday ishlatiladi

Vazifalarni yuqoridan pastga ketma-ket bajar. Bittasini tugatgach:
1. Testni ishga tushir (`Regressiya testi` qatoriga qara)
2. Checkboxni `[x]` qil
3. `Natija` ni to'ldir
4. Commit qil (`fix(ID): ...`)
5. Keyingisiga o't

**Tartib:** Kritik → Yuqori → O'rta → Past. Ichida: xavfsizlik → hisob-kitob → API
kontrakti → qolganlari.

**API kontraktiga tegadigan tuzatishda backend va frontendni bitta commitda** o'zgartir.

**To'xtash shartlari (so'ra va kut):** biznes qoidasi noaniq (`DC-001` — tasdiqlanmagan
xarajat `cash_expected` ga kiradimi?); migration production ma'lumotiga ta'sir qiladi;
tarix tozalash (`SEC-001`) — repo egalari bilan kelishilsin.

**Har 5 ta tuzatishdan keyin:** `pytest` + `tsc --noEmit` + `npm run build` +
`check --deploy` + Progress yangilash.

---

## 🔴 KRITIK

### [x] CFG-001 — Docker-compose ishlab chiqarishda `settings.dev` bilan ishlaydi
**Manzil:** `docker-compose.yml`, `config/asgi.py:5`, `config/wsgi.py:5`,
`config/celery.py:5`, `docker/entrypoint.sh`
**Muammo:** Yagona compose fayli `DJANGO_SETTINGS_MODULE: config.settings.dev` ni
qattiq belgilaydi; `prod.py` hech qayerda ishlatilmaydi. Natijada ishlab chiqarishda
`DEBUG=True`, `ALLOWED_HOSTS=['*']`, Browsable API, HSTS/secure cookie yo'q.
**Bajarildi:**
1. `docker-compose.yml` — endi ishlab chiqarish bazasi: `config.settings.prod`,
   `REQUIREMENTS=prod`, xavfsiz bo'lmagan `SECRET_KEY` standartisiz, `db`/`redis`/
   `minio` portlari xostga ochilmagan, manba bind-mount olib tashlandi.
2. `docker-compose.dev.yml` (yangi) — lokal override: `config.settings.dev`,
   `DEBUG=True`, bind-mount, ochiq portlar, standart maxfiy qiymatlar. **Avtomatik
   yuklanmaydi** (`.override.yml` emas — fail-safe) → `-f docker-compose.yml -f
   docker-compose.dev.yml` yoki `COMPOSE_FILE` env.
3. `config/asgi.py`, `wsgi.py`, `celery.py`, `manage.py` — `setdefault` endi
   `config.settings.prod` (fail-safe; lokal dev `--settings=config.settings.local`
   yoki dev skriptlari orqali).
4. `docker/entrypoint.sh` — har ishga tushishda
   `python manage.py check --deploy --fail-level ERROR` (o'chirish: `DEPLOY_CHECK=0`).
5. `docker/Dockerfile` — `ARG REQUIREMENTS=prod` (edi `dev`).
6. `.env.example` (yangi, repo ildizi) — prod compose uchun; `docs/deploy.md` va
   `README.md` ikkala oqim bilan yangilandi.
**Qabul mezoni:** ✅ `config.settings.prod` yuklanganda `DEBUG is False`,
`'*' not in ALLOWED_HOSTS`, `SESSION_COOKIE_SECURE/CSRF_COOKIE_SECURE/HSTS/SSL_REDIRECT`
yoqilgan; compose'da `config.settings.dev` yo'q; entrypoint check exit 0.
**Regressiya testi:** `backend/tests/test_deploy_config.py` — 7 test.
**Natija:** 236 pytest passed (edi 229 + 7 yangi); `manage.py check` (local) toza;
`makemigrations --check` toza; `check --deploy` (prod, to'g'ri env bilan) exit 0.
Docker CLI audit muhitida yo'q — compose YAML/anchor Python `yaml` bilan tekshirildi.
**Commit:** _(quyida)_

### [~] SEC-001 — Haqiqiy Telegram bot tokeni git'da
**Manzil:** `backend/.env.example:41`
**Muammo:** `.env.example` da haqiqiy Telegram bot tokeni — dastlabki commit `f9188ab`
dan beri **butun tarixda**. Faqat `backend/.env.example` da (tracked); `.py`/compose/
docs'da yo'q. `backend/.env` (git'siz, working tree) da ham bor — bu foydalanuvchining
lokal fayli.
**Bajarildi (kod tomoni):**
1. `backend/.env.example` → `TELEGRAM_BOT_TOKEN=` (bo'sh) + izoh.
2. `backend/tests/test_no_committed_secrets.py` (yangi) — barcha `*.env.example`
   fayllarni skanerlaydi: bekor qilingan token qatori, Telegram token shakli,
   `SECRET/TOKEN/PASSWORD/KEY` qatorlarida uzun (≥20) placeholder bo'lmagan qiymat.
3. `scripts/check-secrets.sh` (yangi) — pre-commit hook sifatida ishlatiladigan
   grep-skaner (Telegram token, AWS key, PEM, `.env.example` uzun qiymatlar).
4. `docs/security.md` — sizish qayd etildi + `git filter-repo` yo'riqnomasi.
**⚠️ FOYDALANUVCHI HARAKATI (kod bilan hal bo'lmaydi):**
- **@BotFather → `/revoke`** — eski tokenni bekor qiling. Yangi tokenni faqat
  serverdagi `backend/.env` ga. Lokal `backend/.env` dagi eski tokenni ham almashtiring.
- **Git tarixini `git filter-repo` bilan tozalash** (repo egalari kelishuvi bilan;
  `docs/security.md` da buyruq). Rewrite qilinmasa — `/revoke` yagona himoya.
**Qabul mezoni:** ✅ `.env.example` da token bo'sh; `test_no_committed_secrets.py`
o'tadi; `check-secrets.sh` toza. ⏳ Token bekor qilinishi + tarix tozalanishi —
foydalanuvchi zimmasida.
**Regressiya testi:** `backend/tests/test_no_committed_secrets.py` — 4 test.
**Natija:** 240 pytest passed (edi 236 + 4 yangi). Kod tomoni bajarildi; SEC-001
to'liq yopilishi uchun token `/revoke` + tarix rewrite kerak.
**Commit:** _(quyida)_

### [x] SEC-002 — Konteyner ma'lum parolli SUPER_ADMIN yaratadi
**Manzil:** `apps/users/management/commands/ensure_superuser.py`, `docker/entrypoint.sh`,
`apps/core/management/commands/seed_demo.py`
**Muammo:** Env berilmasa standart `+998900000000` / `Hasanali.0220` (repo va
hujjatlarda ochiq) bilan admin yaratilardi. `seed_demo` ham prod'da ishlab, o'sha
parolni o'rnatardi.
**Bajarildi:**
1. `ensure_superuser.py` — standart parol/telefon **olib tashlandi**. Ikkalasi bo'sh →
   no-op (idempotent). Faqat bittasi → `CommandError`. Parol Django
   `validate_password` dan o'tishi shart, aks holda `CommandError`.
2. `docker/entrypoint.sh` — `ensure_superuser || true` dan `|| true` olib tashlandi
   (noto'g'ri sozlama endi konteynerni to'xtatadi).
3. `seed_demo.py` — `DEBUG=False` bo'lsa `--force` talab qiladi (`CommandError`).
4. `backend/.env.example` — `DJANGO_SUPERUSER_*` qatorlari + ogohlantirish izohi
   (root `.env.example` CFG-001 da qo'shilgan). `docker-compose.dev.yml` dev
   qulayligi uchun `+998900000000` / `Hasanali.0220` ni saqlaydi (DEBUG=True).
5. `README.md`, `docs/security.md` — dev-only ekani aniqlashtirildi.
**Qabul mezoni:** ✅ env'siz `ensure_superuser` → no-op (user yaratilmaydi);
partial/weak env → `CommandError`; `seed_demo` prod'da `--force` siz `CommandError`.
**Regressiya testi:** `backend/tests/test_ensure_superuser.py` — 5 test.
**Natija:** 245 pytest passed (edi 240 + 5). `check` (local) toza; migratsiya toza.
**Commit:** _(quyida)_

---

## 🟠 YUQORI

### [ ] SEC-003 — `SECRET_KEY` xavfsiz bo'lmagan standart fallback
**Manzil:** `config/settings/base.py:24`, `docker-compose.yml`
**Bajarilishi kerak:**
1. `prod.py` ga: `SECRET_KEY = env("SECRET_KEY")` (fallbacksiz — yo'q bo'lsa
   `ImproperlyConfigured`). `base.py` dagi default faqat dev/local/test uchun qoladi.
2. `docker-compose.yml` — `SECRET_KEY: ${SECRET_KEY:?SECRET_KEY kerak}` (`:-default`
   o'rniga `:?`).
3. `.env.example` — `SECRET_KEY=` + izoh: `python -c "import secrets;print(secrets.token_urlsafe(64))"`.
**Qabul mezoni:** `SECRET_KEY` env'siz `prod` settings import → `ImproperlyConfigured`.
**Regressiya testi:** `test_settings_prod.py` ga qo'shimcha case.
**Natija:** _(to'ldiriladi)_ · **Commit:** _(to'ldiriladi)_

### [ ] SEC-004 — `TELEGRAM_WEBHOOK_SECRET` standart qiymati va ochiq webhook
**Manzil:** `config/settings/base.py:263`, `apps/telegram_bot/views.py:20-25`
**Bajarilishi kerak:**
1. `prod.py` — `TELEGRAM_WEBHOOK_SECRET = env("TELEGRAM_WEBHOOK_SECRET")` (bot yoqilgan
   bo'lsa majburiy; `TELEGRAM_BOT_TOKEN` bo'sh bo'lsa e'tibor bermaslik mumkin).
2. `TelegramWebhookView.post` — `secrets.compare_digest` (`SEC-006` bilan birga).
3. Telegram `set_telegram_webhook` da `secret_token=` yuborilsa,
   `X-Telegram-Bot-Api-Secret-Token` sarlavhasini ham tekshir.
**Qabul mezoni:** noto'g'ri sir bilan `POST /telegram/webhook/xxx/` → 404/403.
**Regressiya testi:** `apps/telegram_bot/tests/test_webhook.py` — noto'g'ri sir rad
etiladi; to'g'ri sir qabul qilinadi.
**Natija:** _(to'ldiriladi)_ · **Commit:** _(to'ldiriladi)_

### [ ] FE-001 — `ErrorBoundary` yo'q
**Manzil:** `src/app/providers.tsx`, `src/app/router.tsx`
**Bajarilishi kerak:**
1. `src/shared/components/ErrorBoundary.tsx` — class boundary, fallback UI
   ("Nimadir noto'g'ri ketdi" + "Qayta yuklash" tugmasi + `import.meta.env.DEV` da
   xato matni). i18n bilan.
2. `providers.tsx` da ildizni o'rab olish; `TanStack Query`
   `QueryErrorResetBoundary` bilan bog'lash.
3. Mobil va admin layout'lar ichida ham alohida boundary (bitta sahifa xatosi
   navigatsiyani o'ldirmasin).
4. (ixtiyoriy) Sentry `captureException` boundary'da.
**Qabul mezoni:** ataylab throw qiladigan test komponenti butun ilovani emas, faqat
o'z sohasini yiqitadi.
**Regressiya testi:** `src/shared/components/ErrorBoundary.test.tsx` (vitest —
`TS-001` bilan birga o'rnatiladi).
**Natija:** _(to'ldiriladi)_ · **Commit:** _(to'ldiriladi)_

### [ ] TS-001 — Runtime validatsiya + frontend testlari yo'q
**Manzil:** `src/shared/api/*`, `src/shared/types/*`, `package.json`
**Bajarilishi kerak:**
1. **Tip generatsiyasi:** `backend`: `python manage.py spectacular --file schema.yml`
   (CI qadami). `frontend`: `npx openapi-typescript schema.yml -o src/shared/types/api.gen.ts`
   + `package.json` skript `gen:api`. Qo'lda tiplarni asta-sekin generatsiyaga
   ko'chirish (`API-001` shu bilan hal bo'ladi).
2. **Kritik javoblar uchun `zod`:** login, `/sales/bulk-sync/` natijasi,
   `pullReferenceData` javoblari — `z.object(...).parse()` API qatlamida. Xato →
   `ErrorBoundary` yoki aniq toast.
3. **Vitest:** `vitest` + `@testing-library/react` o'rnatish; `package.json` `test`
   skripti; `npm run build` dan oldin CI'da.
4. Boshlang'ich testlar: `format.ts` (`money`, `qty`, `numberToWordsUz`),
   `offline/outbox.ts` (dedup, backoff — `OFF-001`), hisob-kitob (`CALC-001`).
**Qabul mezoni:** `npm test` yashil; `gen:api` schema bilan tiplar mos; kamida
`format` va `outbox` testlari bor.
**Regressiya testi:** o'zi test infratuzilmasi.
**Natija:** _(to'ldiriladi)_ · **Commit:** _(to'ldiriladi)_

---

## 🟡 O'RTA

### [ ] API-001 — `Sale` / `SaleItem` TS tiplari serializer bilan mos emas
**Manzil:** `src/shared/types/sales.ts` ↔ `apps/sales/serializers.py`
**Bajarilishi kerak (bitta commit — faqat frontend, backend o'zgarmaydi):**
1. `SaleItem` ga `discount_percent: string`.
2. `Sale` ga `order: string | null`, `order_number: string | null`,
   `latitude: string | null`, `longitude: string | null`, `client_uuid: string | null`,
   `is_synced: boolean`, `device_time: string | null`.
3. `TS-001` bajarilganda bu fayl generatsiyaga ko'chiriladi — vaqtincha qo'lda.
**Qabul mezoni:** `tsc --noEmit` toza; `SaleSerializer.Meta.fields` bilan
`keyof Sale` taqqoslash testi (yoki generatsiya).
**Regressiya testi:** `src/shared/types/sales.contract.test.ts` (generatsiyadan keyin
avtomatik).
**Natija:** _(to'ldiriladi)_ · **Commit:** _(to'ldiriladi)_

### [ ] UX-001 — Backend maydon xatolari formaga bog'lanmaydi
**Manzil:** `src/shared/api/client.ts`, formalar (`react-hook-form`)
**Bajarilishi kerak:**
1. `client.ts` ga `extractFieldErrors(error): Record<string,string>` —
   `error.response.data.error.details` dan `{field: message}` (DRF
   `{"field":["msg"]}` va nested holatlarni qamrab).
2. Umumiy `useApiForm` yordamchisi yoki har mutation `onError` da
   `Object.entries(fields).forEach(([k,v]) => setError(k, {message:v}))`.
3. Kamida: login, xodim yaratish (`StaffForm`), mahsulot (`ProductForm`),
   mijoz (`ClientForm`).
**Qabul mezoni:** band telefon bilan xodim yaratishda `phone` maydoni ostida xato
matni chiqadi (toast emas).
**Regressiya testi:** `StaffForm.test.tsx` — 400 javob mock, maydon xatosi ko'rinadi.
**Natija:** _(to'ldiriladi)_ · **Commit:** _(to'ldiriladi)_

### [ ] DC-001 — Kun yopish snapshot'i `confirm` dan keyin eskiradi
**Manzil:** `apps/dayclose/services/close.py:146` (`confirm_day_close`), `snapshot.py`
**⚠️ Avval biznes qoidasini tasdiqla:** tasdiqlanmagan (`PENDING`) xarajatlar
`cash_expected` hisobiga kiradimi? Hozirgi kod faqat `APPROVED + CASH_ON_HAND` ni
ayiradi. **Noaniq — so'ra.**
**Bajarilishi kerak (qoida tasdiqlangach):**
1. `confirm_day_close` oxirida `_fill_snapshot` ekvivalentini qayta chaqirib
   (`build_snapshot` bilan) `cash_expected`, `cash_difference`,
   `expense_approved_amount`, `expense_amount` ni yangilash va saqlash.
2. Yoki: `cash_expected` ni `@property` qilib jurnaldan hosil qilish, DB maydonini
   olib tashlash (append-only falsafasiga mos — CLAUDE.md 5.2).
3. `check_integrity` ga: har `CLOSED` `DayClose` uchun
   `cash_difference == cash_handed − (naqd sotuv + undirilgan qarz − tasdiqlangan
   naqd xarajat)` tekshiruvi.
**Qabul mezoni:** `submit` → admin xarajatni tasdiqlaydi → `confirm` ketma-ketligida
saqlangan `cash_difference` yakuniy holatga mos.
**Regressiya testi:** `apps/dayclose/tests/test_close_expense_timing.py` — xarajat
`submit` dan keyin tasdiqlansa `cash_difference` to'g'ri.
**Natija:** _(to'ldiriladi)_ · **Commit:** _(to'ldiriladi)_

### [ ] OFF-001 — Outbox backoff va "qotib qolgan" operatsiyalar
**Manzil:** `src/offline/outbox.ts`, `src/offline/db.ts` (`OutboxOp` tipi)
**Bajarilishi kerak:**
1. `OutboxOp` ga `last_attempt_at: number | null`; `applyResult` FAILED holatida
   `last_attempt_at = Date.now()`.
2. `backoffElapsed` ni `last_attempt_at` (yoki yo'q bo'lsa `created_at`) dan
   hisoblash: `Date.now() - (last_attempt_at ?? created_at) > delay`.
3. `attempts >= 20` → `status: 'DEAD'`; `pendingCount` DEAD ni sanamaydi;
   `retryFailed` DEAD'ni ham `attempts=0, status='PENDING'` ga tiklash imkoni
   (foydalanuvchi tugmasi bilan).
4. `SyncPage.tsx` / `SyncBadge.tsx` — DEAD operatsiyalar alohida ro'yxatda,
   "20 marta urinildi — tekshiring" + qayta urinish / o'chirish.
**Qabul mezoni:** doim 500 qaytaradigan mock operatsiya 20 urinishdan keyin DEAD
bo'lib, alohida UI'da ko'rinadi; badge "kutmoqda" da sanalmaydi.
**Regressiya testi:** `src/offline/outbox.test.ts` — backoff intervallari,
DEAD o'tish, dedup (bir `client_uuid` 5 marta → 1 yozuv).
**Natija:** _(to'ldiriladi)_ · **Commit:** _(to'ldiriladi)_

### [ ] ORM-001 — `assertNumQueries` qamrovi yo'q
**Manzil:** `backend/tests/`
**Bajarilishi kerak:**
1. `backend/tests/test_query_counts.py` — `django_assert_num_queries` bilan:
   `GET /sales/` (10 sotuv, har biri 3 qator), `GET /clients/`, `GET /day-close/`,
   `GET /reports/dashboard/`, `GET /van-stock/my/`.
2. Topilgan N+1 lar bo'lsa `select_related`/`prefetch_related` qo'shish.
3. `reports/services/distributor.py` timeline / `aggregates.py` sikllarini ko'rib
   chiqish (kunlik sikl ichida agregatsiya — `values().annotate()` ga o'tkazish).
**Qabul mezoni:** sanab o'tilgan endpointlar uchun so'rov soni ma'lumot hajmiga
bog'liq emas (konstanta).
**Regressiya testi:** `test_query_counts.py` o'zi.
**Natija:** _(to'ldiriladi)_ · **Commit:** _(to'ldiriladi)_

### [ ] DEP-001 — `react-router` CVE'lari
**Manzil:** `frontend/package.json`
**Bajarilishi kerak:**
1. `navigate(...)` / `<Navigate to=...>` / `to={...}` chaqiruvlarida foydalanuvchi
   kiritgan qiymat yo'qligini tasdiqlash (`grep`).
2. `react-router-dom@7` ga yangilash (breaking — `RouterProvider` API o'zgarishi
   minimal, `Routes`/`Route` qoladi) yoki 6.x xavfsiz patch chiqsa o'sha.
3. `npm audit` toza bo'lguncha.
**Qabul mezoni:** `npm audit --audit-level=moderate` → 0; `npm run build` + E2E toza.
**Regressiya testi:** router smoke testi (`TS-001` / `E2E-001`).
**Natija:** _(to'ldiriladi)_ · **Commit:** _(to'ldiriladi)_

### [ ] CFG-002 — `local.py` da kreditsialli wildcard CORS
**Manzil:** `config/settings/local.py:27`
**Bajarilishi kerak:** `CORS_ALLOW_ALL_ORIGINS = True` ni olib tashlab,
`CORS_ALLOWED_ORIGINS = ["http://localhost:5173","http://127.0.0.1:5173",
"http://localhost:5174"]`.
**Qabul mezoni:** `runserver` + `npm run dev` bilan frontend ishlaydi; boshqa origin'dan
kredential so'rov rad etiladi.
**Regressiya testi:** —
**Natija:** _(to'ldiriladi)_ · **Commit:** _(to'ldiriladi)_

---

## 🔵 PAST

### [ ] CALC-001 — Yaxlitlash rejimi mos emas
**Manzil:** `src/shared/lib/format.ts:64`, `apps/sales/models.py:133`
**Bajarilishi kerak:**
1. Biznes qoida: narxlar butun so'mda (tiyin yo'q) — `SaleLineInputSerializer.price`
   va `Product` narx maydonlariga `decimal_places=0` yoki validator
   (`value == value.quantize(Decimal("1"))`).
2. `SaleItem.compute()` da aniq `.quantize(Decimal("1"), ROUND_HALF_UP)` (agar butun
   so'm qoida qabul qilinsa).
3. `docs/` ga "pul yaxlitlash qoidasi" bir jumla.
**Qabul mezoni:** bir xil kirish (`3 × 12500.50`) uchun backend test va frontend test
bir xil natija (Bosqich 4.5).
**Regressiya testi:** `apps/sales/tests/test_pricing_rounding.py` +
`src/shared/lib/format.test.ts` (bir xil ma'lumot to'plami).
**Natija:** _(to'ldiriladi)_ · **Commit:** _(to'ldiriladi)_

### [ ] SEC-005 — `/health/` anonim infra oshkorligi
**Manzil:** `apps/core/views.py`
**Bajarilishi kerak:** anonimga faqat `{"success": bool}` + `200/503`; to'liq
tafsilot (`db/redis/celery/disk`) faqat autentifikatsiyalangan admin yoki
`X-Health-Token` bilan.
**Qabul mezoni:** anonim `GET /health/` → tafsilotsiz; admin → to'liq.
**Regressiya testi:** `apps/core/tests/test_health.py`.
**Natija:** _(to'ldiriladi)_ · **Commit:** _(to'ldiriladi)_

### [ ] SEC-006 — Webhook siri constant-time solishtiruv
**Manzil:** `apps/telegram_bot/views.py:25`
**Bajarilishi kerak:** `secrets.compare_digest(secret, settings.TELEGRAM_WEBHOOK_SECRET)`.
`SEC-004` bilan bitta commitda.
**Natija:** _(to'ldiriladi)_ · **Commit:** _(to'ldiriladi)_

### [ ] CFG-003 — Django admin standart `/admin/` manzilida
**Manzil:** `config/urls.py:34`
**Bajarilishi kerak:** `ADMIN_URL = env("ADMIN_URL", default="admin/")`,
`path(settings.ADMIN_URL, admin.site.urls)`. `.env.example` da izoh.
**Natija:** _(to'ldiriladi)_ · **Commit:** _(to'ldiriladi)_

### [ ] CFG-004 — `dev.py` da `ALLOWED_HOSTS=['*']`
**Manzil:** `config/settings/dev.py:5`
**Bajarilishi kerak:** `CFG-001` bajarilgach ta'sir yo'qoladi; baribir
`ALLOWED_HOSTS = ["localhost","127.0.0.1","web","0.0.0.0"]` ga tor.
**Natija:** _(to'ldiriladi)_ · **Commit:** _(to'ldiriladi)_

### [ ] PERF-001 — Katta bundle bo'laklari
**Manzil:** `src/admin/distributors/DistributorCardPage.tsx`,
`src/mobile/lib/companyCache.ts`, `vite.config.ts`
**Bajarilishi kerak:**
1. `DistributorCardPage` tablarini `React.lazy` + `Suspense`.
2. `companyCache` — `offline/sync.ts` dagi statik importni dinamik qilish yoki
   `ReceiptButtons` dagini statik qilish (bittalashtirish).
3. `manualChunks` ga `recharts` alohida.
**Qabul mezoni:** eng katta boshlang'ich chunk < 300 KB (gzip < 100 KB).
**Regressiya testi:** — (build chiqishi bilan tekshiriladi)
**Natija:** _(to'ldiriladi)_ · **Commit:** _(to'ldiriladi)_

### [ ] E2E-001 — Playwright smoke to'plami (Bosqich 8, audit'da bajarilmagan)
**Manzil:** `frontend/tests/e2e/` (yangi)
**Bajarilishi kerak:**
1. `npm i -D @playwright/test`; `playwright.config.ts` `webServer` bilan:
   backend `DJANGO_SETTINGS_MODULE=config.settings.local python manage.py runserver`
   (sqlite + `seed_demo`), frontend `npm run dev`.
2. Ssenariylar: login → mobil sotuv (30-soniya oqimi) → chek; CRUD (mahsulot);
   kun yopish sehrgar; IDOR (boshqa distributor sotuvini URL bilan ochish → 403/404);
   backend o'chiq holatida xato ekrani; sahifani yangilashda auth saqlanishi.
3. Har sahifada console xato/warning yig'ish; `UI summasi == API javobi` solishtiruv.
4. `docs/audit-screenshots/` ga xatolar.
**Qabul mezoni:** E2E to'plami yashil, konsol toza.
**Natija:** _(to'ldiriladi)_ · **Commit:** _(to'ldiriladi)_

---

## Progress

Kritik: 2.5/3 | Yuqori: 0/4 | O'rta: 0/7 | Past: 0/6
Oxirgi yangilanish: 2026-09-09 — CFG-001 ✅, SEC-002 ✅, SEC-001 kod tomoni ✅
(token `/revoke` + git tarix rewrite foydalanuvchi zimmasida). `fix/audit-stage-10` branch.

## Keyingi 3–5 tavsiya (audit yakuniy xulosasi)

1. **Deploy oqimini prod'ga qaratish** (`CFG-001`) — bu bitta o'zgarish 4 ta
   xavfsizlik topilmasining amaliy ta'sirini yo'qotadi. Undan oldin hech narsani
   "ishlab chiqarishga tayyor" deb hisoblamaslik.
2. **Sirlarni almashtirish** (`SEC-001`, `SEC-002`, `SEC-003`, `SEC-004`) — token
   bekor qilish, admin parol majburiyligi, `SECRET_KEY`/webhook sirini prod'da talab.
3. **Frontend sifat poydevori** (`TS-001`) — vitest + OpenAPI→TS generatsiya. Bu
   `API-001`, `CALC-001` frontend testi, `OFF-001` testi va kelajakdagi driftni
   bir yo'la yopadi.
4. **`ErrorBoundary`** (`FE-001`) — kichik, lekin "oq ekran" xavfini yo'qotadi.
5. **Bosqich 8 ni bajarish** (`E2E-001`) — audit muhitida imkonsiz edi; `local`
   settings bilan to'liq E2E mumkin va hisob-kitoblarni UI=API=DB bo'yicha tasdiqlaydi.

**Umumiy baho:** kod sifati yuqori — service layer izchil, `Decimal` intizomi kuchli,
append-only jurnallar, IDOR himoyasi, `strict` TS, `any` yo'q, 229 test o'tadi.
Asosiy xavf **kodda emas, deploy/konfiguratsiyada** (`prod.py` yozilgan lekin
ulanmagan) va **sirlarni boshqarishda**.
