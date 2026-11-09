import { Minus, Plus } from 'lucide-react';
import type { ReactElement } from 'react';

interface QuantityStepperProps {
  value: number;
  unitLabel: string;
  onChange: (val: number) => void;
  quickOptions?: number[];
  min?: number;
}

const DEFAULT_QUICK = [1, 3, 5, 10, 12, 20];

export function QuantityStepper({
  value,
  unitLabel,
  onChange,
  quickOptions = DEFAULT_QUICK,
  min = 1,
}: QuantityStepperProps): ReactElement {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-700 transition-all duration-150 active:scale-90 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label="Kamaytirish"
        >
          <Minus size={22} aria-hidden />
        </button>
        <div className="min-w-[80px] text-center select-none" aria-live="polite">
          <span className="block text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            {value}
          </span>
          <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
            {unitLabel}
          </span>
        </div>
        <button
          type="button"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-700 transition-all duration-150 active:scale-90 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          onClick={() => onChange(value + 1)}
          aria-label="Ko'paytirish"
        >
          <Plus size={22} aria-hidden />
        </button>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {quickOptions.map((n) => (
          <button
            key={n}
            type="button"
            className={`min-w-[44px] min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 active:scale-95 ${
              value === n
                ? 'bg-brand text-brand-fg shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

