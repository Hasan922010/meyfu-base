import type { KeyboardEvent, ReactElement } from 'react';

import { money, plainQty, qty } from '@/shared/lib/format';
import type { InventoryCountItem } from '@/shared/types/warehouse';

import { actualOf, differenceOf, type Drafts } from './inventory';

interface Props {
  items: InventoryCountItem[];
  drafts: Drafts;
  editable: boolean;
  onChange: (itemId: string, value: string) => void;
}

/** Enter — keyingi qatorning "Haqiqiy" maydoniga o'tadi (tez sanash uchun). */
function focusNext(e: KeyboardEvent<HTMLInputElement>): void {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const inputs = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[data-inventory-actual]'),
  );
  const next = inputs[inputs.indexOf(e.currentTarget) + 1];
  next?.focus();
  next?.select();
}

function diffTone(diff: number | null): string {
  if (diff === null || diff === 0) return 'text-gray-500';
  return diff > 0 ? 'text-success' : 'text-danger';
}

export function InventoryRows({ items, drafts, editable, onChange }: Props): ReactElement {
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
        <tr>
          <th className="p-3">Tovar</th>
          <th className="p-3 text-right">Hisobda</th>
          <th className="p-3 text-right">Haqiqiy</th>
          <th className="p-3 text-right">Farq</th>
          <th className="p-3 text-right">Farq (so'm)</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const actual = actualOf(item, drafts);
          const diff = differenceOf(item, drafts);
          const saved = item.actual_qty === null ? '' : plainQty(item.actual_qty);
          return (
            <tr
              key={item.id}
              className="border-b border-gray-100 last:border-0 dark:border-gray-800"
            >
              <td className="p-3">
                <div>{item.product_name}</div>
                <div className="text-xs text-gray-400">{item.product_sku}</div>
              </td>
              <td className="p-3 text-right">
                {qty(item.expected_qty)} {item.product_unit}
              </td>
              <td className="p-3 text-right">
                {editable ? (
                  <input
                    className="field ml-auto w-28 text-right"
                    inputMode="decimal"
                    data-inventory-actual
                    aria-label={`${item.product_name} — haqiqiy qoldiq`}
                    placeholder="—"
                    value={drafts[item.id] ?? saved}
                    onChange={(e) => onChange(item.id, e.target.value.replace(',', '.'))}
                    onKeyDown={focusNext}
                  />
                ) : (
                  <span>{actual === null ? '—' : qty(actual)}</span>
                )}
              </td>
              <td className={`p-3 text-right font-medium ${diffTone(diff)}`}>
                {diff === null ? '—' : `${diff > 0 ? '+' : ''}${qty(diff)}`}
              </td>
              <td className={`p-3 text-right ${diffTone(diff)}`}>
                {diff === null || diff === 0 ? '—' : money(diff * Number(item.cost_price))}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
