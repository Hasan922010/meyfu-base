# Qo'llanma — Super admin va Menejer

**Kim uchun:** SUPER_ADMIN, MANAGER · **Qurilma:** kompyuter (brauzer) · **Manzil:** `/admin`

> Umumiy qoidalar (kirish, offline, rollar): [`qollanma.md`](./qollanma.md)
> **Menejer** quyidagilarga ruxsatsiz: narx/foizni o'zgartirish, xodim yaratish, sozlamalar,
> maosh tasdiqlash. Qolgan hamma bo'lim ochiq.

---

## Ish tartibi (tavsiya etilgan ketma-ketlik)

Tizimni **birinchi marta** sozlashda shu tartibda yuring:

1. **Sozlamalar → Kompaniya rekvizitlari** — nom, STIR, manzil, bank, direktor, logo, muhr.
2. **Ma'lumotnomalar** — omborlar, yetkazib beruvchilar, o'lchov birliklari, kategoriyalar,
   brendlar, xarajat kategoriyalari (limit va "chek majburiy" bilan).
3. **Mahsulotlar** — har bir tovar: nom, kategoriya, narxlar, rasm.
4. **Xodimlar** — tarqatuvchi, omborchi, menejer, buxgalter qo'shish.
5. **Marshrutlar** — har tarqatuvchiga marshrut, unga mijozlar biriktirish.
6. **Boshlang'ich qoldiqlar** (bo'lim 13) — tovar, kassa, ta'minotchi, mijoz, xodim
   boshlang'ich holatini kiriting.

Shundan keyin kundalik ish boshlanadi.

---

## 1. Dashboard (Bosh sahifa)

Jonli (real-time) ko'rsatkichlar: bugungi savdo, foyda, naqd, xarajat, tashriflar,
faol tarqatuvchilar, jonli lenta (yangi sotuvlar), xaritada tarqatuvchilar joylashuvi.
Internet uzilsa ham ochiq turadi, faqat yangilanish to'xtaydi.

**Diqqat belgilar** (qizil/sariq): narxdan past sotuv, limitdan oshgan xarajat, katta kassa
farqi, kam qolgan tovar — bosib tafsilotga o'ting.

## 2. Mahsulotlar

- **Qo'shish / tahrirlash:** nom, SKU, shtrix-kod, kategoriya, brend, birlik.
- **Narxlar:** tannarx (`cost_price`), optom, chakana, **minimal narx** (`min_price` —
  bundan past sotib bo'lmaydi). Narx o'zgarishi tarixga va audit jurnaliga yoziladi.
- **Rasm galereyasi:** bir nechta rasm yuklash mumkin, birinchisi avtomatik asosiy bo'ladi.
  «Asosiy qilish» / «O'chirish» / tartibni ‹ › bilan o'zgartirish. Tarqatuvchi telefonida
  tovarni rasmi bilan ko'radi — adashmaydi.
- `min_stock_alert` — shu miqdordan kamaysa "kam qoldi" ogohlantirishi chiqadi.
- **Boshlang'ich qoldiq** — mahsulotni saqlagandan keyin **«Boshlang'ich qoldiqlar»**
  bo'limidan (bo'lim 13) kiritasiz.

> Narx va foizni faqat **SUPER_ADMIN** o'zgartiradi.

## 3. Ombor

Uch bo'lim (tab):

### Qoldiq
Har ombor bo'yicha tovar qoldig'i. Kam qolganlar ajratib ko'rsatiladi.

### Kirim (nakladnoy)
Zavoddan kelgan tovarni kiritish:
1. «Yangi kirim» → yetkazib beruvchi, nakladnoy raqami, sana.
2. Tovarlarni qo'shing (tez kiritish formasi): tovar, miqdor, narx.
3. Saqlang → tovar omborga tushadi, `StockMovement` yoziladi.
4. **PDF / Pechat** tugmalari — nakladnoyni rasm va muhr bilan chop etish.

> Naklitni qo'lda kiritish o'rniga **kamera bilan skanerlash** — «Naklit skani» bo'limi (quyida).

### Yuklamalar
Ertalab tarqatuvchiga beriladigan tovar:
1. «Yangi yuklama» → tarqatuvchi, ombor, sana.
2. Tovar va miqdorlarni kiriting (yoki tasdiqlangan buyurtmalardan yig'ing — «Buyurtmalar» bo'limi).
3. «Yuborish» → tarqatuvchi telefonida ko'radi va **tasdiqlaydi**.
4. Tasdiqlangach tovar tarqatuvchining "mashina qoldig'iga" (VanStock) o'tadi.
5. **PDF** — yuklama varaqasini chop etish.

## 4. Naklit skani (OCR)

Omborchi yuklagan naklit rasmlari shu yerga tushadi:
- **Navbat:** UPLOADED → PROCESSING → **NEEDS_REVIEW** → CONFIRMED.
- **Tekshirish ekrani:** chapda naklit rasmi (kattalashtirish/burish), o'ngda tahrirlanadigan
  jadval. Past ishonchli kataklar **sariq** rangda.
- Har bir qatorni katalogdagi tovarga moslang (aniq / o'xshash / yangi). Tasdiqlaganingizda
  har tuzatish eslab qolinadi — keyingi safar OCR to'g'ri taniydi.
- Tasdiq → avtomatik Kirim (Purchase) + omborga tushadi.
- **Metrikalar:** qator aniqligi, tuzatish ulushi, bitta skan narxi (API xarajati), tasdiq
  vaqti. Aniqlik 85% dan past bo'lsa — qo'lda kiritish tezroq, «Naklit skani» o'rniga
  «Ombor → Kirim» dan foydalaning.

## 5. Mijozlar va Marshrutlar

- **Mijozlar:** nom, egasi, telefon, manzil, joylashuv (xarita), tur, **qarz limiti**,
  STIR, "bloklangan" belgisi, izoh.
  - Bloklangan mijozga faqat **naqd** sotiladi.
  - **O'chirish** — mijozlar ro'yxatidagi «O'chirish» tugmasi (tasdiq so'raladi).
    Yumshoq o'chirish — mijoz ro'yxatdan yo'qoladi, lekin oldingi sotuv/qarz tarixi
    saqlanadi (CLAUDE.md 5 — ma'lumot yo'qolmaydi). MANAGER va SUPER_ADMIN uchun.
  - **Boshlang'ich qarz** (mavjud mijoz uchun, sotuvsiz) — **«Boshlang'ich qoldiqlar»**
    bo'limidan (bo'lim 13) kiritiladi.
- **Marshrutlar:** nom, biriktirilgan tarqatuvchi, ish kunlari. Mijozlarni marshrutga
  biriktiring — tarqatuvchi shu ro'yxatni telefonida ko'radi.
- Mijoz kartasida: sotuvlar tarixi, qarzlari, tashriflar.

## 6. Sotuvlar

Barcha sotuvlar jadvali: filtr (sana, tarqatuvchi, mijoz, to'lov turi), tafsilot,
**bekor qilish** (sabab bilan, audit jurnaliga tushadi), Excel eksport.
Narxdan past yoki qarz limitidan oshgan sotuvlar belgilangan (flag).

## 7. Buyurtmalar (zakaz)

Tarqatuvchi yig'gan zakazlar:

### Ro'yxat
Holat bo'yicha filtr (qoralama, berilgan, tasdiqlangan, yuklangan, yetkazilgan).
Tafsilot modalida **«Tasdiqlash»** yoki **«Bekor qilish»**.

### Yuklamaga yig'ish
Tarqatuvchi + ombor tanlang → tasdiqlangan buyurtmalarni belgilang → «Yuklama yaratish».
Bir necha buyurtma bitta yuklamaga birlashadi.

## 8. Xarajatlar

Tarqatuvchilarning yo'l xarajatlari (yoqilg'i, tushlik, ta'mirlash...):
- Har biri: summa, kategoriya, chek rasmi, joylashuv, izoh.
- **Tasdiqlash / Rad etish.** Rad etsangiz **sababini** yozing — tarqatuvchi ko'radi.
- Limitdan oshganlar avtomatik "kutilmoqda" holatida — ular ajratib ko'rsatiladi.
- Diagramma: kategoriya bo'yicha taqsimot.

## 9. Kunlik hisob-kitob (kun yopish)

Tarqatuvchi kunni yopganda shu yerga tushadi:
- Jadval: har kun bo'yicha **kassa farqi** va **tovar farqi**.
- "Faqat farqli kunlar" filtri.
- Qatorni oching → to'liq tafsilot (yuklandi, sotildi, qaytdi, kutilgan naqd, topshirilgan naqd).
- **«Tasdiqlash»** → kun yakunlanadi. Shundan keyin o'sha kunni faqat SUPER_ADMIN,
  sabab bilan tahrirlaydi (audit jurnaliga tushadi).

Formulalar:
```
kutilgan naqd  = naqd sotuv + undirilgan qarz − tasdiqlangan naqd xarajatlar
kassa farqi    = topshirilgan naqd − kutilgan naqd     (manfiy = kamomad)
tovar farqi    = yuklangan − sotilgan − qaytarilgan
```

## 10. Qarzdorlik

- Yoshi bo'yicha tahlil (aging): 0–7, 8–14, 15–30, 30+ kun.
- Muddati o'tgan qarzlar ajratilgan.
- Mijoz bo'yicha to'lov qabul qilish, eslatma yuborish.

## 11. Moliya

- **Umumiy:** kassa balansi, tushum, yalpi foyda, tarqatuvchi xarajatlari, kompaniya xarajatlari.
- **Kassa:** barcha kirim/chiqim harakatlari (append-only jurnal). Kassa boshlang'ich
  qoldig'i endi **«Boshlang'ich qoldiqlar»** bo'limidan (bo'lim 13, faqat SUPER_ADMIN)
  kiritiladi.
- **Kompaniya xarajatlari:** ijara, ish haqi fondi va h.k. qo'shish.

## 12. Xodimlar

- **Qo'shish:** telefon (login), F.I.SH., rol, parol, passport, ishga kirgan sana.
- **Xodim profili (maosh)** — **barcha rol turlari uchun** (tarqatuvchi, omborchi, menejer,
  buxgalter, super admin):
  - **Asosiy maosh** — oylik maosh hisoblashda (bo'lim 15) ishlatiladi.
  - **Boshlang'ich balans** — xodim yaratishda shu yerdan (ixtiyoriy) kiritish mumkin,
    yoki **mavjud** xodim uchun keyinroq **«Boshlang'ich qoldiqlar»** bo'limidan
    (bo'lim 13). Ikkalasida ham: «Xodimga berilgan (avans)» yoki «Xodimning qarzi»
    tugmasi bilan yo'nalishni tanlang, so'ng summani kiriting — xodimning hamyoniga
    bir martalik yozuv sifatida tushadi.
  - Faqat **DISTRIBUTOR** rolida qo'shimcha sozlamalar ochiladi: **Zakaz olgani uchun %**
    va **Yetkazib bergani uchun %** (ikki bosqichli komissiya), "Komissiya %" (eski —
    yuqoridagi ikkitasi 0 bo'lsagina ishlatiladi), oylik reja, qarz limiti, kunlik xarajat
    limiti, mashina raqami, "Minimal narxdan past sotishga ruxsat" belgisi.
- **Bloklash / Faollashtirish** — bloklangan xodim tizimga **vaqtincha** kira olmaydi
  (audit jurnaliga tushadi), lekin ro'yxatda ko'rinishda qoladi.
- **O'chirish** — xodimlar ro'yxatidagi «O'chirish» tugmasi (tasdiq so'raladi). Bloklashdan
  farqli — xodim ro'yxatdan butunlay yo'qoladi va tizimga kira olmaydi, lekin oldingi
  sotuv/maosh/hamyon tarixi saqlanadi (yumshoq o'chirish — CLAUDE.md 5). O'zingizni
  o'chira olmaysiz.
- **Parol o'rnatish** — tahrirlashda yangi parol kiriting (bo'sh qoldirsangiz o'zgarmaydi).

> Xodim yaratish/bloklash/o'chirish/parol — faqat **SUPER_ADMIN**.

## 13. Boshlang'ich qoldiqlar

Tizimni birinchi marta sozlashda (yoki mavjud yozuvlarga tuzatish kiritishda) barcha
"boshlang'ich holat"larni **bitta bo'limda**, alohida-alohida sahifada (tab) kiritasiz:

- **Tovarlar** — mahsulot + ombor tanlang, miqdorni kiriting. Mavjud mahsulotlar uchun
  ham ishlaydi (yaratish paytida kiritishga majbur emassiz).
- **Kassa** — «Kassada bor (+)» / «Kamomad (−)» + summa. Faqat **SUPER_ADMIN**.
- **Ta'minotchilar** — ta'minotchi tanlang, «Biz qarzdormiz (+)» / «U qarzdor (−)» +
  summa. Faqat **SUPER_ADMIN**. **Diqqat:** bu faqat boshlang'ich holat uchun — keyingi
  xaridlar va to'lovlar bu balansga avtomatik qo'shilmaydi.
- **Mijozlar** — mijoz tanlang, boshlang'ich qarz summasini kiriting. Mijozning
  qarzdorligiga (bo'lim 5, 10) darhol qo'shiladi.
- **Xodimlar** — xodim tanlang, «Xodimga berilgan (avans)» / «Xodimning qarzi» + summa.
  Faqat **SUPER_ADMIN**.

Har bir tabda pastda oxirgi kiritilgan yozuvlar ro'yxati ko'rinadi.

## 14. Tarqatuvchilar — 360° karta

Har tarqatuvchi uchun to'liq ko'rinish. Yuqorida davr tanlagich (Bugun / Hafta / Oy / ...).

- **KPI kartalar:** sotuv, sof foyda, naqd yig'ildi, xarajat, topshirildi, qo'lda qolgan,
  qarz berdi/undirdi, kamomad, reja bajarilishi, taxminiy maosh (oldingi davr bilan ▲▼).
- **Tablar:** Umumiy (grafiklar) · Pul harakati (kunlik, farqli kunlar qizil) · Sotuvlar ·
  Xarajatlar · Mijozlar · Mahsulotlar · Qarzdorlik · Kunlik jurnal · Maosh · Faollik (audit).
- **Eksport:** butun karta yoki tab → Excel / PDF.
- **Solishtirish:** bir nechta xodimni yonma-yon + reyting.

## 15. Maosh

### Hisoblash
Davr va xodim tanlang → «Hisoblash». **Barcha rol turlari** uchun ishlaydi — nafaqat
tarqatuvchi: tarqatuvchi uchun asosiy maosh + sotuvdan foiz (zakaz + yetkazish alohida
ko'rsatiladi); omborchi/menejer/buxgalter/super admin uchun — asosiy maosh (bo'lim 12'da
kiritilgan), komissiya har doim 0 bo'ladi (ular sotuv qilmaydi). Qolgan komponentlar
hammaga baravar: bonus, ushlanmalar (kamomad, kassa farqi, avans), xarajat qaytarimi,
yakuniy summa. Holat: qoralama → **tasdiqlangan** → to'langan.

### Komissiya qoidalari
Umumiy / kategoriya / mahsulot / tarqatuvchi darajasida foiz qoidalari (eski, bir bosqichli
tizim uchun). Aniqrog'i yutadi.

### Avanslar
Tarqatuvchiga berilgan avanslar — keyingi maoshdan ushlanadi.

> Maoshni tasdiqlash / to'langan deb belgilash — **SUPER_ADMIN** yoki **BUXGALTER**.

## 16. Hisobotlar

- **Konstruktor:** o'lchov (kun / tarqatuvchi / mahsulot / mijoz) + filtr → jadval.
- **ABC tahlil:** Pareto — qaysi mahsulot/mijoz aylanmaning 80% ini beradi.
- **Foyda-zarar:** davr bo'yicha P&L.
- Har birini Excel / PDF ga yuklab olish mumkin.

## 17. Tizim salomatligi

- Xizmatlar holati (baza, kesh, disk, fon vazifalar).
- **Butunlik tekshiruvi:** hamyon/ombor balansi jurnal yig'indisiga mos keladimi.
  Farq bo'lsa — SUPER_ADMIN shu yerdan tuzatadi (jurnalga tegilmaydi, faqat hisoblangan
  qiymat jurnalga moslanadi).
- Backup holati (oxirgi nusxa yoshi va hajmi).
- Sinxronizatsiya ziddiyatlari, OCR navbati.

## 18. Sozlamalar

- Til (o'zbek / rus / ingliz), tema (yorug' / qorong'i).
- **Telegram** — hisobingizni bir martalik kod bilan ulash (kunlik xulosa va ogohlantirishlar keladi).
- **Kompaniya rekvizitlari** — nom, STIR, manzil, bank, direktor, **logo va muhr**
  (nakladnoy va cheklarda ishlatiladi). Faqat SUPER_ADMIN tahrirlaydi.

---

## Telegram bot

Hisobingizni ulaganingizdan keyin (Sozlamalar → Telegram):
- Har kuni **20:00 da kunlik xulosa**: savdo, foyda, naqd, xarajat, qarz, kim qancha sotdi,
  farqli kunlar.
- Darhol ogohlantirish: narxdan past sotuv, limitdan oshgan xarajat, katta kassa farqi,
  kam qolgan tovar.
- Tugmalar orqali: bugungi hisobot, xodimlar, qarzdorlar, xarajatni tasdiqlash.
