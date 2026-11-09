# 🚚 Foydalanish Qo'llanmasi — Tarqatuvchi (Haydovchi / Van-Sale)

> **Kim uchun:** `DISTRIBUTOR` (Yetkazib beruvchi haydovchi, savdo agenti)  
> **Asosiy qurilma:** Smartfon (Android / iOS) — Mobil PWA ilovasi  
> **Umumiy kirish va qoidalar:** [`qollanma.md`](./qollanma.md)

---

## 📱 1. Ilovani Telefonga O'rnatish va Kirish

MeyFu mobil ilovasi internet tezligidan qat'i nazar do'konlarda tezkor ishlash uchun moslashtirilgan:

1. **O'rnatish (PWA):**
   * Telefon brauzerida (Google Chrome yoki Safari) tizim manzilini oching.
   * Brauzer menyusidagi **«Bosh ekranga qo'shish» (Add to Home screen)** tugmasini bosing.
   * Endi ilova telefoningizda oddiy ilovalar kabi alohida belgida ochiladi.
2. **Kirish:**
   * Telefon raqamingizni (`+998901234567`) va parolingizni kiriting.
   * Birinchi marta kirgach, tizim **4 xonali PIN-kod** o'rnatishni taklif qiladi. Keyingi safar ilovaga tezkor PIN-kod bilan kirasiz.
3. **Internetsiz ishlash (Offline):**
   * Ilova podvalda, qishloqda yoki internet o'chgan paytda ham to'liq ishlaydi.
   * Ekranning yuqori qismidagi holat chirog'i:
     * 🟢 **Online:** Barcha ma'lumotlar serverga yuborilgan.
     * 🟡 **Yuborilmoqda (N ta):** Internet bor, saqlangan sotuvlar serverga yuklanmoqda.
     * 🔴 **Offline (N ta kutmoqda):** Internet yo'q, barcha harakatlar telefon xotirasida xavfsiz saqlanmoqda.

---

## 🧭 2. Mobil Ilova Strukturasi (5 ta Qulay Tab)

Ekranning eng pastki qismida har doim ko'rinib turadigan 5 ta asosiy menyu joylashgan:

| Tab | Nomi | Vazifasi |
|:---:|---|---|
| 🏠 | **Bosh** (`/m/home`) | Qo'lingizdagi naqd pul, bugungi savdo ko'rsatkichlari va tezkor tugmalar |
| 🛒 | **Sotuv** (`/m/sales`) | Yangi sotuv (van-sale), chek chiqarish, sotuvlar tarixi |
| 📋 | **Buyurtma** (`/m/orders`) | Sizga biriktirilgan yetkazish buyurtmalari ro'yxati va holatlari |
| 👛 | **Hamyon** (`/m/wallet`) | Naqd pul oqimi, yo'l xarajatlari, qarz undirish va kassaga topshirish |
| 👥 | **Mijozlar** (`/m/clients`) | Marshrutdagi mijozlar, GPS check-in, telefon qilish va qarzlar |

---

## 🌅 3. Ertalab — Yuklamani Qabul Qilish va Tasdiqlash

Ertalab omborga kelganingizda omborchi mashinangizga yuklagan tovarlarni qabul qilasiz:

1. **Bosh ekrandan** yoki menyudan **«Yuklamalar»** bo'limiga kiring.
2. Omborchi sizga jo'natgan yangi yuklama kartasini oching.
3. Har bir tovarning qadoq va dona miqdorini mashinaga haqiqiy yuklangan tovarlar bilan solishtiring.
4. Agar hammasi to'g'ri bo'lsa — **«Yuklamani tasdiqlash»** tugmasini bosing.
5. **Natija:** Tovar ombor qoldig'idan chiqib, sizning **«Mashina qoldig'ingizga»** rasman o'tadi.

> ⚠️ **Muhim eslatma:** Agar miqdorda farq bo'lsa, tasdiqlashdan oldin omborchiga ayting va tuzatish kiriting. Tasdiqlangan yuklama darhol moddiy javobgarligingizga yoziladi!

---

## ⚡ 4. Do'konda — Tezkor Sotuv Qilish (Van-Sale)

Sotuv jarayoni 30 soniyada amalga oshiriladi:

### 1-qadam: Mijozni tanlash
* **«+ Yangi Sotuv»** tugmasini bosing.
* Marshrutdagi mijozlar ro'yxatidan kerakli do'konni tanlang (yoki qidiruv maydoniga do'kon nomini yozing).

### 2-qadam: Tovar va Qadoq tanlash (Yangi Qulay Imkoniyat!)
* Sotiladigan mahsulotni qidiring va ustiga bosing.
* Ochilgan oynada o'lchov turini tanlang:
  * **Dona** — dona miqdorini kiritish (masalan: 5 dona).
  * **Qadoq (karopka / qop / xalta)** — qadoq sonini kiritish (masalan: 2 karopka).
* Tizim avtomatik formulani ko'rsatadi:
  $$\text{2 karopka} \times \text{12 dona} = \text{24 dona} \implies \text{24 dona} \times \text{20 000 so'm} = \text{480 000 so'm}$$
* **«Qo'shish»** tugmasini bosing.

### 3-qadam: Aksiya va Bepul Bonus Tovarlar (Avtomatik Hisob-kitob)
* Agar mahsulot aksiyada bo'lsa va xarid miqdori yetarli bo'lsa (masalan: 10 ta olganga 1 ta bepul), tizim **avtomatik ravishda bepul bonusni savatga qo'shadi**.
* Bonus tovar narxi: **`0 so'm (BEPUL)`**.
* Savatda maxsus yashil nishon bilan aks ettiriladi: `🎁 Bonus: 1 dona bepul`.
* Sizdan qo'shimcha hech qanday harakat talab qilinmaydi! Bepul tovar ham mashina qoldig'ingizdan aniq kamayadi.

### 4-qadam: To'lov turini belgilash va Saqlash
* To'lov variantini tanlang:
  * 💵 **Naqd:** Butun summa naqd to'landi (darhol hamyoningiz balansiga qo'shiladi).
  * 💳 **Plastik / O'tkazma:** Karta orqali to'landi.
  * ⏳ **Qarzga (Nasiya):** Mijoz keyin to'laydi. Qarz muddatini tanlang (masalan: 7 kun).
  * 🔀 **Aralash to'lov:** Qisman naqd (masalan 200 000 so'm), qolgani qarzga.
* **«Sotuvni saqlash»** tugmasini bosing.
* Ekranda darhol **«✅ Saqlandi»** chiqadi va chek hosil bo'ladi. Chekni Bluetooth printerda chop etish yoki **Telegram / WhatsApp** orqali mijozga PDF qilib jo'natishingiz mumkin.

---

## 💰 5. Hamyon, Qarz Undirish va Yo'l Xarajatlari

### Hamyon Balansi (`/m/wallet`)
Hamyon sizning qo'lingizda turgan naqd pulni jonli ko'rsatadi:
$$\text{Hamyon} = \text{Naqd sotuvlar} + \text{Undirilgan qarzlar} - \text{Tasdiqlangan xarajatlar} - \text{Kassaga topshirilgan pul}$$

### Qarz Undirish:
1. **Hamyon** yoki **Mijozlar** bo'limida do'konning qarzini ko'ring.
2. **«Qarz to'lovi»** tugmasini bosing.
3. Mijoz bergan summani va to'lov turini (Naqd / Karta) kiriting.
4. Saqlang — naqd pul hamyoningizga qo'shiladi, mijoz qarzi avtomatik kamayadi.

### Yo'l Xarajatlarini Yozish:
1. **«+ Xarajat»** tugmasini bosing.
2. Xarajat turini tanlang: Yoqilg'i (Metan / Propan / Benzin), Tushlik, Moy almashtirish, Mashina yuvish, Ta'mirlash, Parkovka.
3. Summani kiriting.
4. **📷 AI Chek skaneri:** Zapravka yoki do'kon chekini rasmga olsangiz, sun'iy intellekt summani o'zi aniqlab to'ldiradi.
5. Saqlash tugmasini bosing. Kiritilgan xarajat hamyondagi naqd pulingizdan kamayadi.

---

## 🌙 6. Kechqurun — Kunni Yopish (3 Bosqichli Kassa Topshirish)

Ish kuni yakunlanganda mashinada qolgan tovarlar va yig'ilgan naqd pul korxona ombori hamda kassasiga topshiriladi. Bu jarayon **3 bosqichli qulay vizard (DayClose)** orqali amalga oshiriladi:

```
[ 1. Tovar Qoldig'i ] ───► [ 2. Pul Hisob-kitobi ] ───► [ 3. Yakuniy Tasdiq ]
```

### 1-bosqich: Tovarlarni omborga topshirish
* Ekranda sizga yuklangan, sotilgan va mashinada qolgan tovarlar ro'yxati chiqadi.
* Omborga qaytarayotgan tovar miqdorini kiriting:
  * **Yaroqli tovar** (omborga qayta sotuvga olinadi).
  * **Brak / Yaroqsiz tovar** (alohida akt qilinadi).
  * **Muddati o'tgan tovar**.
* Tizim avtomatik tovar farqini ko'rsatadi:
  $$\text{Farq} = \text{Ertalabki yuklama} - \text{Sotilgan tovarlar (bonuslar bilan)} - \text{Qaytarilgan tovarlar}$$

### 2-bosqich: Pulni kassaga topshirish
* Tizim bugungi ishlaringiz bo'yicha **Kutilgan naqd pul**ni hisoblab ko'rsatadi:
  $$\text{Kutilgan Naqd} = \text{Naqd sotuvlar} + \text{Undirilgan qarzlar} - \text{Yo'l xarajatlari}$$
* **Topshirilayotgan haqiqiy summa**ni kiriting.
* Agar kassa farqi (kamomad yoki ortiqcha pul) bo'lsa, tizim darhol ko'rsatadi:
  * Manfiy farq (kamomad) bo'lsa, pastdagi maydonga **sababini izoh qilib yozing** (masalan: *«Mijoz 20 000 so'm keyingi safarga berishini aytdi»*). Bu jarima emas, oydinlik kiritish uchun kerak.

### 3-bosqich: Yakuniy tasdiq
* Barcha tovar va pul ko'rsatkichlari yakuniy ko'rinishda taqdim etiladi.
* **«Kunni yopish va topshirish»** tugmasini bosing.
* Hujjat kassa va omborga tasdiqlash uchun yuboriladi.

---

## 📊 7. Mening Maoshim va Shaxsiy Hisobotim

* **Mening Maoshim (`/m/payroll`):**
  * Oylik maoshingiz qanday shakllanayotganini kunma-kun kuzatishingiz mumkin.
  * Tizimda sizga berilgan stavka asosida hisoblanadi:
    * **Yetkazib berganlik uchun %** (yetkazilgan sotuvlar summasidan foiz).
    * **Zakaz olganlik uchun %** (agar o'zingiz zakaz olgan bo'lsangiz).
    * Asosiy oylik maosh (fiks).
    * Ushlanmalar (avanslar, asosli kamomadlar).
* **Mening Hisobotim (`/m/reports`):**
  * Bugungi, haftalik va oylik sof savdo hajmi, tashriflar samaradorligi va rejaning bajarilish foizi.

---

## 💡 Haydovchi Uchun 5 Oltin Qoida

1. **Ertalab yuklamani sanamasdan turib tasdiqlamang.**
2. **Do'konga kirganda birinchi bo'lib qarzini tekshiring va GPS check-in qiling.**
3. **Qadoqlab sotishda qadoq tugmasidan foydalaning (karopka hisobida xato qilmaysiz).**
4. **Xarajat qilganda chekni darhol suratga oling.**
5. **Kunni har kuni kechiktirmasdan yoping — bu maoshingiz to'g'ri chiqishining asosiy garovidir.**
