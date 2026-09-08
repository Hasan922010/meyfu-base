import { useMemo, useState, type ReactElement } from 'react';

import { useAuthStore } from '@/shared/store/authStore';

import {
  COMMON_GUIDE,
  GUIDES,
  guideIdForRole,
  type GuideBlock,
  type GuideSection,
  type RoleGuide,
} from './guides';

function Block({ b }: { b: GuideBlock }): ReactElement {
  switch (b.k) {
    case 'p':
      return <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{b.text}</p>;
    case 'steps':
      return (
        <ol className="ml-1 space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
          {b.items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
                {i + 1}
              </span>
              <span className="leading-relaxed">{it}</span>
            </li>
          ))}
        </ol>
      );
    case 'list':
      return (
        <ul className="ml-1 space-y-1 text-sm text-gray-700 dark:text-gray-300">
          {b.items.map((it, i) => (
            <li key={i} className="flex gap-2 leading-relaxed">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      );
    case 'note':
      return (
        <div className="rounded-lg border border-pending/30 bg-pending/10 px-3 py-2 text-sm text-gray-700 dark:text-gray-200">
          💡 {b.text}
        </div>
      );
    case 'img':
      return (
        <figure className="space-y-1">
          <img
            src={b.src}
            alt={b.caption ?? ''}
            loading="lazy"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700"
          />
          {b.caption != null && (
            <figcaption className="text-xs text-gray-500">{b.caption}</figcaption>
          )}
        </figure>
      );
  }
}

function Section({ s, open }: { s: GuideSection; open: boolean }): ReactElement {
  const [expanded, setExpanded] = useState<boolean>(open);
  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="font-semibold">{s.title}</span>
        <span className="shrink-0 text-gray-400">{expanded ? '−' : '+'}</span>
      </button>
      {expanded && (
        <div className="space-y-3 border-t border-gray-100 px-4 py-3 dark:border-gray-800">
          {s.blocks.map((b, i) => (
            <Block key={i} b={b} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Rol bo'yicha foydalanish yo'riqnomasi. Mobil (Profil) va admin (Sozlamalar)
 * ekranlarida ishlatiladi. Admin boshqa rollarning yo'riqnomasini ham ko'ra oladi.
 */
export function GuidePage(): ReactElement {
  const role = useAuthStore((s) => s.user?.role);
  const isAdminViewer = role === 'SUPER_ADMIN' || role === 'MANAGER';

  const defaultId: RoleGuide['id'] = role != null ? guideIdForRole(role) : 'ALL';
  const [activeId, setActiveId] = useState<RoleGuide['id']>(defaultId);

  // Oddiy xodim faqat o'z yo'riqnomasini + umumiy bo'limni ko'radi.
  const visibleGuides = useMemo<RoleGuide[]>(() => {
    if (isAdminViewer) return GUIDES;
    return GUIDES.filter((g) => g.id === 'ALL' || g.id === defaultId);
  }, [isAdminViewer, defaultId]);

  const active: RoleGuide = GUIDES.find((g) => g.id === activeId) ?? COMMON_GUIDE;
  const showCommon = active.id !== 'ALL';

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-8">
      <div>
        <h1 className="text-xl font-bold">Foydalanish yo'riqnomasi</h1>
        <p className="text-sm text-gray-500">
          {isAdminViewer
            ? 'Har bir rol uchun alohida. Kerak paytda oching.'
            : 'Ilovadan qanday foydalanish — bosqichma-bosqich.'}
        </p>
      </div>

      {visibleGuides.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {visibleGuides.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setActiveId(g.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                g.id === active.id
                  ? 'bg-brand text-brand-fg'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}

      <p className="text-sm text-gray-500">{active.summary}</p>

      <div className="space-y-2">
        {active.sections.map((s, i) => (
          <Section key={`${active.id}-${s.title}`} s={s} open={i === 0} />
        ))}
      </div>

      {showCommon && (
        <div className="space-y-2 pt-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
            Hamma uchun umumiy
          </h2>
          {COMMON_GUIDE.sections.map((s) => (
            <Section key={`all-${s.title}`} s={s} open={false} />
          ))}
        </div>
      )}
    </div>
  );
}
