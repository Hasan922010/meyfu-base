# v5 — Yetishmayotgan imkoniyatlar hisoboti

> Sana: 29.09.2026 · Asos: `distribution-app-prompt-v3.md` (spetsifikatsiya), `docs/v4.md`,
> hozirgi kod (`feat/branch-isolation` branch) va brauzerdagi sinovlar.
> Har bandda: **nima yo'q → nega kerak → taxminiy hajm** (S — 1 kungacha, M — 2–4 kun, L — 1 hafta+).
> Tasdiqlash uchun band raqamlarini yozing (masalan: «A1, A2, B3 ni qil»).

---

## 0. Hozir nima bor (qisqa)

MVP, 2-faza va 3-fazaning asosiy qismi ishlaydi: katalog, ombor (kirim, qoldiq, harakat jurnali,
inventarizatsiya, ko'chirish), mijoz/marshrut, yuklama, offline sotuv (Dexie + outbox),
buyurtma (zakaz), kun yopish, xarajat va hamyon, qarzdorlik va kassa, OCR naklit, Telegram bot,
maosh (ikki bosqichli), 360° xodim kartasi, hisobot konstruktori / ABC / foyda-zarar, PDF va muhr,
butunlik tekshiruvi, boshlang'ich qoldiqlar, **filiallar** (ko'chirish, faoliyat kartalari,
hujjatlar) va endi **filiallarni ajratish** (Filial rahbari roli, o'z xodimi, o'z savdosi, o'z kassasi).

Backend: 467 test o'tadi · Frontend: 176 unit test o'tadi · `tsc` va ESLint toza.

---

## A. Filiallar bo'yicha qolgan bo'shliqlar (ajratish bilan bevosita bog'liq)

| # | Yetishmaydi | Nega kerak | Hajm |
|---|---|---|---|
| **A1** | **Filialdan markazga pul topshirish (inkassatsiya)** | Hozir har filialning o'z kassasi bor, lekin filial kassasidan markaz kassasiga pul o'tkazish hujjati yo'q. Filialda to'plangan naqd pul markazga qanday borayotgani ko'rinmaydi. | M |
| **A2** | **Hujjatga filialni «muhrlash» (Sale, DayClose, Expense, Payroll)** | Hozir sotuv filiali tarqatuvchining *joriy* filiali orqali aniqlanadi. Tarqatuvchi boshqa filialga o'tkazilsa, eski sotuvlari ham u bilan «ko'chib» ketadi. Tarix o'zgarmasligi uchun (CLAUDE.md 5) har hujjatda `branch` saqlanishi kerak. | M |
| **A3** | **Filial uchun boshlang'ich qoldiqlar** | Mijoz qarzi va kassa boshlang'ich qoldig'ini hozir faqat markaz kiritadi (filial rahbariga yopiq). Yangi filial ochilganda uning rahbari o'z ma'lumotini o'zi kirita olishi kerak. | S |
| **A4** | **Filial bo'yicha Telegram kunlik xulosa** | 20:00 dagi xulosa faqat markaz rahbarlariga, butun kompaniya bo'yicha boradi. Filial rahbari o'z filiali xulosasini olmaydi. | S |
| **A5** | **Markaz uchun filiallar kesimidagi hisobot** | Markaz hamma narsani ko'radi, lekin «Filial A vs Filial B» solishtirish jadvali (savdo, foyda, qarz, kassa) yo'q. Hisobotlarda filial filtri yo'q. | M |
| **A6** | **Ko'chirishning pul qiymati va filiallararo hisob-kitob** | Tovar ko'chirilganda tannarx bo'yicha qiymati bor, lekin filial «markazga qancha qarzdor» degan hisob yo'q (agar filiallar alohida biznes birligi sifatida baholansa). | L |
| **A8** | **Marshrut va mijoz formasida «Filial» tanlovi (markaz uchun)** | API `branch` maydonini qabul qiladi, lekin formada tanlov yo'q. Hozir filial mijozi/marshruti faqat filial rahbari yaratganda paydo bo'ladi; markaz mavjud marshrutni filialga o'tkaza olmaydi. | S |
| **A7** | **Filialga xos narx** | Hozir narx hamma filialda bir xil (siz shuni tanladingiz). Kelajakda viloyat filiallari uchun transport xarajati sababli narx farqi kerak bo'lishi mumkin. | M |

---

## B. Spetsifikatsiyada bor, lekin hali qilinmagan

| # | Yetishmaydi | Spetsifikatsiya | Nega kerak | Hajm |
|---|---|---|---|---|
| **B1** | **Mahsulotlarni Excel'dan import qilish** | 13.5 | Yuzlab tovarni birma-bir kiritish sekin; birinchi ishga tushirishda eng katta vaqt yo'qotish. | M |
| **B2** | **Xarita**: mijozlar, marshrut, dashboardda tarqatuvchilar | 12.5, 13.1, 14 | Koordinatalar saqlanyapti, lekin hech qayerda xaritada ko'rsatilmaydi. Marshrutni rejalash va tashrifni tekshirish uchun kerak. | M |
| **B3** | **Sotuvdan qaytarish (SaleReturn) UI** | 6 (Yuklash va sotuv) | API va model bor, lekin mobil ham, admin ham ekrani yo'q. Mijoz brak tovarni qaytarsa, hozir buni rasmiylashtirib bo'lmaydi. | M |
| **B4** | **PIN bilan tez kirish (mobil)** | 12.1 | Tarqatuvchi har safar to'liq parol kiritmasin — «30 soniya» tamoyili. | S |
| **B5** | **Audit log ekrani** | 13.15 | `AuditLog` yoziladi, lekin uni ko'radigan sahifa yo'q. Narx o'zgarishi, kun yopilgandan keyingi tahrirni tekshirish uchun kerak. | S |
| **B6** | **SyncLog (sinxronizatsiya jurnali)** | 6 (Tizim) | Qaysi qurilma qachon, nechta operatsiya va konflikt bilan sinxronlanganini ko'rish. Offline muammolarini tahlil qilish uchun. | S |
| **B7** | **Qo'lda tema almashtirish (light/dark)** | 20 | Hozir faqat tizim sozlamasiga qarab. Quyoshda ishlaydigan tarqatuvchi uchun qo'lda tanlash kerak. | S |
| **B8** | **CI (GitHub Actions)** | 18 | Testlar avtomatik ishlamaydi. `.github/workflows` yo'q — har push'da test/lint/tsc ishga tushishi kerak. | S |

---

## C. Biznesga qo'shimcha foyda beradigan yangi imkoniyatlar

| # | Imkoniyat | Nega kerak | Hajm |
|---|---|---|---|
| **C1** | **Kam qolgan tovar uchun avtomatik buyurtma taklifi** | Qoldiq va o'rtacha kunlik sotuvdan «3 kundan keyin tugaydi» degan ogohlantirish va zavodga buyurtma qoralamasi. | M |
| **C2** | **Mijoz uchun akt-sverka (qarz solishtirish) PDF** | Do'kon bilan qarzni solishtirishda eng ko'p so'raladigan hujjat. | S |
| **C3** | **Bluetooth termal printer chek** | Spetsifikatsiyada «kelajak»: do'konda qog'oz chek berish. | L |
| **C4** | **Marshrut optimizatsiyasi** | Kunlik tashriflar tartibini masofaga qarab tuzish. | L |
| **C5** | **Sotuv prognozi / g'ayrioddiy xarajat aniqlash (AI)** | Spetsifikatsiyada «kelajak». Hozircha ma'lumot to'planishi kerak. | L |
| **C6** | **1C bilan integratsiya (eksport)** | Buxgalteriya 1C'da yuritilsa, sotuv va kirimni avtomatik uzatish. | L |

---

## D. Tavsiya etilgan tartib

1. **Birinchi navbat (pilotdan oldin, 1 hafta):** A2, A8, A1, A3, B8, B5
   Bu bandlar ma'lumot to'g'riligi (hujjatda filial saqlanishi, pul oqimi) va xavfsizlik
   (CI, audit log) uchun. Keyin tuzatish qiyinroq bo'ladi.
2. **Ikkinchi navbat (foydalanish qulayligi, 1–2 hafta):** B1, B3, B4, A4, A5, B2
3. **Keyin:** B6, B7, C1, C2, A7
4. **Uzoq muddatli:** A6, C3–C6

---

## E. Hozirgi filial ajratishi haqida muhim eslatmalar

- **Qoida:** xodimga `is_branch=True` bo'lgan ombor biriktirilsa, u faqat shu filialni ko'radi.
  Markaz xodimlari (filialsiz yoki markaziy omborga biriktirilgan) avvalgidek hammasini ko'radi.
- **Mavjud ma'lumot:** hozirgi barcha mijoz, marshrut va kassa **markazniki** hisoblanadi.
  Filial o'z marshrut va mijozlarini o'zi yaratadi; markazdagi mavjudlarini filialga o'tkazish
  uchun formada tanlov hali yo'q (A8).
- **Tarqatuvchilar:** filial xodimi bo'lishi uchun tarqatuvchiga filial biriktirilishi shart
  (Xodimlar → Tahrir → «Filial / ombor»). Biriktirilmagan tarqatuvchi markaz xodimi hisoblanadi.
- **Katalog, narx, xarajat turlari, ta'minotchilar** — umumiy, faqat markaz o'zgartiradi.
