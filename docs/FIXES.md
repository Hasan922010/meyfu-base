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

### [x] SEC-003 — `SECRET_KEY` xavfsiz bo'lmagan standart fallback
**Manzil:** `config/settings/base.py:24`, `config/settings/prod.py`
**Bajarildi:**
1. `prod.py` — `SECRET_KEY = env("SECRET_KEY")` (fallbacksiz). Qo'shimcha tekshiruv:
   bo'sh, ma'lum insecure qiymatlar (`insecure-*`, `change-me*`, `django-insecure-*`,
   base/test/dev standartlari) yoki <50 belgi → `ImproperlyConfigured`.
2. `base.py` fallback faqat dev/local/test uchun qoldi (o'zgarmagan).
3. `docker-compose.yml` — `${SECRET_KEY:-}` (bo'sh); loud failure endi `prod.py` da
   (compose `:?` dev override oqimini buzardi — CFG-001 ga qarang). Root `.env.example`
   da `SECRET_KEY=` + generatsiya izohi (CFG-001 da qo'shilgan).
**Qabul mezoni:** ✅ `SECRET_KEY` yo'q / bo'sh / insecure / qisqa → `prod` import
`ImproperlyConfigured`; kuchli kalit bilan yuklanadi; `check --deploy` — 0 security
ogohlantirishi.
**Regressiya testi:** `backend/tests/test_deploy_config.py::test_prod_rejects_weak_secret_key`
(6 parametr) + `test_prod_settings_are_hardened`.
**Natija:** 251 pytest passed (edi 245 + 6). `check --deploy` (prod, kuchli kalit
bilan) — 0 security ogohlantirishi, exit 0.
**Commit:** _(quyida)_

### [x] SEC-004 (+ SEC-006) — `TELEGRAM_WEBHOOK_SECRET` standarti va ochiq webhook
**Manzil:** `config/settings/base.py:263`, `apps/telegram_bot/views.py`,
`apps/telegram_bot/client.py`
**Bajarildi:**
1. `prod.py` — `TELEGRAM_BOT_TOKEN` berilgan bo'lsa `TELEGRAM_WEBHOOK_SECRET` majburiy:
   bo'sh / `"dev-webhook-secret"` / <16 belgi → `ImproperlyConfigured`.
2. `views.py` — `_secret_ok()`: `hmac.compare_digest` (constant-time — **SEC-006**);
   `X-Telegram-Bot-Api-Secret-Token` sarlavhasini ham qabul qiladi; kalit bo'sh bo'lsa
   **hamma so'rov rad etiladi** (bo'sh==bo'sh emas); ASCII bo'lmagan kalit → 403 (500 emas).
3. `client.py set_webhook` — kalit bo'lsa `secret_token` ni `setWebhook` ga yuboradi.
4. `.env.example` (backend + root) — kuchli sir generatsiya izohi.
**Qabul mezoni:** ✅ noto'g'ri/bo'sh/ASCIIsiz sir → 403; sarlavha bilan ham ishlaydi;
prod bot yoqilgan + kuchsiz sir → `ImproperlyConfigured`.
**Regressiya testi:** `tests/test_telegram.py` (webhook header/unset/non-ascii/
set_webhook) + `tests/test_deploy_config.py::test_prod_requires_strong_webhook_secret*`.
**Natija:** 258 pytest passed (edi 251 + 7). `check` toza; migratsiya toza.
**Commit:** _(quyida)_

### [x] FE-001 — `ErrorBoundary` yo'q
**Manzil:** `src/App.tsx`, `src/admin/AdminLayout.tsx`, `src/mobile/MobileLayout.tsx`
**Bajarildi:**
1. `src/shared/components/ErrorBoundary.tsx` (class) + `ErrorFallback.tsx` (funksional,
   i18n, `import.meta.env.DEV` da xato matni, "Qayta urinish" / "Bosh sahifa").
2. `App.tsx` — ildizni `<ErrorBoundary variant="screen">` bilan o'radi.
3. `AdminLayout` / `MobileLayout` — `<Outlet/>` atrofida
   `<ErrorBoundary key={location.pathname} variant="page">` — bitta sahifa xatosi
   navigatsiyani (sidebar/bottom-nav) o'ldirmaydi, `key` marshrut o'zgarganda
   boundary'ni tiklaydi.
4. i18n: `errorBoundary.*` kalitlari uz/ru/en ga qo'shildi.
5. `onError` prop — kelajakda Sentry `captureException` uchun ilgak (hozircha
   `console.error`).
**Qo'shimcha:** vitest + @testing-library o'rnatildi (`npm run test`) — `TS-001`
uchun ham asos.
**Qabul mezoni:** ✅ throw qiladigan bola faqat o'z sohasini yiqitadi; sibling
daraxt va navigatsiya ishlaydi; "Qayta urinish" tuzalgan bolani qayta render qiladi.
**Regressiya testi:** `src/shared/components/ErrorBoundary.test.tsx` — 4 test.
**Natija:** `npm run test` (4 passed) · `tsc -b` 0 xato · `npm run lint` 0 · `npm run build` OK.
**Commit:** _(quyida)_

### [x] TS-001 — Runtime validatsiya + frontend testlari yo'q
**Manzil:** `src/shared/api/*`, `src/shared/types/*`, `package.json`
**Bosqichma-bosqich:**
- [x] **3. Test infratuzilmasi** (FE-001 da) — `vitest@3` + `@testing-library/react@16`
  + `jsdom` + `fake-indexeddb`; `src/test/setup.ts`; `npm run test`.
- [x] **4a. Util testlari** — `src/shared/lib/format.test.ts` (10 test — `money`
  yaxlitlash `CALC-001` hujjatlashtirildi, `qty`, `numberToWordsUz`, `dateShort`),
  `src/offline/outbox.test.ts` (10 test — `enqueue` idempotent `client_uuid`,
  `applyResult` SENT/FAILED/CONFLICT, `pendingCount`/`failedCount`/`retryFailed`).
- [ ] **4b. Hisob-kitob testi** — `CALC-001` bilan birga (bir xil ma'lumot to'plami
  backend + frontend).
- [x] **1. Tip generatsiyasi** — `frontend` `npm run gen:api` (`manage.py spectacular`
  → `backend/schema.yml` → `openapi-typescript` → `src/shared/types/api.gen.ts`).
  Ikkala fayl commit qilingan; `api.gen.ts` eslint'dan chiqarildi. `tsc`/`lint`/
  `build` toza. Qo'lda tiplarni ko'chirish — `API-001` da.
- [x] **2. Kritik javoblar uchun `zod`** — `src/shared/lib/validate.ts`
  (`assertApiShape` + `ApiShapeError`), `src/shared/api/schemas.ts` (loose
  `.passthrough()` sxemalar). Ulandi: `auth.login`, `sync.pushOutbox`
  (`bulk-sync`), `sync.pullReferenceData` (katalog/mijoz/van). `extractApiError`
  endi oddiy `Error` xabarini ham ko'rsatadi.
- [ ] **4b. Hisob-kitob testi** → `CALC-001` bilan.
- Qolgan qo'lda tiplarni `api.gen.ts` ga ko'chirish → `API-001`.
**Qabul mezoni:** ✅ `npm test` yashil (31 test); `gen:api` ishlaydi; login/sync/
katalog javoblari runtime'da tekshiriladi (shakl buzilsa `ApiShapeError`).
**Natija:** 31 vitest passed · `tsc -b` / `lint` / `build` toza.
**Commit:** 4a `f473228` · gen `b11e907` · zod — _(quyida)_

---

## 🟡 O'RTA

### [x] API-001 — `Sale` / `SaleItem` TS tiplari serializer bilan mos emas
**Manzil:** `src/shared/types/sales.ts` ↔ `apps/sales/serializers.py`
**Bajarildi:** `sales.ts` endi `api.gen.ts` (`components['schemas']`) dan olinadi —
`PaymentType`/`SaleStatus`/`SaleItem`/`Sale`/`Debt`. Yetishmagan maydonlar
(`discount_percent`, `order`, `order_number`, `latitude`, `longitude`, `client_uuid`,
`is_synced`, `device_time`) endi bor. `order_number`/`sale_number` nullability
`Omit & {...}` bilan to'g'rilandi (drf-spectacular `default=None` ni nullable
belgilamaydi). Faqat frontend — backend o'zgarmadi.
**Qabul mezoni:** ✅ `tsc -b` toza; `sales.contract.test.ts` kompilyatsiyada
maydonlarni tekshiradi; `gen:api` eskirsa yoki serializer o'zgarsa tsc yiqiladi.
**Regressiya testi:** `src/shared/types/sales.contract.test.ts`.
**Natija:** 32 vitest passed · `tsc -b` / `lint` / `build` toza.
**Commit:** _(quyida)_

### [x] UX-001 — Backend maydon xatolari formaga bog'lanmaydi
**Manzil:** `src/shared/api/client.ts`, `src/shared/lib/formErrors.ts`, forma komponentlari
**Bajarildi:**
1. `client.ts` — `extractFieldErrors(error)` (DRF `{"field":["msg"]}` va nested'ni
   tekis yo'lga keltiradi). `extractApiError` endi maydon xatolarini o'qiladigan
   matnga aylantiradi (`Telefon: Bu raqam band` — umumiy "So'rovda xatolik bor" emas)
   → **barcha forma** avtomatik yaxshi xabar ko'radi.
2. `formErrors.ts` — `applyServerFieldErrors(err, setError, fieldMap)` (RHF `setError`
   ga bog'laydi; non_field_errors qaytariladi).
3. Ulandi: `StaffForm` (fieldMap bilan `p_` prefiksi/nested profil), `ProductForm`
   (`name`/`sku`), `ClientForm` (`name`/`phone`) — maydon ostida xato + umumiy blok
   `whitespace-pre-line`.
**Qabul mezoni:** ✅ band telefon bilan xodim yaratishda `phone` maydoni ostida
xato matni; qolgan formalar ham "maydon: sabab" ko'radi.
**Regressiya testi:** `src/shared/api/client.test.ts` — 5 test (`extractFieldErrors`
tekislash, `extractApiError` maydon xulosasi, `{detail}`, tarmoq).
**Natija:** 40 vitest passed · `tsc -b` / `lint` / `build` toza.
**Commit:** _(quyida)_

### [x] DC-001 — Kun yopish snapshot'i `confirm` dan keyin eskiradi
**Manzil:** `apps/dayclose/services/{snapshot,close}.py`, `apps/expenses/services.py`
**Biznes qoidasi (foydalanuvchi tasdiqladi):** `cash_expected` hisobida **rad
etilmagan barcha** qo'ldagi-naqd xarajatlar (PENDING ham) ayiriladi. Admin keyin
rad etsa — snapshot qayta hisoblanadi.
**Bajarildi:**
1. `snapshot.py` — `cash_expected = cash_sales + debt_collected −
   Σ(CASH_ON_HAND, ¬REJECTED)` (avval faqat `APPROVED` edi). `my-today` preview
   ham shu funksiyani ishlatadi → avtomatik izchil.
2. `close.py` — `refresh_day_close_snapshot()` (yangi) + `_apply_snapshot()` helper.
   `confirm_day_close` oxirida agregatlar qayta hisoblanadi (bog'langan xarajatlar /
   status o'zgarishlari). Yopilgan kun bo'lsa `AuditLog` (`dayclose.snapshot_refresh`).
   Jurnal (hamyon/qoldiq) ga ta'sir qilmaydi.
3. `expenses/services.py` — `approve_expense` / `reject_expense` oxirida o'sha
   kun+tarqatuvchi uchun `DayClose` bo'lsa `refresh_day_close_snapshot` chaqiriladi.
**Qabul mezoni:** ✅ PENDING naqd xarajat `my-today` `cash_expected` ni kamaytiradi;
yopilgan kundan keyin xarajat rad etilsa `cash_difference` qayta hisoblanadi
(kamomad ko'rinadi) + AuditLog.
**Regressiya testi:** `tests/test_dayclose.py` — `test_pending_cash_expense_reduces_expected_cash`,
`test_rejecting_expense_recomputes_closed_day`.
**Natija:** 260 pytest passed (258 + 2). Migratsiya yo'q (faqat mantiq). Frontend
`DayCloseWizard` o'zgarmadi (`cash_expected` ni backenddan oladi).
**Commit:** _(quyida)_

### [x] OFF-001 — Outbox backoff va "qotib qolgan" operatsiyalar
**Manzil:** `src/offline/{db,outbox,useSync,SyncBadge}.ts(x)`, `src/mobile/SyncPage.tsx`
**Bajarildi:**
1. `OutboxOp` ga `last_attempt_at: number | null` (indekssiz — Dexie migratsiyasi
   shart emas; eski yozuvlar `?? created_at` bilan ishlaydi).
2. `backoffElapsed` endi `Date.now() - (last_attempt_at ?? created_at) >= delay`
   (avval `created_at` dan kümülatif noto'g'ri formula). `markSending`
   `last_attempt_at` ni belgilaydi.
3. `MAX_ATTEMPTS = 20` → `applyResult` FAILED da yetganda `status: 'DEAD'`.
   `pendingCount` DEAD ni sanamaydi; `deadCount()` yangi; `retryFailed` DEAD'ni
   ham qamraydi va `attempts=0, last_attempt_at=null` ga tiklaydi; `deleteOp()` yangi.
4. `useSync` `dead` ni beradi; `SyncBadge` DEAD bo'lsa «N ta yuborilmadi» (qizil);
   `SyncPage` — ogohlantirish banneri + har DEAD op yonida «Navbatdan o'chirish».
**Qabul mezoni:** ✅ 20 marta FAILED → DEAD; `pendingCount`/badge sanamaydi;
`retryFailed`/`deleteOp` ishlaydi; backoff oxirgi urinishdan hisoblanadi.
**Regressiya testi:** `src/offline/outbox.test.ts` — 13 test (DEAD o'tish, deleteOp,
markSending, dedup, backoff maydonlari).
**Natija:** 35 vitest passed · `tsc -b` / `lint` / `build` toza.
**Commit:** _(quyida)_

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
3. `npm audit` toza bo'lguncha. **Eslatma:** FE-001 da `@vitest/mocker` moderate
   advisory ham qo'shildi (GHSA-82fw-gwwq-j7x9 — path traversal, faqat dev-tooling;
   vitest patch chiqsa yangilash).
**Qabul mezoni:** `npm audit --audit-level=moderate` → 0 (yoki faqat dev-only
qoldiqlar izohlangan); `npm run build` + E2E toza.
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

### [x] SEC-006 — Webhook siri constant-time solishtiruv
**Manzil:** `apps/telegram_bot/views.py`
**Bajarildi:** `SEC-004` bilan bitta commitda — `hmac.compare_digest` (`_ct_equal`).
**Commit:** SEC-004 bilan bir xil.

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

Kritik: 2.5/3 | Yuqori: 4/4 | O'rta: 4/7 | Past: 1/6
Oxirgi yangilanish: 2026-09-09 — CFG-001 ✅, SEC-001 (kod) ✅, SEC-002 ✅, SEC-003 ✅,
SEC-004 ✅, SEC-006 ✅, FE-001 ✅, TS-001 ✅. `fix/audit-stage-10` branch.
SEC-001 to'liq yopilishi: token `/revoke` + git tarix rewrite — foydalanuvchi zimmasida.
TS-001: 4b (hisob-kitob testi) → CALC-001; qo'lda tiplarni ko'chirish → API-001.

Backend: 258 pytest ✅ · `check` ✅ · `check --deploy` 0 security ✅
Frontend: 31 vitest ✅ · `tsc -b` ✅ · `lint` ✅ · `build` ✅ · `gen:api` ✅

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
