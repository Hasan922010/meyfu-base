import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheckBig, Send } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { telegramApi } from '@/shared/api/telegram';

export function TelegramConnect(): ReactElement {
  const qc = useQueryClient();
  const [code, setCode] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ['telegram', 'status'],
    queryFn: () => telegramApi.status(),
    refetchInterval: code ? 5_000 : false,
  });

  const link = useMutation({
    mutationFn: () => telegramApi.link(),
    onSuccess: (d) => {
      setCode(d.code);
      setDeepLink(d.deep_link);
    },
  });
  const unlink = useMutation({
    mutationFn: () => telegramApi.unlink(),
    onSuccess: () => {
      setCode(null);
      void qc.invalidateQueries({ queryKey: ['telegram'] });
    },
  });

  if (status.data?.linked) {
    return (
      <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 font-medium">
              <CircleCheckBig size={16} className="text-success" aria-hidden />
              Telegram bog'langan
            </div>
            <div className="text-xs text-gray-500">
              Bildirishnomalar Telegram orqali ham keladi
            </div>
          </div>
          <button
            className="text-sm text-danger hover:underline"
            onClick={() => unlink.mutate()}
          >
            Uzish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
      <div className="font-medium">Telegram bot</div>
      {!status.data?.enabled && (
        <p className="text-xs text-pending">
          Bot server tomonida sozlanmagan (TELEGRAM_BOT_TOKEN).
        </p>
      )}

      {!code ? (
        <button
          className="btn-brand flex items-center gap-1.5 px-4"
          disabled={link.isPending}
          onClick={() => link.mutate()}
        >
          <Send size={15} aria-hidden /> Telegram'ni ulash
        </button>
      ) : (
        <div className="space-y-2 text-sm">
          <p>
            1. Botni oching:{' '}
            <a
              href={deepLink ?? '#'}
              target="_blank"
              rel="noreferrer"
              className="text-brand underline"
            >
              @{status.data?.bot_username}
            </a>
          </p>
          <p>2. Yoki botga shu kodni yuboring:</p>
          <div className="rounded-lg bg-gray-100 py-3 text-center text-2xl font-bold tracking-widest dark:bg-gray-800">
            {code}
          </div>
          <p className="text-xs text-gray-400">
            Kod 10 daqiqa amal qiladi. Bog'langach bu oyna yangilanadi.
          </p>
        </div>
      )}
    </div>
  );
}
