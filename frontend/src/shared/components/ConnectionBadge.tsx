import { Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

/** CLAUDE.md 4.5 — yuqorida doim online/offline holati. MVP: oddiy variant. */
export function ConnectionBadge(): ReactElement {
  const { t } = useTranslation();
  const [online, setOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const on = (): void => setOnline(true);
    const off = (): void => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        online
          ? 'bg-success/10 text-success'
          : 'bg-danger/10 text-danger'
      }`}
    >
      {online ? <Wifi size={14} aria-hidden /> : <WifiOff size={14} aria-hidden />}
      {online ? t('common.online') : t('common.offline')}
    </span>
  );
}
