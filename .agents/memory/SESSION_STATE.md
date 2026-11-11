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

5. **Buyurtma Oluvchida Qadoq Birligi Bo'yicha Buyurtma Olish va Hisoblash (Mobile NewOrderPage):**
   - **Prompt Spetsifikatsiyasi:** `.agents/prompts/order-packaging-unit-spec.md` yaratildi.
   - **Dona vs Qadoq Tanlovi:** Qadoq ma'lumotlariga ega tovarlar (`pack_quantity > 1` yoki `package_type`) tanlanganda interfeysda "Dona (dona)" va "Qadoq (karopka — 12 dona)" tanlash tugmalari paydo bo'ladi.
   - **Avtomatik Hisob-kitob Formulasi:** Qadoq tanlanganda kiritilgan son qadoqlar soni deb olinadi va ekranda formula ko'rsatiladi: `10 karopka × 12 dona = 120 dona`, `120 dona × 25 000 so'm = 3 000 000 so'm`.
   - **Savat va Backend Muvofiqligi:** Savatda tovar qatori `10 karopka (120 dona) × 25 000 so'm = 3 000 000 so'm` deb ko'rsatiladi. `saveOrderLocal` va backend API ga asosiy o'lchov birligidagi to'liq miqdor (`quantity = 120`) uzatiladi, bu orqali ombor, yuklama va narxlar 100% to'g'ri hisoblanadi.
   - **Test Natijalari:** Frontend 217 ta test (`vitest`) barchasi muvaffaqiyatli, `tsc -b --noEmit` 0 xato, Backend 17 ta tegishli test o'tdi.

6. **Xavfsizlik Arxitekturasi va Himoya Qatlamlari Kuchaytirildi (`agency-security-architect`):**
   - **Hujjat:** `security_architecture_audit.md` xavfsizlik arxitekturasi va tahdidlar tahlili yaratildi.
   - **Haqiqiy Token Blacklisting:** `frontend/src/shared/api/auth.ts` dagi `logout()` funksiyasi orqali chiqishda refresh token backendga uzatilib, `rest_framework_simplejwt.token_blacklist` orqali darhol bekor qilinadigan qilindi.
   - **Admin Test Cleanup Scoped Throttling:** `TestCleanupExecuteView` ga `throttle_scope = "test_cleanup"` va `DEFAULT_THROTTLE_RATES` ga `"test_cleanup": "5/min"` qo'shilib, admin parolini brute-force qilish xavfi bartaraf etildi.
   - **Test Natijalari:** Backend 29 ta test (`test_auth.py`, `test_admin_test_cleanup.py`) va frontend 217 ta test 100% muvaffaqiyatli o'tdi.

7. **Frontend UI/UX Yangilanishi (`agency-frontend-developer`):**
   - **Komponentlar:** `UnitToggle.tsx` (Dona/Qadoq segmentli boshqaruv), `QuantityStepper.tsx` (48px ergonomik hisoblagich va tezkor raqamlar) hamda `PriceFormulaCard.tsx` (jonli hisoblash kartochkasi) yaratildi.
   - **Integratsiya:** `NewOrderPage.tsx` soddalashtirildi, `index.css` ga `.card-minimal` va micro-interaction animatsiyalari qo'shildi.
   - **Test Natijalari:** Frontend 51 ta test fayli, 222 ta test (`vitest`) barchasi muvaffaqiyatli, `tsc -b --noEmit` 0 xato.
   - **Sinxronizatsiya:** `artifacts/meyfu-app/` deploy nusxasi to'liq yangilandi.

8. **Mobil Yetkazish, Sotuv va Kun Yopish Ergonomikasi (`ux_architecture_design_system.md` to'liq joriy qilindi):**
   - **`SaleProductList.tsx`:** Tovar hisoblagich tugmalari to'liq ≥48px (`h-12 w-12`) ga keltirildi, van mahsulotlariga qadoq ko'rsatkichi (`1 karopka = 12 dona`) va `Package` placeholder ikonkasi qo'shildi.
   - **`NewSalePage.tsx`:** Qidiruv maydoni ikonkali qilindi, mijoz kartochkalari qarz holati bilan boyitildi, pastdagi panelda yashil Naqd tugmasi (`bg-emerald-600 min-h-[48px]`), to'lov ekranida 4 ta katta barmoqqa qulay variantlar (Naqd, Plastik, Qarzga, Aralash) hamda qarz muddati uchun tezkor chiplar (`+7 kun`, `+14 kun`, `+30 kun`) o'rnatildi.
   - **`MyOrdersPage.tsx` (FulfillScreen):** Yetkazish ekranida har bir tovar uchun -1/+1 hisoblagichlar va bir bosishda "Hammasi" to'ldirish tugmasi, yirik rangli to'lov tugmalari joriy qilindi.
   - **`DayCloseWizard.tsx`:** 3 bosqichli vizual stepper (1. Tovar -> 2. Pul -> 3. Tasdiq), tovarlarni qaytarishda "Hammasi" va "0 qoldirish" tugmalari, kassaga kutilgan summani bir bosishda kiritish ("Kutilgan summani qo'yish") va jonli kassa farqi ko'rsatkichi qo'shildi.
   - **Test Natijalari:** Yangi unit testlar yozildi (`NewSalePage.test.tsx`, `DayCloseWizard.test.tsx`, `MyOrdersPage.test.tsx`), jami frontend testlari: **54 ta test fayli, 226 ta test 100% muvaffaqiyatli**, `tsc -b --noEmit` 0 xato.
   - **Replit Sinxronizatsiyasi:** `artifacts/meyfu-app/` ga to'liq ko'chirildi va sinxronlandi.

9. **Yangi Sotishda Qadoq Bo'yicha Kiritish, Bepul Aksiya Bonusi va Tovar Harakati Hisoboti:**
   - **Qadoq Bo'yicha Sotish (`PackagingModal.tsx`, `SaleProductList.tsx`):** Yangi sotishda har bir mahsulot uchun dona yoki qadoq (qop, xalta, pachka, karopka) bo'yicha miqdorni kiritish, jonli hisoblash (`PriceFormulaCard`: masalan, `2 karopka × 12 dona = 24 dona`, `24 dona × 20 000 so'm = 480 000 so'm`), mashinadagi mavjud qoldiqqa cheklash va savatda `2 karopka (24 dona)` qilib ko'rsatish joriy qilindi.
   - **Aksiya / Bonus Tovarlar Bepul Berilishi va Qoldiq Ayirilishi:** `computePromotionalBonuses` orqali xarid hajmiga qarab tegishli bonus tovarlar avtomatik hisoblanadi, `NewSalePage.tsx` va `NewOrderPage.tsx` da bepul bonus banneri ko'rsatiladi va buyurtma/sotuvga `price: 0, is_bonus: true` bilan saqlanadi. Mashina va ombor qoldig'i bonus tovarlar uchun ham to'liq hisobdan chiqariladi.
   - **Tovar Harakati Hisoboti (`ProductMovementTab.tsx`, `product_movement.py`):** Admin panelda (`ReportsPage.tsx` -> "Tovar harakati (Sotuv / Bonus)") pullik sotuvlar (miqdor va summa), bepul aksiya bonuslari (miqdor va tannarx), jami ombor chiqimi va bonus ulushi bo'yicha batafsil hisobot va Excel (XLSX) eksporti yo'lga qo'yildi.
   - **Test Natijalari:** Frontend 57 ta test fayli, 235 ta test 100% muvaffaqiyatli (`tsc -b --noEmit` 0 xato). Backend `test_product_movement_and_bonus.py` 100% muvaffaqiyatli.
   - **Sinxronizatsiya:** `artifacts/meyfu-app/` deploy nusxasi to'liq yangilandi.

10. **Zero-Learning-Curve UI/UX va 5-Menyuli Arxitektura (`design-intuitive-ui`, `agency-ux-architect`):**
   - **`AdminLayout.tsx` (5 ta Mantiqiy Bo'lim):** 24 ta tarqoq menyu elementi 5 ta aniq biznes guruhiga birlashtirildi (1. Boshqaruv & Tahlil, 2. Ombor & Tovarlar, 3. Savdo & Yetkazish, 4. Moliya & Kassa, 5. Jamoa & Sozlamalar). Har bir guruh uchun rangli ikonka, qulay bo'lim sarlavhalari va real vaqtda tezkor menyu qidiruvi (`Search`) joriy qilindi.
   - **`MobileLayout.tsx` (5 ta Ergonomik Tab):** Pastki menyu qat'iy 5 ta tabga keltirildi (Bosh, Sotuv, Buyurtma, Hamyon, Mijozlar). O'rtadagi asosiy harakat tugmasi yashil kontrastda ajratildi, 52-56px qulay barmoq zonalari ta'minlandi.
   - **Mobil Bosh Sahifalar (`MobileHomePage.tsx`, `OrderTakerHomePage.tsx`, `WarehouseHomePage.tsx`):** "Bir ekran = Bitta asosiy harakat (Primary CTA)" qoidasi asosida katta yorqin tugmalar (`+ Yangi Sotuv`, `+ Yangi Buyurtma`, `+ Tovar Qabul Qilish`), 4 ta rangli tezkor kartochka va svetofor ranglari o'rnatildi.
   - **Test Natijalari:** Frontend 57 ta test fayli, 235 ta test 100% muvaffaqiyatli (`tsc -b --noEmit` 0 xato).
   - **Sinxronizatsiya:** `artifacts/meyfu-app/` ga to'liq ko'chirildi.

11. **Menyular O'lchamini Kengaytirish va O'qilishini Yaxshilash (Menu Sizing & Typography Ergonomics):**
   - **`AdminLayout.tsx`:** Sidebar eni `250px` dan `280px` ga kengaytirildi. Menyu elementlarining shrift o'lchami kichik `text-xs` (12px) dan to'laqonli `text-sm font-semibold` (14px) ga, ichki bo'shliqlar `px-3.5 py-2.5` ga, ikonka o'lchamlari 17px dan 20px ga oshirildi. Bo'lim sarlavhalari `text-xs font-bold` (16px ikonka), qidiruv paneli `py-2.5 pl-9 pr-3 text-sm`, logotip `h-10 w-10 text-lg` va mobil drawer `w-80` ga keltirildi.
   - **`MobileLayout.tsx`:** Pastki navigatsiya tablari balandligi `min-h-[58px] min-w-[62px]` ga, matn shrifti `text-xs font-bold` (12px) ga, ikonkalar `size={22}` (asosiy harakat `size={24}`) ga kengaytirildi va kontrast oshirildi.
   - **Mobil Bosh Sahifalar (`MobileHomePage`, `OrderTakerHomePage`, `WarehouseHomePage`, `MobileAdminHome`):** Barcha asosiy Primary CTA tugmalari `min-h-[58px] text-lg font-black` (26px ikonka), 2x2 kartochkalar `p-4 text-base font-black` (24px ikonka), qo'shimcha xizmatlar `p-3 text-xs font-bold` (22px ikonka) ga oshirildi.
   - **Test va Sinxronizatsiya:** Frontend 57 ta test fayli, 235 ta test 100% muvaffaqiyatli (`tsc -b --noEmit` 0 xato). `artifacts/meyfu-app/` ga to'liq sinxronlandi.

12. **BUG-004 (Tovar Harakati Hisobotida `categoriesQuery.data?.map is not a function` Tuzatildi):**
   - **Sabab:** `catalogApi.categories({ page_size: 200 })` DRF orqali paginatsiyalangan obyekt `{ count: number, results: Category[] }` qaytaradi. `ProductMovementTab.tsx` esa uni to'g'ridan-to'g'ri massiv deb hisoblab `categoriesQuery.data?.map` chaqirgan va ErrorBoundary ishga tushgan.
   - **Yechim:** `ProductMovementTab.tsx` da himoyalangan `useMemo` orqali `results` va to'g'ridan-to'g'ri massivni to'g'ri ajratib oluvchi `categories` keshlandi, `page_size: 200` uzatildi.
   - **Test:** Yangi unit test yozildi (`ProductMovementTab.test.tsx`), jami frontend testlari: **57 ta test fayli, 236 ta test 100% muvaffaqiyatli**. `artifacts/meyfu-app/` ga sinxronlandi.

13. **Aniqlangan Barcha Kamchiliklar va Bo'shliqlar Bo'yicha Keng Qamrovli Hisobot (`system_flaws_and_gap_analysis_report.md`):**
   - **Hisobot artefakti yaratildi:** Barcha hal qilingan xatolar (BUG-001...004), dasturiy ta'minot bo'shliqlari (GAP-001...005), ma'lumotlar muhandisligi va indekslar (GAP-006...009), test muhiti (GAP-010...011) va pilot integratsiyalari (PILOT-001...003) to'liq jamlandi.
   - **Ponytail uslubida eng kichik, to'liq yechimlar joriy etildi:**
     - `GAP-001`: `downloadBlob` da asinxron `setTimeout(1000)` qo'yildi;
     - `GAP-002`: `ProductMovementTab` qidiruvida null-safety `(r.product_name || '')` qo'shildi;
     - `GAP-003`: `PackagingModal` dagi `stock!` non-null operatori xavfsiz early-return bilan almashtirildi;
     - `GAP-004`: `ProductMovementTab` jadvaliga `min-w-[850px]` gorizontal skroll berildi;
     - `GAP-005`: Excel eksport fayl nomiga filial nomi qo'shildi (`tovar-harakati-{branch_name}-{df}-{dt}.xlsx`);
     - `GAP-006`: `SaleItem` ga kompozit indeks `(sale, is_bonus, product)` qo'shildi (`sales_0007_saleitem_sale_bonus_prod_idx` migratsiyasi);
     - `GAP-010 & GAP-011`: Ildiz `pytest.ini` yaratilib, testlar avtomatik `test.py` (InMemoryChannelLayer + No Throttling) bilan ishlashi ta'minlandi;
     - `SyncLogPage.test.tsx` qo'shildi.
   - **Test Natijalari:** Frontend **58 ta test fayli, 237 ta test 100% muvaffaqiyatli**. Backend **60 ta test 100% muvaffaqiyatli**. `artifacts/meyfu-app/` ga sinxronlandi.

14. **Foydalanish Qo'llanmalari To'liq Yangilandi (User Manual & Role Guides Overhaul):**
    - **`docs/qollanma.md`:** Asosiy qo'llanma qayta yozildi (5 ta rol, login, 4 xonali PIN-kod, Offline PWA, Qadoq birliklari, Aksiya/Bonus tizimi, Append-only o'zgarmaslik).
    - **`docs/qollanma-admin.md`:** 5 guruhli yangi menyu iyerarxiyasi, yagona tannarx (`cost_price`), aksiya sozlamalari, komissiya stavkalari va barcha 6 xil hisobotlar bilan boyitildi.
    - **`docs/qollanma-tarqatuvchi.md`:** 5-tabli mobil ilova, qadoq tanlash (dona vs karopka/qop), jonli formula, 0 so'mlik bepul aksiya bonuslari, 3 bosqichli vizual DayClose va hamyon bilan yangilandi.
    - **`docs/qollanma-zakazchi.md` (Yangi Maxsus Qo'llanma):** Pre-seller (savdo agenti) uchun: "+ Yangi Buyurtma", GPS check-in, real vaqt ombor qoldig'i (`/m/stock`), aksiya bonuslari, buyurtmalar hayotiy sikli va "Zakaz olgani uchun %" shaxsiy maosh hisobi.
    - **`docs/qollanma-omborchi.md`:** Kirim nakladnoy (qadoq va tannarx bilan), AI OCR naklit skani, kam qolgan tovar ogohlantirishlari, yuklamalar, qaytarish qabuli va bepul bonuslarning ombor qoldig'idan hisobdan chiqarilishi.
    - **`docs/qollanma-buxgalter.md`:** Append-only kassa jurnali, mijozlar qarzdorligi (Aging) va Akt-sverka PDF/Excel, "Tovar harakati (Sotuv / Bonus)" hisoboti va Excel eksporti, P&L, 2 bosqichli maosh va 1C eksport.
    - **`frontend/src/shared/help/guides.ts` & `artifacts/meyfu-app/src/shared/help/guides.ts`:** Ilova ichidagi interaktiv yo'riqnomalar to'liq sinxronlandi.
    - **Sifat Nazorati:** `tsc -b --noEmit` 0 xato, Vitest 58/58 test fayli, 237/237 test 100% muvaffaqiyatli, backend testlari 100% muvaffaqiyatli. Replit deploy nusxasi bilan 100% paritet ta'minlandi.

15. **Omborchi Mobil Profiliga Buyurtma Olish va Tarqatish (Sotuv) Imkoniyatlari Qo'shildi:**
    - **Backend API & Ruxsatlar:** `OrderViewSet` (`_WRITE`, `action_roles: cancel, fulfill, my_to_take, my_to_deliver`), `SaleViewSet` (`write_roles`, `_READ`, `action_roles: bulk_sync, my_today`), `LoadingViewSet` (`action_roles: confirm`) va `DayCloseViewSet` (`submit`, `_READ`) da `Role.WAREHOUSE` to'liq kiritildi. `_is_field_staff(user)` orqali omborchi buyurtma/sotuv olganda `taken_by`/`distributor` uning o'ziga majburlanadi.
    - **Mobil Navigatsiya (`MobileLayout.tsx`):** `WAREHOUSE_TABS` 5 ta ergonomik tabga kengaytirildi: `Bosh` (`/m`), `Buyurtma` (`/m/orders`), `Tarqatish` (`/m/sale` — markaziy highlight CTA), `Qabul` (`/m/receive`), `Qoldiq` (`/m/stock`).
    - **Bosh Sahifa (`WarehouseHomePage.tsx`):** 3 ta asosiy tezkor harakat (`+ Yangi Tarqatish / Sotuv`, `+ Buyurtma Olish`, `+ Tovar Qabuli`), 2x2 rangli bo'limlar (`Ombor Qoldig'i`, `Buyurtmalarim`, `Tarqatish Yuklamalari`, `Naklit Skani`, `Mijozlar`, `Boshlang'ich Qoldiq`) va tugayotgan tovarlar ogohlantirishi o'rnatildi.
    - **Qo'llanmalar:** `docs/qollanma-omborchi.md` va `frontend/src/shared/help/guides.ts` yangi imkoniyatlar bilan boyitildi.
    - **Test Natijalari:** Backend yangi unit testlar (`test_warehouse_can_create_order_and_sale`, `test_warehouse_can_make_sale_and_distribution`) bilan 54/54 test muvaffaqiyatli o'tdi. Frontend `tsc -b --noEmit` 0 xato, Vitest 58/58 test fayli, 237/237 test 100% muvaffaqiyatli. Replit deploy pariteti 100% ta'minlandi.

16. **Xodimlar Individual Imkoniyatlari va Ruxsatlarini Superuser Boshqaruvi (Staff Granular Permissions Matrix):**
    - **Reja Artefakti:** `staff_granular_permissions_plan.md` tasdiqlandi.
    - **Backend 8 ta Feature Flag:** `User` modelida 8 ta mustaqil bool maydon (`can_receive_stock`, `can_take_orders`, `can_make_sales`, `can_sell_on_debt`, `can_collect_debts`, `can_record_expenses`, `can_see_warehouse_stock`, `can_scan_invoices`), `has_app_permission(perm)` metodi va `0010_user_can_collect_debts_user_can_make_sales_and_more.py` migratsiyasi joriy qilindi.
    - **Avtorizatsiya Himoyasi:**
      - `OrderViewSet.create` -> `can_take_orders` (403 `ORDER_TAKING_FORBIDDEN`);
      - `create_sale` -> `can_make_sales` (403 `SALES_FORBIDDEN`) va qarzga sotuvda `can_sell_on_debt` (403 `DEBT_SALE_FORBIDDEN`);
      - `collect_debt_payment` -> `can_collect_debts` (403 `DEBT_COLLECTION_FORBIDDEN`);
      - `PurchaseViewSet.create` & `perform_create` -> `can_receive_stock` (403 `RECEIVE_STOCK_FORBIDDEN`);
      - `DistributorExpenseViewSet.create` -> `can_record_expenses` (403 `EXPENSE_RECORDING_FORBIDDEN`);
      - `StockViewSet.get_queryset` -> `can_see_warehouse_stock` (403 `WAREHOUSE_STOCK_FORBIDDEN`);
      - `InvoiceScanViewSet.create` & `ReceiptScanView.create` -> `can_scan_invoices` (403 `INVOICE_SCAN_FORBIDDEN`).
    - **Admin Boshqaruv Paneli:**
      - `SettingsPage.tsx` ga `StaffPermissionsMatrix.tsx` integratsiya qilindi: superuser har qanday xodimni tanlab, uning 8 ta imkoniyatini bir bosishda yoqib/o'chirishi mumkin (bir lahzalik PATCH so'rov va vizual holat bildirishnomasi bilan).
      - `StaffForm.tsx` (Xodim qo'shish va tahrirlash modali) da individual ruxsatlar blokiga 8 ta mustaqil almashtirgich (toggle switch) joylashtirildi.
    - **Mobil Ilova Moslashuvi:**
      - `NewSalePage.tsx` da `can_sell_on_debt` tekshiruvi: ruxsat bo'lmasa "Qarzga berish" va "Aralash to'lov" tugmalari bloklanadi hamda tushuntirish ogohlantirishi chiqadi.
      - `MobileLayout.tsx` da navigatsiya tablari va sahifalar kirish huquqlari xodimning individual `can_make_sales`, `can_take_orders`, `can_receive_stock` bayroqlariga qarab dinamik tarzda ochiladi yoki yashiriladi.
    - **Test Natijalari:**
      - Backend `test_user_permissions.py` (7 ta yangi unit test) va mavjud `test_staff.py`, `test_orders.py` 100% muvaffaqiyatli;
      - Frontend `tsc -b --noEmit` 0 xato, Vitest **58 ta test fayli, 240 ta test 100% muvaffaqiyatli**;
      - Replit nusxasi (`artifacts/meyfu-app/`) bilan 100% to'liq paritet ta'minlandi.

17. **Xodimning Shaxsiy Mijozi, Mahsulot Excel Shabloni va Mijozlar Boshlang'ich Qoldig'ini Ustun Moslab Import Qilish:**
    - **Xodimning o'z mijozi (`Client.assigned_to`):**
      - Backend: `Client.assigned_to` ForeignKey + indeks (`clients/migrations/0006_client_assigned_to_and_more.py`), `own_clients_q()` va `is_client_off_route()` yordamchilari (`clients/models.py`). `assigned_to` belgilanganda mijoz qat'iy shu xodimga tegishli bo'ladi; bo'sh (`None`) bo'lganda mavjud marshrut qoidasiga qaytadi. `ClientViewSet`, `ClientVisitViewSet`, `ClientSyncView`, `OrderViewSet`/`create_order`, `create_sale`, `bulk-sync`, `DebtViewSet` va `distributor.py` (`_debts_block`) da qo'llandi; maydon xodimlari (`DISTRIBUTOR`, `ORDER_TAKER`, `WAREHOUSE`) yaratgan mijozlar avtomatik o'ziga biriktiriladi.
      - Frontend: `ClientForm.tsx` ("Mas'ul xodim (kimning mijozi)" tanlovi), `ClientsPage.tsx` (`Xodim` filtri va saralanadigan ustun) hamda `NewClientModal.tsx` (joriy xodimni ko'rsatib avtomatik `assigned_to` biriktirish va ixtiyoriy marshrut).
    - **Mahsulot Excel Shablonini Yangilash (`product_import.py`, `catalog/views.py`, `ProductImport.tsx`):**
      - `TEMPLATE_HEADER` va namuna qator amaldagi `ProductForm.tsx` maydonlariga moslandi (18 ta ustun: `nomi`, `artikul`, `shtrix-kod`, `kategoriya`, `birlik`, `brend`, `tannarx`, `farqni kuzatish`, `zakaz komissiyasi`, `tarqatish komissiyasi`, `bonus`, `bonus sharti`, `bonus soni`, `bonus tovar`, `qadoq turi`, `qadoqdagi soni`, `kam qoldiq`, `faol`); eski optom/chakana/minimal narx nomlari esa orqaga moslik (alias) sifatida saqlanib qoldi va yangi tovarda `tannarx` bo'sh eski narxlarni to'ldiradi. Ikkinchi o'tishda (`pending_bonus`) faylda keyinroq yaratilgan `bonus tovar` artikuli bog'lanadi.
    - **Mijozlar Boshlang'ich Qoldig'ini Excel'dan Import Qilish (`opening_import.py`, `ClientOpeningImportModal.tsx`, `OpeningBalancesPage.tsx`):**
      - Faqat `Boshlang'ich qoldiqlar` -> `Mijozlar` tabida `Exceldan import` tugmasi qo'shildi (`GET /api/v1/clients/opening-import-template/` va `POST /api/v1/clients/opening-balance/import/`).
      - Yuklangan `.xlsx` fayl ustunlari tahlil qilinadi (`mode=inspect`) va foydalanuvchi har bir tizim maydoniga Excel jadvalidan qaysi ustun tushishini tanlaydi; bazada yo'q mijozlar avtomatik yaratiladi (`auto_create_missing`, mas'ul xodim Excel ustuni yoki standart tanlov orqali biriktiriladi) va boshlang'ich qarz (`Debt(sale=None)`) tranzaksion tarzda kiritiladi. Filial izolyatsiyasi (`acting_branch`) to'liq ta'minlangan.
    - **Test Natijalari va Sinxronizatsiya:**
      - Backend: 12 ta tegishli test faylida (`test_clients.py`, `test_product_import.py`, `test_client_opening_import.py`, `test_orders.py`, `test_sales.py`, `test_order_taker.py`, `test_role_permissions_expansion.py`, `test_query_counts.py`, `test_opening_bulk.py`, `test_branch_isolation.py`, `test_reports_advanced.py`, `test_user_permissions.py`) **178/178 test 100% muvaffaqiyatli**.
      - Frontend: `tsc -b --noEmit` 0 xato, Vitest **59 ta test fayli, 242 ta test 100% muvaffaqiyatli**.
      - Barcha 12 ta o'zgartirilgan/yangi `frontend/src/` fayllari `artifacts/meyfu-app/src/` bilan to'liq sinxronlandi.

18. **`/ponytail-review` Natijasi Bo'yicha Barcha Aniqlangan Kamchiliklar va Regressiyalar Tuzatildi:**
    - **Filial va Mijoz Xavfsizligi (`backend/apps/clients/views.py`, `backend/apps/clients/opening_import.py`):** Markaz admini filial xodimiga mijoz biriktirganda mijoz va yangi marshrutga xodim filiali avtomatik o'tadi; har xil filialdagi xodim, marshrut va filial aralashtirilishi rad etiladi; `opening_balance_import` va shablon yuklash `_MANAGE` rollariga cheklandi (`ACCOUNTANT` chiqarildi).
    - **Import Ishonchliligi, Konkurentlik va N+1 Tuzatishlari (`opening_import.py`, `product_import.py`, `backend/apps/core/services/excel_import.py`):** Umumiy Excel o'qish/normalizatsiya yordamchilari (`excel_import.py`) ajratildi; `opening_import.py` da `_ClientIndex`/`_RouteIndex`/`_StaffIndex` bilan `dry_run=True` yoki xatoli qatorlarda DB yozuvlari to'xtatildi, telefon to'qnashuvi va xato telefon tekshiruvlari kuchaytirildi, mavjud `Client` qatorlari `select_for_update().order_by("pk")` bilan qulflandi; `product_import.py` da qator oxiridagi bo'sh ustunlar va bo'sh `bonus tovar` katagining avvalgi bonusni tozalashi to'g'rilandi.
    - **`bulk-sync` `visit`, Bildirishnoma va Pre-existing `HEAD` Regressiyalari:** `sales/services/sync.py` `_handle_visit` da `ensure_client_in_scope`, `is_client_off_route` va `ClientVisit.checked_in_at` uchun oldindan `timezone.now()` himoyasi qo'yildi; `realtime/tasks.py` `check_overdue_debts` birinchi navbatda `client.assigned_to` xodimini xabardor qiladi; `warehouse/views.py` `LoadingViewSet.confirm` da `WAREHOUSE` faqat o'z yuklamasini tasdiqlaydi (`NOT_YOUR_LOADING` 403); `ocr/views.py` `ReceiptScanView` `can_record_expenses` yoki `can_scan_invoices` ruxsatini qabul qiladi.
    - **Frontend Offline Sinxronizatsiya, UI va ESLint Tozaligi:** `offline/sync.ts` `/clients/` ni barcha sahifalar bo'yicha (`next` tugaguncha) yuklab `db.clients` ni atomik almashtiradi; `ClientOpeningImportModal.tsx` va `ProductImport.tsx` da fayl input `value` tozalanadi (bir xil faylni qayta tanlash uchun) va modal holati reset qilinadi; barcha `eslint` xato va ogohlantirishlari (13 ta holat -> 0) tozalandi.
    - **Yakuniy Verifikatsiya:** Backend **638/638 test 100% muvaffaqiyatli**, `makemigrations --check --dry-run` ("No changes detected"); Frontend `tsc -b --noEmit` 0 xato, `eslint . --max-warnings 0` 0 xato/ogohlantirish, Vitest **59/59 test fayli, 244/244 test 100% muvaffaqiyatli**; o'zgartirilgan/yangi barcha `frontend/src/` fayllari `artifacts/meyfu-app/src/` bilan 1:1 sinxronlandi.

19. **Bir Xil Nomli Mijozlarning Qarzdorligini Telefon Raqami Orqali Farqlash (`Qarzdorlik Telefon nomeri orqali farqlansin`):**
    - **API va Qidiruv (`backend/apps/sales/serializers.py`, `backend/apps/sales/views.py`, `backend/apps/sales/services/debt.py`):** `DebtSerializer` va `DebtPaymentSerializer` ga `client_phone` (`client.phone` / `debt.client.phone`, N+1 so'rovsiz `select_related`) qo'shildi; `DebtViewSet` va `DebtPaymentViewSet` `search_fields` da `client__phone` / `debt__client__phone` bo'yicha qidiruv yoqildi; `client_opening_sheet` (`name`, `phone`, `pk`) bo'yicha saralandi. `backend/schema.yml` va `frontend/src/shared/types/api.gen.ts` qayta generatsiya qilindi.
    - **Hisobotlar, Telegram va Akt-sverka (`aggregates.py`, `digest.py`, `statement.py`):** `debt_aging()` da har bir qatorga `client_id` qo'shildi (frontenda `key` to'qnashuvini oldini olish uchun); `build_overdue_summary()` Telegram xulosasida va `statement_pdf()` Akt-sverka sarlavhasida mijoz telefoni ko'rsatildi.
    - **Excel Boshlang'ich Qarz Importi (`backend/apps/clients/opening_import.py`):** `_ClientIndex.match` da telefon raqami birlamchi ajratuvchi kalitga aylantirildi — bir xil nomli, lekin har xil telefonli mijozlar alohida mijoz sifatida farqlanadi (`auto_create_missing=true` bo'lsa yangi mijoz yaratiladi, bazadagisi bilan to'qnashmaydi; telefonsiz bir nechta mos nom bo'lsa telefon so'raladi; `seen_new_keys` ham `(name, phone)` bo'yicha ajratiladi; `ClientOpeningRowResult.client_phone` oldindan ko'rish jadvaliga qaytariladi).
    - **Web Admin va Mobil UI (`frontend/src/` + `artifacts/meyfu-app/src/` 1:1):** `DebtsPage.tsx` (`Telefon` ustuni, qidiruv, `client_id` kaliti), `DebtCollectPage.tsx` (karta va to'lov modalida telefon, telefon/nom bo'yicha qidiruv, offline outbox yozuviga telefon), `MobileAdminDebts.tsx` (telefon va qidiruv), `OpeningBalancesPage.tsx`, `ClientOpeningImportModal.tsx`, `ClientsPage.tsx`, `CheckInSheet.tsx`, `NewSalePage.tsx`, `NewOrderPage.tsx`, `MyClientsPage.tsx` yangilandi; `DebtsPage.test.tsx` va `DebtCollectPage.test.tsx` qo'shildi.
    - **Yakuniy Verifikatsiya:** Frontend `tsc -b --noEmit` 0 xato, `eslint . --max-warnings 0` 0 ogohlantirish, Vitest **61/61 test fayli, 246/246 test** (`artifacts/meyfu-app` bilan 1:1 sinxron); Backend **642/642 test** (`pytest`) 100% muvaffaqiyatli, `makemigrations --check --dry-run` ("No changes detected").

20. **`/ponytail-audit` Bo'yicha Aniqlangan Barcha 1–17 Kamchiliklar To'liq Tuzatildi (`1-17 -bandlarni tuzat`):**
    - **1. Deployable `artifacts/meyfu-app` & Paritet (1, 15):** `scripts/sync-frontend.sh` (`--sync` / `--check`) yaratildi va `frontend/{src,public}` -> `artifacts/meyfu-app/{src,public}` 1:1 baytma-bayt sinxronlandi; ortiqcha `artifacts/mockup-sandbox/` va gitda saqlangan 85 ta `*/dist/*` / `*.tsbuildinfo` fayllari olib tashlanib `.gitignore` ga qo'shildi; `replit.md` yangilandi.
    - **2. Tovar Harakati Excel Eksporti (`ProductMovementExportView`):** `title=` -> `sheet_name=` tuzatildi, `product_movement_rows_for_export` sarlavha + `list[list]` qaytaradi, filial fayl nomi haqiqiy `Warehouse` nomidan olinadi.
    - **3. `cancel_sale` va `van_expected_quantity` (`SaleReturn` ziddiyati):** Qaytarish (`SaleReturn`) mavjud sotuvni `cancel_sale` bilan bekor qilish bloklandi; `van_expected_quantity` bekor qilingan sotuvga bog'liq qaytarishlarni hisobdan chiqardi.
    - **4. `fulfill_order` va `CONFLICT` / Bekor Qilingan Yetkazish:** `CONFLICT` sotuvda buyurtma `delivered_quantity`/`status` ga yozilmaydi (faqat `resolve_conflict(accept=True)` da yoziladi), noma'lum qator ID (`ORDER_LINE_NOT_FOUND`) xato beradi, `cancel_sale` yetkazilgan buyurtma miqdori va statusini orqaga qaytaradi.
    - **5 va 9. Maosh (`pay_payroll`) va `CommissionRule`:** `final_amount <= 0` bo'lsa kassaga 0/manfiy xarajat yozmay `PAID` ga o'tadi; `resolve_two_stage`, `_commission_rows` va 360° xodim kartasi (`distributor.py`) `CommissionRule` qoidalari va `SaleReturnItem` chegiruvlarini to'liq hisoblaydi.
    - **6. Katalog CSV Eksporti va `stock` (`catalog/views.py`):** `export` `(*_CATALOG_WRITE, Role.ACCOUNTANT)` ga cheklandi, barcha matn kataklari `_safe_cell` bilan formula inyeksiyasidan himoyalandi, `stock` `scope_queryset` bilan filial omboriga cheklandi.
    - **7. Filial Rahbari (`BRANCH_MANAGER`) Chegarasi (`users/views.py`):** `toggle_active` va `perform_destroy` da yuqori/boshqa boshqaruv rollarini (`BRANCH_STAFF_ROLES` dan tashqari) bloklash/o'chirish 403 bilan taqiqlandi.
    - **8. Omborchi (`WAREHOUSE`) va Oflayn `bulk-sync` Ruxsatlari:** `WAREHOUSE` roli `DebtPaymentViewSet`, `SaleReturnViewSet`, `DistributorExpenseViewSet`, `WalletViewSet`, `DayCloseViewSet` va `OrderViewSet` (`place`/`cancel`) da qo'llab-quvvatlandi va `_is_self_only` izolyatsiyasi joriy qilindi; `bulk-sync` `_handle_expense` (`can_record_expenses`) va `_handle_order_create` (`can_take_orders`) ruxsatlarini tekshiradi.
    - **10. Zaxiradan Tiklash (`backup.py`):** `.sqlite3.gz` atomik fayl almashtirish (`connections.close_all()` bilan) tiklashi qo'shildi, JSON tiklashdan oldin jadvallar `_clear_non_system_rows` bilan tozalanadi, PostgreSQL `psql` chaqiruviga `-v ON_ERROR_STOP=1 --single-transaction` qo'shildi.
    - **12. OCR Async va Tranzaksiya (`ocr/services/scan.py`, `ocr/views.py`):** `process_scan` tashqi provayder chaqiruvini `transaction.atomic()` dan tashqariga chiqardi; view'larda Celery faol bo'lganda `transaction.on_commit` bilan `process_scan_task.delay(...)` ishga tushiriladi.
    - **13. N+1 Optimallashtirish (`integrity.py`, `core/views.py`, `distributor.py`):** `run_integrity_check` guruhlangan `Sum`/`GROUP BY` so'rovlariga o'tkazildi, `apply_integrity_fixes` (`bulk_update`) joriy etilib `IntegrityCheckView.post` dagi ortiqcha ikkinchi to'liq tekshiruv olib tashlandi; `distributor_comparison` guruhlangan agregatsiyalarga o'tkazildi.
    - **14. Oflayn Katalog, PDF va Filial Bildirishnomalari:** `pullReferenceData` (`frontend/` + `artifacts/meyfu-app/`) `next` bo'yicha to'liq sahifalab yuklaydi; `rows_to_pdf` sarlavha va hujayralarni XML-escape qiladi; `check_overdue_debts` hamda `_notify_flagged` `business_date()` va filial kesimida ishlaydi.
    - **16 va 17. Tozalash va Lint:** `ClientViewSet.debts` haqiqiy `Debt` yozuvlariga ulandi; o'lik kod va ishlatilmagan 3 ta paket (`@replit/connectors-sdk`, `@hookform/resolvers`, `django-extensions`) olib tashlandi; `ruff` ogohlantirishlari (`--ignore E501`) 0 ga tushirildi.
    - **11. Regressiya Testlari va Yakuniy Verifikatsiya:** 12 ta backend test fayliga barcha yuqoridagi bandlar uchun 22 ta yangi regressiya testi qo'shildi. Backend: **664/664 test (`pytest`)**, `ruff` 0 xato, `makemigrations --check --dry-run` ("No changes detected"); `frontend/`: `tsc -b --noEmit` 0 xato, `eslint . --max-warnings 0` 0 ogohlantirish, Vitest **62/62 test fayli (256/256 test)**, `vite build` muvaffaqiyatli; `artifacts/meyfu-app/`: Vitest **62/62 (256/256)**, `tsc -b --noEmit` 0 xato, `vite build` muvaffaqiyatli, `scripts/sync-frontend.sh --check` OK; `pnpm run typecheck` (`tsc --build`, `manage.py check`, `scripts`, `meyfu-app`) 0 xato.

---

## 2. Joriy Texnik Holat (Current Environment & State)

- **Backend:** Python 3.12 · Django 5.2 · DRF · Channels/Daphne (`backend/`) — lokal port: `8001` (`664/664` pytest)
- **Frontend (GitHub source):** React 18 · TypeScript · Vite · Dexie PWA (`frontend/`) — lokal port: `5173` (`62` test fayli / `256` test)
- **Deployable Web Artifact (Replit):** `artifacts/meyfu-app/` — `bash scripts/sync-frontend.sh --check` orqali `frontend/{src,public}` bilan 1:1 paritet (`62` test fayli / `256` test)
- **Ishga tushirish:** `./start.sh` (Backend `:8001`, Frontend `:5173`) yoki pnpm workspace skriptlari
- **Bilimlar grafi:** `graphify-out/` (kod o'zgarganda `graphify update .` bilan yangilanadi)

---

## 3. Qayerdan Davom Etish Kerak (Next Steps & Priorities)

Yangi seansda foydalanuvchi aniq topshiriq bermasa yoki "qayerdan davom etamiz?" deb so'rasa, quyidagi ustuvor yo'nalishlar bo'yicha davom etiladi:

1. **O'zgarishlarni Commit/Push Qilish va Replit Publish:**
   - Git staging (`git add -A`) bilan kerakli o'zgarishlarni (`frontend/`, `artifacts/`, `backend/`, `.gitignore`, `.agents/memory/`) toza commit qilish.
   - `frontend/` o'zgarganda har doim `bash scripts/sync-frontend.sh --sync` va `--check` bajarish.
2. **Production Pilot va Real Qurilma Sinovlari (`docs/pilot.md`):**
   - Android Chrome'da Web Bluetooth termal printer (`ESC/POS` 58/80mm) sinovi;
   - Buxgalter bilan 1C XML/CSV import formatini yakuniy tasdiqlash;
   - `meyfu-base.uz` domeniga production deploy (PostgreSQL, Redis/Celery, Anthropic OCR, SSL/DNS tekshiruvi).

---

## 4. Seansni Yangilash Qoidasi (Har Bir Seans Yakunida)

Har bir vazifa yoki seans yakunida AI agent ushbu `SESSION_STATE.md` faylini yangilashi shart:
- **1-bo'limga:** Bajarilgan ish, o'zgartirilgan fayllar va commit/test natijasini qo'shish;
- **2-bo'limga:** Testlar soni, portlar yoki muhit o'zgargan bo'lsa yangilash;
- **3-bo'limga:** Tugallangan bandni olib tashlab, keyingi navbatdagi vazifani yozib qo'yish.
