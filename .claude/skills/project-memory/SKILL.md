---
name: project-memory
description: Loyiha xotirasi va seans davomiyligi tizimi (Project Memory & Session Continuity). Har bir yangi seansda loyiha qayerdan kelgani, oxirgi o'zgarishlar nima ekani va qayerdan davom etish kerakligini aniqlash hamda yangilab borish uchun ishlatiladi.
---

# Project Memory & Session Continuity (`project-memory`)

Ushbu skill `meyfu-base` loyihasida har bir yangi AI seansida kontekst yo'qolmasligini ta'minlaydi: agent qayerdan kelganini (oldingi seanslarda nimalar qilinganini) va qayerdan davom etish kerakligini darhol biladi.

## Xotira Fayllari Joylashuvi

- **Asosiy indeks:** `.agents/memory/MEMORY.md`
- **Seans holati va yo'l xaritasi:** `.agents/memory/SESSION_STATE.md`
- **Mavzuli uzoq muddatli xotiralar:** `.agents/memory/*.md` (`github-frontend-sync.md`, `pit-restore-schema-sync.md`, `selected-test-data-cleanup.md` va h.k.)
- **Tezkor holat skripti:** `./scripts/session-memory.sh`

## 1. Seans Boshida (Session Start Protocol)

Har bir yangi seans boshlanganda yoki foydalanuvchi *"qayerda to'xtagan edik?"*, *"davom etamiz"*, *"xotirani tekshir"* deganda:

1. `.agents/memory/MEMORY.md` va `.agents/memory/SESSION_STATE.md` fayllarini o'qing.
2. Zarurat bo'lsa `./scripts/session-memory.sh` skriptini ishga tushirib, joriy git branch, oxirgi commitlar va o'zgargan fayllarni ko'ring.
3. Loyihaning joriy holatini, uzoq muddatli cheklovlarni (masalan, `frontend/` va `artifacts/meyfu-app/` sinxronizatsiyasi, append-only jurnallar, `8001` backend porti) hisobga olgan holda ishni davom ettiring.

## 2. Seans Davomida (In-Session Discipline)

- Agar muhim arxitektura qarori, xavfsizlik qoidasi yoki nozik bug sababi aniqlansa, `.agents/memory/` ichida yangi `<mavzu>.md` fayli yarating va uni `.agents/memory/MEMORY.md` ro'yxatiga qo'shing (`remember` / `lesson` tamoyili).
- Kod yozishda `ponytail` (faqat zarur, xavfsiz va testlangan kod) hamda `graphify` (`graphify-out/` grafigi) qoidalariga amal qiling.

## 3. Seans Yakunida (Session End / Task Completion Protocol)

Har bir topshiriq yoki seans yakunlanganda **foydalanuvchi eslatishini kutmasdan**:

1. `.agents/memory/SESSION_STATE.md` faylini yangilang:
   - **Qayerdan keldik:** Bajarilgan ish, tuzatilgan bug yoki qo'shilgan funksiya qisqacha yoziladi;
   - **Joriy holat:** Testlar soni yoki muhit o'zgargan bo'lsa yangilanadi;
   - **Qayerdan davom etish kerak:** Bajarilgan band olib tashlanib, navbatdagi ustuvor vazifalar yangilanadi.
2. Agar seans boshqa agentga topshirilayotgan bo'lsa, `handoff` yoki `recap` skill'laridan foydalaning.
