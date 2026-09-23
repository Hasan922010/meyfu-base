"""Foydalanuvchiga ko'rinadigan matnlar uchun formatlash (CLAUDE.md §20)."""
from decimal import ROUND_HALF_UP, Decimal


def fmt_money(value) -> str:
    """`Decimal('25000.00')` → `"25 000 so'm"`: butun so'mgacha, bo'sh joy bilan."""
    amount = Decimal(str(value)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    sign = "−" if amount < 0 else ""
    grouped = f"{abs(amount):,}".replace(",", " ")
    return f"{sign}{grouped} so'm"
