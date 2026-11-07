import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const warehouseApi = vi.hoisted(() => ({
  inventoryCount: vi.fn(),
  saveInventoryItems: vi.fn(),
  fillInventoryCount: vi.fn(),
  confirmInventoryCount: vi.fn(),
}));
const auth = vi.hoisted(() => ({ role: 'MANAGER' }));
vi.mock('@/shared/api/warehouse', () => ({ warehouseApi }));
vi.mock('@/shared/store/authStore', () => ({
  useAuthStore: (sel: (s: { user: { role: string } }) => unknown) =>
    sel({ user: { role: auth.role } }),
}));

import { InventoryEditor } from './InventoryEditor';

const COUNT = {
  id: 'inv1',
  number: 'INV-2026-00001',
  warehouse: 'w1',
  warehouse_name: 'Markaziy ombor',
  date: '2026-09-29',
  status: 'DRAFT',
  status_display: 'Qoralama',
  note: '',
  confirmed_at: null,
  created_at: '2026-09-29T08:00:00Z',
  items_count: 2,
  counted_count: 0,
  difference_amount: '0.00',
  items: [
    {
      id: 'i1', product: 'p1', product_name: 'Bio kukun 3kg', product_sku: 'PWD-3KG',
      product_unit: 'dona', expected_qty: '500.000', actual_qty: null, difference: null,
      cost_price: '20000.00', note: '',
    },
    {
      id: 'i2', product: 'p2', product_name: 'Gel 1L', product_sku: 'GEL-1L',
      product_unit: 'dona', expected_qty: '0.000', actual_qty: null, difference: null,
      cost_price: '15000.00', note: '',
    },
  ],
};

function renderEditor(): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <InventoryEditor countId="inv1" onBack={() => undefined} />
    </QueryClientProvider>,
  );
}

function staleError(): AxiosError {
  const headers = new AxiosHeaders();
  return new AxiosError('conflict', 'ERR_BAD_REQUEST', { headers }, null, {
    status: 409, statusText: 'Conflict', headers: {}, config: { headers },
    data: {
      success: false,
      error: { code: 'STALE_STOCK', message: "Sanash davomida 1 ta tovar qoldig'i o'zgardi.", details: {} },
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.role = 'MANAGER';
  warehouseApi.inventoryCount.mockResolvedValue(COUNT);
  warehouseApi.saveInventoryItems.mockResolvedValue(COUNT);
});

describe('InventoryEditor', () => {
  it('shows live difference and saves only edited rows', async () => {
    renderEditor();
    const input = await screen.findByLabelText('Bio kukun 3kg — haqiqiy qoldiq');

    fireEvent.change(input, { target: { value: '480' } });

    expect(screen.getByText('−20')).toBeInTheDocument();
    expect(screen.getByText('Saqlanmagan: 1 ta')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Saqlash' }));
    await waitFor(() =>
      expect(warehouseApi.saveInventoryItems).toHaveBeenCalledWith('inv1', [
        { id: 'i1', actual_qty: '480' },
      ]),
    );
  });

  it('offers refresh when stock changed during counting', async () => {
    warehouseApi.confirmInventoryCount.mockRejectedValue(staleError());
    warehouseApi.fillInventoryCount.mockResolvedValue(COUNT);
    renderEditor();
    fireEvent.change(await screen.findByLabelText('Gel 1L — haqiqiy qoldiq'), {
      target: { value: '3' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Tasdiqlash' }));
    const dialogButtons = await screen.findAllByRole('button', { name: 'Tasdiqlash' });
    fireEvent.click(dialogButtons[dialogButtons.length - 1]!);

    const refresh = await screen.findByRole('button', { name: 'Hisobdagi qoldiqni yangilash' });
    fireEvent.click(refresh);
    await waitFor(() => expect(warehouseApi.fillInventoryCount).toHaveBeenCalledWith('inv1'));
  });

  it('warehouse role can count but not confirm', async () => {
    auth.role = 'WAREHOUSE';
    renderEditor();

    await screen.findByLabelText('Bio kukun 3kg — haqiqiy qoldiq');

    expect(screen.queryByRole('button', { name: 'Tasdiqlash' })).not.toBeInTheDocument();
  });

  it('warns which counted rows got a new book quantity after refresh', async () => {
    const counted = {
      ...COUNT,
      items: [{ ...COUNT.items[0]!, actual_qty: '480.000' }, COUNT.items[1]!],
    };
    warehouseApi.inventoryCount.mockResolvedValue(counted);
    warehouseApi.fillInventoryCount.mockResolvedValue({
      ...counted,
      items: [{ ...counted.items[0]!, expected_qty: '470.000' }, counted.items[1]!],
    });
    renderEditor();
    await screen.findByLabelText('Bio kukun 3kg — haqiqiy qoldiq');

    fireEvent.click(screen.getByRole('button', { name: 'Hisobni yangilash' }));

    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent("1 ta sanalgan tovarning hisobdagi qoldig'i o'zgardi");
    expect(notice).toHaveTextContent('Bio kukun 3kg');
  });
});
