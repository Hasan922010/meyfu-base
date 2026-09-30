# Audit hisoboti №2 — MeyFu (2026-09-30)

Qamrov: oldingi audit (`f8108ef`, 2026-09-09) dan keyingi **140 commit** (v4/v5: filiallar,
ko'chirishlar, inventarizatsiya, boshlang'ich qoldiqlar, qaytarishlar, Telegram, xaritalar,
Bluetooth chop etish, sync log). Oldingi 22 topilma qayta ko'rilmadi (yopilgan).
Usul: baseline tekshiruvlar + 3 parallel sharh (xavfsizlik, Django to'g'riligi, React/TS) +
eng jiddiy topilmalarni kodda qo'lda tasdiqlash. Tasdiqlanmagan gumonlar — **SHUBHA**.

## 0. Baseline

| Tekshiruv | Natija |
|---|---|
| `manage.py check` | ✅ 0 |
| `makemigrations --check` | ✅ o'zgarish yo'q |
| `check --deploy` (prod env) | ✅ 0 xavfsizlik; 8 ta drf-spectacular sxema ogohlantirishi |
| `pytest` | ❌ **1 failed** — `test_debt_aging_report` (qat'iy sana, vaqt o'tib buzildi) → ✅ tuzatildi |
| `tsc -b` / `eslint` | ✅ 0 / 0 |
| `vitest` | ✅ 40 fayl, 191 test |
| `vite build` | ✅ (asosiy chunk 511 kB > 500 kB ogohlantirish) |
| `npm audit --omit=dev` | ✅ 0 |
| `pip-audit` | ⚠️ o'rnatilmagan — CI'da ham yo'q |

## 1. Xulosa

| Daraja | Soni | Asosiylari |
|---|---|---|
| KRITIK | 2 | Sync orqali manfiy miqdor → tovar "yaratish"; logout'da offline navbat boshqa foydalanuvchi nomidan yuboriladi |
| YUQORI | 12 | Chegirma cheklanmagan, Telegram kod brute-force → akkaunt egallash, XFF throttle aylanib o'tish, standart webhook siri, filial rahbari balans "bosadi", yopilgan kun qulfi yo'q, qaytarish ombor qoldig'ini shishiradi, kompaniya xarajati PATCH/DELETE kassa jurnalini buzadi, transfer PATCH poygasi, van qoldig'i ustidan yozish, tashrif outbox'siz |
| O'RTA | ~30 | Filiallararo yozish/o'qish, audit bo'shliqlari, integrity yangi jurnallarni qamramaydi, i18n, vaqt zonasi, a11y |
| PAST | ~15 | XLSX formula injection, import cheklovlari, parol validatsiyasi va b. |

## 2. KRITIK

| ID | Joy | Muammo | Stsenariy |
|---|---|---|---|
| SEC-101 | `apps/sales/services/sync.py:79-95`, `sale.py:175,277` | `bulk-sync` payload `JSONField` — miqdor/narx validatsiyasiz. `quantity=-50` qoldiq tekshiruvidan o'tadi, `van_apply(-(-50))` mashinaga +50 qo'shadi | Tarqatuvchi o'ziga tovar "yaratib", sotib pulni oladi. Xarajat/qarz to'lovi `amount` ham xuddi shunday |
| FE-101 | `shared/store/authStore.ts:26`, `offline/outbox.ts` | Logout faqat tokenni o'chiradi: Dexie (mijozlar, qarzlar, outbox), React Query keshi, `receive-draft` qoladi | Umumiy telefonda B kirsa, A ning yuborilmagan sotuvlari **B tokeni bilan** yuboriladi → pul/qoldiq B ga yoziladi |

## 3. YUQORI

| ID | Joy | Muammo |
|---|---|---|
| SEC-102 | `sales/serializers.py:70-73,84-86`, `sale.py:149` | `discount_percent`/`discount_amount` chegarasiz; min narx chegirmadan **oldin** tekshiriladi → 99.99% chegirma bilan min narx qoidasi chetlab o'tiladi; manfiy summa → manfiy hamyon krediti |
| SEC-103 | `telegram_bot/services/webhook.py:80,105` | 6 xonali bog'lash kodi, urinishlar cheklanmagan → istalgan akkauntga chat bog'lanadi → parol tiklash kodi hujumchiga boradi |
| SEC-104 | `config/settings/base.py:205`, `docker/nginx/nginx.conf:28,37` | `NUM_PROXIES` yo'q + nginx `$proxy_add_x_forwarded_for` → har so'rovda boshqa XFF bilan login/reset throttle aylanib o'tiladi |
| SEC-105 | `telegram_bot/client.py:45-53`, `base.py:278` | Bazadagi sir bo'sh bo'lsa `"dev-webhook-secret"` ga tushadi; prod faqat env token bo'lsa tekshiradi → soxta callback bilan xarajat tasdiqlash |
| SEC-106 | `config/settings/replit.py:11-22` | `DEBUG=False` da ham ma'lum SECRET_KEY standarti, `ALLOWED_HOSTS=["*"]` (konfiguratsiyaga bog'liq) |
| SEC-107 | `users/serializers.py:59-63,108-120,140-143` | BRANCH_MANAGER xodim yaratishda ixtiyoriy `opening_balance` (hamyon krediti) va `commission_percent`/`base_salary`ni yozadi — spetsifikatsiya: faqat SUPER_ADMIN |
| BE-101 | `sales/services/sale.py`, `expenses/services.py`, `sync.py` | Spets. 7.7 — yopilgan kun qulfi hech qayerda yo'q; offline sotuv qurilma sanasi bilan yopilgan kunga tushadi |
| BE-102 | `dayclose/services/close.py:33-90,197-215,287-297` | Qaytarish miqdori VanStock bilan solishtirilmaydi; `_settle_van` `max(0,…)` bilan jim qirqadi, ombor esa to'liq oladi → soxta qoldiq |
| BE-103 | `finance/views.py:150-153` | `CompanyExpense` PATCH/DELETE — `CashTransaction` va kassa balansi o'zgarmaydi, audit yo'q → P&L va kassa ajraladi |
| BE-105 | `warehouse/views.py:412-447`, `serializers.py:568-576` | Transfer PATCH qulfsiz: parallel `send` dan keyin SENT → DRAFT ga qaytadi → ikki marta jo'natish/ikki marta ayirish (vaqt — SHUBHA) |
| FE-102 | `offline/sync.ts:122-127` | `pullVanStock` lokal qoldiqni server qiymati bilan almashtiradi — yuborilmagan sotuvlar hisobga olinmaydi → ortiqcha sotuv |
| FE-103 | `mobile/CheckInSheet.tsx:22-45` | Tashrif outbox'ni chetlab o'tadi (offline'da ishlamaydi), `client_uuid` har urinishda yangi → dublikat |

## 4. O'RTA

**Xavfsizlik / filial izolyatsiyasi**
- SEC-108 `sync.py:272-300` — `order_fulfill` istalgan buyurtmaga (tayinlash/filial tekshiruvisiz).
- SEC-109 `sales/views.py:105,257,297`, `sync.py` — mijoz/qarz filial bo'yicha tekshirilmaydi; boshqa filial qarziga to'lov yig'ish mumkin.
- SEC-111 `warehouse/views.py` — Purchase/Loading PATCH orqali `warehouse`/`distributor` boshqa filialga o'zgartiriladi.
- SEC-112 `ocr/views.py:156-169` — `update_line` `get_object()`siz; tasdiqlangan skan ham tahrirlanadi.
- SEC-113 `orders/views.py:241-265` — `for_loading`/`build_loading` filial doirasisiz.
- SEC-114 `payroll/views.py:133-138` — `calculate` filial tekshiruvisiz.
- SEC-115 `warehouse/views.py:139-148,283-289`, `core/views.py:83-131` — ta'minotchilar, integrity, OCR metrikalari filial foydalanuvchilariga global.
- SEC-116 `realtime/consumers.py:30-33` — `admin_dashboard` WS guruhi filiallararo ma'lumot tarqatadi.
- SEC-117 `docker/nginx/nginx.conf:15-18`, `docker-compose.yml:104` — media (cheklar, naklitlar, imzolar) autentifikatsiyasiz ochiq; MinIO bucket butunlay `anonymous download`.
- SEC-110 `catalog/views.py:77-96` — `cost_price`/`commission_percent` tarqatuvchiga ham ko'rinadi.
- FE-109 `shared/lib/pinLock.ts`, `MobileLayout.tsx` — PIN qulfi faqat `<Outlet/>` ni yopadi; sarlavha/bildirishnomalar ko'rinadi; urinish hisoblagichi `localStorage` da.
- FE-110 `shared/realtime/useEventStream.ts:39` — WS `?token=<JWT>` URL'da; backend'dagi ticket endpoint ishlatilmaydi.

**Ma'lumot butunligi / biznes mantiq**
- BE-104 `catalog/views.py` — narx PATCH SUPER_ADMIN bilan cheklangan (✅), lekin **audit va `ProductPrice` tarixi yozilmaydi**; mahsulot o'chirish audit qilinmaydi.
- BE-106 `core/services/integrity.py:86-147` — filial kassalari, ta'minotchi balansi, `Client.current_debt` tekshirilmaydi.
- BE-108 — `Model.objects.get(pk=…)` → 500; `IntegrityError` (parallel `client_uuid`) → 500 o'rniga 200 bo'lishi kerak.
- BE-109 `dayclose/services/close.py:33-46` — kun yopishda idempotentlik yo'q.
- BE-110 `warehouse/services/transfers.py:113-118` — transfer kamomadi hech qaysi jurnalga yozilmaydi.
- BE-111 `sales/services/sale.py:346-372` — `resolve_conflict` audit qilinmaydi.
- BE-112 — mijoz bloklash/limit, bitta boshlang'ich qoldiq endpointlari, ombor o'chirish audit qilinmaydi.
- BE-113 `reports/views.py:71-88` — sana oralig'i cheklanmagan (1C eksport OOM).
- BE-114 `reports/services/branch.py:79-87,266` — ish kuni (06:00) o'rniga kalendar sana.
- BE-115 `sale.py:172-186` — bir mahsulot ikki qatorda bo'lsa tekshiruv qatorma-qator.

**Frontend**
- FE-104 — yangi ekranlarning deyarli barchasida matn hardcode (i18n faqat ~11 faylda) — spets. 20.
- FE-105 `offline/sync.ts:151-172` — butun batch xatosi `attempts`ni oshirmaydi → abadiy qayta urinish, ogohlantirishsiz.
- FE-106 `offline/outbox.ts:115-122` — doimiy biznes xatolari 20 marta qayta uriniladi; `min_price` mobil'da tekshirilmaydi.
- FE-107 — `X-Device-Id` sarlavhasi yuborilmaydi → Sync log "Qurilma" ustuni doim bo'sh.
- FE-108 — `SyncLogPage`, `AuditLogPage` va b. da `timeZone: 'Asia/Tashkent'` yo'q.
- FE-111 `InventoryEditor.tsx:44-63` — saqlash paytida kiritilgan qiymatlar o'chib ketadi.
- FE-112 `TransferReceiveForm.tsx:20-27` — `"1,5"` → NaN validatsiyadan o'tadi.
- FE-113 — a11y: bosiladigan qatorlar klaviaturasiz, `‹ ›` tugmalarida `aria-label` yo'q, placeholder-only inputlar, Modal'da focus trap yo'q.

## 5. PAST

- SEC-118 `reports/export.py:18` — XLSX formula injection (`=`, `+`, `-`, `@`).
- SEC-119 `catalog/services/product_import.py:89-127` — bo'sh qatorlar cheklovsiz aylanadi.
- SEC-120 `users/serializers.py:181-203` — reset/change parolda `validate_password` yo'q; parol almashganda refresh tokenlar bekor qilinmaydi.
- SEC-121 `webhook.py:88,92,146` — filialsiz BRANCH_MANAGER botda butun kompaniyani ko'radi.
- SEC-122 — MANAGER yangi mahsulotni ixtiyoriy narx bilan yaratadi (spets. talqiniga bog'liq).
- SEC-123 — `client_uuid` bo'lsa onlayn REST'da ham `requires_receipt` chetlab o'tiladi.
- BE-116..121 — transfer ID ro'yxati bilan katta `IN (...)`, reorder yo'ldagi tovarni hisoblamaydi, Telegram kod to'qnashuvi, kun yopish pulini joriy filialga yuborish, backfill migratsiyalar batch'siz.
- FE-114..117 — Dexie operatsiyasi atomar emas, lokal saqlash xatosi ko'rsatilmaydi, butun son miqdor, xarita offline'da bo'sh.

## 6. Arxitektura / infratuzilma

| ID | Muammo |
|---|---|
| ARCH-101 | Testlarda ~48 ta qat'iy sana — vaqt o'tishi bilan buziladigan testlar (bittasi allaqachon buzilgan edi) |
| ARCH-102 | CI: `npm run build`, `check --deploy`, `pip-audit`/`npm audit`, Playwright E2E ishlamaydi |
| ARCH-103 | Asosiy JS chunk 511 kB (> 500 kB) |
| ARCH-104 | `reports/services/distributor.py` — 805 qator (800 chegarasi) |
| ARCH-105 | drf-spectacular: `TelegramBotConfigView` sxemadan tushib qolgan, enum nom to'qnashuvlari → generatsiya qilingan tiplar noaniq |

## 7. Tuzatish tartibi

1. KRITIK: SEC-101 (+SEC-102), FE-101
2. YUQORI: SEC-103, SEC-104, SEC-105, SEC-107, BE-103, BE-102, BE-105, FE-102, FE-103, BE-101, SEC-106
3. O'RTA: filial izolyatsiyasi (SEC-108..116), audit/integrity (BE-104, 106, 108, 111, 112), frontend (FE-105..108, 111..113)
4. PAST va arxitektura

Tuzatish holati — ushbu faylning 8-bo'limida.

## 8. Tuzatish holati

| ID | Holat | Commit |
|---|---|---|
| ARCH-101 (1 test) | ✅ `test_debt_aging_report` nisbiy sana | — |
