import {
  Component,
  type ErrorInfo,
  type PropsWithChildren,
  type ReactNode,
} from 'react';

import { ErrorFallback } from '@/shared/components/ErrorFallback';

// Audit FE-001: bitta komponent xatosi butun SPA'ni oq ekranga aylantirmasin.

interface Props extends PropsWithChildren {
  /** 'screen' — to'liq ekran (ildiz); 'page' — layout ichidagi kompakt blok. */
  variant?: 'screen' | 'page';
  /** Fallback ko'rsatilganda chaqiriladi (masalan telemetriya). */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
    this.props.onError?.(error, info);
  }

  private readonly handleRetry = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <ErrorFallback
          error={this.state.error}
          variant={this.props.variant ?? 'screen'}
          onRetry={this.handleRetry}
        />
      );
    }
    return this.props.children;
  }
}
