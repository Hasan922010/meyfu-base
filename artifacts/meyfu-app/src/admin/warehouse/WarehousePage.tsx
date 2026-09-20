import { useState, type ReactElement } from 'react';

import { LoadingsTab } from './LoadingsTab';
import { PurchasesTab } from './PurchasesTab';
import { StockTab } from './StockTab';

type Tab = 'stock' | 'purchases' | 'loadings';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'stock', label: 'Qoldiq' },
  { id: 'purchases', label: 'Tovar qabullari' },
  { id: 'loadings', label: 'Yuklamalar' },
];

export function WarehousePage(): ReactElement {
  const [tab, setTab] = useState<Tab>('stock');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Ombor</h1>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t.id
                ? 'border-b-2 border-brand text-brand'
                : 'text-gray-500'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'stock' && <StockTab />}
      {tab === 'purchases' && <PurchasesTab />}
      {tab === 'loadings' && <LoadingsTab />}
    </div>
  );
}
