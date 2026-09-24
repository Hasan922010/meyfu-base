# Claude Code uchun PROMPT — "Distribution & Sales Management System" (v3)

> **Foydalanish:** loyiha ildizida `CLAUDE.md` nomi bilan saqlang yoki Claude Code'ga to'liq bering.
>
> **v3 da o'zgargan:** bosqichlar **MVP → 2-faza → 3-faza** ga qayta taqsimlandi · offline **asosiy rejim** sifatida alohida arxitektura bo'limi · ma'lumot butunligi va o'zgarmas jurnal (immutable ledger) qoidalari · OCR uchun realistik sifat/narx o'lchovlari · "nazorat emas, ko'rish" tamoyili · backup 1-kundan · Telegram bot · pilot rejasi va qabul testlari (acceptance tests).

---

> **To'liq spetsifikatsiya** (modellar, API, OCR, real-time, mobil/desktop ekranlar, 360° karta, Telegram bot, backup, bosqichlar): `distribution-app-prompt-v3.md`. Kerak bo'lganda o'sha fayldan o'qing.

---

## 0. ROLE VA ASOSIY TAMOYILLAR

Sen tajribali **full-stack arxitektor va dasturchisan**. Quyidagi spetsifikatsiya asosida ishlab chiqarishga tayyor tizim yaratasan.

### 7 ta buzilmas tamoyil

1. **MVP birinchi.** Hamma narsani birdan qurma. `Yuklash → Sotuv → Kun yopish → Oddiy hisobot` — shu ishlab tursin. OCR, maosh avtomatikasi, 360° statistika keyin. Har bosqich **mustaqil ishlaydigan** mahsulot bo'lsin.
2. **Offline — qo'shimcha emas, asosiy rejim.** Tarqatuvchi podvalda, bozorda, tarifi tugagan telefonda ishlaydi. Har bir sotuv va xarajat avval **lokal bazaga** yoziladi, keyin serverga yuboriladi. Internet bor-yo'qligi ilova ishlashiga ta'sir qilmasin.
3. **Sotuv 30 soniyada tugasin.** Mijoz oldida, bir qo'lda, quyoshda. Har qo'shimcha tegish (tap) — daftarga qaytish ehtimoli. Sotuv oqimidagi qadamlarni sanab ko'r, 5 tadan oshsa — soddalashtir.
4. **Pul va tovar jurnali o'chirilmaydi.** `WalletTransaction`, `StockMovement`, `AuditLog` — faqat qo'shiladi (append-only). Xato bo'lsa tuzatuvchi yozuv qo'shiladi, o'chirilmaydi.
5. **Tizim nazorat quroli emas, ko'zoynak.** Limitlar va tekshiruvlar bor, lekin xodimni ayblovchi til ishlatilmaydi. Xodim o'z natijasini, maoshini, xarajatini ochiq ko'rib tursin — shunda ilovadan qochmaydi.
6. **AI ga 100% ishonilmaydi.** OCR natijasini doim inson tasdiqlaydi. Aniqlik va narx o'lchanadi.
7. **Ma'lumot yo'qolmaydi.** Backup 1-kundan, tiklash sinovdan o'tkazilgan.

### Ishlash tartibi
Har bosqich uchun: **qisqa reja → kod → migratsiya → testlar → qabul mezonlari (Definition of Done) → README yangilanishi → tasdiq so'rash.**
Ortiqcha abstraksiya qilma. Noaniqlik bo'lsa — taxmin qilma, **savol ber**.

---

## 1. BIZNES JARAYONI

Kompaniya zavodlardan **maishiy kimyo mahsulotlarini** (kir yuvish kukunlari/parashoklar, gellar, sovunlar, shampunlar, yuvish vositalari) **optom** oladi va tarqatuvchi agentlar orqali do'kon va bozorlarga yetkazadi.

```
0. TOVAR QABULI (2-faza)
   Zavod naklit (nakladnoy) bilan tovar keltiradi.
   Omborchi naklitni TELEFON KAMERASI bilan rasmga oladi.
   AI rasmni o'qiydi → tovar/miqdor/narx ajratiladi → xodim tekshiradi → tasdiqlaydi.
   MVP da bu qo'lda kiritish (tez kiritish formasi bilan).

1. ERTALAB — YUKLASH
   Ombordan tarqatuvchiga tovar beriladi.
   Tarqatuvchi mobil ilovada ko'radi va TASDIQLAYDI → VanStock (mashina qoldig'i).

2. KUN DAVOMIDA — SOTUV
   Marshrut bo'yicha do'konlarga boradi.
   Mijoz → tovar → miqdor → narx → to'lov turi (NAQD/PLASTIK/O'TKAZMA/QARZ/ARALASH).
   Qarzga berilsa — muddat bilan mijoz qarzdorligiga yoziladi.
   VanStock avtomatik kamayadi.

3. KUN DAVOMIDA — XARAJAT (2-faza)
   Yoqilg'i, tushlik, mashina yuvish, ta'mirlash, parkovka, aloqa va h.k.
   Chek rasmi biriktiriladi. Qo'lidagi pul kamayadi.

4. JONLI HAMYON (2-faza)
   naqd sotuv + undirilgan qarz − xarajat − topshirilgan = QO'LIMDA QOLGAN PUL
   Bu raqam mobil ilovada doim yuqorida turadi.

5. KECHQURUN — QAYTARISH VA KUN YOPISH
   Ostatka omborga qaytariladi (brak alohida).
   Yuklangan − Sotilgan − Qaytarilgan = TOVAR FARQI
   Kutilgan naqd − Topshirilgan naqd  = KASSA FARQI
   Kun yopiladi; keyin o'zgartirish faqat admin ruxsati bilan.

6. OYLIK — MAOSH (3-faza)
   Sotuvdan foiz + bonus − ushlanmalar (kamomad, kassa farqi, avans) ± xarajat qaytarimi.
```

---

## 2. ROLLAR

| Rol | Interfeys | Imkoniyatlar |
|---|---|---|
| **SUPER_ADMIN** | Desktop | Hammasi: sozlamalar, narx, foiz, xodimlar, moliya, tasdiqlashlar |
| **MANAGER** | Desktop | Yuklash, mijoz, tovar, hisobot, kun yopish. Narx/foiz o'zgartirmaydi |
| **WAREHOUSE** | Desktop/telefon | Kirim (naklit skan), yuklash, qaytarish qabuli, inventarizatsiya |
| **DISTRIBUTOR** | Mobil PWA | Yuklama, sotuv, mijozlar, qarz undirish, xarajat, hamyon, kun yopish, o'z maoshi |
| **ACCOUNTANT** | Desktop | Kassa, qarz, xarajat, maosh, eksport |

---

## 4. OFFLINE-FIRST ARXITEKTURA (alohida, majburiy bo'lim)

> Bu **MVP ning bir qismi**, keyinga qoldirilmaydi. Ilova avval lokal bazaga yozadi, keyin sinxronlaydi.

### 4.1 Lokal baza (Dexie / IndexedDB)
```
products        — katalog nusxasi (rasm URL bilan)
clients         — marshrut mijozlari
van_stock       — mashina qoldig'i (lokal hisoblanadi)
expense_categories
outbox          — yuborilmagan operatsiyalar navbati  ← YADRO
media_queue     — yuborilmagan rasmlar (Blob)
meta            — oxirgi sinxronizatsiya vaqti, versiyalar
```

### 4.2 Outbox pattern
```
Har bir operatsiya (sotuv, xarajat, qarz to'lovi, tashrif, kun yopish):
  { id: uuid(v4), type, payload, created_at, attempts, status, error }

Statuslar: PENDING → SENDING → SENT | FAILED | CONFLICT

Qoidalar:
  - client_uuid FRONTENDDA generatsiya qilinadi va o'zgarmaydi
  - Server unique constraint bilan dublikatni rad etadi (idempotent)
  - Yuborish tartibi — yaratilgan vaqt bo'yicha (FIFO)
  - Xato bo'lsa: exponential backoff (5s, 15s, 60s, 5min...), max 20 urinish
  - 3 martadan ko'p muvaffaqiyatsiz bo'lsa — foydalanuvchiga ko'rsatiladi
```

### 4.3 Lokal hisob-kitob
- VanStock offline'da lokal kamayadi → tarqatuvchi qoldiqni doim to'g'ri ko'radi.
- Hamyon balansi offline'da lokal hisoblanadi.
- Sinxronizatsiyadan keyin server qiymati bilan solishtiriladi; farq bo'lsa — ogohlantirish va `reconcile` ekrani.

### 4.4 Konflikt boshqaruvi
| Vaziyat | Yechim |
|---|---|
| Serverda qoldiq yetmaydi | Sotuv `CONFLICT` — xodimga ro'yxat ko'rsatiladi, admin qaror qiladi |
| Narx o'zgargan | Sotuv **eski narx bilan** qabul qilinadi (`price_locked_at` bilan), flag qo'yiladi |
| Mijoz qarz limitidan oshib ketgan | Qabul qilinadi, `flagged=True` + adminga xabar |
| Dublikat `client_uuid` | Jimgina `200 OK` qaytariladi (idempotent) |

### 4.5 UI talablari
- Yuqorida doim status: `🟢 Online` · `🟡 Yuborilmoqda (3)` · `🔴 Offline · 7 ta kutmoqda`
- Sotuv saqlangach darhol "✅ Saqlandi" (server javobini kutmasdan)
- "Sinxronizatsiya" ekrani: navbat, xatolar, "Qayta urinish" tugmasi
- Katalog eskirsa (>24 soat) — ogohlantirish

### 4.6 Qabul testi (majburiy)
```
1. Aviarejimni yoq
2. 20 ta sotuv + 5 ta xarajat + 2 ta qarz to'lovi kirit
3. Ilovani to'liq yop va qayta och → hammasi joyida turishi kerak
4. Internetni yoq
5. Hammasi serverga tushishi, dublikat bo'lmasligi,
   qoldiq va hamyon balansi server bilan mos kelishi shart
```

---

## 5. MA'LUMOT BUTUNLIGI VA JURNALLAR (majburiy)

### 5.1 O'zgarmas jurnallar (append-only)
`StockMovement`, `WalletTransaction`, `AuditLog` — **hech qachon `UPDATE` yoki `DELETE` qilinmaydi.**
- Xato bo'lsa: `CORRECTION` turidagi yangi yozuv (sabab + kim + qachon).
- Modelda `save()` override: mavjud yozuvni o'zgartirishga urinish → `ValidationError`.
- Django admin'da bu modellar uchun `has_delete_permission = False`, `has_change_permission = False`.

### 5.2 Balans = jurnal yig'indisi
`DistributorWallet.balance` va `Stock.quantity` — denormalized tezlik uchun, lekin **haqiqat manbai jurnal**.

Har kecha Celery task (`check_integrity`):
```
for each wallet:   balance == SUM(WalletTransaction.amount) ?
for each stock:    quantity == SUM(StockMovement) ?
for each van_stock: quantity == loaded − sold − returned ?
Farq topilsa → adminga darhol xabar + hisobot + AuditLog
```
Qo'lda ishga tushirish: `python manage.py check_integrity --fix-dry-run`

### 5.3 Audit
Quyidagilar **majburiy** yoziladi: narx o'zgarishi, kun yopilgandan keyingi tahrir, xarajat tasdiqlash/rad etish, maosh tasdiqlash, foydalanuvchi bloklash, tovar o'chirish, qoldiq tuzatish.
Yozuvda: kim, qachon, nima, eski qiymat → yangi qiymat, IP, qurilma.

### 5.4 Sana va vaqt
- Barcha vaqtlar UTC saqlanadi, `Asia/Tashkent` da ko'rsatiladi.
- "Ish kuni" tushunchasi sozlamada (masalan 06:00 – 05:59) — kechki sotuvlar to'g'ri kunga tushishi uchun.
- Mobil qurilma soati noto'g'ri bo'lishi mumkin: server vaqti asos, `device_time` alohida saqlanadi (farq katta bo'lsa flag).

---

## 7. BIZNES QOIDALARI

1. **Narx:** `price < product.min_price` → rad. `can_sell_below_price=True` bo'lsa sotiladi, lekin `flagged=True` + adminga real-time xabar.
2. **Qoldiq:** VanStock'dan ko'p sotilmaydi → `"Mashinada faqat X dona bor"`.
3. **Qarz limiti:** oshsa bloklanadi yoki admin ruxsati (offline'da — flag bilan qabul).
4. **Bloklangan mijoz:** faqat naqd.
5. **Xarajat limiti:** oshsa `PENDING` + admin xabari. `requires_receipt=True` → cheksiz saqlanmaydi.
6. **Hamyon:** balans manfiy bo'lsa ogohlantirish (`OWN_MONEY` dan tashqari).
7. **Kun yopilgach:** o'sha kun tahrirlanmaydi (faqat SUPER_ADMIN, sabab bilan, AuditLog'ga).
8. **Atomarlik:** `transaction.atomic()` + `select_for_update()`. Qoldiq manfiy bo'lmaydi.
9. **Idempotentlik:** `client_uuid` unique — dublikat rad etilmaydi, jimgina qabul qilinadi.
10. **Foyda:** har `SaleItem`da o'sha paytdagi `cost_price` saqlanadi.
11. **Kamomad:** avtomatik `Payroll.deduction`ga tushadi (sozlamada yoqilsa).
12. **Naklit dublikati:** `supplier + invoice_number` bo'yicha tekshiruv.
13. **Raqamlash:** `SOT-2026-00042`, `XRJ-2026-00113`, `YK-2026-00007`.

---

## 8. INSON OMILI — "NAZORAT EMAS, KO'ZOYNAK"

> Agar ilova ishonchsizlik quroliga aylansa, xodimlar uni chetlab o'tish yo'lini topadi. Balans muhim.

**Qilinsin:**
- Tarqatuvchi **o'z natijasini ochiq ko'rsin**: bugungi savdo, foiz, taxminiy maosh, reja progressi. Bu asosiy motivatsiya.
- Xatolik xabarlari **ayblovsiz** bo'lsin: `"Kassa farqi: 15 000 so'm. Izoh qoldiring"` — `"Siz 15 000 so'm kam topshirdingiz!"` emas.
- Kamomad bo'lsa — izoh yozish imkoniyati, darhol jarima emas.
- Xarajat rad etilsa — **sababi ko'rsatilsin**.
- GPS faqat ish vaqtida va tashrif/sotuv paytida yoziladi, kun bo'yi kuzatilmaydi. Buni sozlamalarda ochiq yozing.
- Reyting (kim ko'p sotdi) — ijobiy raqobat uchun, jarima uchun emas.

**Qilinmasin:**
- Yashirin kuzatuv, ekran surati, mikrofon.
- Xodim ko'ra olmaydigan "maxfiy ball".
- Har kichik farqda avtomatik jarima (avval inson ko'rib chiqsin).

---

## 18. TESTLAR (majburiy qoplanadigan yo'llar)

```
✓ Narx limiti (min_price dan past sotish rad/flag)
✓ VanStock yetarliligi
✓ Qarz limiti
✓ Kun yopish formulasi (xarajatli va xarajatsiz)
✓ Hamyon balansi butunligi (balance == SUM(transactions))
✓ Append-only jurnalni o'zgartirishga urinish → xato
✓ Offline dublikat (bir xil client_uuid 5 marta → 1 ta yozuv)
✓ Konflikt: offline sotuv, serverda qoldiq yo'q
✓ Atomarlik: parallel 2 ta sotuv, qoldiq manfiy bo'lmasligi
✓ Maosh formulasi (ushlanma + qaytarim)
✓ OCR qator moslashtirish (mock AI javobi bilan)
✓ Rol ruxsatlari (tarqatuvchi boshqa xodim ma'lumotini ko'rmaydi)
```
Kritik yo'llarda coverage ≥70%. CI da testlar avtomatik ishlasin.

---

## 20. UI/UX

- **Til:** o'zbek (default) + rus + ingliz, `i18next`, hardcode yo'q
- **Valyuta:** `1 250 000 so'm` · **Sana:** `dd.MM.yyyy` · **Vaqt:** `HH:mm`
- **Tema:** light + dark
- **Ranglar:** asosiy indigo; kirim/muvaffaqiyat yashil; xarajat to'q sariq; xato/qarz qizil; kutilmoqda sariq
- **Xato matnlari:** o'zbekcha, aniq va ayblovsiz — `"Mashinada faqat 8 dona bor"`, `"Internet yo'q — saqlandi, keyin yuboriladi"`, `"Kunlik xarajat limitidan oshdi, tasdiq kutilmoqda"`
- **Empty state:** illyustratsiya + keyingi qadam tavsiyasi
- **Responsiv:** mobil <768px, planshet, desktop >1280px
- **Kirish qulayligi:** klaviatura navigatsiyasi, `aria-label`, kontrast AA

---

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
