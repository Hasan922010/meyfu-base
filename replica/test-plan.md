# Test rejasi: MeyFu — Distribyutsiya va Savdo Boshqaruv Tizimi

Versiya: `f776321+`  Sana: `2026-11-07`  Muhit: Ubuntu Linux 6.17 (Python 3.12.16, Node 22.14.0, Django 5.1, React 19, Playwright Chromium)

| case | flow | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- | --- |
| F01-H1 | Kirish va rollar bo'yicha yo'naltirish | happy | `/login` sahifasini ochib, `+998900000000` / `Hasanali.0220` kiritish va «Kirish» tugmasini bosish | `/admin` paneliga yo'naltiriladi, sahifa yangilanganda sessiya saqlanadi, konsolda xatolik yo'q | e2e + pytest | PASS |
| F01-E1 | Kirish va rollar bo'yicha yo'naltirish | edge | Ikkita brauzer oynasida bir vaqtda `401` token yangilanishi (`client.refresh.test.ts`) | `localStorage` dagi yangi token o'qiladi va foydalanuvchi tizimdan chiqarib yuborilmaydi | vitest | PASS |
| F01-N1 | Kirish va rollar bo'yicha yo'naltirish | negative | `/login` sahifasida noto'g'ri parol kiritish | `/login` sahifasida qoladi, o'zbek tilida tushunarli xato xabari chiqadi | e2e + pytest | PASS |
| F01-N2 | Kirish va rollar bo'yicha yo'naltirish | negative | Avtorizatsiyasiz `/admin` ga kirish; `DISTRIBUTOR` roli bilan `/admin` yoki boshqa xodimning 360° kartasini ochish (`idor.spec.ts`) | `/admin` dan qaytariladi; API `403` / `404` qaytaradi | e2e + pytest | PASS |
| F02-H1 | Katalog, xarid va mashinaga yuklash | happy | Blok soni (`pack_quantity`) bilan mahsulot yaratish, xaridni (`Purchase`) va yuklamani (`Loading`) tasdiqlash | Ombor qoldig'i va `VanStock` yangilanadi, `StockMovement` jurnaliga yozuvlar tushadi | pytest + vitest | PASS |
| F02-E1 | Katalog, xarid va mashinaga yuklash | edge | Ombordagi qoldiqdan ko'p miqdorni yuklash (`INSUFFICIENT_STOCK`) yoki qulflangan boshlang'ich qoldiqni tahrirlash | O'zbek tilidagi `BusinessError` xabari bilan bloklanadi | pytest | PASS |
| F03-H1 | Dala sotuvi va qarz undirish | happy | Tarqatuvchi naqd + nasiya (aralash) sotuv yaratadi, so'ngra mijoz qarzidan to'lov qabul qiladi | `WalletTransaction (SALE_CASH)`, `Debt`, `DebtPayment` va `Client.current_debt` to'g'ri yangilanadi | pytest + vitest | PASS |
| F03-E1 | Dala sotuvi va qarz undirish | edge | Minimal narxdan (`min_price`) past sotuv (`FLAGGED`) yoki qarz limitidan (`debt_limit`) oshish | Past narxli sotuv bayroqlanib adminga bildirishnoma yuboradi; limitdan oshgan qarz bloklanadi | pytest | PASS |
| F03-N1 | Dala sotuvi va qarz undirish | negative | Yopilgan / qulflangan sanaga (`DAY_LOCKED`) yangi sotuv kiritishga urinish | `400 DAY_LOCKED` xatosi bilan rad etiladi | pytest | PASS |
| F04-H1 | Tarqatuvchi xarajatlari va yoqilg'i | happy | Dala xarajati va yoqilg'i yozuvini kiritish → admin tomonidan tasdiqlash | `WalletTransaction (EXPENSE)` yaratiladi va `DayClose` snapshot qayta hisoblanadi (`DC-001`) | pytest | PASS |
| F04-E1 | Tarqatuvchi xarajatlari va yoqilg'i | edge | Kun yopilgandan (`DayClose`) keyin xarajatni rad etish | `refresh_day_close_snapshot` kutilgan naqd summani qayta hisoblaydi va `AuditLog` ga yozadi | pytest | PASS |
| F05-H1 | 3 bosqichli kun yopish va naqd topshirish | happy | Tarqatuvchi `DailyReturn` + `CashHandover` bilan kunni yopadi → Admin tasdiqlaydi | `VanStock` tozalanadi, `StockMovement`, `WalletTransaction (HANDOVER)` va `CashTransaction (HANDOVER_IN)` yaratiladi | pytest | PASS |
| F05-E1 | 3 bosqichli kun yopish va naqd topshirish | edge | Qaytarilgan mahsulot miqdori mashinadagi haqiqiy qoldiqdan (`VanStock`) ko'p bo'lishi (`BE-102`) | Mavjud qoldiq bilan cheklanadi va kamomad `AuditLog` da qayd etiladi | pytest | PASS |
| F05-N1 | 3 bosqichli kun yopish va naqd topshirish | negative | Bitta tarqatuvchi va sana uchun parallel ravishda ikki marta `submit_day_close` yuborish | `ALREADY_SUBMITTED` xatosi bilan bloklanadi | pytest | PASS |
| F06-H1 | Moliya, kassa va inkassatsiya | happy | Filial kassasidan markaziy kassaga pul o'tkazish (`to-center`); kompaniya xarajatini kassadan to'lash | Juftlangan `BRANCH_OUT` va `CENTER_IN` yaratiladi; kassa balansi jurnal yig'indisiga teng bo'ladi | pytest + vitest | PASS |
| F06-N1 | Moliya, kassa va inkassatsiya | negative | `CashTransaction` yoki `WalletTransaction` yozuvini bevosita `.save()` orqali o'zgartirish yoki `.delete()` qilish | `ValidationError` (`AppendOnlyModel`) bilan rad etiladi | pytest | PASS |
| F07-H1 | Maosh, bonus va avanslar | happy | Barcha xodim rollari uchun oylik maoshni hisoblash, avanslarni chegirish, tasdiqlash va to'lash | `Payroll`, `PayrollDetail` va `CompanyExpense` yozuvlari aniq hisob-kitob bilan yaratiladi | pytest | PASS |
| F07-N1 | Maosh, bonus va avanslar | negative | Menejer (`MANAGER`) tomonidan moliyaviy ustunlarni (`base_salary`, komissiya %) o'zgartirishga urinish (`SEC-107`) | `403 Forbidden` bilan bloklanadi | pytest | PASS |
| F08-H1 | Oflayn navbat (Dexie) va Bulk Sync | happy | Mobil qurilmada oflayn amallarni navbatga qo'yish → `bulk-sync` yuborish | Barcha operatsiyalar idempotent tarzda bajariladi va `SyncLog` ga yoziladi | pytest + vitest | PASS |
| F08-E1 | Oflayn navbat (Dexie) va Bulk Sync | edge | Bir xil `client_uuid` ga ega oflayn paketni qayta yuborish | Idempotent — takroriy sotuv yoki hamyon yozuvi yaratilmaydi | pytest + vitest | PASS |
| F09-H1 | Tizim salomatligi va zaxira (Backup) | happy | `/api/v1/system/status/` orqali 6 ta jurnal invariantini tekshirish, backup yaratish va SHA-256 nazorati | Barcha 6 ta invariant `ok: true`; `.sqlite3.gz` zaxira fayli yaratiladi va tekshiriladi | pytest + vitest | PASS |
| F09-N1 | Tizim salomatligi va zaxira (Backup) | negative | Zaxira fayli nomida path traversal (`../../etc/passwd`) yuborish | `BackupError` bilan bloklanadi | pytest | PASS |
| F10-H1 | Ko'p filialli (Multi-Branch) izolyatsiya | happy | Filial xodimlari mahsulot, ombor, sotuv, mijoz, kassa va hisobotlarni so'rashi | Faqat o'z filialiga tegishli ma'lumotlar ko'rinadi; markaziy `SUPER_ADMIN` barchasini ko'radi | pytest | PASS |
| F11-H1 | Soxta operatsiyalarni tozalash ruxsati | happy | `/admin/settings` da `allow_test_cleanup` kalitini yoqish/o'chirish va `/admin/system?tab=cleanup` ni ochish | Sozlama `Setting` va `AuditLog` da saqlanadi; tozalash oynasi holatni darhol aks ettiradi | e2e + pytest + vitest | PASS |
| F11-H2 | Soxta operatsiyani preview va tasdiqlash orqali tozalash | happy | Soxta operatsiyani tanlash, preview oynasida sabab + `TOZALASH` + admin paroli + tasdiq belgisini kiritib tozalash | Yozuv va bog'liq hujjatlar faol hisoblardan chiqariladi (`is_deleted=True`), balans qayta hisoblanadi, `AuditLog` da to'liq nusxa saqlanadi | e2e + pytest + vitest | PASS |
| F11-E1 | Yetim (orphaned) bog'liq hujjatli yozuvni tozalash | edge | Manba hujjati (`CashHandover #ace76ff5` / `DayClose`) avval o'chirilgan kassa operatsiyasini tozalash | Xatolik bermasdan yetim yozuv va uning faol bog'liq juftliklari tozalanadi hamda balans tiklanadi | pytest | PASS |
| F11-E2 | O'rtadagi (oxirgi bo'lmagan) operatsiyani tozalash | edge | Keyinroq boshqa operatsiya (`+57 000`) kiritilgan eski operatsiyani (`-100 000 000`) tozalash | Keyingi operatsiyalarning `balance_after` zanjiri va hisobning joriy balansi avtomatik qayta hisoblanadi | pytest | PASS |
| F11-N1 | Tozalash xavfsizlik darvozalari (Security Gates) | negative | `SUPER_ADMIN` bo'lmagan rol, o'chirilgan ruxsat, noto'g'ri parol yoki buzilgan `cleanup_token` bilan so'rov yuborish | Hech qanday ma'lumot o'zgartirilmasdan `403` / `400` xatosi bilan rad etiladi | pytest + vitest | PASS |

## Avtomatlashtirilgan testlar yig'ma ko'rsatkichi

- **Backend integratsion va unit testlar (`pytest`):** `608 passed, 0 failed` (61 ta test moduli)
- **Frontend unit va komponent testlar (`vitest`):** `215 passed, 0 failed` (47 ta test fayli)
- **TypeScript qat'iy tip tekshiruvi (`tsc -b --noEmit`):** `0 errors`
- **Playwright brauzer E2E testlar (`npx playwright test`):** `9 passed, 0 failed` ([auth.spec.ts](file:///home/asus/Desktop/MeyFuBaza/meyfu-base/frontend/tests/e2e/auth.spec.ts), [smoke.spec.ts](file:///home/asus/Desktop/MeyFuBaza/meyfu-base/frontend/tests/e2e/smoke.spec.ts), [idor.spec.ts](file:///home/asus/Desktop/MeyFuBaza/meyfu-base/frontend/tests/e2e/idor.spec.ts), [cleanup.spec.ts](file:///home/asus/Desktop/MeyFuBaza/meyfu-base/frontend/tests/e2e/cleanup.spec.ts))
- **Replica Skills tahlil vositalari (`unittest`):** `57 passed, 0 failed`
