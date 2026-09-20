# MeyFu

MeyFu is a distribution and sales management system for warehouse, field sales, debts, finance, payroll, reporting, and offline mobile workflows.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the Django API server
- `pnpm --filter @workspace/meyfu-app run dev` — run the React frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- Django migrations live under `backend/apps/*/migrations/`
- Required runtime env is provided by Replit: `DATABASE_URL`, `SESSION_SECRET`

## Stack

- Frontend: React 18, TypeScript, Vite, TanStack Query, Zustand, Tailwind, Dexie/PWA
- Backend: Python 3.12, Django 5, Django REST Framework, Channels/Daphne
- DB: Replit PostgreSQL
- Optional services: Redis/Celery, S3-compatible object storage, Telegram, Anthropic OCR

## Where things live

- `artifacts/meyfu-app/` — deployable React frontend
- `backend/` — Django application, models, migrations, API, background tasks
- `artifacts/api-server/` — Replit launch scripts for the Django API
- `frontend/` — original imported frontend source retained as an upstream reference

## Architecture decisions

- Replit uses two routed artifact services: the frontend at `/`, and Django at `/api`, `/admin`, `/ws`, `/static`, and `/media`.
- `config.settings.replit` uses Replit PostgreSQL and falls back to in-memory cache/channels when Redis is unavailable.
- Development seeds the repository's demo dataset; production never runs demo seeding.

## Product

Role-based desktop and mobile workflows cover products, stock, purchases, loading, sales, orders, routes, day closing, expenses, debts, finance, payroll, OCR, reports, and offline synchronization.

## User preferences

Custom domain planned: `meyfu-base.uz`.

## Gotchas

- Keep frontend API URLs same-origin (`/api/v1`) so development and published domains behave identically.
- Do not run `seed_demo` in production.
- Add new Django schema changes through migrations and apply them to development before publishing.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
