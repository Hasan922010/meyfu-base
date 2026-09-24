// Server kodlari uchun o'zbekcha nomlar — UI'da xom enum ("ACCOUNTANT",
// "OTKAZMA") ko'rinmasin (audit m5, CLAUDE.md 20).
import type { Role } from '@/shared/types/api';

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super admin',
  MANAGER: 'Menejer',
  WAREHOUSE: 'Omborchi',
  DISTRIBUTOR: 'Tarqatuvchi',
  ACCOUNTANT: 'Buxgalter',
};

export const PAYMENT_LABELS: Record<string, string> = {
  NAQD: 'Naqd',
  PLASTIK: 'Plastik',
  OTKAZMA: "O'tkazma",
  QARZ: 'Qarzga',
  ARALASH: 'Aralash',
};

export function roleLabel(role: string | null | undefined): string {
  if (!role) return '—';
  return ROLE_LABELS[role as Role] ?? role;
}

export function paymentLabel(value: string): string {
  return PAYMENT_LABELS[value] ?? value;
}
