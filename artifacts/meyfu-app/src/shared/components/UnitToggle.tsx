import type { ReactElement } from 'react';

interface UnitToggleProps {
  mode: 'base' | 'package';
  baseUnit: string;
  packageType: string;
  packQuantity: number;
  onChange: (mode: 'base' | 'package') => void;
}

export function UnitToggle({
  mode,
  baseUnit,
  packageType,
  packQuantity,
  onChange,
}: UnitToggleProps): ReactElement {
  const packLabel = packageType || 'qadoq';
  return (
    <div className="flex rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
      <button
        type="button"
        aria-pressed={mode === 'base'}
        className={`flex-1 rounded-lg py-2 px-3 text-xs font-semibold transition-all duration-150 active:scale-[0.98] ${
          mode === 'base'
            ? 'bg-white text-brand shadow-sm dark:bg-gray-700 dark:text-white'
            : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
        }`}
        onClick={() => onChange('base')}
      >
        Dona ({baseUnit})
      </button>
      <button
        type="button"
        aria-pressed={mode === 'package'}
        className={`flex-1 rounded-lg py-2 px-3 text-xs font-semibold transition-all duration-150 active:scale-[0.98] ${
          mode === 'package'
            ? 'bg-white text-brand shadow-sm dark:bg-gray-700 dark:text-white'
            : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
        }`}
        onClick={() => onChange('package')}
      >
        Qadoq ({packLabel} — {packQuantity} {baseUnit})
      </button>
    </div>
  );
}
