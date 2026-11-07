import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/offline/useSync', () => ({ useSync: () => ({ status: 'online', pending: 0 }) }));
vi.mock('@/offline/sync', () => ({ fullSync: () => Promise.resolve() }));
vi.mock('@/offline/SyncBadge', () => ({ SyncBadge: () => null }));
vi.mock('@/shared/components/NotificationBell', () => ({ NotificationBell: () => null }));
vi.mock('@/shared/realtime/RealtimeBridge', () => ({ RealtimeBridge: () => null }));

const auth = vi.hoisted(() => ({ role: 'ORDER_TAKER' }));
vi.mock('@/shared/store/authStore', () => ({
  useAuthStore: (sel: (s: { user: { role: string; full_name: string } }) => unknown) =>
    sel({ user: { role: auth.role, full_name: 'Test Xodim' } }),
}));

import { MobileLayout } from './MobileLayout';

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/m" element={<MobileLayout />}>
          <Route index element={<p>Bosh sahifa</p>} />
          <Route path="orders" element={<p>Buyurtmalar sahifasi</p>} />
          <Route path="sale" element={<p>Sotuv sahifasi</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  auth.role = 'ORDER_TAKER';
});

describe('MobileLayout — zakaz oluvchi', () => {
  it('faqat buyurtma, mijoz va maosh tablarini ko‘rsatadi', () => {
    renderAt('/m');

    const nav = screen.getByRole('navigation');
    expect(nav).toHaveTextContent('Buyurtma');
    expect(nav).toHaveTextContent('Mijozlar');
    expect(nav).toHaveTextContent('Maosh');
    expect(nav).not.toHaveTextContent('Sotuv');
    expect(nav).not.toHaveTextContent('Hamyon');
  });

  it('ruxsat berilmagan sahifadan bosh sahifaga qaytaradi', () => {
    renderAt('/m/sale');

    expect(screen.getByText('Bosh sahifa')).toBeInTheDocument();
    expect(screen.queryByText('Sotuv sahifasi')).not.toBeInTheDocument();
  });

  it('tarqatuvchi uchun sotuv sahifasi ochiq qoladi', () => {
    auth.role = 'DISTRIBUTOR';
    renderAt('/m/sale');

    expect(screen.getByText('Sotuv sahifasi')).toBeInTheDocument();
  });
});
