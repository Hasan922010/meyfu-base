import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { branchesApi } from '@/shared/api/branches';
import { downloadBlob } from '@/shared/api/reportsAdvanced';
import { DataState } from '@/shared/components/DataState';
import { PeriodSwitcher } from '@/shared/components/PeriodSwitcher';
import { money } from '@/shared/lib/format';

import { usePeriodParam } from './usePeriodParam';

/** Markaz uchun: filiallar yonma-yon (savdo, foyda, qarz, kassa) va hisob-kitob. */
export function BranchComparison(): ReactElement {
  const [preset, setPreset] = usePeriodParam();
  const [exporting, setExporting] = useState<boolean>(false);
  const query = useQuery({
    queryKey: ['branch-comparison', preset],
    queryFn: () => branchesApi.comparison({ preset }),
  });
  const rows = query.data?.rows ?? [];

  async function exportExcel(): Promise<void> {
    setExporting(true);
    try {
      downloadBlob(await branchesApi.comparisonBlob({ preset }), `filiallar_${preset}.xlsx`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Filiallar solishtirmasi</h2>
          <p className="text-xs text-gray-500">
            «Hisob-kitob» — markazdan olingan tovar − markazga qaytarilgan tovar − markazga
            topshirilgan pul. Musbat — filial markazga shuncha qarzdor.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSwitcher value={preset} onChange={setPreset} />
          <button
            className="btn inline-flex items-center gap-1 px-3 py-1.5 text-sm"
            disabled={exporting || rows.length === 0}
            onClick={() => void exportExcel()}
          >
            <Download size={16} aria-hidden /> Excel
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <DataState
          isLoading={query.isLoading}
          isError={query.isError}
          isEmpty={!query.isLoading && rows.length === 0}
          emptyText="Filial yo'q — «Ma'lumotnomalar → Omborlar» da «Filial» belgisini qo'ying"
        >
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
              <tr>
                <th className="p-3">Filial</th>
                <th className="p-3 text-right">Savdo</th>
                <th className="p-3 text-right">Sof foyda</th>
                <th className="p-3 text-right">Xarajat</th>
                <th className="p-3 text-right">Qarzdorlik</th>
                <th className="p-3 text-right">Kassa</th>
                <th className="p-3 text-right">Markazga topshirilgan</th>
                <th className="p-3 text-right">Hisob-kitob</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                >
                  <td className="p-3">
                    <Link
                      to={`/admin/branches/${r.id}?preset=${preset}`}
                      className="font-medium text-brand hover:underline"
                    >
                      {r.name}
                    </Link>
                    <div className="text-xs text-gray-400">
                      {r.sales_count} ta sotuv · {r.active_distributors} tarqatuvchi
                    </div>
                  </td>
                  <td className="whitespace-nowrap p-3 text-right font-medium">
                    {money(r.sales_total)}
                  </td>
                  <td
                    className={`whitespace-nowrap p-3 text-right ${
                      Number(r.net_profit) < 0 ? 'text-danger' : 'text-success'
                    }`}
                  >
                    {money(r.net_profit)}
                  </td>
                  <td className="whitespace-nowrap p-3 text-right text-expense">
                    {money(r.expenses)}
                  </td>
                  <td className="whitespace-nowrap p-3 text-right">{money(r.outstanding_debt)}</td>
                  <td className="whitespace-nowrap p-3 text-right">{money(r.cash_balance)}</td>
                  <td className="whitespace-nowrap p-3 text-right">
                    {money(r.settlement.cash_to_center)}
                  </td>
                  <td
                    className={`whitespace-nowrap p-3 text-right font-medium ${
                      Number(r.settlement.balance) > 0 ? 'text-pending' : 'text-success'
                    }`}
                  >
                    {money(r.settlement.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>
    </section>
  );
}
