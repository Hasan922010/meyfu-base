# Qo'llanma — Tarqatuvchi (agent)

**Kim uchun:** DISTRIBUTOR · **Qurilma:** telefon (mobil ilova / PWA)

> Umumiy qoidalar (kirish, offline): [`qollanma.md`](./qollanma.md)

Bu ilova **internetsiz ham to'liq ishlaydi**. Sotuv, xarajat, qarz to'lovi darhol
saqlanadi va internet paydo bo'lganda avtomatik serverga yuboriladi. Podvalda, bozorda,
tarifi tugagan telefonda ham ishlayveradi.

## Ilovani telefonga o'rnatish

1. Brauzerda (Chrome) ilova manzilini oching, tizimga kiring.
2. Menyu → **"Bosh ekranga qo'shish" (Add to Home Screen)**.
3. Endi ilova alohida dastur kabi ochiladi.

---

## Bosh sahifa

Yuqorida:
- 👛 **Hamyon kartasi** — hozir qo'lingizdagi naqd pul (jonli hisoblanadi).
- **Bugungi ko'rsatkichlar:** savdo, tashriflar, xarajat, reja bajarilishi (halqa).
- Ikki katta tugma: **[+ Sotuv]** va **[Kunni yopish]**.

Pastda: yuklama, mashina qoldig'i, qarz undirish, xarajatlar, naklit skani, tashriflar,
mening hisobotim, mening maoshim, sinxronizatsiya.

Eng pastda doimiy **holat chizig'i:** 🟢 Online · 🟡 Yuborilmoqda (N) · 🔴 Offline · N ta kutmoqda.

---

## 1. Ertalab — yuklamani tasdiqlash

1. **«Yuklama»** ni oching — omborchi siz uchun tayyorlagan tovar ro'yxati.
2. Miqdorlarni haqiqiy olgan tovar bilan solishtiring.
3. Hammasi to'g'ri bo'lsa — **«Tasdiqlash»**.
4. Tasdiqlagandan keyin tovar sizning **«mashina qoldig'ingizga»** o'tadi.

> Farq bo'lsa, tasdiqlashdan oldin omborchiga ayting.

## 2. Kun davomida — sotuv (30 soniya)

**[+ Sotuv]** → 4 qadam:

| Qadam | Nima qilinadi |
|---|---|
| **1. Mijoz** | Marshrutdagi ro'yxatdan tanlash (yoki qidiruv). Bitta teginish. |
| **2. Tovar** | Qidirib tanlash → miqdor (katta +/− tugmalar) → narx (standart narx avtomatik qo'yiladi). Bir necha tovar qo'shish mumkin. |
| **3. To'lov** | **Naqd** · **Plastik** · **Qarzga** (bloklangan mijozga faqat naqd). Aralash bo'lsa: qancha naqd, qolgani qarzga, muddat. |
| **4. Tayyor** | **«✅ Saqlandi»** darhol chiqadi. |

Saqlagandan keyin:
- **«Chek — PDF»** — chekni PDF qilib saqlash yoki mijozga **WhatsApp / Telegram** orqali
  yuborish (internetsiz ham ishlaydi).
- Tovar avtomatik «mashina qoldig'idan» kamayadi.

**Qoidalar:**
- Mashinada yo'q tovarni sotib bo'lmaydi («Mashinada faqat 8 dona bor»).
- Minimal narxdan past sotib bo'lmaydi (ruxsat berilgan bo'lsa — sotiladi, lekin adminga
  belgi boradi).
- Mijoz qarz limitidan oshsa — admin ruxsati so'raladi yoki belgi bilan qabul qilinadi.

## 3. Buyurtma (zakaz) yig'ish

Agar ish tartibi "avval zakaz, keyin yetkazish" bo'lsa:

1. **«Buyurtmalar» → «Yangi zakaz»** (yoki pastdagi «Zakaz» tugmasi).
2. Mijoz → tovar → miqdor → to'lov turi. Saqlash.
3. Zakaz adminga boradi, u **tasdiqlaydi** → yuklamaga qo'shiladi.
4. Yetkazib berganda: **«Buyurtmalar → Yetkazishim»** → zakazni oching →
   **«Yetkazib berdim»**. Shunda u sotuvga aylanadi, tovar «mashina qoldig'idan» kamayadi.

Zakaz olganingiz va yetkazganingiz uchun **alohida foiz** to'planadi (maoshda ko'rinadi).

## 4. Xarajat (yo'l xarajatlari)

**«Xarajat» → «Yangi xarajat»:**
1. Kategoriya (ikonka): yoqilg'i, tushlik, mashina yuvish, ta'mirlash, parkovka, aloqa.
2. **Summa** — katta raqamli klaviatura, tez tugmalar.
3. **📷 Chek rasmi** — «Chek rasmidan summani olish» tugmasi AI bilan summani o'zi to'ldiradi.
4. Yoqilg'i uchun: litr, narx, odometr.
5. Saqlash → qo'lingizdagi pul kamayadi.

- Limitdan oshgan xarajat avtomatik **«kutilmoqda»** holatida — admin tasdiqlaydi/rad etadi.
- Rad etilsa — **sababi** ko'rsatiladi («Mening xarajatlarim» da).
- «Chek majburiy» kategoriyada — chek rasmini albatta biriktiring.

## 5. Hamyon

**«Hamyon»:**
- **Jonli balans** — hozir qo'lingizdagi pul:
  `naqd sotuv + undirilgan qarz − xarajat − topshirilgan`.
- Barcha tranzaksiyalar ro'yxati (har biridan keyingi balans ko'rinadi).
- **«Kassaga topshirish»** — pulni buxgalterga topshirganda: summa, foto, izoh.
  Buxgalter tasdiqlaydi.

## 6. Qarz undirish

**«Qarz undirish»:**
1. Mijoz qarzlari ro'yxati (muddati o'tganlar qizil).
2. Mijozni tanlab → to'lov summasi → to'lov turi → saqlash.
3. Undirilgan pul hamyonga (+) qo'shiladi.

## 7. Mijozlar va tashriflar

- **«Mijozlar»** — marshrutdagi mijozlar, xarita, telefon, joriy qarzi.
- Mijozga kelganda **GPS check-in** qiling (joylashuv yoziladi — faqat ish vaqtida va
  tashrif/sotuv paytida, kun bo'yi kuzatilmaydi).
- Sotuvsiz ketsangiz ham natijani belgilang: **SOTUV / SOTUVSIZ / YOPIQ** (+ ixtiyoriy foto).
- **«Tashriflar»** — bugungi tashriflar tarixi.

## 8. Mashina qoldig'i

**«Mashina qoldig'i»** — hozir mashinada qancha tovar borligini rasmi bilan ko'rish.
Offline ham to'g'ri ko'rsatadi (lokal hisoblanadi).

## 9. Naklit skani (omborchi yo'q bo'lsa)

Zavod naklit bilan tovar keltirsa va siz qabul qilsangiz: **«Naklit skani»** →
kamera bilan naklitni oling → AI o'qiydi → admin panelda tekshiriladi.

## 10. Kechqurun — kunni yopish

**[Kunni yopish]** → 3 qadam:

### 1-qadam: Tovar
Har tovar bo'yicha omborga **qaytariladigan miqdor** ni kiriting (yaxshi / brak / muddat
alohida). **Tovar farqi** darhol ko'rinadi: `yuklangan − sotilgan − qaytariladigan`.

### 2-qadam: Pul
- Naqd sotuv, undirilgan qarz, **kutilgan naqd** ko'rsatiladi.
- **Topshiriladigan naqd** summasini kiriting.
- **Kassa farqi** darhol ko'rinadi (manfiy = kamomad). Farq bo'lsa — **izoh yozing**
  (bu jarima emas, tushuntirish).

### 3-qadam: Tasdiq
Yakuniy ko'rinish → **«Kunni yopish»**.
Shundan keyin o'sha kunni o'zgartirib bo'lmaydi (faqat admin, sabab bilan).

## 11. Mening hisobotim va maoshim

- **«Mening hisobotim»** — kun / hafta / oy: savdo, foyda, xarajat, foiz,
  **taxminiy maosh**, reja progressi, TOP mijozlar va mahsulotlar.
- **«Mening maoshim»** — oylar bo'yicha: sotuvdan foiz (zakaz + yetkazish alohida), bonus,
  ushlanmalar (kamomad, kassa farqi, avans), xarajat qaytarimi, **yakuniy summa**.

## 12. Sinxronizatsiya

**«Sinxronizatsiya»** — yuborilmagan operatsiyalar navbati, xatolar, **«Qayta urinish»**
tugmasi. Odatda o'zi ishlaydi, lekin uzoq offline'dan keyin bu yerni tekshiring.

## 13. Profil / Sozlamalar

Til, tema, katalogni majburiy yangilash, **«Chiqish»**.

---

## Muhim eslatmalar

- **Har kuni internet bor joyda ilovani bir marta oching** — katalog va narxlar yangilanadi,
  navbatdagi operatsiyalar yuboriladi.
- Sotuvni tez qiling — mijoz oldida daftarga qaytmang.
- Kassa/tovar farqi bo'lsa qo'rqmang — **izoh yozing**, admin ko'rib chiqadi.
- Telefon soati noto'g'ri bo'lsa tizim o'zi to'g'rilaydi (server vaqti asos).
