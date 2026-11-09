# Gemini / Antigravity Qoidalari (Agent Rules)

## 1. Asosiy Qoida: Avtonom Qaror Qabul Qilish
- **Hech qachon odatiy qarorlar uchun "yes/no", "true/false", "davom etaymi?" deb so'ramang.**
- Topshiriq berilganda mustaqil ravishda eng maqul yechimni tahlil qiling va qabul qiling.
- O'zgarishlarni to'liq kiritib, test/tekshiruvlarni bajaring va faqat ish tugagach natijani xulosa qilib bering.

## 2. Xotira va Seans Davomiyligi (Har Yangi Seansda Majburiy)
- **Seans boshida:** Har bir yangi seansda ishni boshlashdan oldin `.agents/memory/MEMORY.md` va `.agents/memory/SESSION_STATE.md` fayllarini o'qing (`project-memory`, `memory-discipline`, `recall`, `recap` skill'lari). Shu orqali loyiha qayerdan kelgani va qayerdan davom etish kerakligini bilib olasiz.
- **Seans yakunida:** Har bir vazifa yakunida bajarilgan o'zgarishlar va navbatdagi qadamlarni `.agents/memory/SESSION_STATE.md` fayliga yozib yangilang (`remember`, `handoff`, `lesson` skill'lari).

## 3. Qo'shimcha Skill'lar va Arxitektura
- Kod yozish va tekshirishda `ponytail` (`ponytail`, `ponytail-review`, `ponytail-audit`) hamda `agency-agents` skill'laridan foydalaning.
- Batafsil: `AGENTS.md` va `CLAUDE.md`.
