import type { ReactElement } from 'react';

import type { PeriodPreset } from '@/shared/api/reports360';

const PRESETS: Array<{ v: PeriodPreset; l: string }> = [
  { v: 'today', l: 'Bugun' },
  { v: 'yesterday', l: 'Kecha' },
  { v: 'week', l: 'Hafta' },
  { v: 'month', l: 'Oy' },
  { v: 'last_month', l: "O'tgan oy" },
  { v: 'quarter', l: 'Kvartal' },
  { v: 'year', l: 'Yil' },
];

export function PeriodSwitcher({
  value,
  onChange,
}: {
  value: PeriodPreset;
  onChange: (p: PeriodPreset) => void;
}): ReactElement {
  return (
    <div className="flex flex-wrap gap-1">
      {PRESETS.map((p) => (
        <button
          key={p.v}
          onClick={() => onChange(p.v)}
          className={`rounded-lg px-3 py-1.5 text-sm ${
            value === p.v
              ? 'bg-brand text-brand-fg'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
          }`}
        >
          {p.l}
        </button>
      ))}
    </div>
  );
}
