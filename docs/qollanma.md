# 📖 MeyFu Tizimi — To'liq Foydalanish Qo'llanmasi (User Manual)

> **Versiya:** 5.2 (Yangi Qadoq Birliklari, Aksiya/Bonus Tizimi va 5-Menyuli UI/UX)  
> **Loyiha:** MeyFu (`meyfu-base`) — Tarqatish, Savdo va Ombor Boshqaruvi Tizimi (ERP / WMS / SFA)  
> **Tili:** O'zbek tili (Lotin)  
> **Qurilmalar:** Kompyuter (Desktop brauzer), Planshet va Smartfonlar (Android/iOS PWA)

---

## 📌 Qo'llanma Mundarijasi

MeyFu tizimi korxonadagi har bir xodimning roliga moslashtirilgan. O'z rolingizga tegishli bo'limni tanlang:

| Rol | Kimlar uchun | Asosiy Qurilma | Maxsus Qo'llanma Hujjati |
|---|---|---|---|
| 👑 **Super Admin & Menejer** | Korxona rahbari, tijorat direktori, boshqaruvchilar | Kompyuter / Noutbuk | [`qollanma-admin.md`](./qollanma-admin.md) |
| 🚚 **Tarqatuvchi (Haydovchi)** | Yetkazib beruvchi haydovchilar, van-sale tarqatuvchilar | Mobil telefon / PWA | [`qollanma-tarqatuvchi.md`](./qollanma-tarqatuvchi.md) |
| 📝 **Zakaz Oluvchi (Agent)** | Do'konma-do'kon yurib buyurtma oluvchi savdo agentlari | Mobil telefon / PWA | [`qollanma-zakazchi.md`](./qollanma-zakazchi.md) |
| 📦 **Omborchi** | Markaziy va filial ombor mudirlari, qabul qiluvchilar | Kompyuter / Mobil | [`qollanma-omborchi.md`](./qollanma-omborchi.md) |
| 💰 **Buxgalter & Kassir** | Bosh buxgalter, kassa xodimlari, moliya tahlilchilari | Kompyuter (brauzer) | [`qollanma-buxgalter.md`](./qollanma-buxgalter.md) |

---

## 🔑 Hamma Uchun Umumiy Qoidalar

### 1. Tizimga Kirish (Login) va Xavfsizlik

1. Kompyuter yoki telefon brauzerida tizim manzilini oching (masalan: `http://localhost:5173` yoki `https://meyfu-base.uz`).
2. **Telefon raqamingiz** va **parolingiz**ni kiriting:
   * Telefon raqamni to'liq xalqaro formatda, probel va tiresiz yozing: `+998901234567`.
   * Parolni kiritib, **«Tizimga kirish»** tugmasini bosing.
3. **Mobil ilovani telefonga o'rnatish (PWA):**
   * Brauzer menyusidan **«Bosh ekranga qo'shish» (Add to Home screen)** tugmasini bosing.
   * Shundan so'ng ilova telefonda alohida dastur kabi ochiladi.
   * Telefonda bir marta kirilgach, keyingi safar tezkor **PIN-kod (4 xonali)** bilan xavfsiz ochiladi (har safar uzun parol kiritish shart emas).
4. **Parolni unutgan bo'lsangiz:** Parol faqat Super Admin tomonidan xodimlar bo'limida o'zgartirib beriladi.

---

### 2. Rollar va Ruxsatlar Matritsasi

Tizimda har bir xodim o'z vakolatiga doir ma'lumotlarni ko'radi:

| Imkoniyatlar / Bo'limlar | Super Admin | Filial Rahbari | Omborchi | Tarqatuvchi | Zakaz Oluvchi | Buxgalter |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Tizim sozlamalari va Audit | ✅ | — | — | — | — | — |
| Mahsulotlar (Katalog, Tannarx, Bonus) | ✅ | ko'radi | ko'radi | ko'radi | ko'radi | ko'radi |
| Tovar qabuli (Kirim nakladnoy, OCR) | ✅ | ✅ | ✅ | — | — | ko'radi |
| Yuklamalar (Ombordan mashinaga) | ✅ | ✅ | ✅ | tasdiqlaydi | — | — |
| Yangi Sotuv (Van-sale, Naqd/Qarz) | ✅ | ✅ | — | ✅ | — | ko'radi |
| Buyurtma olish (Zakaz olish) | ✅ | ✅ | — | ko'radi | ✅ | ko'radi |
| Hamyon va Kassa topshirish | ✅ | ✅ | — | ✅ (o'ziniki) | — | ✅ |
| Kunni Yopish (3 bosqichli kassa) | ✅ | ✅ | — | topshiradi | — | ko'radi |
| Xarajat yozish va Tasdiqlash | ✅ | ✅ | — | yozadi | — | ko'radi |
| Mijozlar qarzdorligi va Akt-sverka | ✅ | ✅ | — | undiradi | ko'radi | ✅ |
| Ikki bosqichli Oylik Maosh (Payroll) | ✅ | — | — | o'ziniki | o'ziniki | ✅ |
| Hisobotlar (Tovar harakati, P&L, ABC) | ✅ | ✅ | — | — | — | ✅ |

---

### 3. Internet Bo'lmaganda Ishlash (Offline-First Texnologiyasi)

Tarqatuvchi va Zakaz oluvchi ilovasi **internetsiz (podvalda, tog'da, bozorda) ham 100% to'liq ishlaydi**:
* Yangi sotuv, buyurtma, xarajat yoki qarz undirish amalga oshirilganda darhol **«✅ Saqlandi»** xabari chiqadi va ma'lumot telefon xotirasida (IndexedDB) xavfsiz saqlanadi.
* Ekranning yuqori o'ng burchagidagi indikator joriy holatni bildiradi:
  * 🟢 **Online:** Barcha operatsiyalar serverga to'liq yetib borgan.
  * 🟡 **Yuborilmoqda (N ta):** Internet paydo bo'ldi, N ta operatsiya navbat bilan serverga yuborilmoqda.
  * 🔴 **Offline (N ta kutmoqda):** Internet yo'q, N ta operatsiya telefon xotirasida turibdi.
* Internet paydo bo'lishi bilan dastur **avtomatik tarzda** barcha saqlangan ma'lumotlarni server bilan sinxronlaydi. Ilovani yopib qayta ochsangiz ham hech qanday ma'lumot yo'qolmaydi!

---

### 4. Yangi Standart: Qadoq Birliklari Bo'yicha Hisob-kitob

Dasturda tovarlarni nafaqat dona, balki ulgurji qadoq birliklarida sotish va buyurtma olish imkoniyati mavjud:
1. Mahsulot kartochkasida qadoq turi (masalan, *karopka, qop, xalta, pachka*) va bitta qadoqdagi dona miqdori (masalan, *1 karopka = 12 dona*) ko'rsatiladi.
2. Sotish yoki buyurtma olish paytida ekranda **«Dona»** yoki **«Qadoq (karopka)»** tanlash tugmasi chiqadi.
3. Qadoq tanlanib soni kiritilganda, tizim jonli formula asosida avtomatik hisoblaydi:
   $$\text{2 karopka} \times \text{12 dona} = \text{24 dona}$$
   $$\text{24 dona} \times \text{20 000 so'm} = \text{480 000 so'm}$$
4. Ombor va mashina qoldig'i, yuklama va buxgalteriya hisoboti doimo asosiy o'lchov birligida aniq kamayadi.

---

### 5. Yangi Standart: Aksiya va Bepul Bonus Tovarlar Tizimi

Kompaniyada xarid hajmini oshirish uchun bepul bonus tovarlar aksiyasi yo'lga qo'yilgan:
1. Masalan: *«10 ta shokolad olganga 1 ta bepul shokolad yoki 1 ta choy sovg'a»*.
2. Sotuvchi yoki zakazchi savatga tovar qo'shganda, agar hajm aksiya shartiga yetsa (masalan, 10 ta, 20 ta, 30 ta), tizim avtomatik ravishda bepul bonusni hisoblab savatga qo'shadi:
   * Bonus tovar narxi: **`0 so'm (BEPUL)`**.
   * Ekranda zumrad rangli maxsus belgi chiqadi: **«🎁 Aksiya Bonusi: +1 dona bepul»**.
3. Bepul berilgan tovar ombor va mashina qoldig'idan to'liq hisobdan chiqariladi.
4. Admin panelidagi **«Tovar harakati (Sotuv / Bonus)»** hisobotida qaysi tovardan qancha pullik sotilgani va qancha bepul bonus berilgani so'm va donasigacha aniq ko'rinadi.

---

### 6. Buxgalteriya Qat'iyligi (Append-Only Immutability)

* Tizimda pul va tovar bilan bog'liq yozuvlarni orqaga qaytarib o'chirib (`DELETE`) yoki yashirincha o'zgartirib (`UPDATE`) bo'lmaydi.
* Agar xatolik yuz bersa, buxgalteriya standartlariga muvofiq faqat **tuzatuvchi hujjat (CORRECTION)** rasmiylashtiriladi.
* Barcha amallar, narx o'zgarishlari va tizimga kirishlar **Audit jurnali**da qat'iy saqlanadi.

---

### 7. Bog'lanish va Qo'llab-quvvatlash

Tizim bo'yicha savollar, yangi xodim qo'shish yoki parolni tiklash bo'yicha korxona Super Administratoriga yoki ilova ichidagi **«Yordam» (`/admin/help` yoki `/m/help`)** bo'limiga murojaat qiling.
