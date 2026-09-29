import { useMutation, useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { clientsApi } from '@/shared/api/clients';
import { DataState } from '@/shared/components/DataState';
import { businessDateISO } from '@/shared/lib/businessDay';
import { dateShort, money } from '@/shared/lib/format';

function yearStart(): string {
  return `${businessDateISO().slice(0, 4)}-01-01`;
}

/** v5 C2: mijoz bilan solishtirma dalolatnoma (akt-sverka) — ko'rish va PDF. */
export function ClientStatement({ clientId }: { clientId: string }): ReactElement {
  const [dateFrom, setDateFrom] = useState<string>(yearStart);
  const [dateTo, setDateTo] = useState<string>(() => businessDateISO());

  const query = useQuery({
    queryKey: ['client-statement', clientId, dateFrom, dateTo],
    queryFn: () => clientsApi.statement(clientId, dateFrom, dateTo),
    enabled: dateFrom !== '' && dateTo !== '' && dateFrom <= dateTo,
  });

  const pdf = useMutation({
    mutationFn: () => clientsApi.statementPdf(clientId, dateFrom, dateTo),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `akt-sverka-${dateFrom}-${dateTo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  const data = query.data;

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block text-gray-500">Sanadan</span>
          <input
            type="date"
            className="field"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </label>
        <label className="space-y-1">
          <span className="block text-gray-500">Sanagacha</span>
          <input
            type="date"
            className="field"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </label>
        <button
          className="btn flex items-center gap-1.5 px-3"
          disabled={!data || pdf.isPending}
          onClick={() => pdf.mutate()}
        >
          <Download size={16} aria-hidden /> PDF
        </button>
      </div>

      <DataState isLoading={query.isLoading} isError={query.isError} error={query.error}>
        {data && (
          <div className="space-y-2">
            <div className="max-h-80 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-800">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 text-left dark:bg-gray-800">
                  <tr>
                    <th className="p-2">Sana</th>
                    <th className="p-2">Hujjat</th>
                    <th className="p-2">Mazmuni</th>
                    <th className="p-2 text-right">Debet</th>
                    <th className="p-2 text-right">Kredit</th>
                    <th className="p-2 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-gray-100 font-medium dark:border-gray-800">
                    <td className="p-2" colSpan={5}>
                      Boshlang‘ich saldo
                    </td>
                    <td className="p-2 text-right">{money(data.opening_balance)}</td>
                  </tr>
                  {data.rows.map((r, i) => (
                    <tr key={`${r.date}-${r.document}-${i}`} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="p-2">{dateShort(r.date)}</td>
                      <td className="p-2 font-mono">{r.document || '—'}</td>
                      <td className="p-2">{r.description}</td>
                      <td className="p-2 text-right">{Number(r.debit) ? money(r.debit) : ''}</td>
                      <td className="p-2 text-right">{Number(r.credit) ? money(r.credit) : ''}</td>
                      <td className="p-2 text-right">{money(r.balance)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-gray-200 font-semibold dark:border-gray-700">
                    <td className="p-2" colSpan={3}>
                      Jami aylanma
                    </td>
                    <td className="p-2 text-right">{money(data.debit)}</td>
                    <td className="p-2 text-right">{money(data.credit)}</td>
                    <td className="p-2 text-right">{money(data.closing_balance)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className={Number(data.closing_balance) > 0 ? 'text-danger' : 'text-success'}>
              {Number(data.closing_balance) > 0
                ? `Mijoz qarzi: ${money(data.closing_balance)}`
                : Number(data.closing_balance) < 0
                  ? `Ortiqcha to‘lov: ${money(-Number(data.closing_balance))}`
                  : 'O‘zaro qarzdorlik yo‘q'}
            </p>
          </div>
        )}
      </DataState>
    </div>
  );
}
