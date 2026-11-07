import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { Link, useParams } from 'react-router-dom';

import { DocumentModal } from '@/admin/documents/DocumentModal';
import {
  branchesApi,
  type ActivityDocument,
  type BranchKind,
} from '@/shared/api/branches';
import { downloadBlob } from '@/shared/api/reportsAdvanced';
import { DataState } from '@/shared/components/DataState';
import { PeriodSwitcher } from '@/shared/components/PeriodSwitcher';
import { dateShort, money, qty } from '@/shared/lib/format';

import { usePeriodParam } from './usePeriodParam';

/** Kartadan ochiladigan to'liq hisobot — qatorlar va ularning hujjatlari. */
export function BranchActivityPage(): ReactElement {
  const { id = '', kind = 'stock' } = useParams();
  const [preset, setPreset] = usePeriodParam();
  const [search, setSearch] = useState<string>('');
  const [doc, setDoc] = useState<ActivityDocument | null>(null);
  const [exporting, setExporting] = useState<boolean>(false);

  const query = useQuery({
    queryKey: ['branch-activity', id, kind, preset],
    queryFn: () => branchesApi.activity(id, kind as BranchKind, { preset }),
  });
  const data = query.data;
  const needle = search.trim().toLowerCase();
  const rows = (data?.rows ?? []).filter(
    (r) =>
      !needle ||
      r.product_name.toLowerCase().includes(needle) ||
      r.product_sku.toLowerCase().includes(needle) ||
      (r.document?.number ?? '').toLowerCase().includes(needle),
  );
  const total = rows.reduce((sum, r) => sum + Number(r.amount), 0);
  const periodic = kind !== 'stock' && kind !== 'in_transit';

  async function exportExcel(): Promise<void> {
    setExporting(true);
    try {
      const blob = await branchesApi.exportBlob(id, kind as BranchKind, { preset });
      downloadBlob(blob, `${data?.warehouse.name ?? 'filial'}_${kind}_${preset}.xlsx`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Link
        to={`/admin/branches/${id}?preset=${preset}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500"
      >
        <ArrowLeft size={16} aria-hidden /> {data?.warehouse.name ?? 'Filial'}
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{data?.label ?? '…'}</h1>
          {data && periodic && (
            <p className="text-sm text-gray-500">
              {dateShort(data.date_from)} – {dateShort(data.date_to)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {periodic && <PeriodSwitcher value={preset} onChange={setPreset} />}
          <button
            className="btn inline-flex items-center gap-1 px-3 py-1.5 text-sm"
            disabled={exporting || rows.length === 0}
            onClick={() => void exportExcel()}
          >
            <Download size={16} aria-hidden /> Excel
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          className="field max-w-xs"
          placeholder="Mahsulot, SKU yoki hujjat raqami"
          aria-label="Qidirish"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="text-sm text-gray-500">
          {rows.length} ta qator · jami {money(total)}
        </span>
      </div>

      {data?.truncated && (
        <p className="rounded-lg bg-pending/10 px-3 py-2 text-sm text-pending">
          Faqat oxirgi 1000 ta qator ko'rsatildi — davrni qisqartiring yoki Excel'ga yuklang.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <DataState
          isLoading={query.isLoading}
          isError={query.isError}
          isEmpty={!query.isLoading && rows.length === 0}
          emptyText="Bu davrda harakat yo'q"
        >
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
              <tr>
                <th className="p-3">Sana</th>
                <th className="p-3">Mahsulot</th>
                <th className="p-3 text-right">Miqdor</th>
                <th className="p-3 text-right">Summa</th>
                <th className="p-3">Turi</th>
                <th className="p-3">Hujjat</th>
                <th className="p-3">Kim · izoh</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                >
                  <td className="whitespace-nowrap p-3">{dateShort(r.date)}</td>
                  <td className="p-3">
                    <div>{r.product_name}</div>
                    <div className="text-xs text-gray-400">{r.product_sku}</div>
                  </td>
                  <td
                    className={`whitespace-nowrap p-3 text-right font-medium ${
                      Number(r.quantity) < 0 ? 'text-danger' : ''
                    }`}
                  >
                    {qty(r.quantity)} {r.unit}
                  </td>
                  <td className="whitespace-nowrap p-3 text-right">{money(r.amount)}</td>
                  <td className="p-3 text-gray-500">{r.movement_type}</td>
                  <td className="p-3">
                    {r.document ? (
                      <button
                        className="inline-flex items-center gap-1 text-brand hover:underline"
                        onClick={() => setDoc(r.document)}
                      >
                        <FileText size={14} aria-hidden />
                        {r.document.label} {r.document.number}
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-3 text-gray-500">
                    {[r.user_name, r.note].filter(Boolean).join(' · ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>

      <DocumentModal doc={doc} onClose={() => setDoc(null)} />
    </div>
  );
}
