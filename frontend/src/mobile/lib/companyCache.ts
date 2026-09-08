import { getMeta, setMeta } from '@/offline/db';
import type { CompanyPublic } from '@/shared/api/company';

import type { CompanyCache } from './receiptPdf';

const KEY = 'company';
const STALE_MS = 7 * 24 * 60 * 60 * 1000;

interface Stored extends CompanyCache {
  bank_details: string;
  fetched_at: number;
}

export async function saveCompanyCache(c: CompanyPublic): Promise<void> {
  const row: Stored = {
    name: c.name,
    inn: c.inn,
    address: c.address,
    phone: c.phone,
    bank_details: c.bank_details,
    logo: c.logo,
    stamp: c.stamp,
    fetched_at: Date.now(),
  };
  await setMeta(KEY, JSON.stringify(row));
}

export async function getCompanyCache(): Promise<{
  company: CompanyCache | null;
  stale: boolean;
}> {
  const raw = await getMeta(KEY);
  if (!raw) return { company: null, stale: true };
  try {
    const row = JSON.parse(raw) as Stored;
    return {
      company: {
        name: row.name,
        inn: row.inn,
        address: row.address,
        phone: row.phone,
        bank_details: row.bank_details,
        logo: row.logo,
        stamp: row.stamp,
      },
      stale: Date.now() - (row.fetched_at ?? 0) > STALE_MS,
    };
  } catch {
    return { company: null, stale: true };
  }
}
