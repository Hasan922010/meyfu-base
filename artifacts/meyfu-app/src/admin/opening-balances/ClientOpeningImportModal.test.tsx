import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const clientsApi = vi.hoisted(() => ({
  openingImportTemplate: vi.fn(),
  openingImportInspect: vi.fn(),
  openingImportApply: vi.fn(),
}));
const authApi = vi.hoisted(() => ({ staff: vi.fn() }));
vi.mock('@/shared/api/clients', () => ({ clientsApi }));
vi.mock('@/shared/api/users', () => ({ authApi }));

import { ToastContext } from '@/shared/lib/toast';

import { ClientOpeningImportModal } from './ClientOpeningImportModal';

const push = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  authApi.staff.mockResolvedValue([
    { id: 'u1', full_name: 'Ali Agent', role: 'DISTRIBUTOR' },
  ]);
  clientsApi.openingImportInspect.mockResolvedValue({
    headers: ['Ustun 1', 'Summa', 'Agent'],
    columns: [
      { index: 0, letter: 'A', header: 'Ustun 1' },
      { index: 1, letter: 'B', header: 'Summa' },
      { index: 2, letter: 'C', header: 'Agent' },
    ],
    sample_rows: [['Baraka', '500000', 'Ali Agent']],
    total_rows: 1,
    auto_mapping: { amount: 1 },
    target_fields: [
      { key: 'name', label: "Do'kon / Mijoz nomi", required: true },
      { key: 'amount', label: "Boshlang'ich qarz summasi", required: true },
      { key: 'assigned_to', label: "Mas'ul xodim (kimning mijozi)", required: false },
    ],
  });
  clientsApi.openingImportApply.mockResolvedValue({
    dry_run: true,
    created_clients: 1,
    existing_clients: 0,
    debts_applied: 1,
    skipped: 0,
    errors: 0,
    rows: [
      {
        row: 2,
        client_name: 'Baraka',
        client_phone: '+998901112233',
        assigned_to_name: 'Ali Agent',
        current_debt: '0',
        target_debt: '500000',
        delta: '500000',
        action: 'CREATE_AND_DEBT',
        errors: [],
      },
    ],
  });
});

describe('ClientOpeningImportModal', () => {
  it('fayl yuklangach ustunlarni moslab tekshirish va yuklash ishlaydi', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const onDone = vi.fn();
    render(
      <QueryClientProvider client={qc}>
        <ToastContext.Provider value={{ push }}>
          <ClientOpeningImportModal open onClose={() => undefined} onDone={onDone} />
        </ToastContext.Provider>
      </QueryClientProvider>,
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const f = new File(['dummy'], 'qarz.xlsx');
    fireEvent.change(fileInput, { target: { files: [f] } });

    const nameSelect = await screen.findByLabelText("Do'kon / Mijoz nomi");
    const staffSelect = screen.getByLabelText("Mas'ul xodim (kimning mijozi)");
    fireEvent.change(nameSelect, { target: { value: '0' } });
    fireEvent.change(staffSelect, { target: { value: '2' } });

    fireEvent.click(screen.getByRole('button', { name: 'Tekshirish' }));

    await waitFor(() => expect(clientsApi.openingImportApply).toHaveBeenCalledTimes(1));
    expect(clientsApi.openingImportApply.mock.calls[0]![1]).toMatchObject({
      dry_run: true,
      auto_create_missing: true,
      mapping: { name: 0, amount: 1, assigned_to: 2 },
    });

    expect(await screen.findByText(/Yangi mijoz \+ qarz/)).toBeInTheDocument();
    expect(screen.getByText('+998901112233')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Tasdiqlash va yuklash/i }));
    await waitFor(() => expect(clientsApi.openingImportApply).toHaveBeenCalledTimes(2));
    expect(clientsApi.openingImportApply.mock.calls[1]![1]).toMatchObject({ dry_run: false });
    expect(onDone).toHaveBeenCalled();
  });

  it('fayl input qiymatini tozalaydi, bir xil faylni qayta tanlash ishlaydi', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <ToastContext.Provider value={{ push }}>
          <ClientOpeningImportModal open onClose={() => undefined} onDone={() => undefined} />
        </ToastContext.Provider>
      </QueryClientProvider>,
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const f = new File(['dummy'], 'qarz.xlsx');
    fireEvent.change(fileInput, { target: { files: [f] } });
    await waitFor(() => expect(clientsApi.openingImportInspect).toHaveBeenCalledTimes(1));
    expect(fileInput.value).toBe('');

    fireEvent.change(fileInput, { target: { files: [f] } });
    await waitFor(() => expect(clientsApi.openingImportInspect).toHaveBeenCalledTimes(2));
  });
});

