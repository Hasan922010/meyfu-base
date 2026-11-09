# 📦 Foydalanish Qo'llanmasi — Omborchi (Ombor Mudiri)

> **Kim uchun:** `WAREHOUSE` (Markaziy va filial ombor mudirlari, qabul qiluvchilar)  
> **Qurilma:** Kompyuter (Desktop brauzer `/admin/warehouse`) va Smartfon (Mobil PWA `/m/warehouse`)  
> **Umumiy kirish va qoidalar:** [`qollanma.md`](./qollanma.md)

---

## 🎯 1. Omborchining Asosiy Vazifalari

Omborchi korxonaning barcha moddiy boyliklari harakatiga bevosita javobgardir:
1. Zavod va ta'minotchilardan tovarlarni **to'liq va sifatli qabul qilish (Kirim)**.
2. Savdo buyurtmalari asosida tovarlarni yig'ib, haydovchilarga **mashinaga yuklash (Yuklama)**.
3. Mobil ilovadan **mijozlardan buyurtma olish** va tovarlarni **bevosita do'konlarga tarqatish / sotish**.
4. Kechqurun haydovchilardan sotilmay ortib qolgan tovarlarni **sanab qabul qilish (Qaytarish)**.
5. Yaroqsiz (brak) yoki muddati o'tgan tovarlarni hisobga olish.
6. Rejali **inventarizatsiya** o'tkazish va ombor qoldiqlarining 100% to'g'riligini ta'minlash.

---

## 📱 2. Mobil Profil: Buyurtma Olish va Tarqatish (Yangi Imkoniyat!)

Omborchi mobil ilovasida endi to'laqonli savdo va logistika imkoniyatlari mavjud:

### 1. Buyurtma Olish (`+ Yangi Buyurtma`):
* Omborchi mobil telefondan mijozlar ro'yxatini ko'rib, yangi buyurtma olishi mumkin.
* Tovar qadoqlari (dona / karopka) bo'yicha hisob-kitob avtomatik ishlaydi.
* Aksiya doirasidagi bepul bonuslar savatga 0 so'm bo'lib tushadi.
* Olingan buyurtmalar **«Buyurtmalarim»** bo'limida ko'rinadi.

### 2. Tarqatish / Sotuv (`+ Yangi Tarqatish / Sotuv`):
* Omborchi tovarlarni bevosita xaridor yoki do'konga yetkazib sotishi mumkin.
* To'lov shakllari: Naqd, Plastik, Qarzga (muddat bilan) yoki Aralash to'lov.
* Saqlangach chek rasmiylashtiriladi va tovar qoldiqdan to'g'ri chiqariladi.

### 3. Tarqatish Yuklamalari (`Yuklamalar`):
* Mashinaga ortilgan yoki tarqatishga ajratilgan tovarlar ro'yxatini tasdiqlash va qoldiqni kuzatish.

---

## 🚚 3. Tovar Qabuli (Kirim Nakladnoy)

Zavod yoki yetkazib beruvchidan yangi tovar partiyasi kelganda tizimga rasmiylashtiriladi:

### Kompyuterda to'liq rasmiylashtirish (`/admin/warehouse`):
1. **«Kirim»** sahifasiga o'ting va **«+ Yangi Kirim»** tugmasini bosing.
2. Yetkazib beruvchi tashkilotni tanlang, yetkazib beruvchi nakladnoy raqami va sanasini kiriting.
3. Tovarlarni qidirib topib, ro'yxatga qo'shing:
   * **Qadoq miqdori:** Necha karopka / qop / xalta kelgani.
   * **Dona miqdori:** Bitta qadoqdagi donalar soni (masalan 1 karopka = 12 dona).
   * **Kirim narxi (Tannarx):** Tovarning kelish narxi.
4. **«Kirimni saqlash»** tugmasini bosing.
5. Tovar darhol ombor zaxirasiga qo'shiladi va o'zgarmas harakat jurnaliga (`StockMovement`) yoziladi.
6. Nakladnoyni **PDF** formatida yuklab olish yoki qog'ozga chop etish mumkin.

### Mobil telefonda tezkor kirim:
* Telefondagi **«Tovar qabuli»** bo'limida ham xuddi shu amallarni soddalashtirilgan ko'rinishda tezkor kiritish mumkin (internetsiz ham saqlanadi).

---

## 📸 3. AI Naklit Skani (Qog'oz Nakladnoyni OCR orqali Kiritish)

Qog'ozdagi uzun tovarlar ro'yxatini klaviaturada bittalab terib o'tirmaslik uchun sun'iy intellekt (AI OCR) texnologiyasi o'rnatilgan:

1. Mobil telefondan **«Naklit skani»** bo'limini oching.
2. Kamerani qog'oz nakladnoyga to'g'rilab, aniq va yorug' joyda suratga oling.
3. Suratni tizimga yuklang (agar bir necha varaq bo'lsa, ketma-ket yuklang).
4. Sun'iy intellekt jadvaldagi tovar nomlari, qadoqlar, miqdorlar va narxlarni bir necha soniyada o'qib oladi.
5. Natija kompyuterdagi **«Naklit skani»** sahifasida ko'rinadi:
   * Chap tomonda: qog'oz nakladnoyning asl fotosurati.
   * O'ng tomonda: AI tanib olgan tahrirlanadigan jadval.
6. Qatorlarni katalogdagi mahsulotlar bilan solishtirib tekshiring va **«Kirimga o'tkazish»** tugmasini bosing. Tizim avtomatik rasmiy kirim hujjatini yaratadi.

---

## 📦 4. Yuklamalar (Tovarni Tarqatuvchiga Berish)

Ertalab haydovchi-tarqatuvchilar mashinasiga tovar ortish:

### 1-usul: Buyurtmalar asosida yig'ish (Eng qulay)
1. Kechasi zakazchilar yiqqan va menejer tasdiqlagan buyurtmalar asosida **«Buyurtmalardan yuklama yaratish»** tugmasi bosiladi.
2. Tizim qaysi haydovchining mashinasiga qaysi tovarlardan jami qancha (necha karopka, necha dona) yuklash kerakligini avtomatik komplektatsiya qilib beradi.

### 2-usul: Erkin yangi yuklama yaratish
1. **«Yuklamalar» → «+ Yangi yuklama»** tugmasini bosing.
2. Haydovchi (tarqatuvchi) va jo'natuvchi omborni tanlang.
3. Berilayotgan tovarlar va ularning miqdorini (karopka / dona) kiriting.
4. **«Haydovchiga yuborish»** tugmasini bosing.
5. **«Yuklama varaqasi (PDF)»** ni chop etib, haydovchiga imzo chektirib oling.
6. Haydovchi o'z telefonida ro'yxatni ko'rib **«Tasdiqlash»** tugmasini bosishi bilan tovar omboringizdan chiqib, haydovchining moddiy javobgarligiga (mashina qoldig'iga) o'tadi.

---

## 🌙 5. Kechqurun — Qaytarish Qabuli (Ostatka va Brak)

Kun oxirida haydovchi kunni yopganda mashinada sotilmay qolgan tovarlarni omborga qaytaradi:

1. Haydovchi telefonidagi «Kunni yopish» ekranida qaytarilayotgan tovarlarni yozadi.
2. Omborchi jismoniy tovarlarni sanab qabul qiladi:
   * **Yaroqli tovar:** Yaxshi holatdagi tovarlar qayta ombor zaxirasiga qo'shiladi.
   * **Brak (yaroqsiz tovar):** Shikastlangan tovarlar alohida brak aktiga olinadi.
   * **Muddati o'tgan tovar:** Yaroqlilik muddati tugagan tovarlar alohida hisobga olinadi.
3. Tizim avtomatik tarzda tovar balansi formulasini chiqaradi:
   $$\text{Tovar Farqi} = \text{Ertalabki yuklama} - \text{Sotilgan tovarlar (pullik + bepul bonus)} - \text{Qaytarilgan tovar}$$
4. Agar tovar farqi 0 bo'lsa — balans to'liq to'g'ri. Farq bo'lsa — sababi ko'rsatiladi va adminga bildirishnoma boradi.

---

## 🎁 6. Aksiya va Bepul Bonus Tovarlarning Ombordagi Hisobi

* Tizimda aksiyaga qo'yilgan tovarlar mijozlarga **bepul (0 so'm)** berilsa ham, ular havoga uchib ketmaydi.
* Har bir bepul berilgan bonus tovar ombor va mashina qoldig'idan xuddi oddiy sotilgan tovardek **aniq donasigacha hisobdan chiqariladi**.
* Ombor hisoboti va qoldiqlarida hech qanday tushunarsiz kamomad vujudga kelmaydi, chunki tizim uni **«Aksiya Bonusi»** moddasi bo'yicha hisobdan chiqaradi.

---

## 📋 7. Ombor Qoldiqlari va Kam Qolgan Tovar Ogohlantirishlari

* **«Qoldiqlar»** sahifasida real vaqtdagi barcha mahsulotlar qoldig'i (dona va karopka hisobida) ko'rinadi.
* **Kam qolgan tovarlar (Low Stock Alerts):**
  * Agar mahsulot qoldig'i belgilangan minimal miqdordan kamayib ketsa, qatorda qizil ogohlantirish belgisi chiqadi.
  * Omborchi ushbu ro'yxatga qarab o'z vaqtida rahbariyatga yoki ta'minotchiga yangi tovar keltirish bo'yicha buyurtma beradi.

---

## 🔍 8. Inventarizatsiya O'tkazish

Haqiqiy tovarlar sonini tizimdagi son bilan solishtirish:
1. **«Ombor» → «Inventarizatsiya»** bo'limiga kiring va yangi inventarizatsiya hujjatini oching.
2. Tizim ombordagi barcha tovarlar ro'yxatini chiqaradi.
3. Ombor bo'ylab har bir tovarning haqiqiy sonini sanab, jadvalga kiriting.
4. Tizim avtomatik tarzda **Ortiqcha (+)** yoki **Kamomad (-)** farqlarni ko'rsatadi.
5. Rahbariyat tekshirib tasdiqlagach, tizim avtomatik tarzda tuzatuvchi harakat (`ADJUSTMENT`) yozuvini kiritib, qoldiqni haqiqiy holatga tenglashtiradi.

---

## ⚠️ Omborchi Uchun Qat'iy Qoidalar

1. **Hujjatlarsiz yoki tizimga kiritmasdan ombordan hech qanday tovar chiqarilmaydi.**
2. **Yuklamani haydovchi telefonida tasdiqlamasidan oldin mashinani ombor darvozasidan chiqarmang.**
3. **Brak va muddati o'tgan tovarlarni yaroqli tovarlarga aralashtirmang — alohida saqlang.**
4. **Har qanday tovar harakati tizimda o'zgarmas tarix bo'lib qoladi — xatolik yuz bersa, o'chirishga urinmang, tuzatuvchi akt tuzing.**
