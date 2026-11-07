import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Eye } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { reportsAdvancedApi } from '@/shared/api/reportsAdvanced';
import { dateShort, money } from '@/shared/lib/format';

/**
 * v5 C5: odatdagidan ancha katta xarajatlar (z-score). Bu jarima emas — ko'rib chiqish
 * uchun signal (CLAUDE.md 8). Hech narsa bo'lmasa, panel ko'rinmaydi.
 */
export function ExpenseAnomalies(): ReactElement | null {
  const [open, setOpen] = useState<boolean>(false);
  const query = useQuery({
    queryKey: ['expense-anomalies'],
    queryFn: () => reportsAdvancedApi.expenseAnomalies({}),
    retry: false,
  });
  const rows = query.data?.rows ?? [];
  if (rows.length === 0) return null;

  return (
    <section className="rounded-xl border border-pending/30 bg-pending/5 p-3 text-sm">
      <button
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="flex items-center gap-2 font-medium text-pending">
          <Eye size={16} aria-hidden />
          Odatdagidan katta xarajatlar: {rows.length} ta — ko‘rib chiqish tavsiya etiladi
        </span>
        <ChevronDown size={16} aria-hidden className={open ? 'rotate-180' : ''} />
      </button>
      {open && (
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-lg bg-white p-2 dark:bg-gray-900">
              <div className="flex justify-between gap-2">
                <span>
                  {dateShort(r.date)} · {r.distributor} · {r.category}
                </span>
                <span className="font-semibold">{money(r.amount)}</span>
              </div>
              <div className="text-xs text-gray-500">
                Odatda {money(r.typical)} atrofida
                {r.times_typical != null && ` — ${r.times_typical} barobar ko‘p`}
                {r.description && ` · Izoh: ${r.description}`}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
