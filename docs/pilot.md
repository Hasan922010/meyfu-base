# Pilot rejasi (CLAUDE.md §17)

> Barcha 16 bosqich tugadi (MVP + 2-faza + 3-faza). Endi **1–2 tarqatuvchi bilan
> 2 hafta daftar bilan parallel** ishlatiladi. Raqamlar mos kelsa — to'liq real
> foydalanishga o'tiladi, so'ng CLAUDE.md §21 "Kelajak".

---

## 1. Tayyorgarlik (1-kun)

### 1.1 Infratuzilma
```bash
cp backend/.env.example backend/.env
#  MUHIM: SECRET_KEY (≥50 belgi), DEBUG=False, ALLOWED_HOSTS, CORS_ALLOWED_ORIGINS,
#         CSRF_TRUSTED_ORIGINS, kuchli admin paroli
cp frontend/.env.example frontend/.env      # VITE_API_URL
docker compose up -d --build

docker compose exec web python manage.py check --deploy   # 0 muammo bo'lishi shart
docker compose exec web python manage.py migrate
docker compose exec web python manage.py seed_base        # birlik, kategoriya, ombor
docker compose exec web python manage.py ensure_superuser # bosh admin
```

### 1.2 Admin panelda sozlash (http://SERVER/admin panel)
- **Mahsulotlar** — real katalog (Excel import yoki qo'lda). Har mahsulotda
  `cost_price`, `wholesale_price`, `min_price`, `commission_percent` to'g'ri bo'lsin
- **Xodimlar** — 1 WAREHOUSE, 1 MANAGER, 1–2 DISTRIBUTOR. Har tarqatuvchi profilida:
  `base_salary`, `commission_percent`, `monthly_plan`, `debt_limit`,
  `daily_expense_limit`, `expenses_covered_by`
- **Marshrutlar** — har tarqatuvchiga marshrut + hafta kunlari
- **Mijozlar** — pilot marshrutdagi 20–40 do'kon (`debt_limit` bilan)
- **Ombor → Tovar qabullari** — joriy real qoldiqni kirim qiling
- **Xarajat kategoriyalari** — Yoqilg'i, Tushlik, Mashina yuvish, Ta'mirlash…
  (`daily_limit`, `requires_receipt`, `paid_by`)
- **Sozlamalar → Maosh** — kamida bitta GLOBAL `CommissionRule` (foiz + amal muddati)
- **Sozlamalar** — `payroll.auto_deduct_shortage` (kamomad avtomatik ushlansinmi),
  ish kuni boshlanish soati, OCR kunlik/oylik limit
- **Telegram** (ixtiyoriy) — `TELEGRAM_BOT_TOKEN` + webhook; boshliq va tarqatuvchi
  ilovadagi Sozlamalar → "Telegram'ni ulash" orqali bog'lanadi

### 1.3 Tarqatuvchi telefoni
Brauzerda frontend manzili → **"Add to Home Screen"** → telefon + parol bilan bir
marta kirish → keyingi kirishlar PIN. "Sinxronizatsiya" va "🟢 Online" indikatorini
ko'rsating.

---

## 2. Pilotdan OLDIN bir marta bajariladigan testlar

### 2.1 Offline qabul testi (CLAUDE.md §4.6)
1. Telefonda **aviarejim**
2. 20 ta sotuv + 5 ta xarajat + 2 ta qarz to'lovi kirit → har biri "✅ Saqlandi"
3. Ilovani **to'liq yop va qayta och** → hammasi "Sinxronizatsiya" ekranida turibdi
4. Internetni yoq → hammasi "Yuborildi", dublikat yo'q
5. Admin panelda: sotuvlar soni, mashina qoldig'i, hamyon balansi server bilan mos

> Avtomatik: `docker compose exec web pytest -k "offline or bulk_sync or idempot"`

### 2.2 Backup va tiklash
```bash
docker compose run --rm --entrypoint sh backup /scripts/backup.sh        # qo'lda dump
docker compose run --rm --entrypoint sh backup /scripts/restore-test.sh  # tiklash sinovi
```
Natijani (necha daqiqa) `docs/restore.md` jadvaliga yozing.

### 2.3 Butunlik
```bash
docker compose exec web python manage.py check_integrity  # [OK] bo'lishi shart
```

---

## 3. Kunlik sikl

### Tarqatuvchi
1. **Ertalab** — ombor "Yuklama" → "Yuborish"; tarqatuvchi "Mening yuklamam" →
   **"Qabul qildim"** (mashina qoldig'i to'ladi)
2. **Kun davomida:**
   - "Yangi sotuv" (mijoz → tovar → miqdor → Naqd/Qarz → Saqlash) — 30 soniya
   - "Yangi xarajat" (kategoriya → summa → 📷 chek) — hamyondan kamayadi
   - "Qarz undirish" — mijoz qarzini to'lash
   - 👛 **Hamyon** doim yuqorida: naqd sotuv + undirilgan qarz − xarajat − topshirilgan
3. **Kechqurun:**
   - "Kassaga topshirish" — qo'lidagi naqdni omborga beradi
   - "Kunni yopish": Tovar → Pul → Tasdiq. Farqlar darhol ko'rinadi

### Admin / boshliq
- **Dashboard** (real-time) — kunlik savdo, foyda, kim qancha sotdi
- **Xarajatlar** — `PENDING` larni tasdiqlash/rad etish (sabab bilan)
- **Kunlik hisob-kitob** — kassa/tovar farqlari, tasdiqlash
- **Qarzdorlik** — muddati o'tganlar
- **Telegram** — har kuni 20:00 da avtomatik xulosa

---

## 4. Har kun solishtiriladi (qabul mezoni)

| Ko'rsatkich | Daftar | Tizim | Farq |
|---|---|---|---|
| Kunlik savdo summasi | | `/reports/dashboard/` | |
| Naqd tushum | | | |
| Qarzga berilgan | | | |
| Qarz undirilgan | | | |
| Xarajat (tasdiqlangan) | | | |
| Kassaga topshirilgan | | `CashHandover` | |
| Kassa farqi (kamomad) | | `DayClose.cash_difference` | |
| Tovar farqi (dona) | | `DayClose.stock_difference` | |
| 👛 Hamyon balansi (kun oxiri) | | `/wallet/my/` | |

**Formulalar (tekshirish uchun):**
```
cash_expected   = naqd_sotuv + undirilgan_qarz − tasdiqlangan_xarajat(CASH_ON_HAND)
cash_difference = topshirilgan − cash_expected          (manfiy = kamomad)
stock_diff      = yuklangan − sotilgan − qaytarilgan
hamyon_balans   = SUM(WalletTransaction.amount)
```
**Maqbul farq:** 0. Har farq — sabab aniqlanadi (sinxronizatsiya kechikishi,
noto'g'ri narx, sanoq xatosi, offline konflikt).

---

## 5. Har hafta

- **Tizim salomatligi** (`/admin/system`) — butunlik [OK], backup yangi, sync
  ziddiyati yo'q, disk bo'sh
- **Maosh → Hisoblash** (taxminiy) — tarqatuvchiga ko'rsating: foiz + bonus −
  ushlanmalar. Daftar bo'yicha foiz bilan solishtiring
- **360° xodim kartasi** — reja bajarilishi, o'rtacha chek, sotuvsiz tashriflar
- **OCR metrikalari** (naklit skanerlansa) — `line_accuracy` 20 ta real naklitda.
  `< 85%` yoki tasdiqlash qo'lda kiritishdan sekin → OCR o'chirib, qo'lda ishlatilsin
- Tarqatuvchilardan **fikr:** qaysi qadam sekin, nima chalkash, nima yetishmaydi

---

## 6. Pilot yakunida qaror

| Natija | Harakat |
|---|---|
| ✅ Farqlar barqaror ~0, tarqatuvchilar ilovadan foydalanyapti, daftar tashlab ketishga tayyor | **To'liq real foydalanishga o'ting.** Barcha marshrutlarni ko'chiring, daftarni to'xtating |
| ⚠️ Vaqti-vaqti farq, lekin sabab tushunarli (o'rganish davri) | Pilotni 1 hafta uzaytiring, muammoli oqimni soddalashtiring |
| ❌ Muntazam katta farq yoki ishlatishdan qochish | To'xtang. Sabab: UX og'ir? Offline ishonchsiz? Jarayon mos emas? — tuzating, qaytadan |

### Keyin — CLAUDE.md §21 "Kelajak"
Bluetooth termal printer · B2B mijoz ilovasi · 1C integratsiya · marshrut
optimizatsiyasi · AI: sotuv prognozi, g'ayrioddiy xarajat aniqlash · ko'p filial.
Arxitektura shularga tayyor — har biri alohida loyiha sifatida rejalashtiriladi.
