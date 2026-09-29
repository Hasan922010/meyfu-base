"""Filialga xos narxni aniqlash (v5: A7).

Filial narxi bo'lsa — u, bo'lmasa mahsulotning umumiy narxi. Markaz uchun
(`branch=None`) har doim umumiy narx.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

PRICE_FIELDS = ("wholesale_price", "retail_price", "min_price")


@dataclass(frozen=True)
class Prices:
    wholesale_price: Decimal
    retail_price: Decimal
    min_price: Decimal


def branch_price_map(branch, product_ids=None) -> dict:
    """{product_id: BranchPrice} — filial narxlari (bitta so'rov)."""
    if branch is None:
        return {}
    from .models import BranchPrice

    qs = BranchPrice.objects.filter(branch=branch)
    if product_ids is not None:
        qs = qs.filter(product_id__in=list(product_ids))
    return {bp.product_id: bp for bp in qs}


def price_for(product, branch, price_map: dict | None = None) -> Prices:
    """Mahsulotning shu filialdagi narxlari."""
    if price_map is None:
        price_map = branch_price_map(branch, [product.pk])
    source = price_map.get(product.pk, product)
    return Prices(*(Decimal(str(getattr(source, f))) for f in PRICE_FIELDS))
