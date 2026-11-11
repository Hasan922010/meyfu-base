"""Excel (.xlsx) importlari uchun umumiy o'qish va matn/raqam yordamchilari."""
from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import IO, Any

from openpyxl import load_workbook

from apps.core.exceptions import BusinessError

MAX_ROWS = 5000
MAX_SCANNED_ROWS = MAX_ROWS * 4  # bo'sh qatorlar bilan birga (SEC-119)
MAX_FILE_BYTES = 5 * 1024 * 1024
_ZERO = Decimal("0")


class ImportRollback(Exception):
    """dry_run yoki xato bo'lganda tranzaksiyani bekor qilish uchun."""


def cell_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        value = int(value)  # Excel SKU/telefonni float qilib saqlashi mumkin
    return str(value).strip()


def norm_key(value: Any) -> str:
    cleaned = str(value).strip().lower()
    for ch in ("‘", "’", "`", "ʻ", "ʼ"):
        cleaned = cleaned.replace(ch, "'")
    return " ".join(cleaned.split())


def parse_non_negative_decimal(raw: Any, label: str) -> tuple[Decimal | None, str | None]:
    text = cell_text(raw).replace(" ", "").replace("\u00a0", "").replace(",", ".")
    if text == "":
        return None, None
    try:
        val = Decimal(text)
    except InvalidOperation:
        return None, f"«{label}» son emas: {text}"
    if val < _ZERO:
        return None, f"«{label}» manfiy bo'lmasin."
    return val, None


def open_xlsx_sheet(file: IO[bytes]) -> tuple[tuple[Any, ...], list[tuple[int, tuple[Any, ...]]]]:
    if getattr(file, "size", 0) > MAX_FILE_BYTES:
        raise BusinessError(message="Fayl hajmi 5 MB dan oshmasin.", code="FILE_TOO_LARGE")
    try:
        wb = load_workbook(file, read_only=True, data_only=True)
    except Exception as exc:  # noqa: BLE001 — openpyxl turli xatolar tashlaydi
        raise BusinessError(
            message="Faylni o'qib bo'lmadi. .xlsx formatidagi Excel fayl yuklang.",
            code="INVALID_FILE",
        ) from exc
    try:
        ws = wb.active
        iterator = ws.iter_rows(values_only=True)
        raw_header = next(iterator, None)
        if not raw_header:
            raise BusinessError(message="Fayl bo'sh.", code="EMPTY_FILE")

        rows: list[tuple[int, tuple[Any, ...]]] = []
        for number, values in enumerate(iterator, start=2):
            if number > MAX_SCANNED_ROWS:
                raise BusinessError(
                    message=f"Faylda {MAX_SCANNED_ROWS} dan ortiq qator bor.",
                    code="TOO_MANY_ROWS",
                )
            if values is None or all(v in (None, "") for v in values):
                continue
            rows.append((number, tuple(values)))
            if len(rows) > MAX_ROWS:
                raise BusinessError(
                    message=f"Bir faylda ko'pi bilan {MAX_ROWS} qator bo'lsin.",
                    code="TOO_MANY_ROWS",
                )
        return tuple(raw_header), rows
    finally:
        wb.close()

