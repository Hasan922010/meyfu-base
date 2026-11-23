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
  const unitLabel = isPackage ? (packageType || baseUnit || 'dona') : baseUnit;

  return (
    <div className="rounded-xl bg-gray-50 p-2.5 text-center text-xs text-gray-500 transition-all duration-200 dark:bg-gray-800/60">
      <div>
        Jami: {totalBaseQty} {unitLabel} × {money(unitPrice)} ={' '}
        <strong className="text-gray-900 dark:text-gray-100">
          {money(totalPrice)}
        </strong>
      </div>
      {isPackage && packQuantity > 1 && (
        <div className="mt-0.5 text-[11px] text-gray-400">
          1 {unitLabel} = {packQuantity} {baseUnit} ({packageCount * packQuantity} {baseUnit})
        </div>
      )}
    </div>
  );
}

