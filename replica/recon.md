# Recon xaritasi: MeyFu — Distribyutsiya va Savdo Boshqaruv Tizimi

Sanoat: **FMCG / Maishiy kimyo va oziq-ovqat distribyutsiyasi ERP + Mobil PWA**
Stek: **Django 5.1 + DRF + Channels (Backend)** · **React 19 + TypeScript + Vite + Tailwind + Dexie (Frontend)**

## 1. Ekranlar inventari (`S01–S28`)

| ID | Ekran nomi | Manzil (Route) | Rollar | Asosiy vazifasi |
| --- | --- | --- | --- | --- |
| `S01` | Kirish (Login) | `/login` | Barcha | Telefon + parol orqali JWT kirish va Telegram OTP parol tiklash |
| `S02` | Boshqaruv paneli | `/admin` | Admin / Menejer / Buxgalter | KPI kartalar, savdo dinamikasi, top tarqatuvchilar va jonli xarita |
| `S03` | Mahsulotlar katalogi | `/admin/products` | Admin / Menejer / Omborchi | Mahsulotlar, narxlar, blok soni (`pack_quantity`), Excel import/eksport |
| `S04` | Ombor boshqaruvi | `/admin/warehouse` | Admin / Menejer / Omborchi | Qoldiqlar, xarid (`Purchase`), yuklama (`Loading`), ko'chirish va inventarizatsiya |
| `S05` | Filiallar | `/admin/branches` | Admin / Menejer | Filiallar, filial omborlari/kassalari va filialga xos narxlar (`BranchPrice`) |
| `S06` | Nakladnoy OCR skaneri | `/admin/ocr` | Admin / Menejer / Omborchi | Qog'oz nakladnoy rasmidan avtomatik xarid qoralamasini yaratish |
| `S07` | Mijozlar va 360° karta | `/admin/clients` | Admin / Menejer / Buxgalter | Mijozlar ro'yxati, qarz limiti, solishtirma dalolatnoma (akt sverki PDF) |
| `S08` | Marshrutlar | `/admin/routes` | Admin / Menejer | Hafta kunlari bo'yicha marshrutlar va GPS nuqtalarini optimallashtirish |
| `S09` | Sotuvlar jurnali | `/admin/sales` | Admin / Menejer / Buxgalter | Barcha sotuvlar, to'lov turlari va minimal narxdan past (`FLAGGED`) sotuvlar |
| `S10` | Oldindan buyurtmalar | `/admin/orders` | Admin / Menejer / Omborchi | Zakazchik (`ORDER_TAKER`) buyurtmalarini ko'rib chiqish va sotuvga aylantirish |
| `S11` | Xarajatlar | `/admin/expenses` | Admin / Menejer / Buxgalter | Tarqatuvchilarning dala va yoqilg'i xarajatlarini tasdiqlash yoki rad etish |
| `S12` | Kunlik hisob (Day Close) | `/admin/day-close` | Admin / Menejer / Buxgalter | 3 bosqichli kun yopish, qaytgan yuk va naqd topshirishni (`CashHandover`) tasdiqlash |
| `S13` | Qarzdorlik | `/admin/debts` | Admin / Menejer / Buxgalter | Muddati o'tgan va faol qarzlar, to'lovlar tarixi (`DebtPayment`) |
| `S14` | Moliya va kassa | `/admin/finance` | Admin / Menejer / Buxgalter | Markaziy va filial kassalari, inkassatsiya (`to-center`), korxona xarajatlari |
| `S15` | Xodimlar | `/admin/staff` | Admin / Menejer | Xodimlar, rollar, filialga biriktirish, maosh va komissiya stavkalari |
| `S16` | Tarqatuvchilar 360° | `/admin/distributors` | Admin / Menejer / Buxgalter | Tarqatuvchi hamyoni, mashina qoldig'i (`VanStock`), sotuv va qarz ko'rsatkichlari |
| `S17` | Maosh va avanslar | `/admin/payroll` | Admin / Buxgalter | Oylik maosh hisoblash, buyurtma + yetkazish komissiyasi va avanslar |
| `S18` | Hisobotlar | `/admin/reports` | Admin / Menejer / Buxgalter | Foyda va zarar (P&L), mahsulot aylanmasi, filial hisobotlari, 1C eksport |
| `S19` | Tizim salomatligi va Tozalash | `/admin/system` | `SUPER_ADMIN` | 6 ta jurnal butunligi tekshiruvi, Backup/Restore va **Soxta operatsiyalarni tozalash** |
| `S20` | Audit jurnali | `/admin/audit` | `SUPER_ADMIN` | O'zgarmas (`immutable`) tizim va xavfsizlik hodisalari jurnali |
| `S21` | Sinxronizatsiya jurnali | `/admin/sync-log` | Admin / Menejer | Mobil oflayn navbatdan kelgan `bulk-sync` paketlari tarixi |
| `S22` | Ma'lumotnomalar | `/admin/refdata` | Admin / Menejer | Kategoriyalar, brendlar, o'lchov birliklari va xarajat turlari |
| `S23` | Boshlang'ich qoldiqlar | `/admin/opening-balances` | `SUPER_ADMIN` | Tizimni ishga tushirishda qoldiqlarni ommaviy kiritish va omborni qulflash |
| `S24` | Sozlamalar | `/admin/settings` | `SUPER_ADMIN` | Korxona rekvizitlari, valyuta, kun qulfi, tozalash ruxsati (`allow_test_cleanup`), Telegram bot |
| `S25` | Mobil Tarqatuvchi (PWA) | `/app/*` | `DISTRIBUTOR` | Marshrut, yangi sotuv, qarz yig'ish, xarajat kiritish, yuk qabul qilish va kun yopish |
| `S26` | Mobil Zakazchik | `/orders/*` | `ORDER_TAKER` | Mijozlardan oldindan buyurtma olish va bonuslarni kuzatish |
| `S27` | Mobil Omborchi | `/warehouse/*` | `WAREHOUSE` | Mashinaga yuklash (`Loading`), qaytgan yukni sanash va ombor qoldig'i |
| `S28` | Mobil IshBoshqaruvchi | `/supervisor/*` | `BRANCH_MANAGER` | Filial KPI, xodimlar faoliyati va tasdiqlash jarayonlari |

## 2. Asosiy foydalanuvchi oqimlari (`F01–F11`)

- **`F01` Kirish va rollar bo'yicha yo'naltirish:** JWT kirish, ko'p oynali token yangilanishi va rolga mos sahifaga yo'naltirish.
- **`F02` Katalog, xarid va mashinaga yuklash:** Ta'minotchidan kirim (`IN_PURCHASE`) -> tarqatuvchi mashinasiga yuklash (`OUT_LOADING`) -> `VanStock` hosil bo'lishi.
- **`F03` Dala sotuvi va qarz undirish:** Naqd/karta/nasiya sotuv -> `VanStock` kamayishi, `WalletTransaction` va `Debt` yaratilishi -> qarz to'lovi (`DebtPayment`).
- **`F04` Tarqatuvchi xarajatlari:** Yoqilg'i va dala xarajati -> admin tasdiqlashi -> hamyon balansidan chegirish va `DayClose` snapshotini yangilash.
- **`F05` 3 bosqichli kun yopish (`DayClose`):** Qolgan yukni omborga qaytarish (`DailyReturn`) + naqd pulni kassaga topshirish (`CashHandover`).
- **`F06` Moliya va filial inkassatsiyasi:** Filial kassasidan markaziy kassaga juftlangan o'tkazma (`BRANCH_OUT` / `CENTER_IN`) va korxona xarajatlari.
- **`F07` Maosh va avanslar:** Oklad + zakazchik/tarqatuvchi komissiyasi − avanslar -> tasdiqlash va kassadan to'lash.
- **`F08` Oflayn navbat va Bulk Sync:** Dexie IndexedDB navbatidan idempotent `client_uuid` orqali serverga sinxronlash.
- **`F09` Tizim salomatligi va Backup:** 6 ta moliyaviy/ombor invariantini tekshirish va SHA-256 nazoratli `.sqlite3.gz` zaxira nusxalari.
- **`F10` Ko'p filialli izolyatsiya:** Har bir filial xodimi faqat o'z filiali ma'lumotlarini ko'rishi; tarixiy hujjatlar yaratilgan filialda qolishi (`BranchStampedModel`).
- **`F11` Soxta operatsiyalarni tozalash (`TestCleanupService`):** Sozlamalarda ruxsatni yoqish/o'chirish (`allow_test_cleanup`), bog'liq hujjatlar va yetim (`orphaned`) yozuvlarni xavfsiz tozalash, o'rtadagi operatsiyalar tozalanganda keyingi `balance_after` zanjirini avtomatik qayta hisoblash.
