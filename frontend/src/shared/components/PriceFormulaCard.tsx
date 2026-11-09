import type { ReactElement } from 'react';
import { money } from '@/shared/lib/format';

interface PriceFormulaCardProps {
  isPackage: boolean;
  packageCount: number;
  packageType: string;
  packQuantity: number;
  baseUnit: string;
  totalBaseQty: number;
  unitPrice: number;
  totalPrice: number;
}

export function PriceFormulaCard({
  isPackage,
  packageCount,
  packageType,
  packQuantity,
  baseUnit,
  totalBaseQty,
  unitPrice,
  totalPrice,
}: PriceFormulaCardProps): ReactElement {
  const packLabel = packageType || 'qadoq';

  if (isPackage) {
    return (
      <div className="rounded-xl border border-brand/20 bg-brand/5 p-3 text-center transition-all duration-200 dark:bg-brand/10">
        <div className="text-sm font-semibold text-brand">
          {packageCount} {packLabel} × {packQuantity} {baseUnit} = {totalBaseQty} {baseUnit}
        </div>
        <div className="mt-1 text-xs text-gray-500">
          Jami: {totalBaseQty} {baseUnit} × {money(unitPrice)} ={' '}
          <strong className="text-gray-900 dark:text-gray-100">
            {money(totalPrice)}
          </strong>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-gray-50 p-2.5 text-center text-xs text-gray-500 transition-all duration-200 dark:bg-gray-800/60">
      Jami: {totalBaseQty} {baseUnit} × {money(unitPrice)} ={' '}
      <strong className="text-gray-900 dark:text-gray-100">
        {money(totalPrice)}
      </strong>
    </div>
  );
}

