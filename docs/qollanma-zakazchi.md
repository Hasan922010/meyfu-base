# 📝 Foydalanish Qo'llanmasi — Zakaz Oluvchi (Savdo Agenti / Pre-Seller)

> **Kim uchun:** `ORDER_TAKER` (Do'konma-do'kon yurib buyurtma oluvchi savdo vakillari)  
> **Asosiy qurilma:** Smartfon (Android / iOS) — Mobil PWA ilovasi  
> **Umumiy kirish va qoidalar:** [`qollanma.md`](./qollanma.md)

---

## 🎯 1. Zakaz Oluvchining Vazifasi va Mas'uliyati

Savdo agenti (Pre-seller) tizimdagi eng muhim bo'g'inlardan biri hisoblanadi. Uning asosiy vazifasi — o'ziga biriktirilgan marshrut bo'yicha savdo nuqtalarini aylanib, **to'g'ri, aniq va foydali buyurtmalar yig'ishdir**.

> 💡 **Diqqat:** Zakaz oluvchi xodim **mashinada tovar olib yurmaydi va mijozdan naqd pul yig'maydi!** Tovar yetkazib berish va pul qabul qilish haydovchi-tarqatuvchi (Distributor) zimmasidadir. Savdo agentining diqqati faqat sifatli buyurtma olishga qaratilgan.

---

## 📱 2. Ilovani Telefonga O'rnatish va Kirish

1. **O'rnatish:**
   * Telefon brauzerida tizim manzilini oching (Chrome yoki Safari).
   * Brauzer menyusidan **«Bosh ekranga qo'shish» (Add to Home screen)** tugmasini bosing.
   * Ilova alohida dastur ko'rinishida telefoningiz bosh ekraniga joylashadi.
2. **Kirish:**
   * Telefon raqamingizni (`+998901234567`) va parolingizni kiritib kiring.
   * Birinchi kirishda 4 xonali **PIN-kod** o'rnating. Keyingi safar do'konga kirganda PIN-kod orqali 1 soniyada ilovaga kirasiz.
3. **Internetsiz ishlash (Offline):**
   * Podvallar yoki qishloq hududlarida internet yo'q bo'lsa ham buyurtma bemalol olinadi va saqlanadi.
   * Internet paydo bo'lganda buyurtmalar serverga **avtomatik tarzda** yuboriladi.

---

## 🧭 3. Zakazchi Mobil Ekranining Tuzilishi

Ekranda savdo agenti uchun eng zarur bo'lgan bo'limlar qulay joylashtirilgan:

* 🏠 **Bosh sahifa:** Bugungi reja, olingan buyurtmalar soni, umumiy savdo summasi va hisoblangan komissiya foizi.
* 📋 **Buyurtmalarim:** Siz olgan barcha buyurtmalar va ularning yetkazilish holati.
* 📦 **Ombor qoldig'i (`/m/stock`):** Markaziy ombordagi mavjud tovarlar soni (do'konda yo'q tovarga buyurtma olib qo'ymaslik uchun).
* 👥 **Mijozlar:** Sizning marshrutingizdagi savdo nuqtalari, manzillari, telefonlari va qarz holatlari.
* 💰 **Mening maoshim (`/m/payroll`):** Olingan buyurtmalardan sizga hisoblangan oylik bonus va komissiya mablag'lari.

---

## 🛍️ 4. Buyurtma Olish Jarayoni (Bosqichma-bosqich)

Do'konga tashrif buyurganingizda buyurtma rasmiylashtirish 4 qadamda bajariladi:

### 1-qadam: Mijozni tanlash va GPS Check-in
1. Bosh ekrandagi katta **«+ Yangi Buyurtma»** tugmasini bosing.
2. Marshrutingizdagi mijozlar ro'yxatidan kerakli do'konni tanlang.
3. Tizim avtomatik ravishda tashrif joylashuvini qayd etadi (GPS Check-in).
4. Ekranda mijozning eski qarzlari va sotib olish tarixi ko'rsatiladi.

### 2-qadam: Tovarlar va Qadoq Birliklarini Tanlash
1. Tovarni qidiruv yoki toifalar bo'yicha toping.
2. Mahsulot ustiga bosganda **Qadoq tanlash oynasi** ochiladi:
   * **Dona** — donalab buyurtma qilish (masalan, 6 dona).
   * **Qadoq (karopka / qop / xalta / pachka)** — butun karopkalab buyurtma qilish (masalan, 3 karopka).
3. Tizim jonli hisob-kitob qilib donaga o'giradi:
   $$\text{3 karopka} \times \text{24 dona} = \text{72 dona} \implies \text{72 dona} \times \text{15 000 so'm} = \text{1 080 000 so'm}$$
4. **«Savatga qo'shish»** tugmasini bosing.

### 3-qadam: Bepul Aksiya Bonuslari (Avtomatik Tizim)
* Agar korxonada mahsulotga aksiya e'lon qilingan bo'lsa (masalan: *«20 karopka pechenye olganga 1 karopka vafli bepul»* yoki *«10 taga +1 ta bonus»*):
* Savatga tovar miqdori kiritilishi bilan tizim avtomatik ravishda **bepul bonus tovarini 0 so'm qilib** savatga qo'shadi!
* Savatda yorqin zumrad nishoni ko'rinadi: `🎁 Aksiya Bonusi: 1 dona (0 so'm)`.
* Bu mijozga chegirma va sovg'alarni darhol ko'rsatib, savdo hajmini oshirishga yordam beradi.

### 4-qadam: To'lov Shartlari va Yetkazish Sanasi
1. Mijoz bilan kelishilgan to'lov shaklini belgilang:
   * **Naqd** — yetkazib berilganda haydovchiga to'lanadi.
   * **Plastik / O'tkazma** — hisob raqamga yoki korporativ kartaga.
   * **Qarzga (Nasiya)** — to'lov muddatini tanlang (masalan, 7 kun, 14 kun).
2. Yetkazib berish kerak bo'lgan sanani va haydovchi uchun qo'shimcha izohni yozing.
3. **«Buyurtmani saqlash»** tugmasini bosing.

---

## 🔄 5. Buyurtma Holatlari (Lifecycle)

Siz olgan har bir buyurtma tizimda bosqichma-bosqich harakatlanadi. Siz ularni **«Buyurtmalarim»** bo'limida kuzatib borasiz:

1. 🟡 **Yangi (Kutilmoqda):** Siz kiritgan buyurtma, menejer ko'rib chiqishini kutmoqda.
2. 🔵 **Tasdiqlandi:** Menejer yoki admin buyurtmani tekshirib tasdiqladi.
3. 📦 **Yuklamaga kiritildi:** Omborchi buyurtma asosida tovarlarni mashinaga yig'di.
4. 🚚 **Yetkazilmoqda:** Haydovchi tovarni mashinaga yuklab, do'konga yo'l oldi.
5. 🟢 **Yetkazildi (Sotuvga aylandi):** Haydovchi tovarni do'konga topshirdi va pul/qarzni qabul qildi. **Aynan shu holatda sizning hisobingizga komissiya foizi to'liq yoziladi!**
6. 🔴 **Bekor qilindi:** Mijoz rad etsa yoki tovar omborda yetishmasa, sababi ko'rsatilgan holda bekor qilinadi.

---

## 💵 6. Shaxsiy Maosh va Komissiya Foizi (`/m/payroll`)

MeyFu tizimida savdo agentlarining mehnati shaffof baholanadi:

* Sizga har bir tasdiqlangan va muvaffaqiyatli yetkazilgan buyurtma summasidan maxsus **«Zakaz olgani uchun %»** (masalan, 2% – 4%) hisoblanadi.
* **Hisob-kitob formulasi:**
  $$\text{Oylik Komissiya} = \sum (\text{Yetkazilgan Buyurtmalar Summasi} \times \text{Agent Komissiya Foizi})$$
* Agar sizga fiks oylik maosh (masalan 2 000 000 so'm) belgilangan bo'lsa:
  $$\text{Jami Maosh} = \text{Fiks Maosh} + \text{Zakaz Komissiyasi} + \text{Bonuslar} - \text{Avanslar}$$
* **«Mening maoshim»** bo'limida har kuni qancha komissiya ishlaganingizni jonli ko'rib turasiz.

---

## 📌 Savdo Agenti Uchun Foydali Maslahatlar

1. **Do'konga kirishdan oldin «Ombor qoldig'i»ni tekshiring:** Omborda tugagan tovarga buyurtma olsangiz, yetkazib berilmaydi va mijoz norozi bo'ladi.
2. **Qadoqlab buyurtma oling:** Do'kon egalariga donalab emas, karopkalab olish aksiyalar va chegirmalar tufayli foydali ekanligini tushuntiring.
3. **Mijoz qarzdorligiga e'tibor bering:** Agar mijozning muddati o'tgan katta qarzi bo'lsa, tizim yangi buyurtmani qarzga yuborishni bloklashi mumkin. Avval eski qarzni yopishni so'rang.
4. **Offline paytda ishlashdan qo'rqmang:** Aloqa yo'q do'konlarda ham buyurtmalarni olavering, tashqariga chiqqanda ilova o'zi barchasini serverga uzatadi.

