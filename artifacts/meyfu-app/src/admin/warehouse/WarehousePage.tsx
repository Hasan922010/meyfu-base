import { useState, type ReactElement } from 'react';

import { InventoryTab } from './InventoryTab';
import { LoadingsTab } from './LoadingsTab';
import { PurchasesTab } from './PurchasesTab';
import { ReorderTab } from './ReorderTab';
import { StockTab } from './StockTab';
import { TransfersTab } from './TransfersTab';

type Tab = 'stock' | 'reorder' | 'purchases' | 'loadings' | 'transfers' | 'inventory';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'stock', label: 'Qoldiq' },
  { id: 'reorder', label: 'Buyurtma tavsiyasi' },
  { id: 'purchases', label: 'Tovar qabullari' },
  { id: 'loadings', label: 'Yuklamalar' },
  { id: 'transfers', label: "Ko'chirishlar (filiallarga)" },
  { id: 'inventory', label: 'Inventarizatsiya' },
];

export function WarehousePage(): ReactElement {
  const [tab, setTab] = useState<Tab>('stock');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Ombor</h1>

      <div className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-800">
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
      {tab === 'reorder' && <ReorderTab />}
      {tab === 'purchases' && <PurchasesTab />}
      {tab === 'loadings' && <LoadingsTab />}
      {tab === 'transfers' && <TransfersTab />}
      {tab === 'inventory' && <InventoryTab />}
    </div>
  );
}
