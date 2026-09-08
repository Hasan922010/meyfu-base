# Ishlash (performance) — 16-bosqich

## N+1 so'rovlar
Barcha ViewSet `get_queryset()` lari `select_related` / `prefetch_related` bilan:
sales, clients, warehouse, wallet, expenses, finance, ocr, payroll, dayclose, catalog.
Hisobot agregatlari (`apps/reports/services/`) — `.values().annotate()` bilan bitta
so'rovda, Python tsiklisiz.

## Indekslar
| Model | Indeks | Nima uchun |
|---|---|---|
| `Sale` | `(distributor, -date)`, `(client, -date)`, `(status, flagged)`, `(date, status)` | 360° karta, hisobot sana oralig'i |
| `SaleItem` | FK `sale`, `product` (avtomatik) | hisobot join |
| `Debt` | `(client, status)` | qarzdorlik ro'yxati |
| `DebtPayment` | `(date)`, `(collected_by, -date)` | dashboard, kunlik yig'im |
| `WalletTransaction` | `(wallet, -created_at)`, `(reference_type, reference_id)` | hamyon jurnali, butunlik |
| `StockMovement` | `(warehouse, product, -created_at)`, `(reference_type, reference_id)` | qoldiq jurnali |
| `ClientVisit` | `(distributor, -checked_in_at)`, `(client, -checked_in_at)` | tashriflar |
| `DistributorExpense` | `(distributor, -date)`, `(status)` | xarajatlar |
| `AuditLog` | `(model_name, object_id)`, `(action, -created_at)` | audit qidiruv |

## Keshlash (Redis)
| Kalit | TTL | Izoh |
|---|---|---|
| `reports:dashboard:{sana}` | 15 s | WS tik (30 s) + bir nechta admin yuklamasi |
| `dist360:{id}:{dan}:{gacha}` | 60 s | 360° karta og'ir agregatsiyasi |

Yozuv operatsiyalari keshni invalidatsiya qilmaydi — TTL qisqa, "eventual" yangilanish
qabul qilinadi. Kesh `django.core.cache` (Redis); testlarda `conftest._clear_cache`
har test oldidan tozalaydi.

## Frontend
- `recharts` (og'ir) faqat `DistributorCardPage` da lazy-load — mobil bundle'ga tushmaydi
- TanStack Query: ro'yxatlarda `keepPreviousData`, dashboard 30 s `refetchInterval`
- Rasm yuklashdan oldin `browser-image-compression` (max 1600px)
- Vite kod bo'linishi: `react`, `query`, `i18n`, `offline`, `DistributorCardPage` alohida chunk

## Kelajak (kerak bo'lsa)
- `Sale`/`SaleItem` uchun oylik partitsiya (yillar davomida)
- Hisobot materialized view yoki `pg_cron` bilan oldindan hisoblangan jadval
- `SELECT ... FOR UPDATE SKIP LOCKED` ommaviy sinxronizatsiyada
