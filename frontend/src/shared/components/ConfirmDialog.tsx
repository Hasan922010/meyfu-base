import type { ReactElement, ReactNode } from 'react';

import { Modal } from './Modal';

interface Props {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  /** Qaytarib bo'lmaydigan amal — tugma qizil */
  danger?: boolean;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Brauzerning `confirm()` o'rniga — ilova uslubidagi tasdiqlash oynasi. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  danger = false,
  isPending = false,
  onConfirm,
  onCancel,
}: Props): ReactElement {
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <div className="space-y-4">
        <div className="text-sm text-gray-600 dark:text-gray-300">{children}</div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn px-4" onClick={onCancel}>
            Bekor
          </button>
          <button
            type="button"
            className={danger ? 'btn bg-danger px-4 text-white' : 'btn-brand px-4'}
            disabled={isPending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
