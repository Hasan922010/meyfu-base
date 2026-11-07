import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/App';
import { watchAuthSession } from '@/offline/session';
import { initTheme } from '@/shared/lib/theme';
import '@/index.css';
import '@/locales/i18n'; // Ensure i18n is initialized and handles document.documentElement.lang

initTheme();
watchAuthSession();

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('#root topilmadi');
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
