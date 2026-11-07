import { useQuery } from '@tanstack/react-query';
import type { ReactElement } from 'react';

import { PdfButtons } from '@/admin/warehouse/PdfButtons';
import type { ActivityDocument } from '@/shared/api/branches';
import { dayCloseApi } from '@/shared/api/reports';
import { warehouseApi } from '@/shared/api/warehouse';
import { DataState } from '@/shared/components/DataState';
import { Modal } from '@/shared/components/Modal';
import { dateShort, money, qty } from '@/shared/lib/format';

/** Har xil hujjat turlari uchun yagona ko'rinish. */
interface DocView {
  facts: Array<[string, string]>;
  columns: string[];
  rows: Array<{ key: string; cells: string[] }>;
  pdf?: (stamp: boolean) => Promise<Blob>;
}

async function loadDocument(doc: ActivityDocument): Promise<DocView> {
  switch (doc.type) {
    case 'transfer': {
      const t = await warehouseApi.transfer(doc.id);
      return {
        facts: [
          ['Sana', dateShort(t.date)],
          ['Qayerdan', t.from_warehouse_name],
          ['Qayerga', t.to_warehouse_name],
          ['Holat', t.status_display],
          ['Yubordi', t.sent_by_name ?? '—'],
          ['Qabul qildi', t.received_by_name ?? '—'],
          ['Izoh', [t.note, t.receive_note].filter(Boolean).join(' · ') || '—'],
        ],
        columns: ['Mahsulot', "Jo'natilgan", 'Qabul qilingan', 'Farq'],
        rows: t.items.map((i) => ({
          key: i.id,
          cells: [
            i.product_name,
            `${qty(i.quantity)} ${i.product_unit}`,
            i.received_quantity === null ? '—' : qty(i.received_quantity),
            i.difference === null || Number(i.difference) === 0 ? '—' : qty(i.difference),
          ],
        })),
      };
    }
    case 'purchase': {
      const p = await warehouseApi.purchase(doc.id);
      return {
        facts: [
          ['Sana', dateShort(p.date)],
          ["Ta'minotchi", p.supplier_name],
          ['Ombor', p.warehouse_name],
          ['Nakladnoy', p.invoice_number || '—'],
          ['Holat', p.status_display],
        ],
        columns: ['Mahsulot', 'Miqdor', 'Narx'],
        rows: p.items.map((i, n) => ({
          key: i.id ?? String(n),
          cells: [i.product_name ?? i.product, qty(i.quantity), qty(i.cost_price)],
        })),
        pdf: (stamp) => warehouseApi.purchasePdf(doc.id, stamp),
      };
    }
    case 'loading': {
      const l = await warehouseApi.loading(doc.id);
      return {
        facts: [
          ['Sana', dateShort(l.date)],
          ['Tarqatuvchi', l.distributor_name],
          ['Ombor', l.warehouse_name],
          ['Holat', l.status_display],
        ],
        columns: ['Mahsulot', 'Miqdor'],
        rows: l.items.map((i, n) => ({
          key: i.id ?? String(n),
          cells: [i.product_name ?? i.product, qty(i.quantity)],
        })),
        pdf: (stamp) => warehouseApi.loadingPdf(doc.id, stamp),
      };
    }
    case 'inventory': {
      const c = await warehouseApi.inventoryCount(doc.id);
      const counted = (c.items ?? []).filter((i) => i.actual_qty !== null);
      return {
        facts: [
          ['Sana', dateShort(c.date)],
          ['Ombor', c.warehouse_name],
          ['Holat', c.status_display],
          ['Sanalgan', `${c.counted_count} / ${c.items_count}`],
        ],
        columns: ['Mahsulot', 'Hisobda', 'Haqiqiy', 'Farq'],
        rows: counted.map((i) => ({
          key: i.id,
          cells: [
            i.product_name,
            qty(i.expected_qty),
            qty(i.actual_qty ?? '0'),
            i.difference === null ? '—' : qty(i.difference),
          ],
        })),
      };
    }
    case 'daily_return': {
      const r = await dayCloseApi.dailyReturn(doc.id);
      return {
        facts: [
          ['Sana', dateShort(r.date)],
          ['Tarqatuvchi', r.distributor_name ?? '—'],
          ['Ombor', r.warehouse_name ?? '—'],
          ['Summa', money(r.total_amount)],
          ['Izoh', r.note || '—'],
        ],
        columns: ['Mahsulot', 'Miqdor', 'Holati', 'Summa'],
        rows: r.items.map((i) => ({
          key: i.id,
          cells: [
            i.product_name,
            qty(i.quantity),
            CONDITION_LABEL[i.condition] ?? i.condition,
            money(i.amount),
          ],
        })),
      };
    }
  }
}

const CONDITION_LABEL: Record<string, string> = {
  GOOD: 'Yaroqli',
  DAMAGED: 'Brak',
  EXPIRED: "Muddati o'tgan",
};

export function DocumentModal({
  doc,
  onClose,
}: {
  doc: ActivityDocument | null;
  onClose: () => void;
}): ReactElement {
  const query = useQuery({
    queryKey: ['document', doc?.type, doc?.id],
    queryFn: () => loadDocument(doc as ActivityDocument),
    enabled: doc !== null,
  });
  const view = query.data;

  return (
    <Modal
      open={doc !== null}
      title={doc ? `${doc.label} ${doc.number}` : ''}
      size="lg"
      onClose={onClose}
    >
      <DataState isLoading={query.isLoading} isError={query.isError} isEmpty={false}>
        {view && (
          <div className="space-y-3">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {view.facts.map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between gap-2 border-b border-gray-100 py-1 dark:border-gray-800"
                >
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            {view.columns.length > 0 && (
              <div className="max-h-[50vh] overflow-auto rounded-lg border border-gray-100 dark:border-gray-800">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white text-left text-gray-500 dark:bg-gray-900">
                    <tr>
                      {view.columns.map((c, n) => (
                        <th key={c} className={`p-2 ${n > 0 ? 'text-right' : ''}`}>
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {view.rows.map((r) => (
                      <tr key={r.key} className="border-t border-gray-100 dark:border-gray-800">
                        {r.cells.map((c, n) => (
                          <td key={n} className={`p-2 ${n > 0 ? 'text-right' : ''}`}>
                            {c}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {view.pdf && (
              <div className="flex justify-end">
                <PdfButtons fetchPdf={view.pdf} />
              </div>
            )}
          </div>
        )}
      </DataState>
    </Modal>
  );
}
