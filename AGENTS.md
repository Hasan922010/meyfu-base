# Agent Qoidalari va Avtonom Qaror Qabul Qilish (Autonomous Decision-Making)

## 1. Asosiy Qoida: To'liq Avtonomlik va Mustaqil Qaror Qabul Qilish

- **Tasdiq (yes/no, true/false) so'ramaslik**: Topshiriq berilganda har bir mayda qadam, fayl yaratish, komanda bajarish yoki kod yozish jarayonida foydalanuvchidan tasdiq (ha/yo'q, yes/no, true/false) so'ramang.
- **Eng maqul yechimni o'zi tanlash**: Muammoni tahlil qiling, eng maqul, zamonaviy, xavfsiz va to'g'ri texnik yechimni mustaqil tanlang va to'liq joriy qiling.
- **Avtomatik bajarish**: Kerakli fayllarni o'zgartiring, terminal komandalarini (test, build, lint va h.k.) bajaring, xatoliklar chiqsa o'zingiz tuzating.
- **Faqat jiddiy xavf tug'ilganda so'rash**: Faqat ma'lumotlar bazasini qaytmas darajada o'chirish (destructive action) yoki loyiha talabi tubdan noaniq bo'lgan favqulodda vaziyatdagina foydalanuvchiga murojaat qiling.
- **Xulosa berish**: Barcha ishlar to'liq bajarilgach, qabul qilingan qaror va amalga oshirilgan o'zgarishlar haqida qisqa, tushunarli hisobot taqdim eting.

## 2. Xotira va Seans Davomiyligi (Session Memory & Continuity — MAJBURIY)

- **Seans boshida (Qayerdan keldik va qayerdan davom etamiz):** Har bir yangi seans boshida `.agents/memory/MEMORY.md` va `.agents/memory/SESSION_STATE.md` fayllarini o'qing (yoki `./scripts/session-memory.sh` ni ishga tushiring). Bu orqali oldingi seanslarda nimalar bajarilgani, loyihaning joriy texnik holati va navbatdagi vazifalar qayerdan davom etishi kerakligini darhol bilib olasiz.
- **Seans yakunida (Xotirani yangilash):** Har bir topshiriq to'liq bajarilgach, `.agents/memory/SESSION_STATE.md` faylini yangilang (bajarilgan ishlar, o'zgargan holat va keyingi qadamlar). Muhim arxitektura yoki xavfsizlik qarorlari qabul qilinganda `.agents/memory/` ichiga yangi xotira fayli qo'shib, `MEMORY.md` indeksida ko'rsating.
- **Tegishli skill'lar:** `.agents/skills/project-memory/SKILL.md`, `memory-discipline`, `handoff`, `recap`, `remember`, `recall`, `session-history`.

## 3. O'rnatilgan Skill Paketlari va Standartlar

- **Ponytail (`ponytail`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, `ponytail-review`):** Ortiqcha abstraksiyasiz, mavjud komponentlardan foydalanib, qisqa, toza, xavfsiz va test bilan qoplangan kod yozish.
- **The Agency (`agency-agents`):** Muhandislik, dizayn, xavfsizlik, testlash va mahsulot bo'yicha 280+ ixtisoslashgan AI agent skill'lari (`.agents/skills/`).
- **Loyiha yo'riqnomasi va arxitekturasi:** `CLAUDE.md` va `distribution-app-prompt-v3.md` fayllarida belgilangan.
