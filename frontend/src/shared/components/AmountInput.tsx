import { forwardRef, type ReactElement } from 'react';

import { groupThousands, numberToWordsUz } from '@/shared/lib/format';

interface Props {
  /** Xom qiymat — faqat raqamlar (masalan "1250000") */
  value: string;
  onChange: (raw: string) => void;
  placeholder?: string | undefined;
  className?: string | undefined;
  autoFocus?: boolean | undefined;
  /** So'z bilan yozuvni ko'rsatish (default: true) */
  showWords?: boolean | undefined;
  suffix?: string | undefined;
  disabled?: boolean | undefined;
}

/**
 * Pul kiritish maydoni. Yozish paytida raqamlar guruhlanib ko'rinadi
 * (1 250 000), ostida summa so'z bilan chiqadi ("bir million ... so'm").
 */
export const AmountInput = forwardRef<HTMLInputElement, Props>(function AmountInput(
  {
    value,
    onChange,
    placeholder = '0',
    className = '',
    autoFocus,
    showWords = true,
    suffix = "so'm",
    disabled,
  },
  ref,
): ReactElement {
  const digits = String(value ?? '').replace(/\D/g, '');
  const n = Number(digits || 0);
  return (
    <div>
      <input
        ref={ref}
        className={`field ${className}`}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        value={digits ? groupThousands(digits) : ''}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
      />
      {showWords && n > 0 && (
        <p className="mt-1 text-xs text-gray-500 first-letter:uppercase">
          {numberToWordsUz(n)} {suffix}
        </p>
      )}
    </div>
  );
});
