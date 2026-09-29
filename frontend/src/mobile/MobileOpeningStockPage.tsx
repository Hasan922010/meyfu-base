import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { BalanceGrid } from '@/admin/opening-balances/BalanceGrid';
import { warehouseApi } from '@/shared/api/warehouse';

/** Omborchi telefonidan tovarlarning boshlang'ich qoldig'ini kiritadi. */
export function MobileOpeningStockPage(): ReactElement {
  const qc = useQueryClient();
  const [warehouse, setWarehouse] = useState<string>('');
  const warehouses = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehouseApi.warehouses({ page_size: 200 }),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Link to="/m" aria-label="Orqaga" className="text-gray-500">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold">Boshlang'ich qoldiq</h1>
      </div>

      <select
        className="field"
        aria-label="Ombor"
        value={warehouse}
        onChange={(e) => setWarehouse(e.target.value)}
      >
        <option value="">— omborni tanlang —</option>
        {warehouses.data?.results.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>

      {/* key — ombor almashsa kiritilganlar boshqa omborga o'tib ketmasin */}
      <BalanceGrid
        key={warehouse}
        kind="stock"
        warehouse={warehouse}
        valueKind="qty"
        rules={{ allowNegative: false, increaseOnly: false }}
        hint="Har tovarning haqiqiy miqdorini yozing — farq boshlang'ich qoldiq sifatida yoziladi."
        onSaved={() => void qc.invalidateQueries({ queryKey: ['stock'] })}
      />
    </div>
  );
}
