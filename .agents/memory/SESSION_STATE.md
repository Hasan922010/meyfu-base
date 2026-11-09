# MeyFu (`meyfu-base`) — Seans Xotirasi va Davomiylik Xaritasi (Session State)

> **Maqsad:** Har bir yangi AI seansida agent loyiha qayerdan kelganini, oxirgi marta nimalar bajarilganini, hozirgi texnik holatni va navbatdagi vazifalarni qayerdan davom ettirish kerakligini darhol bilishi uchun yagona haqiqat manbai (Single Source of Truth).

---

## 1. Qayerdan Keldik (Bajarilgan Bosqichlar va Tarix)

1. **MVP + 2-faza + 3-faza + v5 (100% Parity):**
   - Katalog, ombor (kirim, qoldiq, harakat jurnali, inventarizatsiya, ko'chirish), mijoz/marshrut, yuklama, offline sotuv (`Dexie` + `outbox`), buyurtma (zakaz), kun yopish (`DayClose`), xarajat va hamyon (`DistributorWallet`), qarzdorlik va kassa (`CashTransaction`), OCR naklit, Telegram bot, ikki bosqichli maosh (`Payroll`), 360° xodim kartasi, ABC / P&L hisobotlari, PDF + muhr, 1C eksport, Bluetooth termal printer (ESC/POS), marshrut optimizatsiyasi, Excel import va filiallar ajratilishi (`branch` isolation) to'liq yakunlangan.
   - `replica/parity.md` bo'yicha **Parity: 100.0 / 100** (barcha 20 ta feature va 16/16 must-have bajarilgan).

2. **Oxirgi Hal Qilingan Muammolar (`replica/bugs.md`):**
   - **BUG-001 (Port to'qnashuvi):** Ubuntu Linux muhitida 8000-port OnlyOffice tomonidan band qilingani sababli `start.sh` va `frontend/vite.config.ts` da Django backend porti standart **`8001`** (`http://127.0.0.1:8001`), frontend porti **`5173`** (`http://localhost:5173`) etib sozlandi.
   - **BUG-002 (Admin Test Cleanup UI):** `frontend/src/pages/admin/TestCleanupSection.tsx` da brauzer parol menejeri `TOZALASH` maydoniga telefon raqamni yozib qo'ymasligi uchun `autoComplete` himoyalari va bir bosishda `TOZALASH` tugmasi qo'shildi.
   - **BUG-003 (Orphaned CashHandover & Mid-history Cleanup):** `backend/apps/core/services/test_cleanup.py` da avval o'chirilgan manba hujjatlari (`all_objects`) va o'rtadagi operatsiyalarni tozalaganda keyingi barcha operatsiyalarning `balance_after` qiymatlarini qayta hisoblash mantiqi qo'shildi (`backend/tests/test_admin_test_cleanup.py` — 30 ta test).

3. **O'rnatilgan Agent Skill'lar Ekotizimi:**
   - **Xotira va Seans Davomiyligi (`agentmemory` + `project-memory`):** `memory-discipline`, `handoff`, `session-history`, `recap`, `remember`, `recall`, `lesson`, `forget`, `commit-context`, `commit-history`, `project-memory`.
   - **Kod Sifati va Minimalizm (`ponytail`):** `ponytail`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, `ponytail-help`, `ponytail-review`.
   - **Ixtisoslashgan Agentlar (`agency-agents`):** Muhandislik, dizayn, xavfsizlik, testlash, mahsulot va boshqaruv bo'yicha to'liq ixtisoslashgan agent skill'lari.
   - **Replica & Security (`replica-*`, `security-audit`, `graphify`):** Arxitektura, dizayn, backend, test va audit skill'lari.

4. **Yangi Joriy Qilingan Funksiyalar (Tovarlar, Komissiyalar, Yuklama va Kamomad/Ortiqcha Hisoboti):**
   - **Yagona Tannarx:** Tovarlar profilida faqat `cost_price` (tannarx) qoldirildi, ortiqcha narx turlari formadan olib tashlandi.
   - **Bonus Tizimi:** Tovarlar uchun `has_bonus`, `bonus_trigger_qty`, `bonus_reward_qty` va `bonus_product` (o'zidan yoki boshqa tovardan) qo'shildi.
   - **Qadoq Birliklari:** Tovarlarga `package_type` (qop, xalta, pachka, karopka) va `pack_quantity` bog'landi.
   - **Tovar Komissiyasi va Oylik:** Har bir tovar profilida alohida `order_commission_rate` va `delivery_commission_rate` belgilandi, oylik maosh (`Payroll`) tovar foizlari bo'yicha yig'iladi. Xodim profilidagi umumiy komissiya foizlari kiritish maydonlari olib tashlandi.
   - **Yuklama Hujjati (PDF):** Buyurtmalardan yuklama yaratishda mijoz bilan kelishilgan buyurtma narxi olindi (`build_loading_from_orders`) hamda yuklama qog'ozining o'ng tomonida qalin shriftda Tarqatuvchi ismi va telefon raqami joylashtirildi.
   - **Kamomad va Ortiqcha Hisoboti:** `track_variance` bo'yicha belgilangan tovarlar sotuvida tannarxdan arzon (kamomad) yoki qimmat (ortiqcha) sotilganini ko'rsatuvchi hisobot va `PriceVarianceTab` jadvali joriy qilindi.
   - **Test Natijalari:** Backend 609 ta test (`pytest`), Frontend 215 ta test (`vitest`), `tsc` 0 xato.

---

## 2. Joriy Texnik Holat (Current Environment & State)

- **Backend:** Python 3.12 · Django 5.1 · DRF · Channels/Daphne (`backend/`) — lokal port: `8001`
- **Frontend (GitHub source):** React 18 · TypeScript · Vite · Dexie PWA (`frontend/`) — lokal port: `5173`
- **Deployable Web Artifact (Replit):** `artifacts/meyfu-app/` (`frontend/` dagi o'zgarishlar publish oldidan shu yerga ham sinxronlanishi shart)
- **Ishga tushirish:** `./start.sh` (Backend `:8001`, Frontend `:5173`) yoki pnpm workspace skriptlari
- **Bilimlar grafi:** `graphify-out/` (kod o'zgarganda `graphify update .` bilan yangilanadi)

---

## 3. Qayerdan Davom Etish Kerak (Next Steps & Priorities)

Yangi seansda foydalanuvchi aniq topshiriq bermasa yoki "qayerdan davom etamiz?" deb so'rasa, quyidagi ustuvor yo'nalishlar bo'yicha davom etiladi:

1. **SyncLog UI sahifasi (`docs/v5-imkoniyatlar-hisoboti.md` — B6):**
   - Backendda `SyncLog` modeli va `/api/v1/sync-logs/` endpointi tayyor, lekin Admin panelda qurilmalar sinxronizatsiya tarixi va konfliktlarini ko'rish uchun maxsus UI sahifasi qo'shilishi mumkin.
2. **`frontend/` va `artifacts/meyfu-app/` sinxronizatsiyasi:**
   - `frontend/` da qilingan so'nggi o'zgarishlar (masalan, `TestCleanupSection.tsx` va boshqa tuzatishlar) Replit deploy artefakti `artifacts/meyfu-app/` bilan to'liq sinxron ekanligini tekshirish.
3. **Production Pilot va Real Qurilma Sinovlari (`docs/pilot.md`):**
   - Android Chrome'da Web Bluetooth termal printer (`ESC/POS` 58/80mm) sinovi;
   - Buxgalter bilan 1C XML/CSV import formatini yakuniy tasdiqlash;
   - `meyfu-base.uz` domeniga production deploy va SSL/DNS tekshiruvi.

---

## 4. Seansni Yangilash Qoidasi (Har Bir Seans Yakunida)

Har bir vazifa yoki seans yakunida AI agent ushbu `SESSION_STATE.md` faylini yangilashi shart:
- **1-bo'limga:** Bajarilgan ish, o'zgartirilgan fayllar va commit/test natijasini qo'shish;
- **2-bo'limga:** Testlar soni, portlar yoki muhit o'zgargan bo'lsa yangilash;
- **3-bo'limga:** Tugallangan bandni olib tashlab, keyingi navbatdagi vazifani yozib qo'yish.
