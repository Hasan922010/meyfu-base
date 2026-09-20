import type { Role } from '@/shared/types/api';

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: 'Super admin',
  MANAGER: 'Menejer',
  WAREHOUSE: 'Omborchi',
  DISTRIBUTOR: 'Tarqatuvchi',
  ACCOUNTANT: 'Buxgalter',
};

export const PAYMENT_TYPE_LABEL: Record<string, string> = {
  NAQD: 'Naqd',
  PLASTIK: 'Plastik',
  OTKAZMA: "O'tkazma",
  QARZ: 'Qarzga',
  ARALASH: 'Aralash',
};

export const DAYCLOSE_STATUS_LABEL: Record<string, string> = {
  OPEN: 'Ochiq',
  PENDING: 'Tasdiq kutilmoqda',
  CLOSED: 'Yopilgan',
};

export const PAYROLL_STATUS_LABEL: Record<string, string> = {
  ESTIMATE: 'taxminiy',
  DRAFT: 'qoralama',
  APPROVED: 'tasdiqlangan',
  PAID: "to'langan",
};
