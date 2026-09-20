import type { ReactElement } from 'react';

import { AppProviders } from '@/app/providers';
import { AppRouter } from '@/app/router';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';

export function App(): ReactElement {
  return (
    <AppProviders>
      <ErrorBoundary variant="screen">
        <AppRouter />
      </ErrorBoundary>
    </AppProviders>
  );
}
