# Claude Code uchun PROMPT — v4 QO'SHIMCHA (Buyurtma oqimi · Ikki bosqichli maosh · Mahsulot rasmlari · Nakladnoy & chek PDF)

> **Bu fayl `CLAUDE.md` (v3) ni to'ldiradi, bekor qilmaydi.** v3 dagi 7 ta buzilmas tamoyil,
> offline-first arxitektura, append-only jurnallar, "nazorat emas — ko'zoynak" tamoyili va
> bosqichli ishlash tartibi kuchda qoladi. Bu yerda faqat **v4 da qo'shiladigan 4 ta talab**
> va ularning aniq texnik yechimi bayon qilingan.
>
> **Ishlash tartibi (v3 §0 dagidek):** har bosqich uchun
> `qisqa reja → kod → migratsiya → testlar → DoD tekshiruvi → README/i18n → tasdiq so'rash`.
> Noaniqlik bo'lsa — taxmin qilma, **savol ber**.

---

## 0. TALABLAR (mijoz so'zi bilan) VA QABUL QILINGAN QARORLAR

| # | Talab | Qaror (mijoz tasdiqladi) |
|---|---|---|
| **T1** | Xodim va tarqatuvchilarga haq: **zakaz olgani uchun alohida foiz** + **yetkazib bergani uchun alohida foiz**, har bajarilgan ishga qarab to'planib boradi. **Alohida (qo'lda) ish haqi belgilash** imkoni saqlansin. | **Alohida Buyurtma → Yetkazish oqimi** (yangi `Order` entity). Foizlar **faqat `DistributorProfile`** da (`order_commission_percent`, `delivery_commission_percent`). Mavjud `commission_percent` — legacy fallback. Qo'lda ish haqi = `base_salary` + `bonus` + `set_manual_fields` (o'zgarishsiz). |
| **T2** | Tovarga **rasm(lar) qo'yish** — adashib ketmaslik uchun. | Bir nechta rasm: yangi `ProductImage` modeli (galereya). `Product.image` — asosiy rasmning nusxasi (backward compat). |
| **T3** | **Nakladnoyda tovar rasmlari bilan + Pechat (muhr)** berish imkoni. | Kompaniya rekvizitlari + **muhr rasmi (PNG, shaffof fon)** `CompanySettings` (singleton) da. Server PDF (ReportLab): tovar rasm eskizlari + rekvizit + muhr. `?stamp=1|0` bilan "Pechat bilan / Pechatsiz". |
| **T4** | **Mobil versiyada chekni PDF qilib saqlab, mijozga berish** imkoni. | PDF **mobil klientda** (offline) yaratiladi — `jspdf`. Kompaniya profili + muhr base64 Dexie'da keshlanadi. Web Share API bilan ulashish, fallback — yuklab olish. |

---

## 1. T1 — BUYURTMA (ORDER) OQIMI VA IKKI BOSQICHLI MAOSH

### 1.1 Biznes jarayoni (v3 §1 ga qo'shimcha)

```
YANGI (ixtiyoriy) bosqich — ZAKAZ YIG'ISH
  Order-taker (agent / menejer / tarqatuvchining o'zi) mijoz oldida yoki telefonda
  buyurtma yozadi: mijoz → tovar → miqdor → kelishilgan narx → to'lov niyati → yetkazish sanasi.
  Order.status: DRAFT → PLACED → APPROVED

  APPROVED buyurtmalar omborga ko'rinadi → ombor bir tarqatuvchiga Loading'ga yig'adi
  Order.status: APPROVED → LOADED

  Tarqatuvchi yetkazadi → har buyurtma uchun haqiqiy yetkazilgan miqdorni tasdiqlaydi
  → SHU YERDA Sale yaratiladi (Sale.order = shu buyurtma), VanStock kamayadi
  Order.status: LOADED → DELIVERED | PARTIALLY_DELIVERED | CANCELLED
```

**To'g'ridan-to'g'ri sotuv (hozirgidek) saqlanadi:** `Order`siz `Sale` — tarqatuvchi ham
zakaz oluvchi, ham yetkazuvchi hisoblanadi.

### 1.2 Maosh mantiqi

Har **yetkazilgan** `SaleItem` uchun ikkita komissiya hisoblanadi:

```
order_taker  = Sale.order.taken_by   (Order bo'lsa)   yoki   Sale.distributor  (to'g'ridan-to'g'ri)
deliverer    = Sale.distributor

order_commission    = SaleItem.amount × profile(order_taker).order_commission_percent   / 100
delivery_commission = SaleItem.amount × profile(deliverer).delivery_commission_percent  / 100
```

- Faqat **haqiqatda sotilgan/yetkazilgan** miqdorga to'lanadi (bekor qilingan buyurtmaga yo'q).
- `order_taker` va `deliverer` bir odam bo'lsa — u ikkala komissiyani ham oladi.
- Profil topilmasa yoki foiz 0 bo'lsa — Setting fallback:
  `payroll.default_order_commission`, `payroll.default_delivery_commission` (default 0).
- Legacy: `*_commission_percent` ikkalasi 0 va `commission_percent > 0` bo'lsa —
  eski mantiq (bitta foiz, faqat `deliverer` ga), migratsiyani buzmaslik uchun.

### 1.3 Model o'zgarishlari

**`apps/users/models.py` → `DistributorProfile`:**
```python
order_commission_percent    = DecimalField(max_digits=5, decimal_places=2, default=0)  # "zakaz foizi"
delivery_commission_percent = DecimalField(max_digits=5, decimal_places=2, default=0)  # "yetkazish foizi"
# commission_percent — o'zgarishsiz qoladi (legacy fallback)
```

**Yangi app: `apps/orders/`** (`config.settings.base.LOCAL_APPS` ga qo'sh, `apps.sales` dan keyin):

```
Order (BaseModel)
  number            CharField unique blank   # "ZAK-2026-00042"
  date              DateField
  client            FK clients.Client PROTECT
  taken_by          FK users.User PROTECT  related_name="orders_taken"   # zakaz oluvchi
  assigned_to       FK users.User SET_NULL null  related_name="orders_to_deliver"  # yetkazuvchi (ombor biriktiradi)
  loading           FK warehouse.Loading SET_NULL null related_name="orders"
  status            CharField choices=OrderStatus  default=DRAFT  db_index
  payment_intent    CharField choices=sales.PaymentType  blank      # niyat, majburiy emas
  desired_date      DateField null blank
  total_amount      Decimal default 0
  note              CharField(500) blank
  client_uuid       UUIDField unique null blank    # offline idempotent (v3 §4.2)
  device_time       DateTimeField null blank
  cancelled_at / cancel_reason

OrderItem (BaseModel)
  order       FK Order CASCADE related_name="items"
  product     FK catalog.Product PROTECT
  quantity          Decimal  (buyurtma qilingan)
  delivered_quantity Decimal default 0   (yetkazishda to'ldiriladi)
  price       Decimal
  amount      Decimal default 0
```

`OrderStatus` (`apps/orders/constants.py`):
`DRAFT, PLACED, APPROVED, LOADED, DELIVERED, PARTIALLY_DELIVERED, CANCELLED`.

**`apps/sales/models.py` → `Sale`:**
```python
order = models.ForeignKey(
    "orders.Order", on_delete=models.SET_NULL, null=True, blank=True,
    related_name="sales", verbose_name=_("buyurtma"),
)
```
`Sale.distributor` = **yetkazuvchi** (semantik o'zgarmaydi).
Helper: `Sale.order_taker` → `self.order.taken_by if self.order_id else self.distributor`.

**`apps/payroll/models.py` → `PayrollDetail`:**
```python
role        = CharField(choices=CommissionRole)   # ORDER | DELIVERY
beneficiary = FK users.User SET_NULL null related_name="+"   # kimga (default: payroll.distributor)
# mavjud maydonlar saqlanadi; `scope` legacy uchun qoladi
```
`CommissionRole` (`apps/payroll/constants.py`): `ORDER = "ORDER"`, `DELIVERY = "DELIVERY"`.

**`apps/payroll/models.py` → `Payroll`:** ikkita ko'rinadigan maydon qo'sh (hisobot uchun):
```python
order_commission_amount    = Decimal default 0
delivery_commission_amount = Decimal default 0
# commission_amount = order_commission_amount + delivery_commission_amount  (yig'indi, formula o'zgarmaydi)
```

### 1.4 Service layer

**`apps/orders/services/order.py`:**
- `create_order(...)` — idempotent (`client_uuid`), narx/qoldiq tekshiruvi **yumshoq**
  (buyurtma — va'da, qoldiq keyin bo'lishi mumkin), `ZAK` raqami (`DocumentSequence`).
- `place_order`, `approve_order`, `cancel_order` — status o'tishlari + `AuditLog` + realtime event.
- `assign_to_loading(order, loading)` / `attach_orders_to_loading(...)` — `APPROVED → LOADED`.
- `fulfill_order(order, delivered_lines, distributor, ...)`:
  - `OrderItem.delivered_quantity` to'ldiradi,
  - mavjud `sales.services.create_sale(...)` ni `order=order` bilan chaqiradi (VanStock, Debt,
    Wallet — hammasi hozirgidek ishlaydi),
  - `status = DELIVERED` (to'liq) yoki `PARTIALLY_DELIVERED`.
  - Atomik (`transaction.atomic` + `select_for_update`).

**`apps/payroll/services/commission.py`:** yangi funksiya
```python
def resolve_two_stage(*, user, on_date) -> tuple[Decimal, Decimal]:
    """(order_percent, delivery_percent) — profil → Setting fallback → legacy."""
```
`resolve_commission` (eski) — OCR/testlar uchun qoladi, lekin `_commission_rows` endi
`resolve_two_stage` ishlatadi.

**`apps/payroll/services/payroll.py` → `_commission_rows` qayta yoziladi:**
```
Bir davr, bir `distributor` (D) uchun:
  DELIVERY: Sale.distributor == D bo'lgan barcha SaleItem'lar
            → delivery_commission (profile(D).delivery_commission_percent)
  ORDER:    Sale.order_taker == D bo'lgan barcha SaleItem'lar
            → order_commission (profile(D).order_commission_percent)
  Har biriga alohida PayrollDetail(role=..., beneficiary=D).
  payroll.order_commission_amount / delivery_commission_amount / commission_amount to'ldiriladi.
```
`total_sales` / `total_profit` — **faqat DELIVERY** bo'yicha (ikki marta sanamaslik uchun;
zakaz oluvchining "sotuvi" emas).

### 1.5 API (`/api/v1/`)

```
ORDERS   GET/POST /orders/                       filter: status, client, taken_by, assigned_to, date
         GET      /orders/{id}/
         POST     /orders/{id}/place|approve|cancel/
         POST     /orders/{id}/fulfill/          body: {lines:[{item_id, delivered_quantity, price?}], ...}
         POST     /orders/bulk-sync/             offline outbox (v3 §4.2) — type: "order.create"
         GET      /orders/my-to-take/            order-taker: bugun yozganlarim
         GET      /orders/my-to-deliver/         distributor: menga biriktirilgan APPROVED/LOADED
         GET      /orders/for-loading/?distributor=   ombor: yig'ish uchun APPROVED

LOADING  POST /loadings/from-orders/             body: {distributor, warehouse, order_ids:[...]}

PAYROLL  GET /payrolls/{id}/  javobiga:
         order_commission_amount, delivery_commission_amount,
         details:[{role, beneficiary, sale_item, percent, base_amount, commission_amount}]
```

Rol ruxsatlari (v3 §2, §18): order-taker faqat o'zi olgan buyurtmalarni,
distributor faqat o'ziga biriktirilganini ko'radi; SUPER_ADMIN/MANAGER — hammasi.

### 1.6 Realtime eventlar (v3 §11)

| Event | Kimga |
|---|---|
| `order.placed` | admin, ombor |
| `order.approved` | taken_by, ombor |
| `order.loaded` | assigned_to (distributor) |
| `order.delivered` / `order.partially_delivered` | admin, taken_by |

### 1.7 Testlar (v3 §18 ga qo'shimcha)

```
✓ Order idempotent (bir xil client_uuid 5× → 1 ta Order)
✓ fulfill_order → Sale yaratiladi, Sale.order to'g'ri, VanStock kamayadi
✓ Qisman yetkazish → PARTIALLY_DELIVERED, delivered_quantity to'g'ri
✓ Maosh: order_taker ≠ deliverer → har biriga to'g'ri foiz, ikkita PayrollDetail
✓ Maosh: order_taker == deliverer → bitta odam ikkala komissiyani oladi
✓ Legacy: yangi foizlar 0, commission_percent > 0 → eski xulq
✓ payroll_matches_formula (order+delivery bilan)
✓ Bekor qilingan buyurtma → komissiya yo'q
✓ Rol: order-taker boshqa agentning buyurtmasini ko'rmaydi
```

### 1.8 DoD (v4-1)
- `docker compose up` → migratsiyalar toza qo'llanadi.
- To'liq sikl test: `Order yoz → tasdiqla → Loading'ga yig' → yetkaz → Sale → Payroll hisobla`
  va `payroll.order_commission_amount + delivery_commission_amount == commission_amount`.
- Barcha yangi + mavjud payroll testlari yashil. Coverage (payroll+orders) ≥ 70%.

---

## 2. T2 — MAHSULOT RASMLARI (GALEREYA)

### 2.1 Model — `apps/catalog/models.py`
```python
class ProductImage(BaseModel):
    product    = FK Product CASCADE related_name="images"
    image      = ImageField(upload_to="products/gallery/")
    sort_order = PositiveIntegerField(default=0)
    is_primary = BooleanField(default=False)

    class Meta:
        ordering = ("sort_order", "created_at")
        constraints = [UniqueConstraint(fields=["product"], condition=Q(is_primary=True),
                                        name="uniq_primary_image_per_product")]
```
- `save()` / signal: `is_primary=True` bo'lganda `Product.image` ni shu faylga tenglashtirish
  (backward compat — hozirgi kod `product.image` ishlatadi).
- Birinchi yuklangan rasm avtomatik `is_primary`.

### 2.2 API
```
CATALOG  GET  /products/{id}/           → images:[{id, image, thumb, sort_order, is_primary}]
         POST /products/{id}/images/    (multipart, bir nechta fayl)
         PATCH/DELETE /products/{id}/images/{imgId}/    (sort_order, is_primary)
         GET  /sync/catalog/?since=     → primary image URL (o'zgarishsiz), + `images` massivi
```
Rasm siqish: yuklashda `Pillow` bilan max 1600px + `thumb` 200px (opencv/Pillow, v3 §9 uslubi).

### 2.3 Frontend — `src/admin/products/ProductForm.tsx`
- Multi-upload (drag&drop), eskizlar gridi, drag bilan tartib, "Asosiy" belgilash, o'chirish.
- `browser-image-compression` bilan yuborishdan oldin siqish.
- `ProductsPage` jadvalida kichik eskiz ustuni.
- Mobil `MyVanStockPage` / `NewSalePage` tovar tanlashda eskiz ko'rsatilsin (adashmaslik uchun).

### 2.4 Testlar / DoD
```
✓ Ikkinchi rasmni primary qilsa — eski primary bekor, Product.image yangilanadi
✓ Yagona primary constraint ishlaydi
✓ /products/{id} javobida images tartiblangan
```
DoD: admin paneldan 3 rasm yuklash, tartib o'zgartirish, asosiyni almashtirish — hammasi ishlaydi;
mobil katalogda eskiz ko'rinadi.

---

## 3. T3 — KOMPANIYA REKVIZITLARI · MUHR · NAKLADNOY PDF

### 3.1 Model — `apps/core/models.py`
```python
class CompanySettings(BaseModel):          # singleton (pk bo'yicha 1 ta yozuv)
    name          = CharField(255)
    legal_name    = CharField(255, blank)
    inn           = CharField(20, blank)     # STIR
    address       = CharField(255, blank)
    phone         = CharField(50, blank)
    bank_details  = TextField(blank)         # hisob raqami, MFO, bank
    logo          = ImageField(upload_to="company/", null, blank)
    stamp         = ImageField(upload_to="company/", null, blank)   # muhr, PNG shaffof fon
    director_name = CharField(255, blank)

    @classmethod
    def load(cls): ...   # get_or_create(pk=<fixed>) yoki first()
```
Admin: `Sozlamalar` bo'limida alohida "Kompaniya rekvizitlari" tab (SUPER_ADMIN).
O'zgarish `AuditLog` ga (v3 §5.3).

### 3.2 Backend PDF — `apps/warehouse/pdf.py` (yangi) + `apps/reports/pdf.py` qayta ishlatiladi
```python
def purchase_to_pdf(purchase, *, with_stamp: bool, with_images: bool = True) -> bytes:
    # A4, ReportLab platypus:
    #   sarlavha: CompanySettings (logo, nom, STIR, manzil, tel)
    #   "NAKLADNOY № {invoice_number}  sana: {date}   Yetkazib beruvchi: {supplier}"
    #   jadval: [№, Rasm(eskiz 14mm), Nomi, SKU, Miqdor, Birlik, Dona narxi, Summa]
    #   jami: total_amount, paid_amount, debt_amount
    #   pastki qism: "Topshirdi ___ / Qabul qildi ___", direktor F.I.SH.
    #   with_stamp=True → CompanySettings.stamp rasmini imzo zonasiga yarim-shaffof joylashtirish
```
- Tovar rasmi yo'q bo'lsa — bo'sh katak (crash bo'lmasin).
- Kirill/lotin uchun shrift: `DejaVuSans` (yoki mavjud) ni `reportlab` ga ro'yxatdan o'tkaz;
  `docs/` ga qo'shilmasa `backend/apps/core/fonts/` ga.
- Xuddi shu uslubda `loading_to_pdf(loading, ...)` — yuklama varag'i (ixtiyoriy, shu bosqichda).

### 3.3 API
```
WAREHOUSE  GET /purchases/{id}/pdf/?stamp=1        → application/pdf (Content-Disposition: inline)
           GET /loadings/{id}/pdf/?stamp=0
SYSTEM     GET/PATCH /company-settings/            (SUPER_ADMIN)
           GET       /company/public/             → mobil uchun: name, inn, address, phone,
                                                     bank_details, stamp(base64 data-URI), logo(base64)
```
`/company/public/` — mobil offline kesh uchun (T4). Rasm base64 ~50-150KB, kunlik sinxda tortiladi.

### 3.4 Frontend
- `src/admin/warehouse/PurchaseDetail*` — ikkita tugma: **"Pechat bilan chop etish"** (`?stamp=1`)
  va **"Pechatsiz"** (`?stamp=0`) → yangi tabda PDF ochiladi.
- `src/admin/system/` — "Kompaniya rekvizitlari" formasi (logo, muhr yuklash + rekvizit maydonlari).
- i18n: `company.*`, `pdf.*` kalitlari (uz/ru/en).

### 3.5 Testlar / DoD
```
✓ purchase_to_pdf → bytes qaytaradi, %PDF header, sahifa > 0
✓ with_stamp=True va stamp yo'q → crash yo'q (muhr tashlanadi)
✓ Rasmi bor va rasmi yo'q tovarlar aralash — PDF hosil bo'ladi
✓ /purchases/{id}/pdf/ — WAREHOUSE/ADMIN kirishi, DISTRIBUTOR 403
```
DoD: haqiqiy nakladnoy PDF'i eskizlar + rekvizit + muhr bilan yuklab olinadi; matn kirillda to'g'ri.

---

## 4. T4 — MOBIL: CHEKNI PDF QILIB MIJOZGA BERISH (OFFLINE)

### 4.1 Kutubxona
`frontend/package.json` → `jspdf` (+ `jspdf-autotable`). Bundle ~250KB — faqat mobil chunk'da
(`React.lazy` / dynamic import), asosiy yukni sekinlashtirmasin.

### 4.2 Kesh (Dexie — v3 §4.1)
`offline` bazasiga `company` jadvali (yoki `meta` kaliti):
`{ name, inn, address, phone, bank_details, stamp_data_uri, logo_data_uri, fetched_at }`.
Sinxronizatsiyada `GET /company/public/` dan yangilanadi (>7 kun eski bo'lsa ogohlantirish).

### 4.3 PDF quruvchi — `src/mobile/lib/receiptPdf.ts`
```ts
buildReceiptPdf(sale: LocalSale | SaleDTO, company: CompanyCache): Blob
// 80mm × auto (termal uslub) YOKI A5. Tarkib:
//   logo + kompaniya nomi, STIR, tel
//   "CHEK / SOTUV № {number|client_uuid}"  sana, tarqatuvchi F.I.SH., mijoz
//   jadval: Nomi | Soni | Narx | Summa
//   Jami / To'landi / Qarz (+ qarz muddati)
//   to'lov turi, izoh
//   pastda: muhr rasmi (stamp_data_uri) + "Rahmat!" / QR (ixtiyoriy, keyin)
```
- **Offline ishlaydi:** faqat lokal `sale` ma'lumoti + keshlangan `company`.
- Raqam: server bergani bo'lsa `SOT-...`, bo'lmasa `client_uuid` qisqartmasi + "(sinxrondan oldin)".

### 4.4 UI
- `src/mobile/NewSalePage.tsx` saqlangач ekran: **"PDF saqlash"** va **"Ulashish"**.
  - "Ulashish": `navigator.share({ files: [pdfFile] })` — mavjud bo'lsa (Android Chrome ✅).
  - Fallback: `<a download>` blob (PWA'da ishlaydi — bu artifact emas, haqiqiy ilova).
- Sale detali / `my-today` ro'yxatidagi har sotuvda ham "PDF" tugmasi.
- Zakaz oluvchi uchun: `Order` ni ham PDF qilish (xuddi shu quruvchi, sarlavha "BUYURTMA").

### 4.5 Testlar / DoD
```
✓ buildReceiptPdf — Blob (type application/pdf), o'lcham > 0  (jsdom/unit)
✓ company keshsiz — PDF baribir chiqadi (rekvizitsiz)
✓ Offline (aviarejim) sotuvdan keyin PDF tugmasi ishlaydi
```
DoD: aviarejimda sotuv → "PDF saqlash" → telefon xotirasiga tushadi; "Ulashish" → WhatsApp/Telegram'ga
fayl ketadi; muhr va rekvizit ko'rinadi.

---

## 5. INTEGRATSIYA (v4-5, oxirgi bosqich)

- **360° xodim kartasi (v3 §14):** `commission_earned` → `order_commission` + `delivery_commission`
  ajratib ko'rsatish; yangi "Buyurtmalar" mini-blok (yozgan / yetkazilgan / bekor).
- **Mobil `MyPayrollPage`:** ikkita komissiya oqimi alohida qatorda, "bugungacha to'plangan".
- **Mobil `MyReportPage`:** "Zakaz yig'dim: N ta / M so'm", "Yetkazdim: ...".
- **Telegram bot (v3 §15):** kunlik xulosada zakaz vs yetkazish bo'linmasi; `order.approved`
  da yetkazuvchiga xabar.
- **`reports/services/distributor.py` `_payroll_block`:** yangi maydonlar.
- **i18n:** barcha yangi kalitlar uz/ru/en. Hardcode yo'q (v3 §20).
- **Butunlik (v3 §5.2):** `check_integrity` — `Order.total_amount == SUM(items.amount)`,
  `OrderItem.delivered_quantity ≤ quantity` (yoki flag).
- **Docs:** `README.md`, `docs/` — Order oqimi diagrammasi, PDF/muhr sozlash yo'riqnomasi.

---

## 6. BOSQICHLAR VA TARTIB

> Har bosqich **mustaqil ishlaydigan** qism. Oxirida: xulosa → ishga tushirish buyruqlari →
> DoD tekshiruvi → **tasdiq so'rash**. Keyingi bosqichga faqat ruxsatdan keyin.

| Bosqich | Mazmun | Asosiy fayllar |
|---|---|---|
| **v4-1** | Order oqimi + ikki bosqichli maosh (backend) | `apps/orders/*` (yangi), `users/models.py`, `sales/models.py`, `payroll/*`, migratsiyalar, testlar |
| **v4-2** | Mahsulot rasmlari galereyasi (backend + admin) | `catalog/models.py`, `catalog/serializers.py`, `admin/products/ProductForm.tsx` |
| **v4-3** | Kompaniya rekvizitlari + muhr + Nakladnoy PDF | `core/models.py` (CompanySettings), `warehouse/pdf.py`, `admin/system/*`, `admin/warehouse/*` |
| **v4-4** | Mobil offline chek PDF | `frontend` `jspdf`, `mobile/lib/receiptPdf.ts`, `mobile/NewSalePage.tsx`, Dexie `company` |
| **v4-5** | Integratsiya: 360°, mobil hisobot, Telegram, i18n, docs, butunlik | `reports/*`, `mobile/My*Page.tsx`, `telegram_bot/*`, `locales/*` |

**Hozir: v4-1 dan boshlanadi.**

---

## 7. UMUMIY QOIDALAR (v3 dan, eslatma)

- Append-only jurnallar (`StockMovement`, `WalletTransaction`, `AuditLog`) — `UPDATE`/`DELETE` yo'q.
  `PayrollDetail` — append-only emas (DRAFT payroll qayta hisoblanadi), lekin tasdiqlangач o'zgarmaydi.
- Offline: `client_uuid` frontendda, server idempotent (dublikat → jimgina `200`).
- `transaction.atomic()` + `select_for_update()`; qoldiq manfiy bo'lmaydi.
- Xato matnlari — o'zbekcha, aniq, **ayblovsiz**.
- Barcha pul — `Decimal`, 2 kasr; foiz — `max_digits=5, decimal_places=2`.
- TypeScript `strict`, `any` yo'q. Test coverage kritik yo'llarda ≥ 70%, CI da avtomatik.
