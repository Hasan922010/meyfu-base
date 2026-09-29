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

---

## F. Bajarilish holati (29.09.2026)

Barcha 22 band bajarildi (`feat/branch-isolation` branch, lokal commitlar, push qilinmagan).
Backend: **515 test** o'tadi · Frontend: **191 unit test**, `tsc -b`, ESLint va `vite build` toza.

| # | Holat | Qayerda |
|---|---|---|
| A1 | ✅ `df80b2d` | Moliya → «Markazga topshirish» (filial kassasi → markaz kassasi) |
| A2 | ✅ `df80b2d` | Sotuv, qaytarish, kun yopish, topshirish, xarajat, maosh, avansda `branch` muhrlanadi |
| A3 | ✅ `df80b2d` | Boshlang'ich qoldiqlar — filial rahbari o'z filiali uchun kiritadi |
| A4 | ✅ `df80b2d` | Telegram 20:00 xulosasi filial rahbariga — o'z filiali bo'yicha |
| A5, A6 | ✅ `df80b2d` | Filiallar → «Filiallar solishtiruvi» (savdo, foyda, qarz, kassa, ko'chirish qiymati) + Excel |
| A7 | ✅ `df80b2d` | Filiallar → filial → «Narxlar» (faqat SUPER_ADMIN o'zgartiradi) |
| A8 | ✅ `df80b2d` | Marshrut formasida «Filial» tanlovi; marshrut ko'chsa, mijozlari ham ko'chadi |
| B1 | ✅ `9b35518` | Mahsulotlar → «Excel'dan import» (shablon, avval tekshirish, keyin tasdiqlash) |
| B2 | ✅ `a505c5e` | Mijozlar → «Xarita»; marshrut optimallash xaritasi; dashboard — tarqatuvchilar xaritasi |
| B3 | ✅ `393dfce` | Mobil: Bosh → «Tovar qaytarish» (offline); admin: Sotuvlar → «Qaytarishlar» |
| B4 | ✅ `293623d` | Mobil: Profil → «Tez kirish (PIN)» |
| B5 | ✅ `b89e486` | Admin → «Audit jurnali» |
| B6 | ✅ `b89e486` | `SyncLog` modeli + `/sync-logs/` API (UI sahifasi hali yo'q) |
| B7 | ✅ `b89e486` | Sarlavhada ☀/🌙 tugmasi (admin va mobil) |
| B8 | ✅ `df80b2d` | `.github/workflows/ci.yml` — pytest, tsc, ESLint, vitest |
| C1 | ✅ `00d1e32` | Ombor → «Buyurtma tavsiyasi» (o'rtacha kunlik sotuv, necha kunga yetadi) |
| C2 | ✅ `8aa99e2` | Mijozlar → «Akt-sverka» (ko'rish + PDF) |
| C3 | ✅ `df5a854` | Mobil chek → «Printerda chop etish» (Web Bluetooth, ESC/POS; 58/80 mm Profil'da) |
| C4 | ✅ `5fcb34e` | Marshrutlar → «Tartibni optimallash» (eng yaqin qo'shni + 2-opt, taklif → saqlash) |
| C5 | ✅ `62ad99b` | Xarajatlar → «Odatdagidan katta xarajatlar» (z-score ≥ 2.5, jarima emas — signal) |
| C6 | ✅ `de95d0c` | Hisobotlar → «1C eksport» (XML yoki CSV) |

**Cheklovlar va eslatmalar**
- **C3:** Web Bluetooth faqat Android Chrome'da ishlaydi (iOS Safari qo'llamaydi — u yerda PDF/ulashish qoladi). Haqiqiy printerda sinab ko'rilmagan.
- **C4:** masofa to'g'ri chiziq (haversine) bo'yicha — yo'l xaritasi emas, lekin internet va pul talab qilmaydi.
- **B2:** xarita plitalari OpenStreetMap'dan yuklanadi (internet kerak). Tarqatuvchi joylashuvi faqat tashrif/sotuv paytidagi nuqta — kun bo'yi kuzatuv yo'q (CLAUDE.md 8).
- **C6:** 1C'ga to'g'ridan-to'g'ri ulanish yo'q — fayl 1C'da qayta ishlash orqali yuklanadi; 1C tomonidagi import sozlamasi buxgalter bilan kelishilishi kerak.
- Yangi npm paket: `leaflet` (+ `@types/leaflet`) — faqat xarita ochilganda yuklanadi.
