# MeyFu Project Memory Index (`MEMORY.md`)

> **Qoida:** Har bir yangi seans boshida avval ushbu `MEMORY.md` va [SESSION_STATE.md](SESSION_STATE.md) fayllarini o'qing. Vazifa yakunlangach, `SESSION_STATE.md` ni yangilang.

## 1. Joriy Seans Holati va Davomiylik (Session Continuity)
- [Seans holati va yo'l xaritasi (SESSION_STATE.md)](SESSION_STATE.md) — **Qayerdan keldik, hozir nima holatda va qayerdan davom etish kerak** (har bir seansda o'qilishi va yangilanishi shart).

## 2. Arxitektura va Xavfsizlik Qoidalari (Long-Term Lessons)
- [GitHub frontend sync](github-frontend-sync.md) — `frontend/` dagi o'zgarishlar Replit web artefakti (`artifacts/meyfu-app`) ga ham ko'chirilishi shart.
- [PIT restore and schema sync](pit-restore-schema-sync.md) — Production bazani restore qilgandan so'ng publish diff'ni tekshirish; jadval `TRUNCATE` qilinishiga yo'l qo'ymaslik.
- [Selected test-data cleanup](selected-test-data-cleanup.md) — Faqat tanlangan soxta operatsiyalarni tozalash (`TestCleanupService`), global balans/operatsiya reset qilmaslik.
