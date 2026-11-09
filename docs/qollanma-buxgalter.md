# 💰 Foydalanish Qo'llanmasi — Buxgalter va Kassir

> **Kim uchun:** `ACCOUNTANT` (Bosh buxgalter, moliyachi, hisobchi-kassir)  
> **Asosiy qurilma:** Kompyuter / Noutbuk (Desktop brauzer `/admin`)  
> **Umumiy kirish va qoidalar:** [`qollanma.md`](./qollanma.md)

---

## 🎯 1. Buxgalterning Tizimdagi O'rni va Mas'uliyati

Buxgalter korxonaning barcha pul oqimlari, debitorlik qarzlari, xodimlar maoshi va moliyaviy hisobotlarining haqqoniyligini nazorat qiladi:
* **Kassa va hisob-raqamlar:** Pul kirim-chiqimlarining qat'iy intizomi.
* **Qarzdorlik nazorati:** Mijozlar balansi va solishtirma dalolatnomalar (Akt-sverka).
* **Tovar harakati:** Sotilgan va aksiya doirasida bepul berilgan bonus tovarlar tahlili.
* **Oylik maosh:** Ikki bosqichli komissiya tizimi bo'yicha maoshlarni hisoblash va to'lash.
* **Foyda va zarar (P&L):** Korxonaning sof rentabelligini aniqlash.

---

## 💵 2. Moliya va Kassa Jurnali (`/admin/finance`)

Ushbu bo'limda korxonaning barcha naqd va naqdsiz pullari yuritiladi:

### 1. Kassa Balansi va Jurnal (Append-Only)
* **Jonli qoldiq:** Har bir kassa (Asosiy naqd kassa, Bank hisob raqami) bo'yicha joriy qoldiq ko'rinadi.
* **O'zgarmas jurnal:** Pul harakatlari jurnalidagi yozuvlarni orqaga qaytarib o'chirib bo'lmaydi. Har bir kirim, chiqim va tuzatish yozuvi sana, vaqt va mas'ul xodim bilan muhrlanadi.

### 2. Tarqatuvchilarning Naqd Pulini Qabul Qilish
* Kechqurun haydovchi-tarqatuvchi kunni yopganda topshirgan naqd pul summasi kassa moduliga tushadi:
  * **Kutilgan naqd pul** = Naqd sotuvlar + Undirilgan qarzlar − Tasdiqlangan yo'l xarajatlari.
  * **Topshirilgan naqd pul** bilan solishtiriladi.
  * Farq bo'lsa (kamomad yoki ortiqcha pul), haydovchi yozgan izoh o'rganiladi va kassa kirimi tasdiqlanadi.

### 3. Kompaniya Xarajatlari va Avanslar
* Buxgalter umumiy operatsion xarajatlarni (ofis ijarasi, soliqlar, kommunal to'lovlar, internet) va xodimlarga berilgan oraliq avanslarni kassa chiqimi sifatida rasmiylashtiradi.

---

## 📑 3. Mijozlar Qarzdorligi va Akt-Sverka (`/admin/debts`)

Debitorlik qarzdorligini samarali boshqarish va pulni o'z vaqtida undirish vositalari:

### Qarzdorlik Tahlili (Aging):
Barcha qarzlar vujudga kelgan muddatiga qarab guruhlanadi:
* 🟢 **0–7 kun:** Yangi qarzlar (xavfsiz davr).
* 🟡 **8–14 kun:** To'lov muddati yaqinlashgan qarzlar.
* 🟠 **15–30 kun:** Muddati o'tgan qarzlar (ogohlantirish talab etiladi).
* 🔴 **30+ kun:** Muammoli qarzdorlik (savdo to'xtatiladi).

### Mijoz bilan Solishtirma Dalolatnoma (Akt-Sverka — PDF):
1. Kerakli mijoz kartasini oching.
2. Davrni tanlang (masalan, joriy oy yoki chorak).
3. **«Akt-sverka (PDF)»** tugmasini bosing.
4. Tizim avtomatik rasmiy dalolatnoma tuzadi:
   * Davr boshidagi qoldiq;
   * Yetkazib berilgan barcha tovarlar (sana, nakladnoy №, tovarlar, summa);
   * Qabul qilingan to'lovlar (naqd, plastik, bank o'tkazmasi);
   * Davr oxiridagi qarz qoldig'i;
   * Ikkala tomon imzosi va muhri uchun joylar.
5. Hujjatni chop etib do'konga taqdim etish yoki Telegram orqali yuborish mumkin.

---

## 📊 4. Yangi Hisobot: Tovar Harakati (Sotuv va Bonuslar) (`/admin/reports`)

Kompaniyada aksiyalar yo'lga qo'yilgani sababli buxgalter uchun alohida **«Tovar harakati (Sotuv / Bonus)»** hisoboti joriy qilingan:

### Hisobot Nimani Ko'rsatadi?
* **Pullik sotuv:** Mijozlarga pul evaziga sotilgan tovarlar hajmi va tushumi.
* **Bepul bonus:** Aksiya doirasida (masalan, 10 taga +1 sovg'a) bepul berilgan bonus tovarlar soni.
* **Bonus qiymati (Tannarxda):** Bepul berilgan tovarlarning korxona tannarxi bo'yicha qiymati (bu kompaniyaning marketing xarajati hisoblanadi).
* **Jami chiqarilgan tovar:** Ombor va mashinalardan haqiqiy hisobdan chiqarilgan umumiy miqdor.

### Buxgalter uchun Imkoniyatlar:
1. **Filtrlar:** Sana oralig'i (oy, chorak), filiallar va tovar kategoriyalari bo'yicha filtrlash.
2. **Excelga Eksport (`.xlsx`):** Bir marta bosishda barcha raqamlarni chiroyli formatlangan Excel faylga yuklab olish.
3. **Marketing tahlili:** Bepul berilgan bonus tovarlar qancha savdo olib kelgani va uning tannarxini buxgalteriya hisobida marketing xarajatlariga to'g'ri o'tkazish.

---

## 📈 5. Foyda va Zarar (P&L) va ABC Tahlili

* **P&L (Foyda va Zarar) Hisoboti:**
  * **Yalpi Tushum:** Sotilgan barcha tovarlar summasi.
  * **Tovar Tannarxi (COGS):** Sotilgan tovarlarning kirim tannarxi.
  * **Yalpi Foyda (Gross Profit):** $\text{Tushum} - \text{Tannarx}$.
  * **Yo'l va Transport Xarajatlari:** Haydovchilarning yoqilg'i va avto xarajatlari.
  * **Operatsion Xarajatlar (OPEX):** Oylik maoshlar, ijara, kommunal va boshqa xarajatlar.
  * **Sof Foyda (Net Profit):** Korxonaning barcha xarajatlardan keyingi sof daromadi.
* **ABC Tahlili (Pareto 80/20 qoidasi):**
  * **A toifa:** Korxona daromadining 80%ini beruvchi asosiy tovarlar.
  * **B toifa:** 15% daromad beruvchi o'rta tovarlar.
  * **C toifa:** Faqat 5% aylanma beruvchi sust tovarlar.

---

## 💼 6. Ikki Bosqichli Oylik Maosh (Payroll) Hisoblash (`/admin/payroll`)

MeyFu tizimida oylik maosh adolatli va avtomatlashtirilgan tarzda hisoblanadi:

```
[ Davr Tanlash ] ───► [ «Hisoblash» Tugmasi ] ───► [ Tekshirish & Tuzatish ] ───► [ «Tasdiqlash & To'lash» ]
```

### Xodimlar Bo'yicha Hisoblash Qoidalari:
1. **Zakaz Oluvchilar (Pre-seller):**
   * O'zi olgan va yetkazib berilgan buyurtmalar summasidan maxsus **«Zakaz %»** bo'yicha komissiya.
2. **Haydovchi-Tarqatuvchilar (Distributor):**
   * O'zi yetkazib bergan tovarlar summasidan **«Yetkazish %»** bo'yicha komissiya.
   * Agar zakazni ham o'zi olgan bo'lsa (van-sale), har ikkala foiz to'liq hisoblanadi.
3. **Boshqa Xodimlar (Omborchi, Menejer, Buxgalter):**
   * Super Admin tomonidan belgilangan qat'iy oylik maosh (Oklad).
4. **Ushlanmalar va Jarimalar:**
   * Kun yopishda aniqlangan asossiz kassa kamomadlari;
   * Tovar yetishmovchiligi bo'yicha moddiy javobgarlik summalari;
   * Oy davomida xodimga berilgan avanslar avtomatik tarzda yakuniy to'lanadigan summadan chegiriladi.

### Yakuniy To'lov:
* Buxgalter vedomostni tekshiradi, kerak bo'lsa tuzatish kiritadi va **«Tasdiqlash»** tugmasini bosadi.
* Pul xodimga berilgach yoki kartaga o'tkazilgach **«To'landi»** maqomiga o'tkaziladi va kassa chiqimiga yoziladi.

---

## 🔄 7. 1C Dasturiga Eksport

* Barcha kunlik sotuvlar, kirim nakladnoylari, mijozlar to'lovlari va qoldiqlarini **1C: Korxona** dasturiga import qilish uchun standart **XML / CSV / Excel** formatida yuklab olish imkoniyati mavjud.

---

## ⚠️ Buxgalter Uchun Muhim Qoidalar

1. **Jurnallardagi harakatlar o'chirilmaydi:** Agar noto'g'ri operatsiya kiritilgan bo'lsa, uni o'chirishga urinmang — sababi ko'rsatilgan holda teskari tuzatuvchi operatsiya kiriting.
2. **Kechki kassa qabulini qoldirmang:** Har kuni haydovchilar topshirgan pullarni shu kunning o'zida qabul qilib, kassa bilan solishtiring.
3. **Akt-sverkani muntazam o'tkazing:** Haftada yoki oyda kamida bir marta do'konlar bilan hisob-kitoblarni solishtiring.
