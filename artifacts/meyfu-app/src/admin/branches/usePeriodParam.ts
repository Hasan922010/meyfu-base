import { useSearchParams } from 'react-router-dom';

import type { PeriodPreset } from '@/shared/api/reports360';

const PRESETS: PeriodPreset[] = [
  'today', 'yesterday', 'week', 'month', 'last_month', 'quarter', 'year',
];

/** Davr URL'da saqlanadi — kartadan hisobotga o'tganda va orqaga qaytganda saqlanib qoladi. */
export function usePeriodParam(): [PeriodPreset, (p: PeriodPreset) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get('preset') as PeriodPreset | null;
  const preset = raw && PRESETS.includes(raw) ? raw : 'month';
  return [preset, (p) => setParams({ preset: p }, { replace: true })];
}
