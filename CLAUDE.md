# Claude Code uchun PROMPT — "Distribution & Sales Management System" (v3)

> **Foydalanish:** loyiha ildizida `CLAUDE.md` nomi bilan saqlang yoki Claude Code'ga to'liq bering.
>
> **v3 da o'zgargan:** bosqichlar **MVP → 2-faza → 3-faza** ga qayta taqsimlandi · offline **asosiy rejim** sifatida alohida arxitektura bo'limi · ma'lumot butunligi va o'zgarmas jurnal (immutable ledger) qoidalari · OCR uchun realistik sifat/narx o'lchovlari · "nazorat emas, ko'rish" tamoyili · backup 1-kundan · Telegram bot · pilot rejasi va qabul testlari (acceptance tests).

---

## 0. ROLE VA ASOSIY TAMOYILLAR

Sen tajribali **full-stack arxitektor va dasturchisan**. Quyidagi spetsifikatsiya asosida ishlab chiqarishga tayyor tizim yaratasan.

### 7 ta buzilmas tamoyil

1. **MVP birinchi.** Hamma narsani birdan qurma. `Yuklash → Sotuv → Kun yopish → Oddiy hisobot` — shu ishlab tursin. OCR, maosh avtomatikasi, 360° statistika keyin. Har bosqich **mustaqil ishlaydigan** mahsulot bo'lsin.
2. **Offline — qo'shimcha emas, asosiy rejim.** Tarqatuvchi podvalda, bozorda, tarifi tugagan telefonda ishlaydi. Har bir sotuv va xarajat avval **lokal bazaga** yoziladi, keyin serverga yuboriladi. Internet bor-yo'qligi ilova ishlashiga ta'sir qilmasin.
3. **Sotuv 30 soniyada tugasin.** Mijoz oldida, bir qo'lda, quyoshda. Har qo'shimcha tegish (tap) — daftarga qaytish ehtimoli. Sotuv oqimidagi qadamlarni sanab ko'r, 5 tadan oshsa — soddalashtir.
4. **Pul va tovar jurnali o'chirilmaydi.** `WalletTransaction`, `StockMovement`, `AuditLog` — faqat qo'shiladi (append-only). Xato bo'lsa tuzatuvchi yozuv qo'shiladi, o'chirilmaydi.
5. **Tizim nazorat quroli emas, ko'zoynak.** Limitlar va tekshiruvlar bor, lekin xodimni ayblovchi til ishlatilmaydi. Xodim o'z natijasini, maoshini, xarajatini ochiq ko'rib tursin — shunda ilovadan qochmaydi.
6. **AI ga 100% ishonilmaydi.** OCR natijasini doim inson tasdiqlaydi. Aniqlik va narx o'lchanadi.
7. **Ma'lumot yo'qolmaydi.** Backup 1-kundan, tiklash sinovdan o'tkazilgan.

### Ishlash tartibi
Har bosqich uchun: **qisqa reja → kod → migratsiya → testlar → qabul mezonlari (Definition of Done) → README yangilanishi → tasdiq so'rash.**
Ortiqcha abstraksiya qilma. Noaniqlik bo'lsa — taxmin qilma, **savol ber**.

---

## 1. BIZNES JARAYONI

Kompaniya zavodlardan **maishiy kimyo mahsulotlarini** (kir yuvish kukunlari/parashoklar, gellar, sovunlar, shampunlar, yuvish vositalari) **optom** oladi va tarqatuvchi agentlar orqali do'kon va bozorlarga yetkazadi.

```
0. TOVAR QABULI (2-faza)
   Zavod naklit (nakladnoy) bilan tovar keltiradi.
   Omborchi naklitni TELEFON KAMERASI bilan rasmga oladi.
   AI rasmni o'qiydi → tovar/miqdor/narx ajratiladi → xodim tekshiradi → tasdiqlaydi.
   MVP da bu qo'lda kiritish (tez kiritish formasi bilan).

1. ERTALAB — YUKLASH
   Ombordan tarqatuvchiga tovar beriladi.
   Tarqatuvchi mobil ilovada ko'radi va TASDIQLAYDI → VanStock (mashina qoldig'i).

2. KUN DAVOMIDA — SOTUV
   Marshrut bo'yicha do'konlarga boradi.
   Mijoz → tovar → miqdor → narx → to'lov turi (NAQD/PLASTIK/O'TKAZMA/QARZ/ARALASH).
   Qarzga berilsa — muddat bilan mijoz qarzdorligiga yoziladi.
   VanStock avtomatik kamayadi.

3. KUN DAVOMIDA — XARAJAT (2-faza)
   Yoqilg'i, tushlik, mashina yuvish, ta'mirlash, parkovka, aloqa va h.k.
   Chek rasmi biriktiriladi. Qo'lidagi pul kamayadi.

4. JONLI HAMYON (2-faza)
   naqd sotuv + undirilgan qarz − xarajat − topshirilgan = QO'LIMDA QOLGAN PUL
   Bu raqam mobil ilovada doim yuqorida turadi.

5. KECHQURUN — QAYTARISH VA KUN YOPISH
   Ostatka omborga qaytariladi (brak alohida).
   Yuklangan − Sotilgan − Qaytarilgan = TOVAR FARQI
   Kutilgan naqd − Topshirilgan naqd  = KASSA FARQI
   Kun yopiladi; keyin o'zgartirish faqat admin ruxsati bilan.

6. OYLIK — MAOSH (3-faza)
   Sotuvdan foiz + bonus − ushlanmalar (kamomad, kassa farqi, avans) ± xarajat qaytarimi.
```

---

## 2. ROLLAR

| Rol | Interfeys | Imkoniyatlar |
|---|---|---|
| **SUPER_ADMIN** | Desktop | Hammasi: sozlamalar, narx, foiz, xodimlar, moliya, tasdiqlashlar |
| **MANAGER** | Desktop | Yuklash, mijoz, tovar, hisobot, kun yopish. Narx/foiz o'zgartirmaydi |
| **WAREHOUSE** | Desktop/telefon | Kirim (naklit skan), yuklash, qaytarish qabuli, inventarizatsiya |
| **DISTRIBUTOR** | Mobil PWA | Yuklama, sotuv, mijozlar, qarz undirish, xarajat, hamyon, kun yopish, o'z maoshi |
| **ACCOUNTANT** | Desktop | Kassa, qarz, xarajat, maosh, eksport |

---

## 3. TEXNOLOGIYALAR

**Backend:** Python 3.12+, Django 5, DRF, **Django Channels 4** + Daphne, Redis (channel layer + cache + broker), Celery + Beat, PostgreSQL 16, SimpleJWT, django-filter, drf-spectacular, Pillow + opencv-python, **Anthropic API (Claude vision)** OCR uchun (fallback: Tesseract uz/ru), rapidfuzz, openpyxl + ReportLab, pytest + pytest-django + factory_boy.

**Frontend:** React 18 + **TypeScript (strict, `any` taqiqlanadi)**, Vite, TanStack Query, Zustand, React Router v6, React Hook Form + Zod, Tailwind + shadcn/ui, TanStack Table, Recharts, Axios (interceptor), react-use-websocket, **Dexie.js (IndexedDB)**, **vite-plugin-pwa** + Workbox, react-webcam, html5-qrcode, browser-image-compression, i18next (uz/ru/en).

**DevOps:** Docker + docker-compose (web, worker, beat, db, redis, nginx, minio), django-environ, Nginx (static/media/WS proxy), Sentry (xatoliklar), avtomatik backup.

---

## 4. OFFLINE-FIRST ARXITEKTURA (alohida, majburiy bo'lim)

> Bu **MVP ning bir qismi**, keyinga qoldirilmaydi. Ilova avval lokal bazaga yozadi, keyin sinxronlaydi.

### 4.1 Lokal baza (Dexie / IndexedDB)
```
products        — katalog nusxasi (rasm URL bilan)
clients         — marshrut mijozlari
van_stock       — mashina qoldig'i (lokal hisoblanadi)
expense_categories
outbox          — yuborilmagan operatsiyalar navbati  ← YADRO
media_queue     — yuborilmagan rasmlar (Blob)
meta            — oxirgi sinxronizatsiya vaqti, versiyalar
```

### 4.2 Outbox pattern
```
Har bir operatsiya (sotuv, xarajat, qarz to'lovi, tashrif, kun yopish):
  { id: uuid(v4), type, payload, created_at, attempts, status, error }

Statuslar: PENDING → SENDING → SENT | FAILED | CONFLICT

Qoidalar:
  - client_uuid FRONTENDDA generatsiya qilinadi va o'zgarmaydi
  - Server unique constraint bilan dublikatni rad etadi (idempotent)
  - Yuborish tartibi — yaratilgan vaqt bo'yicha (FIFO)
  - Xato bo'lsa: exponential backoff (5s, 15s, 60s, 5min...), max 20 urinish
  - 3 martadan ko'p muvaffaqiyatsiz bo'lsa — foydalanuvchiga ko'rsatiladi
```

### 4.3 Lokal hisob-kitob
- VanStock offline'da lokal kamayadi → tarqatuvchi qoldiqni doim to'g'ri ko'radi.
- Hamyon balansi offline'da lokal hisoblanadi.
- Sinxronizatsiyadan keyin server qiymati bilan solishtiriladi; farq bo'lsa — ogohlantirish va `reconcile` ekrani.

### 4.4 Konflikt boshqaruvi
| Vaziyat | Yechim |
|---|---|
| Serverda qoldiq yetmaydi | Sotuv `CONFLICT` — xodimga ro'yxat ko'rsatiladi, admin qaror qiladi |
| Narx o'zgargan | Sotuv **eski narx bilan** qabul qilinadi (`price_locked_at` bilan), flag qo'yiladi |
| Mijoz qarz limitidan oshib ketgan | Qabul qilinadi, `flagged=True` + adminga xabar |
| Dublikat `client_uuid` | Jimgina `200 OK` qaytariladi (idempotent) |

### 4.5 UI talablari
- Yuqorida doim status: `🟢 Online` · `🟡 Yuborilmoqda (3)` · `🔴 Offline · 7 ta kutmoqda`
- Sotuv saqlangach darhol "✅ Saqlandi" (server javobini kutmasdan)
- "Sinxronizatsiya" ekrani: navbat, xatolar, "Qayta urinish" tugmasi
- Katalog eskirsa (>24 soat) — ogohlantirish

### 4.6 Qabul testi (majburiy)
```
1. Aviarejimni yoq
2. 20 ta sotuv + 5 ta xarajat + 2 ta qarz to'lovi kirit
3. Ilovani to'liq yop va qayta och → hammasi joyida turishi kerak
4. Internetni yoq
5. Hammasi serverga tushishi, dublikat bo'lmasligi,
   qoldiq va hamyon balansi server bilan mos kelishi shart
```

---

## 5. MA'LUMOT BUTUNLIGI VA JURNALLAR (majburiy)

### 5.1 O'zgarmas jurnallar (append-only)
`StockMovement`, `WalletTransaction`, `AuditLog` — **hech qachon `UPDATE` yoki `DELETE` qilinmaydi.**
- Xato bo'lsa: `CORRECTION` turidagi yangi yozuv (sabab + kim + qachon).
- Modelda `save()` override: mavjud yozuvni o'zgartirishga urinish → `ValidationError`.
- Django admin'da bu modellar uchun `has_delete_permission = False`, `has_change_permission = False`.

### 5.2 Balans = jurnal yig'indisi
`DistributorWallet.balance` va `Stock.quantity` — denormalized tezlik uchun, lekin **haqiqat manbai jurnal**.

Har kecha Celery task (`check_integrity`):
```
for each wallet:   balance == SUM(WalletTransaction.amount) ?
for each stock:    quantity == SUM(StockMovement) ?
for each van_stock: quantity == loaded − sold − returned ?
Farq topilsa → adminga darhol xabar + hisobot + AuditLog
```
Qo'lda ishga tushirish: `python manage.py check_integrity --fix-dry-run`

### 5.3 Audit
Quyidagilar **majburiy** yoziladi: narx o'zgarishi, kun yopilgandan keyingi tahrir, xarajat tasdiqlash/rad etish, maosh tasdiqlash, foydalanuvchi bloklash, tovar o'chirish, qoldiq tuzatish.
Yozuvda: kim, qachon, nima, eski qiymat → yangi qiymat, IP, qurilma.

### 5.4 Sana va vaqt
- Barcha vaqtlar UTC saqlanadi, `Asia/Tashkent` da ko'rsatiladi.
- "Ish kuni" tushunchasi sozlamada (masalan 06:00 – 05:59) — kechki sotuvlar to'g'ri kunga tushishi uchun.
- Mobil qurilma soati noto'g'ri bo'lishi mumkin: server vaqti asos, `device_time` alohida saqlanadi (farq katta bo'lsa flag).

---

## 6. MODELLAR

Barcha modellarda: `id (UUID)`, `created_at`, `updated_at`, `created_by`, soft delete uchun `is_deleted`.
Marker: **[MVP]** · **[F2]** 2-faza · **[F3]** 3-faza.

### Foydalanuvchilar [MVP]
```
User (AbstractUser) — phone (unique, login), full_name, role, avatar,
  passport_series, address, hire_date, is_active, device_id, last_seen_at, warehouse
DistributorProfile (1-1) — route, vehicle_number, base_salary, commission_percent,
  monthly_plan, debt_limit, can_sell_below_price,
  daily_expense_limit [F2], expenses_covered_by: COMPANY|SALARY [F2]
```

### Katalog [MVP]
```
Category (parent self FK), Brand, Unit
Product — name, sku, barcode, category, brand, unit, image,
  cost_price, wholesale_price, retail_price, min_price,
  pack_quantity, commission_percent, min_stock_alert, is_active
ProductPrice — narx tarixi
ProductAlias [F2] — product, alias_text, supplier (OCR o'rganishi uchun)
```

### Ombor [MVP]
```
Warehouse, Supplier
Stock — warehouse, product, quantity, reserved_quantity [unique_together]
VanStock — distributor, product, quantity
StockMovement (append-only) — type: IN_PURCHASE|OUT_LOADING|IN_RETURN|OUT_SALE|
  ADJUSTMENT|WRITE_OFF|TRANSFER|CORRECTION, product, quantity,
  from_location, to_location, reference_type, reference_id, user, note
Purchase / PurchaseItem — supplier, invoice_number, date, total, paid, debt,
  source: MANUAL|SCAN, invoice_scan (FK) [F2]
Inventory / InventoryItem [F2]
```

### Naklit skanerlash [F2]
```
InvoiceScan — uploaded_by, warehouse, supplier, scan_type,
  status: UPLOADED|PROCESSING|NEEDS_REVIEW|CONFIRMED|FAILED,
  detected_invoice_number, detected_date, detected_total,
  raw_text, ai_response (JSON), confidence, provider (claude|tesseract),
  tokens_used, cost_usd, processing_time_ms, error_message, purchase (FK)
InvoiceScanPage — scan, image, processed_image, page_number
InvoiceScanLine — scan, line_number, raw_name, raw_quantity, raw_unit,
  raw_price, raw_amount, matched_product, match_confidence,
  match_status: EXACT|FUZZY|NEW|UNMATCHED,
  final_product, final_quantity, final_price, was_corrected (bool), is_confirmed
```

### Mijozlar [MVP]
```
Route — name, distributor, days_of_week
Client — name, owner_name, phone, phone2, address, latitude, longitude,
  route, client_type, debt_limit, current_debt, photo, inn, is_blocked, note
ClientVisit — distributor, client, checked_in_at, lat, lng,
  result: SOTUV|SOTUVSIZ|YOPIQ, photo
```

### Yuklash va sotuv [MVP]
```
Loading — number, date, distributor, warehouse,
  status: DRAFT|SENT|CONFIRMED|CLOSED, total_amount, confirmed_at
LoadingItem — product, quantity, price, amount
Sale — number, date, distributor, client, payment_type,
  total_amount, discount_amount, paid_amount, debt_amount, due_date,
  status, latitude, longitude, client_uuid (unique), is_synced,
  device_time, note, signature_image
SaleItem — product, quantity, price, cost_price, discount_percent, amount, profit
SaleReturn / SaleReturnItem — BRAK|MUDDAT|KELISHMOVCHILIK
```

### Xarajat [F2]
```
ExpenseCategory — name, icon, color, requires_receipt, daily_limit,
  paid_by: COMPANY|DISTRIBUTOR
DistributorExpense — distributor, date, category, amount, description,
  receipt_image, receipt_scan_data (JSON), latitude, longitude,
  payment_source: CASH_ON_HAND|OWN_MONEY|COMPANY_CARD,
  status: PENDING|APPROVED|REJECTED, approved_by, approved_at, reject_reason,
  is_deductible, day_close, client_uuid (unique), is_synced
FuelLog — expense (1-1), liters, price_per_liter, odometer, station_name
```

### Hamyon [F2]
```
DistributorWallet — distributor (1-1), balance, updated_at
WalletTransaction (append-only) — wallet, date, type:
  SALE_CASH(+) | DEBT_COLLECTED(+) | EXPENSE(−) | HANDOVER(−) |
  ADVANCE(+) | CORRECTION(±),
  amount, balance_after, reference_type, reference_id, note, created_by
```

### Kun yopish [MVP + F2 maydonlari]
```
DailyReturn / DailyReturnItem — condition: GOOD|DAMAGED|EXPIRED
CashHandover — distributor, date, amount, received_by, photo, note
DayClose — date, distributor, status: OPEN|PENDING|CLOSED
  [tovar]  loaded_amount, sold_amount, returned_amount,
           stock_difference_qty, stock_difference_amount
  [pul]    cash_sales_amount, debt_collected_amount,
           expense_amount [F2], expense_approved_amount [F2],
           cash_expected, cash_handed_amount, cash_difference,
           wallet_balance_end [F2]
  [boshqa] debt_given_amount, sales_count, visits_count, new_clients_count,
           closed_by, closed_at, note
```
**Formulalar (testda tekshirilsin):**
```
cash_expected    = cash_sales + debt_collected − approved_expenses(CASH_ON_HAND)
cash_difference  = cash_handed − cash_expected            (manfiy = kamomad)
stock_difference = loaded_qty − sold_qty − returned_qty
```

### Moliya [MVP: Debt, F2: qolgani]
```
Debt — client, sale, amount, paid_amount, remaining, due_date,
  status: ACTIVE|PARTIAL|PAID|OVERDUE
DebtPayment — debt, amount, payment_type, collected_by, date
CashTransaction, CompanyExpense [F2]
```

### Maosh [F3]
```
CommissionRule — scope: GLOBAL|CATEGORY|PRODUCT|DISTRIBUTOR, target_id,
  percent, valid_from, valid_to, priority
Payroll — distributor, period, total_sales, total_profit, commission_amount,
  base_salary, bonus, deduction_shortage, deduction_cash_diff,
  deduction_expense, reimbursement_expense, advance, final_amount,
  status: DRAFT|APPROVED|PAID
PayrollDetail — qaysi sotuvdan qancha foiz
Advance
```

### Tizim [MVP]
```
Notification — user, type, title, body, is_read, data (JSON)
AuditLog (append-only) — user, action, model_name, object_id, changes (JSON), ip, user_agent
Setting — key, value (JSON)
SyncLog [MVP] — device, user, operations_count, conflicts_count, duration_ms
```

---

## 7. BIZNES QOIDALARI

1. **Narx:** `price < product.min_price` → rad. `can_sell_below_price=True` bo'lsa sotiladi, lekin `flagged=True` + adminga real-time xabar.
2. **Qoldiq:** VanStock'dan ko'p sotilmaydi → `"Mashinada faqat X dona bor"`.
3. **Qarz limiti:** oshsa bloklanadi yoki admin ruxsati (offline'da — flag bilan qabul).
4. **Bloklangan mijoz:** faqat naqd.
5. **Xarajat limiti:** oshsa `PENDING` + admin xabari. `requires_receipt=True` → cheksiz saqlanmaydi.
6. **Hamyon:** balans manfiy bo'lsa ogohlantirish (`OWN_MONEY` dan tashqari).
7. **Kun yopilgach:** o'sha kun tahrirlanmaydi (faqat SUPER_ADMIN, sabab bilan, AuditLog'ga).
8. **Atomarlik:** `transaction.atomic()` + `select_for_update()`. Qoldiq manfiy bo'lmaydi.
9. **Idempotentlik:** `client_uuid` unique — dublikat rad etilmaydi, jimgina qabul qilinadi.
10. **Foyda:** har `SaleItem`da o'sha paytdagi `cost_price` saqlanadi.
11. **Kamomad:** avtomatik `Payroll.deduction`ga tushadi (sozlamada yoqilsa).
12. **Naklit dublikati:** `supplier + invoice_number` bo'yicha tekshiruv.
13. **Raqamlash:** `SOT-2026-00042`, `XRJ-2026-00113`, `YK-2026-00007`.

---

## 8. INSON OMILI — "NAZORAT EMAS, KO'ZOYNAK"

> Agar ilova ishonchsizlik quroliga aylansa, xodimlar uni chetlab o'tish yo'lini topadi. Balans muhim.

**Qilinsin:**
- Tarqatuvchi **o'z natijasini ochiq ko'rsin**: bugungi savdo, foiz, taxminiy maosh, reja progressi. Bu asosiy motivatsiya.
- Xatolik xabarlari **ayblovsiz** bo'lsin: `"Kassa farqi: 15 000 so'm. Izoh qoldiring"` — `"Siz 15 000 so'm kam topshirdingiz!"` emas.
- Kamomad bo'lsa — izoh yozish imkoniyati, darhol jarima emas.
- Xarajat rad etilsa — **sababi ko'rsatilsin**.
- GPS faqat ish vaqtida va tashrif/sotuv paytida yoziladi, kun bo'yi kuzatilmaydi. Buni sozlamalarda ochiq yozing.
- Reyting (kim ko'p sotdi) — ijobiy raqobat uchun, jarima uchun emas.

**Qilinmasin:**
- Yashirin kuzatuv, ekran surati, mikrofon.
- Xodim ko'ra olmaydigan "maxfiy ball".
- Har kichik farqda avtomatik jarima (avval inson ko'rib chiqsin).

---

## 9. OCR REALIZMI [F2]

### Ish oqimi
```
1) Kamera: ramka + edge detection + sifat tekshiruvi (xiralik, yorug'lik, burchak)
   Sifat past bo'lsa — yuborishdan OLDIN ogohlantirish
2) Frontendda siqish (max 1600px, JPEG q≈80)
3) Backend opencv: grayscale → deskew → perspective correction → kontrast → denoise
4) Celery task → Claude vision, qat'iy JSON prompt:
   {supplier, invoice_number, date, items:[{name, quantity, unit, price, amount}], total}
   Fallback: Tesseract (uz+ru) + qoidaviy jadval ajratish
5) rapidfuzz bilan katalogga moslashtirish:
   ProductAlias aniq moslik → EXACT
   o'xshashlik ≥85% → FUZZY (tasdiq so'raladi)
   topilmasa → NEW
6) NEEDS_REVIEW → chapda rasm (zoom/rotate), o'ngda tahrirlanadigan jadval.
   Past ishonchli katakchalar SARIQ.
7) Tasdiq → Purchase + PurchaseItem + Stock + StockMovement
   Har tuzatish ProductAlias sifatida saqlanadi (tizim o'rganadi)
```

### O'lchanishi shart bo'lgan metrikalar (dashboardda ko'rsatilsin)
```
line_accuracy      = to'g'ri chiqqan qatorlar / jami qatorlar
correction_rate    = tuzatilgan katakchalar ulushi
avg_cost_per_scan  = API xarajati (USD/so'm)
avg_time_to_confirm= skandan tasdiqgacha o'tgan vaqt
manual_fallback    = qo'lda kiritishga o'tilgan holatlar %
```
**Qaror qoidasi:** `line_accuracy < 85%` yoki `avg_time_to_confirm > qo'lda kiritish vaqti` bo'lsa — OCR foyda bermayapti. Bunday holda xodimga aniq alternativa: **"Qo'lda kiritish"** tugmasi doim ko'rinib tursin.

### Xarajat nazorati
- Har skan uchun `tokens_used` va `cost_usd` saqlanadi.
- Kunlik/oylik API limiti sozlamada, oshsa admin ogohlantiriladi.
- Bir xil rasm qayta yuborilsa (hash bo'yicha) — keshdan qaytariladi.

---

## 10. API (asosiy endpointlar)

`/api/v1/`, barcha listlarda pagination + filter + search + ordering.
Javob formati:
```json
{ "success": true, "data": {...} }
{ "success": false, "error": { "code": "INSUFFICIENT_STOCK", "message": "...", "details": {} } }
```

```
AUTH        /auth/login|refresh|logout|me|change-password

CATALOG     CRUD /products/ /categories/ /brands/ /units/
            GET  /products/{id}/stock/   /products/search/?q=
            GET  /sync/catalog/?since=   ← offline uchun delta yuklab olish [MVP]

WAREHOUSE   CRUD /warehouses/ /suppliers/ /purchases/
            GET  /stock/  /stock-movements/
            POST /inventory/  /inventory/{id}/apply/

OCR [F2]    POST /invoice-scans/            GET /invoice-scans/{id}/
            POST /invoice-scans/{id}/reprocess|confirm|cancel/
            PATCH /invoice-scans/{id}/lines/{lineId}/
            POST /receipt-scan/             GET /invoice-scans/metrics/

LOADING     GET/POST /loadings/   POST /loadings/{id}/send|confirm/
            GET  /loadings/my-today/

SALES       GET/POST /sales/      POST /sales/{id}/cancel/
            POST /sales/bulk-sync/   ← offline outbox [MVP]
            POST /sale-returns/

CLIENTS     CRUD /clients/   GET /clients/{id}/history|debts/
            POST /client-visits/   GET /sync/clients/?since=

VAN         GET /van-stock/my/   GET /van-stock/?distributor=

EXPENSES[F2] GET/POST /expenses/   GET /expenses/my|my-today/
            POST /expenses/{id}/approve|reject/   POST /expenses/bulk-sync/
            CRUD /expense-categories/   GET /expenses/summary/

WALLET [F2] GET /wallet/my/   GET /wallet/my/transactions/
            POST /cash-handovers/   POST /cash-handovers/{id}/confirm/

DAY CLOSE   POST /daily-returns/   POST /daily-returns/{id}/accept/
            GET  /day-close/my-today/   POST /day-close/submit/
            POST /day-close/{id}/confirm/   GET /day-close/?has_difference=true

FINANCE     GET /debts/   POST /debt-payments/
            CRUD /company-expenses/ /cash-transactions/

PAYROLL[F3] GET /payrolls/  POST /payrolls/calculate/
            POST /payrolls/{id}/approve|pay/   GET /payrolls/my/
            CRUD /commission-rules/ /advances/

REPORTS     GET /reports/dashboard/
            GET /reports/sales-summary/?group_by=day|distributor|product|client
            GET /reports/profit/ /debt-aging/ /expenses/
            GET /reports/distributor/{id}/full/?preset=today|week|month  ← 360° [F3]
            GET /reports/distributor/{id}/timeline/
            GET /reports/distributor-comparison/
            GET /reports/export/?type=&format=xlsx|pdf

SYSTEM      GET /notifications/  POST /notifications/{id}/read/
            GET /audit-logs/  GET/PATCH /settings/  GET /health/
```

### `/reports/distributor/{id}/full/` javobi [F3]
```json
{
  "distributor": {...}, "period": {...},
  "sales":    { "total_amount","total_profit","sales_count","avg_check","items_sold_qty",
                "cash_amount","card_amount","transfer_amount","debt_amount",
                "plan","plan_completion_percent","returns_amount" },
  "money":    { "cash_collected","debt_collected","expenses_total","handed_to_cashier",
                "wallet_balance","cash_differences_total","shortage_days_count" },
  "expenses": { "total","by_category":[...],"pending_count","rejected_amount",
                "fuel":{"liters","amount","avg_price","cost_per_sale_percent"} },
  "debts":    { "given_total","collected_total","outstanding_total",
                "overdue_amount","overdue_clients_count","collection_rate" },
  "clients":  { "visited_count","sold_to_count","new_clients","no_sale_visits","top_clients":[...] },
  "products": { "top_products":[...],"categories":[...] },
  "stock":    { "loaded_amount","returned_amount","damaged_amount","shortage_amount" },
  "payroll":  { "commission_earned","base_salary","bonus",
                "deductions":{...},"reimbursements","advances","estimated_total" },
  "charts":   { "daily_sales":[...],"payment_mix":[...],"hourly_activity":[...] },
  "timeline": [ { "date","loaded","sold","returned","cash","expense",
                  "handed","difference","status" } ]
}
```

---

## 11. REAL-TIME (Channels)

Guruhlar: `admin_dashboard`, `distributor_{id}`, `warehouse_{id}`. JWT bilan autentifikatsiya.

| Event | Kimga |
|---|---|
| `sale.created` / `sale.flagged` | admin |
| `expense.created` / `expense.limit_exceeded` [F2] | admin |
| `expense.approved` / `expense.rejected` [F2] | distributor |
| `wallet.updated` [F2] | distributor |
| `invoice_scan.completed` / `.failed` [F2] | uploader, warehouse |
| `loading.confirmed` | warehouse, admin |
| `stock.low` | warehouse, admin |
| `dayclose.submitted` / `cash.difference` | admin |
| `debt.overdue` | admin, distributor |
| `sync.conflict` | admin, distributor |
| `notification.new` | user |
| `dashboard.tick` (30 s) | admin |

Eventlar signal'dan emas, **service layer**dan: `services/realtime.py → broadcast(group, event, payload)`.
**Muhim:** WebSocket uzilsa ham ilova ishlashi kerak — real-time faqat qulaylik, funksional bog'liqlik emas.

---

## 12. MOBIL PWA (Tarqatuvchi)

Haqiqiy mobil ilovadek: bottom nav, tugmalar ≥48px, swipe, pull-to-refresh, skeleton, haptic, safe-area, "Add to Home Screen".

### Sotuv oqimi — 30 soniya qoidasi
```
Bosh sahifa → [+ Sotuv] → mijoz (marshrutdan, 1 tegish)
→ tovar (oxirgi sotilganlar yuqorida / barcode / qidiruv)
→ miqdor (katta +/− yoki tez tugmalar: 1, 5, 10, 12)
→ [Naqd] yoki [Qarz] (bitta tegish, standart narx avtomatik)
→ Saqlash ✅

Jami: 5-6 tegish. Narxni o'zgartirish — ixtiyoriy qo'shimcha qadam.
Optimizatsiya: shu mijozga oxirgi safar sotilgan tovarlar tayyor ro'yxat sifatida
("Oxirgi buyurtmani takrorlash" tugmasi).
```

### Ekranlar
1. **Login** — telefon + parol, keyingi kirishlar PIN bilan
2. **Bosh sahifa** — 👛 hamyon kartasi [F2], bugungi KPI (savdo, tashrif, xarajat, reja ring), tezkor tugmalar
3. **Mening yuklamam** — bugungi loading, tasdiqlash
4. **Mashina qoldig'i** — qidiruv, rasm, qolgan miqdor
5. **Marshrut / Mijozlar** — ro'yxat + xarita, GPS check-in
6. **Yangi sotuv** (yuqoridagi oqim) → chek → WhatsApp/Telegram
7. **Yangi xarajat** [F2] — ikonkali kategoriyalar, katta raqamli klaviatura, tez summalar, 📷 chek (AI summani to'ldiradi), yoqilg'i uchun litr/odometr
8. **Mening xarajatlarim** [F2] — ro'yxat, diagramma, status
9. **Hamyon** [F2] — balans + tranzaksiyalar, "Kassaga topshirish"
10. **Qarz undirish** — mijoz qarzlari, to'lov
11. **Kunni yopish** — 3 qadam: Tovar → Pul → Tasdiq (farqlar darhol ko'rinadi)
12. **Naklit skaner** [F2] — omborchi roli
13. **Mening hisobotim** — kun/hafta/oy: savdo, xarajat, foiz, taxminiy maosh
14. **Sinxronizatsiya** — navbat, xatolar, qayta urinish
15. **Profil / Sozlamalar** — til, tema, katalog yangilash, chiqish

---

## 13. DESKTOP ADMIN PANEL

Sidebar + header, TanStack Table (sort, filter, column visibility, sticky header, virtual scroll).

1. **Dashboard** (real-time) — KPI, grafiklar, jonli lenta, xaritada tarqatuvchilar
2. **Kirim / Naklit skanerlash** [F2] — navbat, tekshirish ekrani, OCR metrikalari
3. **Yuklash** — yaratish, tarix
4. **Sotuvlar** — jadval, filtr, detal, bekor qilish, eksport
5. **Mahsulotlar** — CRUD, narx, rasm, Excel import, aliaslar
6. **Ombor** — qoldiq, kirim, harakat jurnali, inventarizatsiya, kam qolganlar
7. **Mijozlar** — CRUD, marshrut, qarzdorlar, mijoz kartasi
8. **Qarzdorlik** — aging, muddati o'tganlar, to'lov, eslatma
9. **Xarajatlar** [F2] — jadval, chek rasmi, tasdiqlash/rad etish, diagramma, limitdan oshganlar
10. **Kunlik hisob-kitob** — kunlar, farqlar, tasdiqlash
11. **👥 Xodimlar → 360° karta** [F3] — *quyida*
12. **Maosh** [F3]
13. **Moliya** — kassa, kompaniya xarajatlari, foyda-zarar
14. **Hisobotlar** — konstruktor, Excel/PDF
15. **Sozlamalar** — foydalanuvchi, rol, foiz, xarajat kategoriyalari va limitlari, audit log
16. **Tizim salomatligi** — sinxronizatsiya xatolari, butunlik tekshiruvi natijasi, backup holati, OCR metrikalari

---

## 14. XODIM KARTASI — 360° STATISTIKA [F3]

**URL:** `/admin/distributors/{id}` · Yuqorida davr tanlagich: `Bugun · Kecha · Hafta · Oy · O'tgan oy · Kvartal · Yil · Ixtiyoriy`.

**A) Sarlavha:** rasm, F.I.SH, telefon, marshrut, ishga kirgan sana, foiz, onlayn holati, tugmalar (Qo'ng'iroq, Maosh, Excel).

**B) KPI kartalar** (har birida oldingi davr bilan solishtirish ▲▼):
```
Sotuv summasi │ Sof foyda │ Sotuvlar soni │ O'rtacha chek
Naqd yig'ildi │ Xarajat   │ Topshirildi   │ 👛 Qo'lida qolgan
Qarzga berdi  │ Qarz undirdi │ Qoldiq qarz │ Kamomad/Kassa farqi
Reja bajarilishi │ Tashriflar │ Yangi mijozlar │ Taxminiy maosh
```

**C) Tablar**
1. **Umumiy** — savdo/foyda/xarajat combo chart, to'lov turlari, soatlik faollik, reja-fakt
2. **💰 Pul harakati** — `Sana │ Naqd sotuv │ Qarz undirdi │ Xarajat │ Topshirdi │ Qoldi │ Farq │ Status`, farqli kunlar qizil, qatorga bosilsa detal
3. **🛒 Sotuvlar** — ro'yxat, filtr, eksport
4. **💸 Xarajatlar** — ro'yxat + diagramma, chek rasmi, shu yerdan tasdiqlash; yoqilg'i bloki (litr, o'rtacha narx, savdoga nisbatan %)
5. **🏪 Mijozlar** — TOP mijozlar, tashriflar, sotuvsiz tashriflar, yangilar, xarita
6. **📦 Mahsulotlar** — TOP mahsulot, kategoriya ulushi, qaytarilgan/brak
7. **💳 Qarzdorlik** — bergan/undirgan, muddati o'tganlar, undirish foizi
8. **📅 Kunlik jurnal** — har kun: yuklandi → sotildi → qaytdi → xarajat → topshirdi → farq
9. **💵 Maosh** — oylar bo'yicha: sotuv, foiz, bonus, ushlanmalar, qaytarimlar, yakuniy
10. **📄 Faollik** — hujjatlar, audit log

**D) Eksport:** butun karta yoki tab → Excel/PDF.
**E) Solishtirish:** bir nechta xodimni yonma-yon jadvalda + reyting.

---

## 15. TELEGRAM BOT [F2 — arzon va samarali]

Push-bildirishnomadan ko'ra ishonchli. Alohida `apps/telegram_bot` (aiogram yoki webhook + DRF).

**Boshliqqa:**
- Har kuni **20:00 da kunlik xulosa**: savdo, foyda, naqd, xarajat, qarz, kim qancha sotdi, farqi bor kunlar
- Darhol xabar: narxdan past sotuv, limitdan oshgan xarajat, katta kassa farqi, kam qolgan tovar
- Tugmalar: `Bugungi hisobot` · `Xodimlar` · `Qarzdorlar` · `Xarajatni tasdiqlash`

**Tarqatuvchiga:**
- Ertalab: bugungi yuklama tayyor
- Kechqurun: kun yopilmagan bo'lsa eslatma
- Xarajati tasdiqlangani/rad etilgani

Telegram akkaunt `User.telegram_chat_id` ga bir martalik kod orqali bog'lanadi.

---

## 16. BACKUP VA EKSPLUATATSIYA (1-kundan)

```
1. PostgreSQL: har kuni 02:00 da avtomatik dump (pg_dump, gzip)
   → boshqa serverga / S3-mos xotiraga yuboriladi
   → 30 kunlik saqlanish (7 kunlik kunlik + 4 haftalik)
2. Media (naklit va chek rasmlari): haftalik to'liq, kunlik inkremental
3. TIKLASH SINOVI: kamida bir marta amalda bajarilsin va hujjatlashtirilsin
   (`docs/restore.md` — necha daqiqada tiklanadi)
4. Monitoring: /health/ endpoint (db, redis, celery, disk),
   Sentry xatoliklar uchun, Celery navbat uzunligi nazorati
5. Loglar: 14 kun, JSON formatda
6. Xavfsizlik: access token 15 min + refresh rotation, rate limiting
   (ayniqsa OCR va login), CORS aniq domenlar, media fayllarga rolli kirish,
   .env git'da yo'q, HTTPS majburiy
```
Backup ishlamayotgani haqida **admin darhol xabar olsin** (jim yiqilish eng xavflisi).

---

## 17. BOSQICHLAR

> Har bosqich oxirida: qisqa xulosa → ishga tushirish buyruqlari → **qabul mezonlari tekshiruvi** → tasdiq so'rash.

### 🟢 MVP (maqsad: 3-4 hafta, 1-2 tarqatuvchi bilan ishlatish mumkin)

**1 — Poydevor.** Docker-compose (postgres, redis, minio), Django, custom User, JWT, `core` app (BaseModel, javob formati, exception handler, append-only mixin), Swagger, `/health/`, **backup skripti**. Frontend: Vite + TS + Tailwind + router + auth + axios interceptor.
*DoD:* `docker compose up` bilan ko'tariladi, login ishlaydi, backup cron yozilgan.

**2 — Katalog va ombor.** Product/Category/Brand/Unit CRUD, Stock, StockMovement (append-only), Supplier, Purchase (qo'lda, tez kiritish formasi), admin UI.
*DoD:* tovar kirim qilinadi, qoldiq to'g'ri, StockMovement o'chirilmaydi (test bor).

**3 — Mijoz va marshrut.** Client, Route CRUD, xarita, admin UI + mobil ro'yxat.

**4 — Yuklash va VanStock.** Loading → mobil tasdiqlash → VanStock. Atomik tranzaksiya + testlar.

**5 — Sotuv (yadro) + offline.** Sale/SaleItem, biznes qoidalari, **Dexie + outbox + bulk-sync**, mobil sotuv ekrani (30 soniya oqimi), chek.
*DoD:* **4.6-bo'limdagi offline qabul testi to'liq o'tadi.**

**6 — Kun yopish (soddalashtirilgan) va asosiy hisobotlar.** DailyReturn, CashHandover, DayClose (xarajatsiz formula), mobil 3 qadamli wizard, admin dashboard (asosiy KPI), sotuvlar jadvali, Excel eksport.
*DoD:* bir kun to'liq sikl: yuklash → sotuv → qaytarish → kun yopish → hisobot.

> ⏸ **PILOT:** shu yerda to'xtab, 1-2 tarqatuvchi bilan **2 hafta daftar bilan parallel** ishlating. Raqamlar mos kelsa — davom eting. Fikr-mulohaza asosida MVP ni sozlang.

### 🟡 2-FAZA

**7 — Xarajat va hamyon.** ExpenseCategory, DistributorExpense, chek rasmi, limit va tasdiqlash, DistributorWallet + WalletTransaction (append-only), mobil ekranlar, admin bo'limi, DayClose formulasini yangilash.
*DoD:* hamyon butunlik testi (`balance == SUM(transactions)`) o'tadi.

**8 — Real-time.** Channels, consumerlar, jonli dashboard, eventlar. WS uzilsa ilova ishlashda davom etadi.

**9 — Qarzdorlik va moliya.** Debt, DebtPayment, aging report, kassa, kompaniya xarajatlari, eslatmalar.

**10 — Telegram bot.** Kunlik hisobot, ogohlantirishlar, tasdiqlash tugmalari.

**11 — Naklit OCR.** InvoiceScan modellari, opencv tayyorlash, Claude vision + Tesseract fallback, fuzzy matching, tekshirish ekrani, ProductAlias o'rganishi, **metrikalar dashboardi**, qo'lda kiritishga qaytish yo'li.
*DoD:* 20 ta haqiqiy naklitda `line_accuracy` o'lchangan va hisobotda ko'rsatilgan.

### 🔵 3-FAZA

**12 — Maosh.** CommissionRule, avtomatik Payroll (ushlanma + qaytarim), tasdiqlash, mobil "Mening maoshim".

**13 — 360° xodim kartasi.** Optimallashtirilgan agregatsiya endpointi (keshli), barcha tablar, solishtirish, eksport.

**14 — Kengaytirilgan hisobotlar.** Konstruktor, ABC tahlil, foyda-zarar, PDF.

**15 — Butunlik va monitoring.** `check_integrity` Celery task, Tizim salomatligi sahifasi, Sentry, backup holati.

**16 — Yakuniy sayqal.** Performance (indekslar, N+1, keshlash), xavfsizlik audit, `seed_demo`, hujjatlar, deployment qo'llanmasi.

---

## 18. TESTLAR (majburiy qoplanadigan yo'llar)

```
✓ Narx limiti (min_price dan past sotish rad/flag)
✓ VanStock yetarliligi
✓ Qarz limiti
✓ Kun yopish formulasi (xarajatli va xarajatsiz)
✓ Hamyon balansi butunligi (balance == SUM(transactions))
✓ Append-only jurnalni o'zgartirishga urinish → xato
✓ Offline dublikat (bir xil client_uuid 5 marta → 1 ta yozuv)
✓ Konflikt: offline sotuv, serverda qoldiq yo'q
✓ Atomarlik: parallel 2 ta sotuv, qoldiq manfiy bo'lmasligi
✓ Maosh formulasi (ushlanma + qaytarim)
✓ OCR qator moslashtirish (mock AI javobi bilan)
✓ Rol ruxsatlari (tarqatuvchi boshqa xodim ma'lumotini ko'rmaydi)
```
Kritik yo'llarda coverage ≥70%. CI da testlar avtomatik ishlasin.

---

## 19. LOYIHA STRUKTURASI

```
backend/
  config/            settings(base/dev/prod), urls, asgi, celery
  apps/
    core/            BaseModel, AppendOnlyModel, permissions, pagination, exceptions
    users/  catalog/  warehouse/  clients/  sales/
    expenses/ [F2]  wallet/ [F2]  ocr/ [F2]  telegram_bot/ [F2]
    finance/  payroll/ [F3]  reports/  notifications/
  realtime/          consumers, routing, broadcast
  tests/
frontend/src/
  app/  features/  shared/  mobile/  admin/  offline/  locales/
docker/  docker-compose.yml  docs/(restore.md, deploy.md)  README.md
```

---

## 20. UI/UX

- **Til:** o'zbek (default) + rus + ingliz, `i18next`, hardcode yo'q
- **Valyuta:** `1 250 000 so'm` · **Sana:** `dd.MM.yyyy` · **Vaqt:** `HH:mm`
- **Tema:** light + dark
- **Ranglar:** asosiy indigo; kirim/muvaffaqiyat yashil; xarajat to'q sariq; xato/qarz qizil; kutilmoqda sariq
- **Xato matnlari:** o'zbekcha, aniq va ayblovsiz — `"Mashinada faqat 8 dona bor"`, `"Internet yo'q — saqlandi, keyin yuboriladi"`, `"Kunlik xarajat limitidan oshdi, tasdiq kutilmoqda"`
- **Empty state:** illyustratsiya + keyingi qadam tavsiyasi
- **Responsiv:** mobil <768px, planshet, desktop >1280px
- **Kirish qulayligi:** klaviatura navigatsiyasi, `aria-label`, kontrast AA

---

## 21. KELAJAK (arxitektura tayyor bo'lsin)

Bluetooth termal printer · B2B mijoz ilovasi · AI: sotuv prognozi, g'ayrioddiy xarajat aniqlash · ko'p filial · 1C integratsiya · marshrut optimizatsiyasi.

---

## 22. BOSHLASH

**1-bosqichdan** boshla. Har bosqich oxirida:
1. Nima qilinganini qisqa xulosa qil
2. Ishga tushirish buyruqlarini ko'rsat
3. **Qabul mezonlarini (DoD) tekshirib ko'rsat**
4. Keyingi bosqichga o'tishdan oldin tasdiq so'ra

**MVP (1-6 bosqich) tugagach to'xta va pilot uchun tavsiya ber.** 7-bosqichga faqat ruxsatdan keyin o't.

Noaniqlik bo'lsa — taxmin qilma, **aniq savol ber**.
