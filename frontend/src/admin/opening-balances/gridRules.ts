import type { OpeningBulkRow, OpeningSheetRow } from '@/shared/api/opening';

export interface GridRules {
  /** Manfiy yakuniy qiymat mumkinmi (kassa, ta'minotchi, xodim — ha) */
  allowNegative: boolean;
  /** Faqat oshirish mumkin (mijoz qarzi — kamaytirish to'lov orqali) */
  increaseOnly: boolean;
}

/** Qatordagi yozuv muammosi (ayblovsiz matn) yoki `null`. */
export function rowIssue(current: string, draft: string, rules: GridRules): string | null {
  const value = draft.trim();
  if (value === '' || value === '-') return null;
  const n = Number(value);
  if (Number.isNaN(n)) return 'Raqam kiriting';
  if (!rules.allowNegative && n < 0) return "Manfiy bo'lmaydi";
  if (rules.increaseOnly && n < Number(current)) return "Kamaytirish — qarz to'lovi orqali";
  return null;
}

/** Joriydan farq qiladigan va xatosiz qatorlar — serverga shular yuboriladi. */
export function changedTargets(
  rows: OpeningSheetRow[],
  drafts: Readonly<Record<string, string>>,
  rules: GridRules,
): OpeningBulkRow[] {
  return rows
    .filter((row) => {
      const draft = drafts[row.id]?.trim() ?? '';
      if (draft === '' || draft === '-' || rowIssue(row.current, draft, rules)) return false;
      return Number(draft) !== Number(row.current);
    })
    .map((row) => ({ id: row.id, target: (drafts[row.id] ?? '').trim() }));
}

export function hasIssues(
  rows: OpeningSheetRow[],
  drafts: Readonly<Record<string, string>>,
  rules: GridRules,
): boolean {
  return rows.some((row) => rowIssue(row.current, drafts[row.id] ?? '', rules) !== null);
}

export function searchRows(rows: OpeningSheetRow[], search: string): OpeningSheetRow[] {
  const needle = search.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter(
    (row) => row.name.toLowerCase().includes(needle) || row.code.toLowerCase().includes(needle),
  );
}
