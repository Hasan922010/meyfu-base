import { CloudOff, RefreshCw, TriangleAlert, Wifi } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import type { SyncState } from './useSync';

/** CLAUDE.md 4.5 — yuqorida doim holat. */
export function SyncBadge({ state }: { state: SyncState }): ReactElement {
  const { online, pending, dead, syncing } = state;

  let text: string;
  let cls: string;
  let icon: ReactElement;
  if (dead > 0) {
    text = `${dead} ta yuborilmadi`;
    cls = 'bg-danger/10 text-danger';
    icon = <TriangleAlert size={14} aria-hidden />;
  } else if (!online) {
    text = pending > 0 ? `Offline · ${pending} kutmoqda` : 'Offline';
    cls = 'bg-danger/10 text-danger';
    icon = <CloudOff size={14} aria-hidden />;
  } else if (pending > 0 || syncing) {
    text = `Yuborilmoqda (${pending})`;
    cls = 'bg-pending/10 text-pending';
    icon = <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} aria-hidden />;
  } else {
    text = 'Online';
    cls = 'bg-success/10 text-success';
    icon = <Wifi size={14} aria-hidden />;
  }

  return (
    <Link
      to="/m/sync"
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}
    >
      {icon}
      {text}
    </Link>
  );
}
