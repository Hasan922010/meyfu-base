import type { ReactElement } from 'react';

import { AppProviders } from '@/app/providers';
import { AppRouter } from '@/app/router';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { PwaPrompt } from '@/shared/pwa/PwaPrompt';

export function App(): ReactElement {
  return (
    <AppProviders>
      <ErrorBoundary variant="screen">
        <AppRouter />
        <PwaPrompt />
      </ErrorBoundary>
    </AppProviders>
  );
}
