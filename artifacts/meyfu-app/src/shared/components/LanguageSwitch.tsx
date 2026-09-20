import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

const LANGS: Array<{ code: string; label: string; shortLabel: string }> = [
  { code: 'uz', label: "O'zbek", shortLabel: 'UZ' },
  { code: 'ru', label: 'Русский', shortLabel: 'RU' },
  { code: 'en', label: 'English', shortLabel: 'EN' },
];

interface LanguageSwitchProps {
  /** Slim pill selector for tight spaces (e.g. the login form header) — no
   * card background or heading, just the language buttons. */
  compact?: boolean;
}

export function LanguageSwitch({ compact = false }: LanguageSwitchProps): ReactElement {
  const { i18n } = useTranslation();

  if (compact) {
    return (
      <div className="inline-flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
        {LANGS.map((l) => (
          <button
            key={l.code}
            type="button"
            aria-pressed={i18n.language === l.code}
            onClick={() => void i18n.changeLanguage(l.code)}
            className={`rounded-md px-2 py-1 text-xs font-medium transition ${
              i18n.language === l.code
                ? 'bg-brand text-brand-fg'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {l.shortLabel}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
      <div className="mb-2 font-medium">Til / Язык / Language</div>
      <div className="flex gap-2">
        {LANGS.map((l) => (
          <button
            key={l.code}
            type="button"
            aria-pressed={i18n.language === l.code}
            onClick={() => void i18n.changeLanguage(l.code)}
            className={`flex-1 rounded-lg py-2 text-sm ${
              i18n.language === l.code
                ? 'bg-brand text-brand-fg'
                : 'bg-gray-100 dark:bg-gray-800'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}
