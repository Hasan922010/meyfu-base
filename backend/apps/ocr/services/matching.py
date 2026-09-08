"""Katalogga moslashtirish (CLAUDE.md 9.5).

ProductAlias aniq moslik → EXACT
o'xshashlik ≥ OCR_FUZZY_THRESHOLD → FUZZY
topilmasa → NEW / UNMATCHED
"""
from __future__ import annotations

from django.conf import settings

from apps.catalog.models import Product, ProductAlias

from ..constants import MatchStatus

try:
    from rapidfuzz import fuzz, process

    _RF = True
except Exception:  # noqa: BLE001
    _RF = False
    import difflib


def _norm(text: str) -> str:
    return " ".join((text or "").lower().split())


def _ratio(a: str, b: str) -> int:
    if _RF:
        return int(fuzz.token_sort_ratio(a, b))
    return int(difflib.SequenceMatcher(None, a, b).ratio() * 100)


def match_line(raw_name: str, *, supplier_id=None) -> tuple[Product | None, int, str]:
    """(product, confidence 0..100, match_status) qaytaradi."""
    name = _norm(raw_name)
    if not name:
        return None, 0, MatchStatus.UNMATCHED

    # 1) ProductAlias aniq moslik (yetkazuvchi bo'yicha yoki umumiy)
    alias_qs = ProductAlias.objects.select_related("product").filter(
        alias_text__iexact=raw_name.strip()
    )
    if supplier_id:
        exact = alias_qs.filter(supplier_id=supplier_id).first() or \
            alias_qs.filter(supplier__isnull=True).first()
    else:
        exact = alias_qs.first()
    if exact:
        return exact.product, 100, MatchStatus.EXACT

    # 2) katalog nomi aniq moslik
    prod = Product.objects.filter(name__iexact=raw_name.strip()).first()
    if prod:
        return prod, 100, MatchStatus.EXACT

    # 3) fuzzy — katalog + aliaslar
    candidates: dict[str, Product] = {}
    for p in Product.objects.filter(is_active=True).only("id", "name", "sku"):
        candidates[_norm(p.name)] = p
    for a in ProductAlias.objects.select_related("product").only(
        "alias_text", "product"
    ):
        candidates.setdefault(_norm(a.alias_text), a.product)

    if not candidates:
        return None, 0, MatchStatus.NEW

    threshold = settings.OCR_FUZZY_THRESHOLD
    if _RF:
        best = process.extractOne(
            name, list(candidates.keys()), scorer=fuzz.token_sort_ratio
        )
        if best:
            key, score, _ = best
            score = int(score)
            if score >= threshold:
                return candidates[key], score, MatchStatus.FUZZY
    else:
        best_key, best_score = None, 0
        for key in candidates:
            s = _ratio(name, key)
            if s > best_score:
                best_key, best_score = key, s
        if best_key and best_score >= threshold:
            return candidates[best_key], best_score, MatchStatus.FUZZY

    return None, 0, MatchStatus.NEW


def learn_alias(product: Product, raw_name: str, *, supplier=None) -> None:
    """Tasdiqlangan tuzatishni alias sifatida saqlaydi (tizim o'rganadi — 9.7)."""
    raw_name = (raw_name or "").strip()
    if not raw_name or _norm(raw_name) == _norm(product.name):
        return
    alias, created = ProductAlias.objects.get_or_create(
        product=product, alias_text=raw_name, supplier=supplier,
        defaults={"hit_count": 1},
    )
    if not created:
        alias.hit_count += 1
        alias.save(update_fields=["hit_count", "updated_at"])
