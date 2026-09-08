import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import ru from './ru.json';
import uz from './uz.json';

export const SUPPORTED_LANGS = ['uz', 'ru', 'en'] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];

const STORAGE_KEY = 'meyfu-lang';

function initialLang(): Lang {
  const saved = localStorage.getItem(STORAGE_KEY);
  return (SUPPORTED_LANGS as readonly string[]).includes(saved ?? '')
    ? (saved as Lang)
    : 'uz';
}

void i18n.use(initReactI18next).init({
  resources: {
    uz: { translation: uz },
    ru: { translation: ru },
    en: { translation: en },
  },
  lng: initialLang(),
  fallbackLng: 'uz',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  localStorage.setItem(STORAGE_KEY, lng);
});

export default i18n;
