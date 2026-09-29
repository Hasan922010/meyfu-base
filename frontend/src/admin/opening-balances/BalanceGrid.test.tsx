import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const openingApi = vi.hoisted(() => ({ sheet: vi.fn(), bulk: vi.fn() }));
vi.mock('@/shared/api/opening', () => ({ openingApi }));

import { BalanceGrid } from './BalanceGrid';

function renderGrid(kind: 'suppliers' | 'stock', warehouse?: string): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <BalanceGrid
        kind={kind}
        {...(warehouse ? { warehouse } : {})}
        rules={{ allowNegative: true, increaseOnly: false }}
        hint="izoh"
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  openingApi.sheet.mockResolvedValue([
    { id: 's1', name: 'Zavod A', code: '', current: '0.00' },
    { id: 's2', name: 'Zavod B', code: '', current: '50000.00' },
  ]);
  openingApi.bulk.mockResolvedValue({ applied: 1, skipped: 0 });
});

describe('BalanceGrid', () => {
  it('auto-fills the list and saves only changed targets in one request', async () => {
    renderGrid('suppliers');
    const input = await screen.findByLabelText('Zavod A — yangi qoldiq');
    fireEvent.change(input, { target: { value: '-120000' } });
    fireEvent.change(screen.getByLabelText('Zavod B — yangi qoldiq'), {
      target: { value: '50000' },
    });

    expect(screen.getByText("O'zgargan: 1 ta")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Saqlash' }));

    await waitFor(() =>
      expect(openingApi.bulk).toHaveBeenCalledWith('suppliers', {
        rows: [{ id: 's1', target: '-120000' }],
      }),
    );
  });

  it('asks for a warehouse before loading products', () => {
    renderGrid('stock');

    expect(screen.getByText(/omborni tanlang/)).toBeInTheDocument();
    expect(openingApi.sheet).not.toHaveBeenCalled();
  });

  it('passes the warehouse for stock', async () => {
    renderGrid('stock', 'w1');

    await screen.findByLabelText('Zavod A — yangi qoldiq');

    expect(openingApi.sheet).toHaveBeenCalledWith('stock', 'w1');
  });
});
