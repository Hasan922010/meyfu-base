# offline/

Offline-first yadro (CLAUDE.md 4). **5-bosqichda** to'ldiriladi:

- `db.ts` — Dexie sxemasi (products, clients, van_stock, outbox, media_queue, meta)
- `outbox.ts` — outbox pattern, FIFO, exponential backoff
- `sync.ts` — `bulk-sync` bilan serverga yuborish, reconcile
- `useSyncStatus.ts` — 🟢/🟡/🔴 holat hook

MVP 1-bosqichda faqat papka rezerv qilingan.
