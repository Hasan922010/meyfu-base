import { createContext, useContext } from 'react';

export type ToastKind = 'info' | 'success' | 'warning' | 'danger';

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  body?: string;
}

export interface ToastApi {
  push: (t: Omit<Toast, 'id'>) => void;
}

export const ToastContext = createContext<ToastApi>({ push: () => undefined });

export function useToast(): ToastApi {
  return useContext(ToastContext);
}
