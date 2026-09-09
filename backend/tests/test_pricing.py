"""CALC-001 — pul yaxlitlash aniq va deterministik bo'lishi kerak.

`SaleItem.compute()` avval DB qatlamining yashirin yaxlitlashiga (ROUND_HALF_EVEN)
tayanardi. Endi `money_round` (2 xona, ROUND_HALF_UP) — frontend `money()`
(`Math.round`, yarim yuqoriga) bilan bir xil yo'nalishda.
"""
from decimal import Decimal

import pytest

from apps.sales.models import SaleItem, money_round

# (xom qiymat, kutilgan 2 xonali natija)
ROUND_CASES = [
    ("31876.275", "31876.28"),
    ("12500.005", "12500.01"),
    ("12500.004", "12500.00"),
    ("0.125", "0.13"),
    ("2.505", "2.51"),
    ("-1.005", "-1.01"),  # ROUND_HALF_UP — noldan uzoqqa
]


@pytest.mark.parametrize("raw, expected", ROUND_CASES)
def test_money_round_is_half_up_2dp(raw: str, expected: str):
    assert money_round(Decimal(raw)) == Decimal(expected)


def test_sale_item_compute_uses_money_round():
    """3 × 12 500.50, 15% chegirma, tannarx 10 000."""
    item = SaleItem(
        quantity=Decimal("3"),
        price=Decimal("12500.50"),
        discount_percent=Decimal("15"),
        cost_price=Decimal("10000"),
    )
    item.compute()
    # gross = 37 501.50 ; amount = 37 501.50 * 0.85 = 31 876.275 -> 31 876.28
    assert item.amount == Decimal("31876.28")
    # profit = 31 876.28 - 30 000 = 1 876.28
    assert item.profit == Decimal("1876.28")
    # 2 xonadan ortiq bo'lmasin
    assert item.amount.as_tuple().exponent >= -2
    assert item.profit.as_tuple().exponent >= -2


def test_sale_item_compute_no_discount_is_exact():
    item = SaleItem(
        quantity=Decimal("3"), price=Decimal("12500"),
        discount_percent=Decimal("0"), cost_price=Decimal("10000"),
    )
    item.compute()
    assert item.amount == Decimal("37500.00")
    assert item.profit == Decimal("7500.00")
