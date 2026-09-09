# REACT + TYPESCRIPT + DJANGO — TO'LIQ AUDIT VA TUZATISH PROMPTI

> Faylni loyiha ildiziga joylashtiring va ishga tushiring:
> `claude "AUDIT_PROMPT_REACT_TS_DJANGO.md faylini o'qi va bosqichlarni 0 dan boshlab ketma-ket bajar"`

---

## ROLI VA VAZIFA

Sen tajribali **Senior Full-Stack Engineer (Django + React/TypeScript) + Security Auditor + QA Engineer**san. Ushbu loyihani uch o'lchamda tekshirasan va topilgan kamchiliklarni tizimli tuzatasan:

1. **To'g'rilik** — backend mantiqi, frontend mantiqi va ayniqsa **ikkalasi orasidagi kelishuv (API kontrakti)**
2. **Xavfsizlik** — OWASP + Django + SPA-ga xos zaifliklar
3. **Sifat** — foydalanuvchi brauzerda real muammoga duch keladimi

Natija ikki faylda: `docs/AUDIT_REPORT.md` (topilmalar) va `docs/FIXES.md` (tuzatish prompti + progress trekeri).

---

## ASOSIY QOIDALAR (BUZILMAYDI)

1. **Hech narsani o'ylab topma.** Har topilma aniq manzilga ega: `apps/orders/views.py:142` yoki `src/features/cart/useCart.ts:58`. Isbotlanmagan gumon — "SHUBHA" deb belgilanadi.
2. **Avval o'qi, keyin yoz.** Model, serializer, hook va komponentni to'liq o'qimasdan o'zgartirma.
3. **Migration bilan ehtiyot.** Mavjud migration fayllarini **hech qachon tahrirlash yoki o'chirma** — yangi migration yoz. `migrate` faqat lokal/test DB'da.
4. **Production DB'ga tegma.** `DATABASES` production'ga ishora qilsa — to'xta va so'ra.
5. **Sirlar sir qoladi.** `SECRET_KEY`, API kalitlari, DB parollari hisobotda `<REDACTED>`.
6. **`any` qo'shma.** TypeScript'da muammoni `any` yoki `@ts-ignore` bilan yopish — tuzatish emas, yashirish.
7. **Kichik qadamlar.** Bitta commit = bitta mantiqiy tuzatish.
8. **Har bosqich oxirida** natijani `docs/AUDIT_REPORT.md` ga yozib bor.
9. **Biznes qoidasi noaniq bo'lsa — so'ra**, taxmin qilma.

---

## BOSQICH 0 — KASHFIYOT

**Backend**
- [ ] Django va Python versiyalari, `requirements.txt` / `pyproject.toml`
- [ ] `INSTALLED_APPS` — o'z app'lari va uchinchi tomon paketlari
- [ ] Settings strukturasi: bitta fayl mi yoki `base/dev/prod`
- [ ] DB engine, cache, Celery + broker
- [ ] Custom User model (`AUTH_USER_MODEL`) ishlatilganmi
- [ ] Auth: `simplejwt` / session+cookie / TokenAuth / allauth
- [ ] DRF konfiguratsiyasi: `DEFAULT_PERMISSION_CLASSES`, `DEFAULT_AUTHENTICATION_CLASSES`, `DEFAULT_THROTTLE_RATES`
- [ ] Barcha endpointlar xaritasi (`show_urls` yoki `urls.py` qo'lda)
- [ ] Model va bog'lanishlar sxemasi

**Frontend**
- [ ] React versiyasi, build tool (Vite / CRA / Next.js), router
- [ ] TypeScript konfiguratsiyasi: `strict`, `noImplicitAny`, `strictNullChecks` yoqilganmi
- [ ] State: Redux / Zustand / Context; server-state: React Query / SWR / qo'lda `fetch`
- [ ] HTTP qatlami: `axios` instance / `fetch` wrapper qayerda
- [ ] Forma kutubxonasi: react-hook-form / formik; validatsiya: zod / yup
- [ ] UI kutubxonasi, styling yondashuvi
- [ ] Tiplar qayerdan keladi: qo'lda yozilganmi yoki OpenAPI'dan generatsiya qilinganmi

**Boshlang'ich holat**
```bash
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test          # yoki pytest
npx tsc --noEmit               # TS xatolari
npm run lint
npm run build
npm test                       # bo'lsa
```
Har birining natijasini qayd et — bu boshlang'ich nuqta.

**Chiqish:** `AUDIT_REPORT.md` da "0. Loyiha xaritasi" + arxitektura tavsifi + API endpoint ↔ frontend hook mosligi jadvali.

---

## BOSQICH 1 — DJANGO SETTINGS VA KONFIGURATSIYA

- [ ] `python manage.py check --deploy` — **har bir ogohlantirishni** hisobotga yoz
- [ ] `DEBUG` env'dan olinadimi, production'da `False` mi
- [ ] `SECRET_KEY` kodda emas; **default fallback yo'qmi** (`os.getenv('SECRET_KEY', 'insecure-...')` — xato)
- [ ] `ALLOWED_HOSTS` — `['*']` emasmi
- [ ] `CORS_ALLOW_ALL_ORIGINS = True` **emasmi**; `CORS_ALLOWED_ORIGINS` aniq ro'yxatmi
- [ ] `CORS_ALLOW_CREDENTIALS = True` bo'lsa, origin `*` bo'lmasligi shart
- [ ] `CSRF_TRUSTED_ORIGINS` frontend domenini o'z ichiga oladimi
- [ ] `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `SESSION_COOKIE_HTTPONLY`, `SECURE_HSTS_SECONDS`, `SECURE_CONTENT_TYPE_NOSNIFF`, `X_FRAME_OPTIONS`
- [ ] `SESSION_COOKIE_SAMESITE` / `CSRF_COOKIE_SAMESITE` — SPA alohida domenda bo'lsa to'g'ri sozlanganmi
- [ ] `USE_TZ = True`, `TIME_ZONE` to'g'rimi (masalan `Asia/Tashkent`)
- [ ] Static/media: production'da qanday servis qilinadi; `MEDIA_ROOT` bajariladigan joyda emasmi
- [ ] `LOGGING` bormi; loglarga parol/token tushmaydimi
- [ ] `.env` `.gitignore` da mi; git tarixida sir bormi:
  ```bash
  git log -p --all -S "SECRET_KEY" | head -50
  git log --all --name-only | grep -iE "\.env$|\.env\."
  ```
- [ ] Admin URL default `/admin/` da qolganmi

**Frontend konfiguratsiya**
- [ ] **`VITE_` / `REACT_APP_` prefiksli env o'zgaruvchilar bundle'ga tushadi** — ular orasida maxfiy kalit yo'qmi:
  ```bash
  grep -rn "VITE_\|REACT_APP_" src/ .env*
  ```
- [ ] API base URL qattiq yozilmaganmi, env'dan olinadimi
- [ ] `tsconfig.json`: `"strict": true` mi. `false` bo'lsa — bu Yuqori darajali topilma
- [ ] ESLint konfiguratsiyasi bormi, `npm run lint` toza o'tadimi
- [ ] `npm audit` natijasi

---

## BOSQICH 2 — MODELLAR VA MA'LUMOTLAR BAZASI

**Model dizayni**
- [ ] **Pul maydonlari `FloatField` emas, `DecimalField(max_digits, decimal_places)` mi** — eng ko'p uchraydigan kritik xato
- [ ] `null=True` + `blank=True` mantiqiy; `CharField(null=True)` anti-pattern
- [ ] `on_delete` ongli tanlanganmi — to'lov, buyurtma tarixi `CASCADE` bilan o'chib ketmaydimi
- [ ] Indekslar: filtrlash/saralash maydonlarida `db_index` yoki `Meta.indexes`
- [ ] `UniqueConstraint` — dublikat DB darajasida to'siladimi
- [ ] `CheckConstraint` — manfiy narx, manfiy stok taqiqlanganmi
- [ ] `Meta.ordering` beqaror emasmi (pagination buzilishi)
- [ ] `save()` override'dagi yashirin yon ta'sirlar

**Migration'lar**
- [ ] `makemigrations --check --dry-run` toza mi
- [ ] Konflikt yo'qmi, `RunPython` da `reverse_code` bormi
- [ ] Data migration'lar `apps.get_model()` ishlatadimi

**So'rovlar**
- [ ] **N+1:** serializer ichida `obj.related.field` — `select_related` / `prefetch_related` bormi
  ```python
  queryset = Order.objects.select_related('user').prefetch_related('items__product')
  ```
- [ ] `assertNumQueries` bilan asosiy endpointlardagi so'rovlar sonini o'lchа
- [ ] Ro'yxat endpointlarida pagination bormi
- [ ] `.exists()` o'rniga `.count() > 0`; `len(qs)` o'rniga `.count()`
- [ ] `F()` siz qilingan increment (`obj.count += 1; obj.save()`) — race condition

---

## BOSQICH 3 — DRF: VIEW'LAR VA SERIALIZER'LAR

**Serializer'lar**
- [ ] `fields = '__all__'` — **mass assignment xavfi**. `is_staff`, `balance`, `role`, `user`, `status` yozilishi mumkinmi?
- [ ] `read_only_fields` to'g'ri belgilanganmi
- [ ] Hisoblanadigan maydonlar (`total`, `discount`) `read_only` mi — mijoz ularni yubora olmasligi kerak
- [ ] `validate_<field>` va `validate()` — biznes qoidalar serializer darajasida tekshiriladimi
- [ ] Nested serializer'da yozish (`create`/`update`) to'g'ri amalga oshirilganmi
- [ ] Javobda keraksiz maxfiy maydon qaytmayaptimi (`password`, `email`, ichki ID)

**View / ViewSet**
- [ ] `DEFAULT_PERMISSION_CLASSES` global `AllowAny` emasmi
- [ ] Har viewset'da `permission_classes` aniq ko'rsatilganmi
- [ ] **IDOR:** `get_queryset()` foydalanuvchi bo'yicha filtrlaydimi:
  ```python
  def get_queryset(self):
      return Order.objects.filter(user=self.request.user)
  ```
  Har bir detail endpoint uchun alohida tekshir
- [ ] `perform_create()` da `serializer.save(user=self.request.user)` — `user` body'dan olinmayaptimi
- [ ] Custom `@action` metodlarida ham permission tekshiruvi bormi
- [ ] Throttling login/OTP/parol tiklashda sozlanganmi
- [ ] `OrderingFilter` ixtiyoriy maydon bo'yicha saralashga ruxsat bermayaptimi

**Tranzaksiya va parallellik ⚠️**
- [ ] Bir nechta yozuv o'zgaradigan har joyda `transaction.atomic()` bormi
- [ ] Stok/balans o'zgarishi `select_for_update()` bilan qulflanganmi
- [ ] Atomik yangilanish:
  ```python
  # XATO — race condition
  product.stock -= qty; product.save()
  # TO'G'RI
  updated = Product.objects.filter(pk=pk, stock__gte=qty).update(stock=F('stock') - qty)
  if not updated: raise ValidationError("Stok yetarli emas")
  ```
- [ ] Idempotentlik: buyurtma/to'lov ikki marta yuborilsa dublikat yaratiladimi
- [ ] `transaction.on_commit()` — Celery task tranzaksiyadan oldin ishga tushmayaptimi
- [ ] Signal'lar (`post_save`) ichidagi yashirin mantiq tranzaksiya bilan mos ishlaydimi

---

## BOSQICH 4 — HISOB-KITOBLAR TO'G'RILIGI ⚠️ (ENG MUHIM BO'LIM)

### 4.1 Backend (Python / Decimal)

- [ ] Barcha hisob-kitob joylarini invenarizatsiya qil:
  ```bash
  grep -rn "Decimal\|round(\|/ 100\|\* 0\.\|percent\|discount\|tax\|total\|price" --include="*.py" .
  ```
- [ ] Pul hech qayerda `float` ga aylanmaydimi (`float(price)`, `FloatField`)
- [ ] `Decimal` va `float` aralashtirilmaganmi
- [ ] `Decimal('0.1')` string'dan yaratilganmi, `Decimal(0.1)` emas
- [ ] Yaxlitlash aniq: `amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)`
- [ ] Yaxlitlash **qaysi bosqichda** — har amaldan keyinmi yoki oxiridami? Hamma joyda bir xilmi?
- [ ] `Sum()` / `Avg()` da `output_field=DecimalField()` ko'rsatilganmi
- [ ] Bo'sh queryset'da `Sum()` `None` qaytaradi — `Coalesce(Sum(...), Decimal('0'))` bormi
- [ ] `annotate` + `filter` JOIN tufayli summani ikki barobar qilmayaptimi
- [ ] `max_digits` overflow (`InvalidOperation`) holati

### 4.2 Frontend (TypeScript)

- [ ] **Frontendda pul hisobi umuman bormi?** Ideal holat — barcha summalarni backend hisoblab, tayyor qiymat yuboradi
- [ ] Agar frontend hisoblasa: `number` tipi 0.1+0.2 muammosiga ega. Yechim — butun tiyinlarda hisoblash yoki `decimal.js` / `dinero.js`
- [ ] `parseFloat(price)` — DRF `Decimal`ni **string** sifatida yuboradi (`"12500.00"`). Katta summalarda `parseFloat` aniqlik yo'qotadi
- [ ] `toFixed()` bilan yaxlitlash backend qoidasi bilan mos kelmasligi mumkin
- [ ] Formatlash: `Intl.NumberFormat('uz-UZ', {...})` ishlatilganmi yoki qo'lda regex bilan qilinganmi
- [ ] Sana: `new Date(str)` timezone'ni brauzer bo'yicha talqin qiladi — backend UTC yuboradimi, frontend to'g'ri ko'rsatadimi

### 4.3 ⚠️ ENG MUHIM: FRONTEND VA BACKEND MOS KELADIMI?

Bu stackda eng ko'p uchraydigan jimgina xato — **bir xil summa ikki joyda hisoblanadi va ular farq qiladi**.

- [ ] Frontendda hisoblanadigan har bir qiymat ro'yxatini tuz (savat jami, chegirma, QQS, yetkazib berish)
- [ ] Har biri uchun backendda mos hisob bormi — **formulalar bir xilmi?**
- [ ] Yaxlitlash qoidasi ikkalasida bir xilmi?
- [ ] Amallar tartibi bir xilmi (chegirma soliqdan oldinmi yoki keyin)?
- [ ] **Test:** bir xil kirish ma'lumoti bilan frontend natijasini backend natijasi bilan solishtiruvchi test yoz
- [ ] **Tavsiya:** takrorlanishni yo'q qil — backend `subtotal`, `discount_amount`, `tax_amount`, `total` ni javobda qaytarsin, frontend faqat ko'rsatsin

### 4.4 Biznes mantiq

- [ ] Chegirma soliqdan oldinmi yoki keyinmi? Yetkazib berish soliqqa kiradimi?
- [ ] `subtotal + tax + shipping - discount == total` — barcha yo'llarda tenglik
- [ ] Nolga bo'lish, manfiy qiymat, `NaN`, juda katta son
- [ ] Valyuta: kurs qayerdan, konvertatsiya qayerda, aralash valyuta qo'shilmayaptimi
- [ ] **Buyurtma yaratilgandagi narx saqlanadimi** yoki har safar joriy mahsulot narxidan hisoblanadimi? Ikkinchisi — kritik xato: mahsulot narxi o'zgarsa eski buyurtmalar summasi o'zgarib ketadi
- [ ] `timezone.now()` ishlatiladimi (`datetime.now()` emas); naive datetime yo'qmi
- [ ] Kunlik/oylik hisobotlarda timezone chegarasi to'g'rimi

### 4.5 Tekshirish usuli

**Har bir formula uchun qo'lda hisoblangan misol yoz va to'rt joyda solishtir:**

```
Misol: 3 × 12 500 so'm, 15% chegirma, 12% QQS
  Subtotal:   37 500.00
  Chegirma:   -5 625.00   (37 500 × 0.15)
  Soliq baza:  31 875.00
  QQS:        +3 825.00   (31 875 × 0.12)
  JAMI:        35 700.00

Backend testi:   ???
API javobi:      ???
UI'da ko'rinishi: ???
DB'dagi yozuv:   ???
→ HAMMASI MOS / MOS EMAS
```

- [ ] Har formula uchun **backend unit test** (pytest) — chekka holatlar: `0`, `1`, manfiy, `Decimal('0.005')`, juda katta son
- [ ] Har formula uchun **frontend unit test** (vitest/jest)
- [ ] Ikkalasi uchun **bir xil test ma'lumotlari to'plamini** ishlat

---

## BOSQICH 5 — XAVFSIZLIK AUDITI

**Django-ga xos**
- [ ] Xom SQL: `raw()`, `extra()`, `cursor.execute()` — parametrlashtirilganmi
  ```bash
  grep -rn "\.raw(\|\.extra(\|cursor.execute" --include="*.py" .
  ```
- [ ] Deserializatsiya: `pickle.loads`, `yaml.load` (`safe_load` emas), `eval`, `exec`
- [ ] Path traversal: `open(user_input)`, `os.path.join(MEDIA_ROOT, user_input)`
- [ ] SSRF: `requests.get(user_url)`
- [ ] Fayl yuklash: `FileExtensionValidator`, hajm cheklovi, content-type tekshiruvi
- [ ] Django Admin: `list_display` da maxfiy maydon yo'qmi
- [ ] `DEBUG=False` da stack trace ochilmaydimi

**Autentifikatsiya**
- [ ] Parol hash Django default (`PBKDF2`/`Argon2`) mi; `AUTH_PASSWORD_VALIDATORS` yoqilganmi
- [ ] JWT: `ACCESS_TOKEN_LIFETIME` qisqami, `ROTATE_REFRESH_TOKENS` + blacklist yoqilganmi
- [ ] **Token qayerda saqlanadi?** `localStorage` — XSS bo'lsa token o'g'irlanadi. `httpOnly` cookie afzalroq (lekin CSRF himoyasi kerak). Tanlov ongli qilinganmi?
- [ ] Logout'da token haqiqatan bekor qilinadimi (faqat frontenddan o'chirilmayaptimi)
- [ ] Parol tiklash tokeni bir martalik va muddatli mi
- [ ] Brute-force himoyasi: `django-axes` yoki DRF throttling login'da

**Frontend / SPA-ga xos**
- [ ] XSS: `dangerouslySetInnerHTML` ishlatilgan joylar — kontent sanitizatsiya qilinadimi (`DOMPurify`)
  ```bash
  grep -rn "dangerouslySetInnerHTML\|innerHTML" src/
  ```
- [ ] `href={userInput}` — `javascript:` protokoli tekshiriladimi
- [ ] Rol tekshiruvi faqat frontendda emas, backendda ham bormi (`{user.isAdmin && <AdminPanel/>}` — himoya emas, faqat UI)
- [ ] Maxfiy ma'lumot Redux/localStorage'da ochiq saqlanmayaptimi
- [ ] `console.log` da token/foydalanuvchi ma'lumoti chiqmayaptimi
- [ ] Source map production build'ga tushmayaptimi
- [ ] Uchinchi tomon skriptlari (analytics, chat) — nima yuborishadi

**Avtomatik skanerlar**
```bash
pip install bandit pip-audit
bandit -r . -ll -x ./venv,./tests
pip-audit
npm audit --audit-level=moderate
```

---

## BOSQICH 6 — REACT + TYPESCRIPT AUDITI

**Tip xavfsizligi**
- [ ] `npx tsc --noEmit` — barcha xatolarni ro'yxatga ol
- [ ] `any` ishlatilgan joylar:
  ```bash
  grep -rn ": any\|as any\|@ts-ignore\|@ts-expect-error" src/
  ```
- [ ] **API javob tiplari qayerdan?** Qo'lda yozilgan bo'lsa — ular backend serializer bilan mos kelishini tekshir. Har bir nomuvofiqlik = potensial runtime xato
- [ ] **TypeScript tiplari runtime'da yo'qoladi.** API javobi kutilganidan farq qilsa, ilova jimgina buziladi. `zod` bilan runtime validatsiya bormi?
- [ ] `null` / `undefined` holatlari: `strictNullChecks` yoqilganmi, optional chaining to'g'ri ishlatilganmi
- [ ] Non-null assertion (`!`) ishlatilgan xavfli joylar

**React mantiqi**
- [ ] `useEffect` bog'liqliklari to'liqmi (`react-hooks/exhaustive-deps` qoidasi yoqilganmi)
- [ ] Fetch race condition: tez almashinuvda eski javob yangisini bosib ketmayaptimi — `AbortController` yoki cleanup bormi
- [ ] Cleanup: `setInterval`, event listener, subscription tozalanadimi (memory leak)
- [ ] Stale closure: `setState(x + 1)` o'rniga `setState(prev => prev + 1)` kerak bo'lgan joylar
- [ ] Key sifatida array index ishlatilganmi (ro'yxat o'zgarganda bug)
- [ ] Keraksiz re-render: katta ro'yxatlarda `memo`/`useMemo`/`useCallback` kerakmi
- [ ] Error Boundary bormi — bitta komponent xatosi butun ilovani o'ldirmaydimi

**Server-state va API qatlami**
- [ ] React Query / SWR ishlatilsa: mutation'dan keyin kesh invalidatsiyasi bormi (`invalidateQueries`)
- [ ] `staleTime` / `cacheTime` mantiqiy sozlanganmi — eski ma'lumot ko'rsatilmayaptimi
- [ ] Axios interceptor: 401 da refresh qilinadimi, **cheksiz sikl yaratmaydimi**
- [ ] Refresh paytida parallel so'rovlar navbatga qo'yiladimi yoki hammasi refresh chaqiradimi
- [ ] Har API chaqiruvida xato ushlanadimi; foydalanuvchiga tushunarli xabar ko'rsatiladimi
- [ ] Network xatosi (backend o'chiq) da oq ekran qolmaydimi

**UI holatlari**
- [ ] Loading / error / empty holatlari har asinxron joyda bormi
- [ ] Forma: submit paytida tugma bloklanadimi (double submit)
- [ ] Backend validatsiya xatolari (`400` javobidagi maydon xatolari) formaga bog'lanadimi
- [ ] Frontend validatsiya qoidalari backend qoidalari bilan mos keladimi (masalan parol uzunligi)
- [ ] Optimistic update ishlatilsa — xato bo'lganda rollback bormi

**Boshqa**
- [ ] Routing: himoyalangan sahifalar auth'siz ochiladimi; `ProtectedRoute` bormi
- [ ] Sonlar/sana/valyuta formatlash markazlashtirilganmi (bir nechta joyda takrorlanmayaptimi)
- [ ] i18n: matnlar qattiq yozilganmi
- [ ] Accessibility: `<label>` siz inputlar, `alt` yo'q rasmlar, kontrast, klaviatura navigatsiyasi, focus trap (modal)
- [ ] Bundle hajmi: `npm run build` natijasi; ishlatilmayotgan kutubxonalar; lazy-load imkoniyatlari

---

## BOSQICH 7 — API KONTRAKTI (CHEGARA AUDITI)

Bu bo'lim shu stackga xos va odatda e'tibordan chetda qoladi.

- [ ] **Har bir endpoint uchun jadval tuz:** DRF serializer maydonlari ↔ TypeScript interface maydonlari
- [ ] Nomuvofiqliklar: backend `snake_case`, frontend `camelCase` kutayaptimi? Konvertatsiya qayerda?
- [ ] Backend `null` yuboradigan maydon frontendda `optional` mi
- [ ] `Decimal` string sifatida keladi (`"12500.00"`) — TS tipi `string` mi yoki xato ravishda `number` mi
- [ ] `DateTimeField` ISO string keladi — TS tipi `string` mi, `Date` mi
- [ ] Pagination formati (`{count, next, previous, results}`) frontendda to'g'ri talqin qilinadimi
- [ ] Xato formati: DRF `{"field": ["xato"]}` yoki `{"detail": "..."}` — frontend ikkalasini ham qayta ishlaydimi
- [ ] **Tavsiya:** `drf-spectacular` bilan OpenAPI sxema generatsiya qilib, tiplarni avtomatik yaratish:
  ```bash
  pip install drf-spectacular
  python manage.py spectacular --file schema.yml
  npx openapi-typescript schema.yml -o src/types/api.ts
  ```
  Bu qo'lda yozilgan tiplardagi nomuvofiqlikni butunlay yo'q qiladi
- [ ] Ishlatilmayotgan endpointlar yoki frontend chaqiradigan mavjud bo'lmagan endpointlar bormi

---

## BOSQICH 8 — BRAUZERDA REAL TEST

Playwright + TypeScript ishlat:
```bash
npm init playwright@latest
```
Backend va frontend ikkalasini ham ishga tushirib test qil (`webServer` konfiguratsiyasida ikkalasini ko'rsat).

- [ ] **Har bir asosiy ssenariyni boshidan oxirigacha o'tkaz:**
  - ro'yxatdan o'tish → login → asosiy amal → to'lov/saqlash → logout
  - CRUD: yaratish → ko'rish → tahrirlash → o'chirish
- [ ] Har sahifada **console xatolari va warninglarini** yig'
- [ ] **Network:** 4xx/5xx so'rovlar, sekin (>1s), takroriy bir xil so'rovlar (frontendda N+1)
- [ ] **Hisob-kitobni uch joyda solishtir:** UI'dagi summa = API javobi = DB yozuvi
- [ ] Forma xatolari: bo'sh, noto'g'ri format, uzun matn, maxsus belgilar, emoji, kirill/lotin
- [ ] Double submit — dublikat yaratiladimi
- [ ] Sahifani yangilash — auth holati saqlanadimi, ma'lumot buziladimi
- [ ] Brauzer "orqaga" tugmasi
- [ ] Auth'siz himoyalangan URL → login'ga redirect bo'ladimi
- [ ] **Boshqa foydalanuvchi obyektining URL'ini ochish → 403/404 qaytadimi** (IDOR jonli tekshiruvi)
- [ ] Token muddati tugaganda nima bo'ladi (localStorage'dagi tokenni buzib ko'r)
- [ ] Backend o'chiq holatda ilova qanday xatoni ko'rsatadi
- [ ] Responsive: 375 / 768 / 1440 px — skrinshot ol
- [ ] Sekin tarmoq (throttling) va offline
- [ ] Lighthouse: performance, accessibility, best practices
- [ ] Xato topilsa skrinshot → `docs/audit-screenshots/`

---

## BOSQICH 9 — HISOBOTNI YOZISH

### 9.1 `docs/AUDIT_REPORT.md`

```markdown
# Audit hisoboti — {loyiha nomi}
Sana: {sana} | Commit: {hash} | Django {v} | React {v} | TS {v}

## Xulosa
- Jami topilma: N (Kritik: N, Yuqori: N, O'rta: N, Past: N)
- Eng xavfli 3 muammo: ...

## Jadval
| ID | Sarlavha | Turkum | Jiddiylik | Manzil | Holat |
|----|----------|--------|-----------|--------|-------|
| CALC-001 | Savat jami frontend va backendda farq qiladi | Hisob-kitob | Kritik | src/features/cart/total.ts:34 ↔ apps/orders/services.py:88 | Ochiq |

## Batafsil topilmalar
### CALC-001 — Savat jami frontend va backendda farq qiladi
- **Jiddiylik:** Kritik
- **Manzil:** `src/features/cart/total.ts:34` va `apps/orders/services.py:88`
- **Tavsif:** Frontend chegirmani QQS'dan keyin qo'llaydi, backend oldin.
- **Isbot:** 3 × 12 500, 15% chegirma → UI: 35 910.00, API: 35 700.00
- **Ta'sir:** Foydalanuvchi ko'rgan summa bilan hisobdan yechilgan summa mos kelmaydi.
- **Yechim:** Frontenddan hisobni olib tashlash, backend qaytargan `total` ni ko'rsatish.
```

**ID prefikslari:** `SEC-` xavfsizlik · `CALC-` hisob-kitob · `API-` API kontrakti · `ORM-` DB/so'rov · `DRF-` serializer/view · `MIG-` migration · `CFG-` konfiguratsiya · `FE-` React · `TS-` tip xavfsizligi · `UX-` · `PERF-` · `A11Y-`

**Jiddiylik:**
| Daraja | Ma'no | Muddat |
|--------|-------|--------|
| Kritik | Ma'lumot sizishi, pul xatosi, ishlamay qolish | Darhol |
| Yuqori | Asosiy funksiya buzilgan, jiddiy zaiflik | Shu sprint |
| O'rta | Chekka holat, sezilarli UX muammo | Rejalashtirilsin |
| Past | Kosmetik, texnik qarz | Imkon bo'lganda |

### 9.2 `docs/FIXES.md` — bu fayl keyingi bosqichda prompt bo'lib xizmat qiladi

```markdown
# Tuzatish rejasi

## Qanday ishlatiladi
Vazifalarni yuqoridan pastga ketma-ket bajar. Bittasini tugatgach:
1. Testni ishga tushir  2. Checkboxni [x] qil  3. "Natija" ni to'ldir
4. Commit qil  5. Keyingisiga o't

---

## 🔴 KRITIK

### [ ] CALC-001 — Savat jami frontend va backendda farq qiladi
**Manzil:** `src/features/cart/total.ts:34` ↔ `apps/orders/services.py:88`
**Muammo:** Chegirma va QQS tartibi ikki joyda har xil.
**Bajarilishi kerak:**
1. Biznes qoidasini tasdiqla (chegirma QQS'dan oldin) — noaniq bo'lsa SO'RA
2. Backend javobiga `subtotal`, `discount_amount`, `tax_amount`, `total` qo'sh
3. `src/features/cart/total.ts` dagi hisobni olib tashla, API qiymatlarini ishlat
4. TS tiplarini yangila (Decimal string sifatida keladi)
5. Backend unit test: 5 ta stsenariy
6. Playwright E2E: UI summasi = API summasi
**Qabul mezoni:** Frontendda pul hisobi qolmagan; E2E test UI va API summasini solishtirib o'tadi.
**Regressiya testi:** `apps/orders/tests/test_pricing.py`, `tests/e2e/cart.spec.ts`
**Natija:** _(to'ldiriladi)_
**Commit:** _(to'ldiriladi)_

---

## 🟠 YUQORI
...
## 🟡 O'RTA
...
## 🔵 PAST
...

## Progress
Kritik: 0/N | Yuqori: 0/N | O'rta: 0/N | Past: 0/N
Oxirgi yangilanish: {sana}
```

---

## BOSQICH 10 — TUZATISH SIKLI

`docs/FIXES.md` ni **o'zingga prompt sifatida** ishlat:

```
1. O'QI      → keyingi bajarilmagan vazifani ol
2. TEKSHIR   → tegishli fayllarni o'qi, muammo hali mavjudligini tasdiqla
3. TEST YOZ  → tuzatishdan OLDIN muammoni ko'rsatuvchi test (yiqilishi kerak)
4. TUZAT     → minimal, aniq o'zgartirish
5. SINA      → pytest <path>  ·  npx tsc --noEmit  ·  npm run lint
               python manage.py check
               makemigrations --check --dry-run
6. BRAUZER   → UI'ga aloqador bo'lsa Playwright bilan qayta tekshir
7. BELGILA   → FIXES.md da [x], "Natija", "Commit"
8. COMMIT    → fix(CALC-001): savat hisobini backendga markazlashtirish
9. KEYINGISI → 1-qadamga qayt
```

**Tartib:** Kritik → Yuqori → O'rta → Past. Ichida: xavfsizlik → hisob-kitob → API kontrakti → qolganlari.

**Muhim:** API kontraktiga tegadigan tuzatishda **backend va frontendni bitta commitda** o'zgartir — aks holda oraliq holatda ilova buziladi.

**To'xtash shartlari** — so'ra va kutib tur:
- Biznes qoidasi noaniq (chegirma soliqdan oldinmi yoki keyinmi?)
- Migration production ma'lumotiga ta'sir qiladi
- API kontrakti buziladi va mobil ilova / boshqa mijoz bor
- Tuzatish arxitekturaviy o'zgarish talab qiladi (2 soatdan ko'p)

**Har 5 ta tuzatishdan keyin:** to'liq test suite + `tsc --noEmit` + `check --deploy` ishga tushir, Progress'ni yangila.

---

## BOSQICH 11 — YAKUNIY TEKSHIRUV

- [ ] Barcha Kritik va Yuqori vazifalar yopilgan
- [ ] `pytest` / `python manage.py test` yashil, coverage pasaymagan
- [ ] `npx tsc --noEmit` — 0 xato
- [ ] `npm run lint` va `npm run build` toza
- [ ] `python manage.py check --deploy` — ogohlantirish yo'q yoki izohlangan
- [ ] `makemigrations --check --dry-run` toza
- [ ] `bandit -r .`, `pip-audit`, `npm audit` — kritik topilma yo'q
- [ ] Playwright E2E to'plami yashil, konsol toza
- [ ] Barcha hisob-kitob formulalari tasdiqlangan: **UI = API = DB**
- [ ] `AUDIT_REPORT.md` da har topilma holati yangilangan
- [ ] `FIXES.md` da qolgan vazifalar sababi bilan izohlangan

**Yakuniy xulosa yoz:** nima tuzatildi, nima qoldi va nega, keyingi 3-5 tavsiya.

---

## ISHNI BOSHLASH

Hozir **Bosqich 0** dan boshla. Har bosqich oxirida qisqacha hisobot ber va keyingisiga o't. Kontekst tugasa — `docs/AUDIT_REPORT.md` va `docs/FIXES.md` ni o'qib, qolgan joydan davom et.
