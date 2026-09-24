import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const financeApi = vi.hoisted(() => ({ createCashTransaction: vi.fn() }));
vi.mock('@/shared/api/finance2', () => ({ financeApi }));

import { ToastContext } from '@/shared/lib/toast';

import { CashTxModal } from './CashTxModal';

const push = vi.fn();
const onDone = vi.fn();

function renderModal(balance = '900000'): void {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastContext.Provider value={{ push }}>
        <CashTxModal open balance={balance} onClose={() => undefined} onDone={onDone} />
      </ToastContext.Provider>
    </QueryClientProvider>,
  );
}

function fill(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

beforeEach(() => {
  financeApi.createCashTransaction.mockReset().mockResolvedValue({ id: 't1' });
  push.mockReset();
  onDone.mockReset();
});

describe('CashTxModal', () => {
  it('"Boshqa chiqim" sababsiz saqlanmaydi', () => {
    renderModal();
    fill('Turi', 'OTHER_OUT');
    fill('Summa', '50000');

    expect(screen.getByRole('button', { name: 'Saqlash' })).toBeDisabled();

    fill('Sabab *', 'Ofis suvi');
    expect(screen.getByRole('button', { name: 'Saqlash' })).toBeEnabled();
  });

  it('balansdan ko‘p chiqimda ogohlantiradi va tasdiqsiz saqlamaydi', async () => {
    renderModal('900000');
    fill('Turi', 'OTHER_OUT');
    fill('Summa', '5000000');
    fill('Sabab *', 'Xato sinov');

    expect(screen.getByText(/Kassada 900 000 so'm bor/)).toBeInTheDocument();
    expect(screen.getByText(/−4 100 000 so'm/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Saqlash' })).toBeDisabled();

    fireEvent.click(screen.getByLabelText('Balans manfiy bo‘lishini tasdiqlayman'));
    fireEvent.click(screen.getByRole('button', { name: 'Saqlash' }));

    await waitFor(() => expect(financeApi.createCashTransaction).toHaveBeenCalledWith({
      transaction_type: 'OTHER_OUT',
      amount: '5000000',
      counterparty: '',
      note: 'Xato sinov',
    }));
  });

  it('saqlangach muvaffaqiyat xabarini ko‘rsatadi', async () => {
    renderModal();
    fill('Summa', '100000');
    fireEvent.click(screen.getByRole('button', { name: 'Saqlash' }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(push).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });
});
