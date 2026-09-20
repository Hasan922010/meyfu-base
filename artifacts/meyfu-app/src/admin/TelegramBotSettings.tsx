import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useState, type FormEvent, type ReactElement } from 'react';

import { telegramApi } from '@/shared/api/telegram';

export function TelegramBotSettings(): ReactElement {
  const qc = useQueryClient();
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const config = useQuery({
    queryKey: ['telegram', 'bot-config'],
    queryFn: () => telegramApi.botConfig(),
  });
  const update = useMutation({
    mutationFn: () => telegramApi.updateBotToken(token),
    onSuccess: () => {
      setToken('');
      setShowToken(false);
      void qc.invalidateQueries({ queryKey: ['telegram'] });
    },
  });

  function submit(event: FormEvent): void {
    event.preventDefault();
    if (token.trim()) update.mutate();
  }

  return (
    <section className="max-w-lg space-y-4 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-medium">
            <Bot size={18} aria-hidden /> Telegram bot tokeni
          </div>
          <p className="mt-1 text-xs text-gray-500">
            BotFather bergan tokenni kiriting. Token saqlangach qayta ko‘rsatilmaydi.
          </p>
        </div>
        {config.data?.configured && (
          <span className="flex items-center gap-1 text-xs text-success">
            <CheckCircle2 size={14} aria-hidden /> Ulangan
          </span>
        )}
      </div>

      {config.data?.bot_username && (
        <p className="text-sm">
          Faol bot: <span className="font-medium">@{config.data.bot_username}</span>
        </p>
      )}

      <form className="space-y-3" onSubmit={submit}>
        <label className="block text-sm font-medium" htmlFor="telegram-bot-token">
          {config.data?.configured ? 'Yangi token' : 'Bot tokeni'}
        </label>
        <div className="relative">
          <input
            id="telegram-bot-token"
            type={showToken ? 'text' : 'password'}
            autoComplete="off"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="123456789:AA..."
            className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 pr-10 text-sm outline-none focus:border-brand dark:border-gray-700"
          />
          <button
            type="button"
            aria-label={showToken ? 'Tokenni yashirish' : 'Tokenni ko‘rsatish'}
            className="absolute inset-y-0 right-0 px-3 text-gray-500"
            onClick={() => setShowToken((value) => !value)}
          >
            {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {update.isError && (
          <p className="text-xs text-danger">
            Token tasdiqlanmadi. BotFather tokenini tekshirib qayta urinib ko‘ring.
          </p>
        )}
        {update.isSuccess && (
          <p className="text-xs text-success">Telegram bot muvaffaqiyatli ulandi.</p>
        )}
        <button
          type="submit"
          className="btn-brand px-4"
          disabled={!token.trim() || update.isPending}
        >
          {update.isPending ? 'Tekshirilmoqda…' : 'Tokenni ulash'}
        </button>
      </form>
    </section>
  );
}