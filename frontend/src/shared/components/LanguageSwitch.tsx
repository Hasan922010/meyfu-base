import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

const LANGS: Array<{ code: string; label: string }> = [
  { code: 'uz', label: "O'zbek" },
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
];

/** `compact` — login sahifasi uchun: kartasiz, kichik tugmalar. */
export function LanguageSwitch({ compact = false }: { compact?: boolean }): ReactElement {
  const { i18n } = useTranslation();

  if (compact) {
    return (
      <div className="flex justify-center gap-1 text-xs" role="group" aria-label="Til / Язык / Language">
        {LANGS.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => void i18n.changeLanguage(l.code)}
            aria-pressed={i18n.language === l.code}
            className={`rounded-md px-2 py-1 ${
              i18n.language === l.code ? 'bg-brand/10 font-semibold text-brand' : 'text-gray-500'
            }`}
          >
            {l.label}
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
