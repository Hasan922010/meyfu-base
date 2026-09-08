"""PDF uchun umumiy yordamchilar — shrift (kirill/lotin) va rasm o'lchamlash.

Nakladnoy, yuklama va chek PDF'lari shu shriftni ishlatadi (CLAUDE.md 3, v4 T3).
`DejaVuSans` — to'liq kirill + lotin qamrovi (`apps/core/fonts/` da).
"""
from __future__ import annotations

import io
from functools import lru_cache
from pathlib import Path

from reportlab.lib.fonts import addMapping
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

_FONT_DIR = Path(__file__).resolve().parent / "fonts"
FONT_REGULAR = "DejaVuSans"
FONT_BOLD = "DejaVuSans-Bold"


@lru_cache(maxsize=1)
def register_fonts() -> str:
    """DejaVu shriftlarini ReportLab'ga ro'yxatdan o'tkazadi. Idempotent.

    Shrift fayllari bo'lmasa — Helvetica'ga qaytadi (kirill chiqmasligi mumkin).
    """
    reg = _FONT_DIR / "DejaVuSans.ttf"
    bold = _FONT_DIR / "DejaVuSans-Bold.ttf"
    if not reg.exists():
        return "Helvetica"
    try:
        pdfmetrics.registerFont(TTFont(FONT_REGULAR, str(reg)))
        if bold.exists():
            pdfmetrics.registerFont(TTFont(FONT_BOLD, str(bold)))
        else:
            pdfmetrics.registerFont(TTFont(FONT_BOLD, str(reg)))
        addMapping(FONT_REGULAR, 0, 0, FONT_REGULAR)
        addMapping(FONT_REGULAR, 1, 0, FONT_BOLD)
    except Exception:  # noqa: BLE001 — shrift buzuq bo'lsa ham PDF chiqishi kerak
        return "Helvetica"
    return FONT_REGULAR


def fitted_image_buffer(field, box_px: int = 400) -> io.BytesIO | None:
    """ImageField'dan `platypus.Image` uchun yaroqli BytesIO qaytaradi (yo'q → None).

    Rasm katta bo'lsa xotira tejash uchun kichraytiriladi. Shaffoflik (PNG muhr)
    saqlanadi.
    """
    if not field:
        return None
    try:
        from PIL import Image

        field.open("rb")
        try:
            with Image.open(field) as im:
                im.load()
                im.thumbnail((box_px, box_px), Image.Resampling.LANCZOS)
                buf = io.BytesIO()
                if im.mode in ("RGBA", "LA", "P"):
                    im.convert("RGBA").save(buf, format="PNG")
                else:
                    im.convert("RGB").save(buf, format="JPEG", quality=85)
        finally:
            field.close()
        buf.seek(0)
        return buf
    except Exception:  # noqa: BLE001
        return None
