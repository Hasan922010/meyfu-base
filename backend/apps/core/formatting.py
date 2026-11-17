"""Foydalanuvchiga ko'rinadigan matnlar uchun formatlash (CLAUDE.md §20)."""
from decimal import ROUND_HALF_UP, Decimal


def fmt_money(value) -> str:
    """`Decimal('25000.00')` → `"25 000 so'm"`: butun so'mgacha, bo'sh joy bilan."""
    amount = Decimal(str(value)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    sign = "−" if amount < 0 else ""
    grouped = f"{abs(amount):,}".replace(",", " ")
    return f"{sign}{grouped} so'm"


_ONES = (
    "", "bir", "ikki", "uch", "to'rt", "besh", "olti", "yetti", "sakkiz", "to'qqiz",
)
_TENS = (
    "", "o'n", "yigirma", "o'ttiz", "qirq", "ellik", "oltmish", "yetmish",
    "sakson", "to'qson",
)
_SCALES = ("", "ming", "million", "milliard", "trillion")


def _under_1000(n: int) -> str:
    out: list[str] = []
    h, rest = divmod(n, 100)
    if h:
        out.append("yuz" if h == 1 else f"{_ONES[h]} yuz")
    t, o = divmod(rest, 10)
    if t:
        out.append(_TENS[t])
    if o:
        out.append(_ONES[o])
    return " ".join(out)


def number_to_words_uz(value) -> str:
    """Sonni o'zbekcha so'z bilan: 1250000 -> 'bir million ikki yuz ellik ming'."""
    amount = int(Decimal(str(value or 0)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    if amount == 0:
        return "nol"
    n = abs(amount)
    parts: list[str] = []
    idx = 0
    while n > 0:
        n, g = divmod(n, 1000)
        if g:
            scale = _SCALES[idx] if idx < len(_SCALES) else ""
            if scale == "ming" and g == 1:
                parts.append("ming")
            elif scale:
                parts.append(f"{_under_1000(g)} {scale}")
            else:
                parts.append(_under_1000(g))
        idx += 1
    words = " ".join(reversed(parts))
    return f"minus {words}" if amount < 0 else words
