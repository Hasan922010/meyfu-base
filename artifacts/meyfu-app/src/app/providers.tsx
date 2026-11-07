import { QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren, ReactElement } from 'react';

import { queryClient } from '@/app/queryClient';
import { ToastProvider } from '@/shared/components/Toaster';
import '@/locales/i18n';

export function AppProviders({ children }: PropsWithChildren): ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
