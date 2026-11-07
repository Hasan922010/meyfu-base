import { Wifi, WifiOff, ServerOff } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { env } from '@/shared/config/env';

const HEALTH_URL = `${env.apiBaseUrl}/health/`;
const POLL_MS = 20_000;

type Status = 'online' | 'offline' | 'server-down';

/**
 * CLAUDE.md 4.5 — yuqorida doim aloqa holati.
 * Brauzer tarmog'i (`navigator.onLine`) + backend salomatligini (`/health/`)
 * tekshiradi, shunda backend o'chib qolsa foydalanuvchi aniq ko'radi.
 */
export function ConnectionBadge(): ReactElement {
  const { t } = useTranslation();
  // Using true initially and testing immediately so it doesn't blink falsely, but
  // actually wait we can just start with navigator.onLine and wait for backend check
  const [browserOnline, setBrowserOnline] = useState<boolean>(navigator.onLine);
  const [backendUp, setBackendUp] = useState<boolean>(true);
  const timer = useRef<number | undefined>(undefined);
  const isMounted = useRef(true);

  const checkBackend = useCallback(async (): Promise<void> => {
    if (!navigator.onLine) {
      if (isMounted.current) setBackendUp(true); // Don't show server down if offline
      return;
    }
    try {
      const ctrl = new AbortController();
      const to = window.setTimeout(() => ctrl.abort(), 8000);
      const resp = await fetch(HEALTH_URL, {
        method: 'GET',
        cache: 'no-store',
        signal: ctrl.signal,
      });
      window.clearTimeout(to);
      if (isMounted.current) {
        setBackendUp(resp.ok || resp.status === 503);
      }
    } catch {
      if (isMounted.current) {
        setBackendUp(false);
      }
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    const on = (): void => {
      setBrowserOnline(true);
      void checkBackend();
    };
    const off = (): void => setBrowserOnline(false);
    const onFocus = (): void => void checkBackend();

    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    window.addEventListener('focus', onFocus);

    void checkBackend();
    timer.current = window.setInterval(() => void checkBackend(), POLL_MS);

    return () => {
      isMounted.current = false;
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      window.removeEventListener('focus', onFocus);
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [checkBackend]);

  const status: Status = !browserOnline
    ? 'offline'
    : backendUp
      ? 'online'
      : 'server-down';

  const cfg: Record<Status, { cls: string; icon: ReactElement; label: string }> = {
    online: {
      cls: 'bg-success/10 text-success',
      icon: <Wifi size={14} aria-hidden />,
      label: t('common.online'),
    },
    offline: {
      cls: 'bg-danger/10 text-danger',
      icon: <WifiOff size={14} aria-hidden />,
      label: t('common.offline'),
    },
    'server-down': {
      cls: 'bg-danger/10 text-danger',
      icon: <ServerOff size={14} aria-hidden />,
      label: t('common.serverDown'),
    },
  };

  const { cls, icon, label } = cfg[status];

  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}
      title={status === 'server-down' ? t('common.serverDown') : undefined}
    >
      {icon}
      {label}
    </span>
  );
}
