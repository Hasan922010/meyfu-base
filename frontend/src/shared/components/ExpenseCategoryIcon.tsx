import {
  Car,
  Fuel,
  Phone,
  Receipt,
  Sparkles,
  Utensils,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { ReactElement } from 'react';

interface ExpenseCategoryIconProps {
  icon?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}

function resolveIcon(icon?: string | null, name?: string | null): LucideIcon {
  const token = `${icon ?? ''} ${name ?? ''}`.toLowerCase();

  // Fuel / Benzin / Yoqilg'i (legacy \u26FD)
  if (
    token.includes('fuel') ||
    token.includes('benzin') ||
    token.includes("yoqilg'i") ||
    token.includes('yoqilgi') ||
    token.includes('gaz') ||
    token.includes('\u26FD')
  ) {
    return Fuel;
  }

  // Food / Tushlik / Ovqat (legacy \uD83C\uDF7D, \uD83C\uDF54, \uD83C\uDF72)
  if (
    token.includes('food') ||
    token.includes('lunch') ||
    token.includes('meal') ||
    token.includes('ovqat') ||
    token.includes('tushlik') ||
    token.includes('choy') ||
    token.includes('\uD83C\uDF7D') ||
    token.includes('\uD83C\uDF54') ||
    token.includes('\uD83C\uDF72')
  ) {
    return Utensils;
  }

  // Car wash / Moyka / Yuvish (legacy \uD83E\uDDFD, \uD83E\uDDFC)
  if (
    token.includes('wash') ||
    token.includes('moyka') ||
    token.includes('yuvish') ||
    token.includes('tozalash') ||
    token.includes('\uD83E\uDDFD') ||
    token.includes('\uD83E\uDDFC')
  ) {
    return Sparkles;
  }

  // Repair / Remont / Ta'mir (legacy \uD83D\uDD27, \uD83D\uDD28)
  if (
    token.includes('repair') ||
    token.includes('tamir') ||
    token.includes("ta'mir") ||
    token.includes('remont') ||
    token.includes('zapchast') ||
    token.includes('ustaxona') ||
    token.includes('\uD83D\uDD27') ||
    token.includes('\uD83D\uDD28')
  ) {
    return Wrench;
  }

  // Phone / Aloqa / Internet (legacy \uD83D\uDCF1, \uD83D\uDCDE)
  if (
    token.includes('phone') ||
    token.includes('aloqa') ||
    token.includes('telefon') ||
    token.includes('internet') ||
    token.includes('megabayt') ||
    token.includes('\uD83D\uDCF1') ||
    token.includes('\uD83D\uDCDE')
  ) {
    return Phone;
  }

  // Parking / Car / Mashina (legacy \uD83C\uDD7F, \uD83D\uDE97)
  if (
    token.includes('park') ||
    token.includes('car') ||
    token.includes('mashina') ||
    token.includes('turargoh') ||
    token.includes('\uD83C\uDD7F') ||
    token.includes('\uD83D\uDE97')
  ) {
    return Car;
  }

  return Receipt;
}

export function ExpenseCategoryIcon({
  icon,
  name,
  size = 18,
  className = '',
}: ExpenseCategoryIconProps): ReactElement {
  const Icon = resolveIcon(icon, name);
  return <Icon size={size} className={className} aria-hidden />;
}
