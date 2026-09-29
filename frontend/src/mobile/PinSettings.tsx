import { useState, type ReactElement } from 'react';

import { clearPin, hasPin, isValidPin, setPin } from '@/shared/lib/pinLock';
import { useAuthStore } from '@/shared/store/authStore';

/** Profil: tez kirish uchun PIN o'rnatish / o'chirish (faqat shu qurilmada). */
export function PinSettings(): ReactElement | null {
  const userId = useAuthStore((s) => s.user?.id);
  const [enabled, setEnabled] = useState<boolean>(() => (userId ? hasPin(userId) : false));
  const [pin, setPinValue] = useState<string>('');
  const [repeat, setRepeat] = useState<string>('');
  const [message, setMessage] = useState<string>('');

  if (!userId) return null;
  const id = userId;
  const mismatch = repeat !== '' && pin !== repeat;

  async function save(): Promise<void> {
    await setPin(id, pin);
    setEnabled(true);
    setPinValue('');
    setRepeat('');
    setMessage('PIN o‘rnatildi. Endi ilova PIN bilan ochiladi.');
  }

  return (
    <section className="space-y-2 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
      <h2 className="font-semibold">Tez kirish (PIN)</h2>
      <p className="text-xs text-gray-500">
        PIN faqat shu telefonda saqlanadi va internetsiz ham ishlaydi. 5 marta xato
        kiritilsa, parol bilan qayta kirish kerak bo‘ladi.
      </p>
      {enabled ? (
        <button
          className="btn w-full text-danger"
          onClick={() => {
            clearPin(id);
            setEnabled(false);
            setMessage('PIN o‘chirildi.');
          }}
        >
          PIN'ni o‘chirish
        </button>
      ) : (
        <div className="space-y-2">
          <input
            className="field"
            type="password"
            inputMode="numeric"
            maxLength={6}
            placeholder="Yangi PIN (4–6 raqam)"
            aria-label="Yangi PIN"
            value={pin}
            onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
          />
          <input
            className="field"
            type="password"
            inputMode="numeric"
            maxLength={6}
            placeholder="PIN'ni takrorlang"
            aria-label="PIN'ni takrorlang"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value.replace(/\D/g, ''))}
          />
          {mismatch && <p className="text-xs text-danger">PIN'lar bir xil emas.</p>}
          <button
            className="btn-brand w-full"
            disabled={!isValidPin(pin) || pin !== repeat}
            onClick={() => void save()}
          >
            PIN o‘rnatish
          </button>
        </div>
      )}
      {message && <p className="text-xs text-success">{message}</p>}
    </section>
  );
}
