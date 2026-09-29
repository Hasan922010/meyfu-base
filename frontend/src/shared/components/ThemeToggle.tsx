import { Monitor, Moon, Sun } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { getTheme, setTheme, type ThemeChoice } from '@/shared/lib/theme';

const NEXT: Record<ThemeChoice, ThemeChoice> = { system: 'light', light: 'dark', dark: 'system' };
const LABEL: Record<ThemeChoice, string> = {
  system: 'Tema: tizim bo‘yicha',
  light: 'Tema: yorug‘',
  dark: 'Tema: qorong‘i',
};

/** Bitta tugma: tizim → yorug' → qorong'i. */
export function ThemeToggle(): ReactElement {
  const [choice, setChoice] = useState<ThemeChoice>(getTheme);
  const Icon = choice === 'dark' ? Moon : choice === 'light' ? Sun : Monitor;

  return (
    <button
      type="button"
      className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
      aria-label={LABEL[choice]}
      title={LABEL[choice]}
      onClick={() => {
        const next = NEXT[choice];
        setTheme(next);
        setChoice(next);
      }}
    >
      <Icon size={18} aria-hidden />
    </button>
  );
}
