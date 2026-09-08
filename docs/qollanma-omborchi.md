# Qo'llanma — Omborchi

**Kim uchun:** WAREHOUSE · **Qurilma:** kompyuter yoki telefon

> Umumiy qoidalar (kirish, offline): [`qollanma.md`](./qollanma.md)

Omborchining vazifasi: tovarni **qabul qilish**, tarqatuvchilarga **yuklash**, kechqurun
ostatka va brakni **qaytarib olish**, vaqti-vaqti bilan **inventarizatsiya**.

Telefonda kirsangiz — soddalashtirilgan mobil ekran (qabul, skan, qoldiq). Kompyuterda
kirsangiz — to'liq ombor bo'limi.

---

## Telefonda (tez ish)

Bosh sahifada 3 ta tugma:

### 1. Tovar qabuli
Zavoddan kelgan tovarni tez kiritish:
1. Yetkazib beruvchi, nakladnoy raqami, sanani tanlang.
2. Tovarni qidiring → miqdor va narxni kiriting → «+».
3. Bir necha tovar qo'shing.
4. **«Qabulni saqlash»** → tovar omborga tushadi.

Internet yo'q bo'lsa ham saqlanadi, keyin avtomatik yuboriladi.

### 2. Naklit skani
Nakladnoyni qo'lda yozmay, **kamera bilan** suratga oling:
1. «Naklit skani» → kamerani naklitga to'g'rilang (ramka ichiga).
2. Sifat past bo'lsa (xira, qiyshiq, qorong'i) — ilova ogohlantiradi, qayta oling.
3. Suratni yuboring. Bir necha varaq bo'lsa hammasini oling.
4. Sun'iy intellekt naklitni o'qiydi (bir necha soniya–daqiqa).
5. Natija **admin paneldagi "Naklit skani"** bo'limiga tushadi — u yerda inson
   tekshiradi va tasdiqlaydi (kompyuterda).

> Skan aniqligi past bo'lsa — «Tovar qabuli» dan qo'lda kiriting, tezroq bo'ladi.

### 3. Ombor qoldig'i
Har tovarning joriy qoldig'ini qidiruv orqali ko'rish.

---

## Kompyuterda (to'liq ish) — `/admin/warehouse`

Uch bo'lim:

### Qoldiq
Har ombor bo'yicha tovar qoldig'i. **Kam qolganlar** ajratib ko'rsatiladi —
ular ustidan ishlang (yetkazib beruvchiga buyurtma).

### Kirim
Telefondagi «Tovar qabuli» bilan bir xil, lekin batafsilroq. «Yangi kirim» →
yetkazib beruvchi, nakladnoy №, sana → tovarlar → saqlash. Tovar omborga tushadi,
harakat jurnaliga (`StockMovement`) yoziladi — **o'chirib bo'lmaydi**.

Saqlagandan keyin **PDF / Pechat** tugmalari bilan nakladnoyni chop etish mumkin.

### Yuklamalar
Ertalab tarqatuvchiga tovar berish:
1. **«Yangi yuklama»** → tarqatuvchi, ombor, sana.
2. Tovar va miqdorlarni kiriting. (Yoki admin «Buyurtmalar → Yuklamaga yig'ish» dan
   tayyor yuklama yaratadi — u ham shu ro'yxatda ko'rinadi.)
3. **«Yuborish»** → tarqatuvchi telefonida ko'radi.
4. Tarqatuvchi **tasdiqlagandan keyin** tovar uning «mashina qoldig'iga» o'tadi va
   sizning ombordan chiqadi.
5. **PDF** — yuklama varaqasini chop etish (tarqatuvchi imzo qo'yadi).

---

## Kechqurun — qaytarish qabuli

Tarqatuvchi kunni yopayotganda sotilmagan tovarni qaytaradi:

1. Tarqatuvchi telefonida qaytarish ro'yxatini tuzadi (yaxshi tovar / brak / muddati
   o'tgan — alohida).
2. Siz omborda tovarni sanab, **qabul qilasiz** (admin panel — kunlik hisob-kitob yoki
   qaytarish ekrani).
3. Yaxshi tovar omborga qaytadi, brak alohida hisoblanadi.
4. **Tovar farqi** avtomatik hisoblanadi: `yuklangan − sotilgan − qaytarilgan`.
   Farq bo'lsa — admin va tarqatuvchi ko'radi, izoh so'raladi (ayblovsiz).

---

## Inventarizatsiya

Vaqti-vaqti bilan haqiqiy qoldiqni tizimdagi bilan solishtirish:
1. Admin panelda inventarizatsiya boshlanadi.
2. Har tovar bo'yicha haqiqiy sanoqni kiriting.
3. Farqlar ko'rsatiladi → tasdiqlasangiz tuzatuvchi harakat (`ADJUSTMENT`) yoziladi.

---

## Nimaga e'tibor berish

- **Har tovar harakati doimiy saqlanadi.** Xato kiritgan bo'lsangiz — o'chirolmaysiz,
  adminga ayting, u tuzatuvchi yozuv qo'shadi.
- Yuklama yuborishdan oldin miqdorlarni ikki marta tekshiring — tarqatuvchi
  tasdiqlagandan keyin o'zgartirish qiyin.
- Naklit skanida sifatli surat = kam tuzatish. Yorug' joyda, tekis qo'yib, to'liq ramka ichiga.
