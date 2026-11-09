### BUG-001: Ubuntu Linux muhitida OnlyOffice DocumentServer 8000-portni band qilgani sababli login `404 ("So'ralgan manzil topilmadi.")` qaytarishi

- **Muhimlilik darajasi:** high
- **Holati:** **Hal qilindi (Fixed & Verified)**
- **Oqim / ekran:** `F01` · `S01 (/login)`
- **Muhit:** `Ubuntu Linux 6.17 · Vite 6.0 · Django 5.1 · Google Chrome`

**Qayta hosil qilish qadamlari (Repro)**
1. `8000`-portda `snap.onlyoffice-ds.documentserver.service` (nginx) ishlayotgan Ubuntu kompyuterda `./start.sh` ni ishga tushirish.
2. `http://localhost:5173/login` sahifasini ochish.
3. `+998900000000` va `Hasanali.0220` kiritib, **«Kirish»** tugmasini bosish.

**Kutilgan natija:** Vite `/api/v1/auth/login/` so'rovini Django backend serveriga uzatishi va foydalanuvchi tizimga kirishi kerak.
**Amaldagi natija:** Vite `/api` so'rovlarini `127.0.0.1:8000` dagi OnlyOffice nginx serveriga uzatgan va `404 Not Found` (`"So'ralgan manzil topilmadi."`) xatosi qaytgan.
**Sabab va yechim:** `start.sh` hamda `frontend/vite.config.ts` fayllarida standart backend porti `8001` (`http://127.0.0.1:8001`) ga o'zgartirildi.

---

### BUG-002: Brauzer parol menejeri tozalash oynasidagi `TOZALASH` tasdiqlash maydoniga telefon raqamni (`+998900000000`) avtomatik yozib qo'yishi

- **Muhimlilik darajasi:** medium
- **Holati:** **Hal qilindi (Fixed & Verified)**
- **Oqim / ekran:** `F11` · `S19 (/admin/system?tab=cleanup)`
- **Muhit:** `f776321 · Chrome Desktop · Dark theme`

**Qayta hosil qilish qadamlari (Repro)**
1. Brauzerda saqlangan admin login/paroli bilan `/admin/system?tab=cleanup` sahifasiga kirish.
2. Operatsiyani tanlab, **«Tanlanganlarni tozalash»** tugmasini bosish.
3. Modal oynadagi `Joriy admin parolingiz` (`type="password"`) maydoni brauzer parol menejerini ishga tushirib, undan oldingi `Tasdiqlash uchun TOZALASH deb yozing` (`type="text"`) maydoniga `+998900000000` ni avtomatik joylashtirib qo'yadi.

**Kutilgan natija:** Tasdiqlash maydoni parol menejeri tomonidan o'zgartirilmasligi va `TOZALASH` kiritilganda **«Tasdiqlab tozalash»** tugmasi faollashishi kerak.
**Amaldagi natija:** Maydonga `+998900000000` tushib qolgani uchun `confirmWord !== 'TOZALASH'` sharti bajarilmagan va tugma nofaol (`disabled`) qolgan.
**Sabab va yechim:** `frontend/src/pages/admin/TestCleanupSection.tsx` da `autoComplete="off"`, `autoComplete="new-password"`, alohida `name` atributlari, katta-kichik harfga sezgir bo'lmagan `TOZALASH` tekshiruvi hamda bir bosishda to'ldiruvchi **`TOZALASH`** tugmasi qo'shildi.

---

### BUG-003: Bog'liq manba hujjati (`CashHandover`) avval o'chirilgan yoki o'rtadagi operatsiyalarni tozalashda `"Bog'liq hujjat topilmadi; tozalash bloklandi."` xatosi

- **Muhimlilik darajasi:** high
- **Holati:** **Hal qilindi (Fixed & Verified)**
- **Oqim / ekran:** `F11` · `S19 (/admin/system?tab=cleanup)`
- **Muhit:** `Production Server · Django 5.1 · TestCleanupService`

**Qayta hosil qilish qadamlari (Repro)**
1. `/admin/system?tab=cleanup` -> `Kassa operatsiyalari` bo'limini ochish.
2. `10.10.2026 c20f474d` (`cash_handover #ace76ff5`, `+57 000 so'm`) va `23.09.2026 cbe14290` (`manual`, `-100 000 000 so'm`) yozuvlarini belgilash.
3. **«Tanlanganlarni tozalash (2)»** tugmasini bosish.

**Kutilgan natija:** Preview oynasi ochilib, ham yetim qolgan `cash_handover` yozuvini, ham `manual` kassa yozuvini tozalash va kassa balansini qayta hisoblash imkonini berishi kerak.
**Amaldagi natija:** Server `"Bog'liq hujjat topilmadi; tozalash bloklandi."` (`400 SOURCE_NOT_FOUND`) xatosini qaytargan, chunki:
1. `CashHandover #ace76ff5` (yoki uning `DayClose` hujjati) avval Django Admin orqali bazadan o'chirilgan bo'lib, jurnalda yetim (`orphaned`) yozuv qolgan edi.
2. O'rtadagi yozuv (`-100 000 000 so'm`) oxirgi operatsiya bo'lmagani uchun eski qoida bo'yicha bloklangan edi.

**Sabab va yechim:** `backend/apps/core/services/test_cleanup.py` yangilandi:
- `_source()` endi soft-delete qilingan hujjatlarni ham (`all_objects`) tekshiradi;
- `_check_handover()` manba `CashHandover` yoki `DayClose` bazadan o'chirilgan bo'lsa ham, qolgan yetim jurnal yozuvlarini (`CashTransaction` va `WalletTransaction`) xavfsiz tozalashga ruxsat beradi;
- `build_plan()` va `_document_effects()` o'rtadagi operatsiya tozalanganda undan keyingi barcha faol operatsiyalarning `balance_after` qiymatlarini va hisobning joriy balansini avtomatik qayta hisoblaydi (`backend/tests/test_admin_test_cleanup.py` — 30 ta test bilan tasdiqlandi).
