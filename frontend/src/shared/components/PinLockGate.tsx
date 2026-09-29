import { Lock } from 'lucide-react';
import { useEffect, useState, type ReactElement, type ReactNode } from 'react';

import { logout } from '@/shared/api/auth';
import {
  RELOCK_AFTER_MS,
  hasPin,
  isUnlocked,
  lock,
  remainingAttempts,
  verifyPin,
} from '@/shared/lib/pinLock';
import { useAuthStore } from '@/shared/store/authStore';

/** PIN o'rnatilgan bo'lsa — ilova ochilganda va uzoq yashirilgandan keyin qulflanadi. */
export function PinLockGate({ children }: { children: ReactNode }): ReactElement {
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const userId = user?.id ?? '';
  const [locked, setLocked] = useState<boolean>(() => !!userId && hasPin(userId) && !isUnlocked());
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);

  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = (): void => {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else if (hiddenAt && Date.now() - hiddenAt > RELOCK_AFTER_MS && hasPin(userId)) {
        lock();
        setLocked(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [userId]);

  if (!locked) return <>{children}</>;

  async function submit(): Promise<void> {
    setBusy(true);
    const result = await verifyPin(userId, pin);
    setBusy(false);
    setPin('');
    if (result === true) {
      setLocked(false);
      setError('');
    } else if (result === 'locked-out') {
      await logout();
      clear();
    } else {
      setError(`PIN noto'g'ri. Yana ${remainingAttempts(userId)} ta urinish qoldi.`);
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 p-6">
      <Lock size={40} className="text-brand" aria-hidden />
      <h1 className="text-xl font-bold">{user?.full_name}</h1>
      <p className="text-sm text-gray-500">Davom etish uchun PIN kiriting</p>
      <input
        className="field w-48 text-center text-2xl tracking-[0.5em]"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        aria-label="PIN"
        autoFocus
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && pin.length >= 4) void submit();
        }}
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        className="btn-brand w-48"
        disabled={pin.length < 4 || busy}
        onClick={() => void submit()}
      >
        Ochish
      </button>
      <button
        className="text-sm text-gray-500 underline"
        onClick={() => {
          void logout().then(clear);
        }}
      >
        Parol bilan kirish
      </button>
    </div>
  );
}
