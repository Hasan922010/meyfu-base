import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Fragment, useState, type ReactElement } from 'react';

import { salesApi } from '@/shared/api/reports';
import { DataState } from '@/shared/components/DataState';
import { dateShort, money } from '@/shared/lib/format';

const REASONS = [
  { value: '', label: 'Barcha sabablar' },
  { value: 'BRAK', label: 'Brak' },
  { value: 'MUDDAT', label: "Muddati o'tgan" },
  { value: 'KELISHMOVCHILIK', label: 'Kelishmovchilik' },
];

/** B3: mijozdan qaytarishlar ro'yxati (faqat o'qish; filial bo'yicha serverda cheklangan). */
export function SaleReturnsTable(): ReactElement {
  const [page, setPage] = useState<number>(1);
  const [reason, setReason] = useState<string>('');
  const [open, setOpen] = useState<string>('');

  const query = useQuery({
    queryKey: ['admin-sale-returns', page, reason],
    queryFn: () =>
      salesApi.returns({
        page,
        page_size: 25,
        ordering: '-created_at',
        ...(reason ? { reason } : {}),
      }),
    placeholderData: keepPreviousData,
  });
  const rows = query.data?.results ?? [];

  return (
    <div className="space-y-3">
      <select
        className="field max-w-xs"
        aria-label="Sabab bo'yicha filtr"
        value={reason}
        onChange={(e) => {
          setReason(e.target.value);
          setPage(1);
        }}
      >
        {REASONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <DataState
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          isEmpty={!query.isLoading && rows.length === 0}
          emptyText="Qaytarish yo'q"
        >
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
              <tr>
                <th className="p-3">Raqam</th>
                <th className="p-3">Sana</th>
                <th className="p-3">Mijoz</th>
                <th className="p-3">Tarqatuvchi</th>
                <th className="p-3">Sabab</th>
                <th className="p-3">Mashinaga</th>
                <th className="p-3 text-right">Summa</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Fragment key={r.id}>
                  <tr
                    className="cursor-pointer border-b border-gray-100 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand dark:border-gray-800 dark:hover:bg-gray-800"
                    tabIndex={0}
                    aria-expanded={open === r.id}
                    onClick={() => setOpen(open === r.id ? '' : r.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setOpen(open === r.id ? '' : r.id);
                      }
                    }}
                  >
                    <td className="p-3 font-mono text-xs">{r.number}</td>
                    <td className="p-3">{dateShort(r.date)}</td>
                    <td className="p-3">{r.client_name}</td>
                    <td className="p-3">{r.distributor_name ?? '—'}</td>
                    <td className="p-3">{r.reason_display}</td>
                    <td className="p-3">{r.restock ? 'Ha' : "Yo'q"}</td>
                    <td className="p-3 text-right">{money(r.total_amount)}</td>
                  </tr>
                  {open === r.id && (
                    <tr className="bg-gray-50 dark:bg-gray-800/50">
                      <td colSpan={7} className="p-3">
                        <ul className="space-y-1 text-xs">
                          {r.items.map((it) => (
                            <li key={it.id} className="flex justify-between">
                              <span>{it.product_name}</span>
                              <span>
                                {it.quantity} × {money(it.price ?? 0)} = {money(it.amount ?? 0)}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {r.note && <p className="mt-2 text-xs text-gray-500">Izoh: {r.note}</p>}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>

      {query.data && query.data.pages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <button
            className="btn px-3"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            aria-label="Oldingi sahifa"
          >
            ‹
          </button>
          <span>
            {page} / {query.data.pages}
          </span>
          <button
            className="btn px-3"
            disabled={page >= query.data.pages}
            onClick={() => setPage(page + 1)}
            aria-label="Keyingi sahifa"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
