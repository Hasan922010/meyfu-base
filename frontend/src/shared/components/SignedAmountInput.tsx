import type { ReactElement } from 'react';

import { AmountInput } from '@/shared/components/AmountInput';

interface Props {
  /** Ishorali xom qiymat, masalan "-150000" yoki "150000" (bo'sh — kiritilmagan) */
  value: string;
  onChange: (signed: string) => void;
  positiveLabel: string;
  negativeLabel: string;
}

/**
 * Ishorali summa: yo'nalish (musbat/manfiy) aniq tugmalar bilan tanlanadi,
 * miqdor esa {@link AmountInput} bilan kiritiladi (CLAUDE.md 8 — aniq,
 * ayblovsiz UI: bare minus belgisi o'rniga tushunarli yorliqlar).
 */
export function SignedAmountInput({
  value,
  onChange,
  positiveLabel,
  negativeLabel,
}: Props): ReactElement {
  const isNegative = value.trim().startsWith('-');
  const magnitude = value.replace(/[^0-9]/g, '');

  const setSign = (negative: boolean) => {
    onChange(negative && magnitude ? `-${magnitude}` : magnitude);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          className={`btn flex-1 ${!isNegative ? 'btn-brand' : ''}`}
          onClick={() => setSign(false)}
        >
          {positiveLabel}
        </button>
        <button
          type="button"
          className={`btn flex-1 ${isNegative ? 'btn-brand' : ''}`}
          onClick={() => setSign(true)}
        >
          {negativeLabel}
        </button>
      </div>
      <AmountInput
        value={magnitude}
        onChange={(digits) => onChange(isNegative && digits ? `-${digits}` : digits)}
        showWords={false}
      />
    </div>
  );
}
