import type { CachedProduct } from '@/offline/db';

export interface BonusCalculationResult {
  bonusProductId: string;
  bonusProductName: string;
  bonusQty: number;
  triggeredByProductName: string;
}

/**
 * Savatdagi pullik tovarlar bo'yicha aksiya bonuslarini hisoblaydi.
 * Masalan: 10 ta xarid qilinsa, 1 ta sovg'a.
 */
export function computePromotionalBonuses<
  T extends { product: string; quantity: number; is_bonus?: boolean | undefined },
>(
  lines: T[],
  productMap: Map<string, CachedProduct>,
): BonusCalculationResult[] {
  // 1. Faqat pullik (is_bonus != true) tovarlar miqdorini jamlash
  const qtyByProduct = new Map<string, number>();
  for (const line of lines) {
    if (line.is_bonus) continue;
    const current = qtyByProduct.get(line.product) ?? 0;
    qtyByProduct.set(line.product, current + line.quantity);
  }

  const results: BonusCalculationResult[] = [];

  for (const [productId, totalQty] of qtyByProduct.entries()) {
    const product = productMap.get(productId);
    if (!product || !product.has_bonus) continue;

    const triggerQty = Number(product.bonus_trigger_qty ?? 0);
    const rewardQty = Number(product.bonus_reward_qty ?? 0);

    if (triggerQty <= 0 || rewardQty <= 0) continue;

    const multiplier = Math.floor(totalQty / triggerQty);
    if (multiplier > 0) {
      const bonusQty = multiplier * rewardQty;
      const targetId = product.bonus_product || product.id;
      const targetProduct = productMap.get(targetId);
      const targetName =
        product.bonus_product_name ||
        targetProduct?.name ||
        product.name;

      results.push({
        bonusProductId: targetId,
        bonusProductName: targetName,
        bonusQty,
        triggeredByProductName: product.name,
      });
    }
  }

  return results;
}
