# 👑 Qo'llanma — Super Admin, Menejer va Filial Rahbari

> **Kim uchun:** `SUPER_ADMIN`, `MANAGER`, `BRANCH_MANAGER`  
> **Qurilma:** Kompyuter / Noutbuk (katta ekranli brauzer)  
> **Asosiy manzil:** `/admin`

---

## 🧭 Yangi Menyular Tuzilishi (5 ta Asosiy Biznes Guruhi)

Admin paneli 5 ta qulay mantiqiy bo'limga ajratilgan. Har bir bo'lim tepasida tezkor qidiruv paneli (`Bo‘limni qidirish…`) mavjud bo'lib, kerakli sahifani bir zumda topish imkonini beradi:

```
┌────────────────────────────────────────────────────────┐
│ 1. 📊 BOSHQARUV & TAHLIL                                │
│    ├── Bosh sahifa (Dashboard)                         │
│    ├── Hisobotlar (Tovar harakati, P&L, ABC, 1C...)    │
│    └── Filiallar boshqaruvi                            │
│                                                        │
│ 2. 📦 OMBOR & TOVARLAR                                 │
│    ├── Mahsulotlar (Katalog, Tannarx, Bonus, Qadoq)    │
│    ├── Ombor (Qoldiq, Kirim, Yuklama, Ko'chirish)      │
│    ├── OCR Naklit Skani (Kamerada kirim qilish)        │
│    └── Boshlang'ich qoldiqlar                          │
│                                                        │
│ 3. 🛒 SAVDO & YETKAZISH                                │
│    ├── Sotuvlar jurnali (Pullik va Bepul bonuslar)     │
│    ├── Buyurtmalar (Zakazlar ro'yxati va holati)       │
│    ├── Do'konlar & Mijozlar (Qarzdorlik, GPS lokatsiya)│
│    ├── Marshrutlar (Kunlik grafiklar)                  │
│    └── Kun yopishni tasdiqlash                         │
│                                                        │
│ 4. 💰 MOLIYA & KASSA                                   │
│    ├── Moliya & Kassa (Kassa qoldig'i, Kirim/Chiqim)   │
│    ├── Mijozlar qarzdorligi (Akt-sverka, Muddatlar)    │
│    ├── Xarajatlar (Tasdiqlash va chek rasmlari)        │
│    └── Oylik Maosh (2 bosqichli Payroll)               │
│                                                        │
│ 5. ⚙️ JAMOA & SOZLAMALAR                               │
│    ├── Xodimlar boshqaruvi (Rollar va ruxsatlar)       │
│    ├── Tarqatuvchilar & Mashina qoldiqlari             │
│    ├── Ma'lumotnomalar (Kategoriyalar, Ta'minotchilar) │
│    ├── Sinxronizatsiya jurnali (SyncLog)               │
│    ├── Audit jurnali (O'zgarishlar tarixi)             │
│    ├── Tizim sozlamalari & Butunlik tekshiruvi         │
│    └── Foydalanish qo'llanmasi                         │
└────────────────────────────────────────────────────────┘
```

---

## 1. Mahsulotlar Kartochkasi va Narxlar Siyosati (`/admin/products`)

Yangi talablarga binoan, mahsulot profilida ma'lumotlar soddalashtirilgan va biznes uchun eng muhim ko'rsatkichlarga keltirilgan:

### 1.1 Yagona Tannarx va Narxlar
* **Tannarx (`cost_price`):** Tovar zavoddan qanchaga olingani. Bu ko'rsatkich faqat Admin va Buxgalterga ko'rinadi (tarqatuvchi va zakazchilardan yashirilgan).
* **Standart sotuv narxi:** Do'konlarga tavsiya etiladigan ulgurji narx.
* **Minimal narx (`min_price`):** Tarqatuvchi bundan past narxda sota olmaydi (agar sotmoqchi bo'lsa, tizim ogohlantiradi va adminga belgilangan savdo sifatida tushadi).

### 1.2 Qadoq Birliklari Parametrlari
* **Qadoq turi (`package_type`):** *karopka*, *qop*, *xalta*, *pachka*, *blok*.
* **Qadoqdagi dona soni (`pack_quantity`):** Masalan, `12`.
* *Natija:* Tarqatuvchi va zakazchi ilovasida bitta tugma bilan karopkada buyurtma olish imkoni paydo bo'ladi.

### 1.3 Aksiya va Bepul Bonus Tovarlar Sozlamasi
* **Aksiyada qatnashadimi (`has_bonus`):** Ha/Yo'q belgisi.
* **Bonus chegarasi (`bonus_trigger_qty`):** Masalan, `10` dona.
* **Beriladigan bepul tovar soni (`bonus_reward_qty`):** Masalan, `1` dona.
* **Bonus mahsulot (`bonus_product`):** Tovarning o'zidan bepul beriladimi yoki boshqa maxsus tovar (masalan, sovg'a krujkasi, choy) qo'shib beriladimi.
* *Natija:* Savatda miqdor 10 taga yetganda avtomatik `0 so'm` lik bepul bonus qatori qo'shiladi.

### 1.4 Tovarga Bog'liq Oylik Komissiya Foizlari
* **Zakaz foizi (`order_commission_rate`):** Ushbu tovardan olingan buyurtma uchun zakaz oluvchiga to'lanadigan foiz (masalan, `2%`).
* **Yetkazish foizi (`delivery_commission_rate`):** Ushbu tovarni yetkazib bergan tarqatuvchiga to'lanadigan foiz (masalan, `3%`).
* *Natija:* Oylik maosh umumiy foizdan emas, sotilgan aniq tovarlarning komissiyasi asosida adolatli jamlanadi.

---

## 2. Ombor Boshqaruvi (`/admin/warehouse`)

* **Qoldiq:** Barcha omborlardagi tovarlar soni, tannarx qiymati va kam qolgan tovarlar bo'yicha qizil indikatorlar.
* **Kirim (Tovar qabuli):** Ta'minotchidan yangi tovar kelganda qabul qilish. Nakladnoy qog'ozini OCR bo'limida rasmga olib, avtomatik kirim qilish mumkin.
* **Yuklamalar (Loadings):** Ertalab tarqatuvchining mashinasiga tovar ortish. Buyurtmalar asosida avtomatik yuklama shakllantirish mumkin. Yuklama qog'ozi (PDF) o'ng tomonida tarqatuvchi ismi va telefoni qalin shriftda chiqadi.
* **Ko'chirishlar (Transfers):** Markaziy ombordan filial omborlariga tovar yuborish va qabul qilish.

---

## 3. Savdo va Buyurtmalar Nazorati (`/admin/sales`, `/admin/orders`)

* **Sotuvlar jurnali:** Barcha yakunlangan savdolar. Har bir sotuvda to'lov turi (Naqd, Plastik, Qarz, Aralash), sotilgan tovarlar va bepul berilgan aksiya bonuslari ko'rinadi.
* **Buyurtmalar (Orders):** Zakazchilar tomonidan olingan buyurtmalar. Buyurtmadan to'g'ridan-to'g'ri bitta bosishda omborga yuklama yaratish mumkin. Kelishilgan narxlar yuklama va chekka o'zgarishsiz o'tadi.
* **Kun yopishni tasdiqlash (`/admin/day-close`):** Kechqurun tarqatuvchilar kunni yopganda, omborchi va menejer kassa summasi hamda mashinadan qaytgan tovar qoldiqlarini tekshirib tasdiqlaydi.

---

## 4. Moliya, Qarzlar va Oylik Maosh (`/admin/finance`, `/admin/payroll`)

* **Moliya & Kassa:** Filial va markaziy kassalar qoldig'i, naqd pul harakati jurnali. Filialdan markazga pul o'tkazish (inkassatsiya) hujjati.
* **Mijozlar qarzdorligi:** Muddatiga qarab (0–7 kun, 8–14 kun, 15–30 kun, 30+ kun) saralangan qarzlar ro'yxati. Har bir do'kon uchun bitta bosishda **Akt-sverka (PDF)** yuklab olish.
* **Oylik Maosh (Payroll — 2 bosqichli):**
  1. *Hisoblash bosqichi:* Oklad + tovarlar bo'yicha foizlar + bonuslar − kamomadlar avtomatik yig'iladi.
  2. *Tasdiqlash va to'lash bosqichi:* Super admin tasdiqlagach, kassadan xodimga naqd yoki plastik orqali to'lanadi.

---

## 5. Yangilangan Tahliliy Hisobotlar (`/admin/reports`)

Hisobotlar bo'limida 6 ta kuchli biznes tahlili mavjud:

1. **📊 Tovar Harakati (Sotuv / Bonus) — Yangi:**
   * Qaysi tovardan qancha pullik sotilgani (miqdor va summa).
   * Qaysi tovardan qancha bepul aksiya bonusi berilgani (miqdor va tannarxi).
   * Jami ombor chiqimi va aksiya ulushi (`bonus_ratio_percent`).
   * **«Excel yuklash»** tugmasi orqali to'liq XLSX formatida eksport qilinadi.
2. **📉 Tannarxdan Farq (Kamomad / Ortiqcha) Hisoboti:**
   * Tovar tannarxdan arzon (zarariga/kamomad) yoki qimmat (ortiqcha daromad) sotilganini aniqlash.
3. **📈 Ko'p O'lchamli Sotuv Konstruktori:**
   * Kunlar, tarqatuvchilar, tovarlar, kategoriyalar, mijozlar va marshrutlar kesimida sotuv, sof foyda va marja tahlili.
4. **🏆 ABC / XYZ Analitika:**
   * Daromadning 80% ini keltiruvchi «A toifali» eng xaridorgir tovarlar va mijozlar reytingi.
5. **💼 Foyda va Zarar (P&L):**
   * Jami tushum − Tannarx − Chegirmalar − Operatsion xarajatlar = **Sof Foyda**.
6. **🏢 1C Buxgalteriya Eksporti:**
   * Sotuvlar va kirimlarni 1C:Enterprise dasturiga uzatish uchun XML va CSV fayllarni shakllantirish.

---

## 6. Jamoa va Xavfsizlik Nazorati

* **Sinxronizatsiya Jurnali (`/admin/sync-log`):** Qaysi xodim qaysi telefondan qachon bog'langani, nechta operatsiya yuborgani va oflayn xatoliklar sonini kuzatish.
* **Audit Jurnali (`/admin/audit`):** Har bir o'zgarish (narx kim tomonidan o'zgartirildi, qachon kassa to'g'rilandi) muhrlangan doimiy jurnal.
* **Testlarni Tozalash (`/admin/system?tab=cleanup`):** Dastur o'rnatilganda kiritilgan test ma'lumotlarini xavfsiz tozalash va kassa balanslarini qayta hisoblash.
