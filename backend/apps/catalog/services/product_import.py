"""Mahsulotlarni Excel'dan import qilish (v5: B1).

Qoidalar:
  - Kalit — SKU (artikul): bor bo'lsa yangilanadi, yo'q bo'lsa yaratiladi.
  - Kategoriya / birlik / brend nomi bo'yicha topiladi, yo'q bo'lsa yaratiladi.
  - Mavjud mahsulot narxini faqat SUPER_ADMIN o'zgartiradi (CLAUDE.md 2) —
    boshqalarda narx/komissiya farq qilsa, qator xato bo'ladi.
  - Narx o'zgarsa — ProductPrice tarixi + AuditLog (CLAUDE.md 5.3).
  - `dry_run=True` — hech narsa yozilmaydi, faqat natija ko'rsatiladi.
  - Butun fayl bitta tranzaksiyada: xatoli qator bo'lsa, hech narsa yozilmaydi.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import IO, Any

from django.db import transaction
from django.utils import timezone

from apps.core.exceptions import BusinessError
from apps.core.models import AuditLog
from apps.core.services.excel_import import (
    ImportRollback,
    cell_text,
    norm_key,
    open_xlsx_sheet,
    parse_non_negative_decimal,
)
from apps.users.constants import Role

from ..models import Brand, Category, Product, ProductPrice, Unit

_ZERO = Decimal("0")
_HUNDRED = Decimal("100")

# Ustun sarlavhasi (kichik harfda) → model maydoni. O'zbekcha va inglizcha nomlar.
COLUMNS: dict[str, str] = {
    "sku": "sku",
    "artikul": "sku",
    "name": "name",
    "nomi": "name",
    "category": "category",
    "kategoriya": "category",
    "unit": "unit",
    "birlik": "unit",
    "o'lchov birligi": "unit",
    "olchov birligi": "unit",
    "brand": "brand",
    "brend": "brand",
    "barcode": "barcode",
    "shtrix-kod": "barcode",
    "shtrixkod": "barcode",
    "cost_price": "cost_price",
    "tannarx": "cost_price",
    "wholesale_price": "wholesale_price",
    "optom narx": "wholesale_price",
    "retail_price": "retail_price",
    "chakana narx": "retail_price",
    "min_price": "min_price",
    "minimal narx": "min_price",
    "track_variance": "track_variance",
    "farqni kuzatish": "track_variance",
    "kamomad kuzatish": "track_variance",
    "order_commission_rate": "order_commission_rate",
    "zakaz komissiyasi": "order_commission_rate",
    "zakaz komissiyasi (%)": "order_commission_rate",
    "delivery_commission_rate": "delivery_commission_rate",
    "tarqatish komissiyasi": "delivery_commission_rate",
    "tarqatish komissiyasi (%)": "delivery_commission_rate",
    "yetkazish komissiyasi": "delivery_commission_rate",
    "has_bonus": "has_bonus",
    "bonus": "has_bonus",
    "bonus mavjud": "has_bonus",
    "bonus_trigger_qty": "bonus_trigger_qty",
    "bonus sharti": "bonus_trigger_qty",
    "har nechtaga": "bonus_trigger_qty",
    "bonus_reward_qty": "bonus_reward_qty",
    "bonus soni": "bonus_reward_qty",
    "bonus_product": "bonus_product_sku",
    "bonus_product_sku": "bonus_product_sku",
    "bonus tovar": "bonus_product_sku",
    "bonus tovar artikuli": "bonus_product_sku",
    "package_type": "package_type",
    "qadoq turi": "package_type",
    "pack_quantity": "pack_quantity",
    "qadoqdagi soni": "pack_quantity",
    "qadoq soni": "pack_quantity",
    "min_stock_alert": "min_stock_alert",
    "kam qoldiq": "min_stock_alert",
    "is_active": "is_active",
    "faol": "is_active",
}

TEMPLATE_HEADER = [
    "nomi",
    "artikul",
    "shtrix-kod",
    "kategoriya",
    "birlik",
    "brend",
    "tannarx",
    "farqni kuzatish",
    "zakaz komissiyasi",
    "tarqatish komissiyasi",
    "bonus",
    "bonus sharti",
    "bonus soni",
    "bonus tovar",
    "qadoq turi",
    "qadoqdagi soni",
    "kam qoldiq",
    "faol",
]

PRICE_COLUMNS = ("cost_price", "wholesale_price", "retail_price", "min_price")
PROTECTED_PRICE_COLUMNS = (
    *PRICE_COLUMNS,
    "order_commission_rate",
    "delivery_commission_rate",
)
_NUMERIC = (
    *PRICE_COLUMNS,
    "order_commission_rate",
    "delivery_commission_rate",
    "bonus_trigger_qty",
    "bonus_reward_qty",
    "pack_quantity",
    "min_stock_alert",
)
_BOOLEAN = ("track_variance", "has_bonus", "is_active")

_BOOL_TRUE = {"1", "true", "ha", "yes", "da", "faol", "active", "+", "bor"}
_BOOL_FALSE = {"0", "false", "yo'q", "yoq", "no", "net", "nofaol", "-", "yo"}


@dataclass
class RowResult:
    row: int
    sku: str
    action: str  # CREATE | UPDATE | SKIP | ERROR
    errors: list[str] = field(default_factory=list)


@dataclass
class ImportReport:
    dry_run: bool
    created: int = 0
    updated: int = 0
    unchanged: int = 0
    rows: list[RowResult] = field(default_factory=list)

    @property
    def error_count(self) -> int:
        return sum(1 for r in self.rows if r.action == "ERROR")

    def as_dict(self) -> dict[str, Any]:
        return {
            "dry_run": self.dry_run,
            "created": self.created,
            "updated": self.updated,
            "unchanged": self.unchanged,
            "errors": self.error_count,
            "rows": [r.__dict__ for r in self.rows],
        }


def _read_rows(file: IO[bytes]) -> list[tuple[int, dict[str, Any]]]:
    header, raw_rows = open_xlsx_sheet(file)
    mapping: dict[int, str] = {}
    for idx, h in enumerate(header):
        if h is None:
            continue
        key = COLUMNS.get(norm_key(h))
        if key:
            mapping[idx] = key
    if not {"sku", "name"} <= set(mapping.values()):
        raise BusinessError(
            message="Sarlavhada kamida «artikul» va «nomi» ustunlari bo'lishi kerak.",
            code="MISSING_COLUMNS",
        )
    return [
        (
            number,
            {mapping[i]: (values[i] if i < len(values) else None) for i in mapping},
        )
        for number, values in raw_rows
    ]


def _parse_bool(value: Any, key: str) -> tuple[bool | None, str | None]:
    if isinstance(value, bool):
        return value, None
    text = norm_key(cell_text(value))
    if text == "":
        return None, None
    if text in _BOOL_TRUE:
        return True, None
    if text in _BOOL_FALSE:
        return False, None
    return None, f"«{key}» ha/yo'q bo'lishi kerak: {value}"


def _parse(raw: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    data: dict[str, Any] = {
        k: cell_text(raw.get(k))
        for k in ("sku", "name", "category", "unit", "brand", "barcode", "package_type")
    }
    if "bonus_product_sku" in raw:
        data["bonus_product_sku"] = cell_text(raw.get("bonus_product_sku"))
    errors: list[str] = []
    if not data["sku"]:
        errors.append("Artikul bo'sh.")
    if not data["name"]:
        errors.append("Nomi bo'sh.")
    for key in _NUMERIC:
        number, dec_err = parse_non_negative_decimal(raw.get(key), key)
        if dec_err:
            errors.append(dec_err)
            continue
        if number is None:
            continue
        if key == "pack_quantity" and number <= _ZERO:
            errors.append(f"«{key}» manfiy yoki nol bo'lmasin.")
            continue
        if key in ("pack_quantity", "min_stock_alert") and number % 1 != 0:
            errors.append(f"«{key}» butun son bo'lishi kerak.")
            continue
        if key in ("order_commission_rate", "delivery_commission_rate") and number > _HUNDRED:
            errors.append(f"«{key}» 100 dan oshmasin.")
            continue
        data[key] = number
    for key in _BOOLEAN:
        if key not in raw:
            continue
        parsed, b_err = _parse_bool(raw.get(key), key)
        if b_err:
            errors.append(b_err)
        elif parsed is not None:
            data[key] = parsed
    return data, errors


class _Lookups:
    """Nom bo'yicha kategoriya/birlik/brendni keshlab topadi yoki yaratadi."""

    def __init__(self) -> None:
        self._cache: dict[tuple[str, str], Any] = {}

    def get(self, model: type, name: str) -> Any:
        key = (model.__name__, name.lower())
        if key not in self._cache:
            # o'chirilganini ham qidiramiz — unique nom bilan to'qnashmaslik uchun
            obj = model.all_objects.filter(name__iexact=name).first()
            if obj is not None and obj.is_deleted:
                obj.is_deleted = False
                obj.save(update_fields=["is_deleted", "updated_at"])
            if obj is None:
                extra = {"short_name": name[:16]} if model is Unit else {}
                obj = model.objects.create(name=name, **extra)
            self._cache[key] = obj
        return self._cache[key]


def _apply_row(
    data: dict[str, Any], lookups: _Lookups, user, can_price: bool,
) -> tuple[str, list[str], dict[str, Any] | None, tuple[Product, str] | None]:
    """Bitta qatorni yozadi. (action, errors, narx o'zgarishi, deferred_bonus) qaytaradi."""
    # SKU unique — o'chirilgan mahsulot qayta import qilinsa, tiklanadi
    product = Product.all_objects.filter(sku=data["sku"]).first()
    fields: dict[str, Any] = {"name": data["name"], "is_deleted": False}
    if data["barcode"]:
        fields["barcode"] = data["barcode"]
    if data["package_type"]:
        fields["package_type"] = data["package_type"]
    if data["category"]:
        fields["category"] = lookups.get(Category, data["category"])
    if data["unit"]:
        fields["unit"] = lookups.get(Unit, data["unit"])
    if data["brand"]:
        fields["brand"] = lookups.get(Brand, data["brand"])
    for key in _NUMERIC:
        if key in data:
            fields[key] = data[key]
    for key in _BOOLEAN:
        if key in data:
            fields[key] = data[key]

    deferred_bonus: tuple[Product, str] | None = None
    deferred_bonus_sku = ""
    if "bonus_product_sku" in data:
        bonus_sku = data["bonus_product_sku"]
        if bonus_sku and bonus_sku != data["sku"]:
            bp = Product.objects.filter(sku=bonus_sku).first()
            if bp is not None:
                fields["bonus_product"] = bp
            else:
                deferred_bonus_sku = bonus_sku
        elif product is not None:
            fields["bonus_product"] = None

    # Tannarx kiritilib, eski optom/chakana/minimal narx berilmagan bo'lsa — moslashtiramiz
    if "cost_price" in fields:
        for pfield in ("wholesale_price", "retail_price", "min_price"):
            if pfield not in fields and (
                product is None or getattr(product, pfield) == _ZERO
            ):
                fields[pfield] = fields["cost_price"]

    # Bonus shartlari tekshiruvi
    has_bonus = fields.get("has_bonus", product.has_bonus if product else False)
    if has_bonus:
        trigger = fields.get("bonus_trigger_qty", product.bonus_trigger_qty if product else _ZERO)
        reward = fields.get("bonus_reward_qty", product.bonus_reward_qty if product else _ZERO)
        if (trigger or _ZERO) <= _ZERO or (reward or _ZERO) <= _ZERO:
            return (
                "ERROR",
                ["Bonus berilishi uchun bonus sharti va bonus soni 0 dan katta bo'lishi kerak."],
                None,
                None,
            )

    if product is None:
        missing = [label for key, label in (("category", "kategoriya"), ("unit", "birlik"))
                   if key not in fields]
        if missing:
            return "ERROR", [f"Yangi mahsulot uchun {', '.join(missing)} kerak."], None, None
        errors = _min_price_errors(fields, None)
        if errors:
            return "ERROR", errors, None, None
        fields.pop("is_deleted")
        created = Product.objects.create(sku=data["sku"], created_by=user, **fields)
        if deferred_bonus_sku:
            deferred_bonus = (created, deferred_bonus_sku)
        return "CREATE", [], None, deferred_bonus

    changed = {k: v for k, v in fields.items() if getattr(product, k) != v}
    protected_changed = [k for k in PROTECTED_PRICE_COLUMNS if k in changed]
    if protected_changed and not can_price:
        return "ERROR", ["Mavjud mahsulot narxini faqat SUPER_ADMIN o'zgartira oladi."], None, None

    if not changed and not deferred_bonus_sku:
        return "SKIP", [], None, None

    errors = _min_price_errors(fields, product)
    if errors:
        return "ERROR", errors, None, None

    price_changed = [k for k in PRICE_COLUMNS if k in changed]
    before = {k: str(getattr(product, k)) for k in protected_changed}
    for key, value in changed.items():
        setattr(product, key, value)
    if changed:
        product.save()
    if deferred_bonus_sku:
        deferred_bonus = (product, deferred_bonus_sku)

    if not price_changed and not protected_changed:
        return ("UPDATE" if changed else "SKIP"), [], None, deferred_bonus

    if price_changed:
        ProductPrice.objects.create(
            product=product, effective_from=timezone.now(), reason="Excel import",
            **{k: getattr(product, k) for k in PRICE_COLUMNS},
        )
    return "UPDATE", [], {
        "sku": product.sku, "before": before,
        "after": {k: str(getattr(product, k)) for k in protected_changed},
    }, deferred_bonus


def _min_price_errors(fields: dict[str, Any], product: Product | None) -> list[str]:
    retail = fields.get("retail_price", getattr(product, "retail_price", None))
    minimum = fields.get("min_price", getattr(product, "min_price", None))
    if retail is not None and minimum is not None and retail > _ZERO and minimum > retail:
        return ["Minimal narx chakana narxdan katta bo'lmasin."]
    return []


def import_products(file: IO[bytes], *, user, dry_run: bool) -> ImportReport:
    rows = _read_rows(file)
    report = ImportReport(dry_run=dry_run)
    can_price = user.is_superuser or getattr(user, "role", None) == Role.SUPER_ADMIN
    price_changes: list[dict[str, Any]] = []
    seen: set[str] = set()
    pending_bonus: list[tuple[RowResult, Product, str]] = []

    try:
        with transaction.atomic():
            lookups = _Lookups()
            for number, raw in rows:
                data, errors = _parse(raw)
                if data["sku"] and data["sku"] in seen:
                    errors.append("Bu artikul faylda takrorlangan.")
                seen.add(data["sku"])
                if errors:
                    report.rows.append(RowResult(number, data["sku"], "ERROR", errors))
                    continue
                action, errors, change, deferred = _apply_row(data, lookups, user, can_price)
                res = RowResult(number, data["sku"], action, errors)
                report.rows.append(res)
                if change:
                    price_changes.append(change)
                if deferred:
                    pending_bonus.append((res, deferred[0], deferred[1]))

            # Faylda keyingi qatorda yaratilgan bonus tovarlarni bog'lash
            for res, prod, target_sku in pending_bonus:
                bp = Product.objects.filter(sku=target_sku).first()
                if bp is None:
                    res.action = "ERROR"
                    res.errors.append(f"Bonus tovar topilmadi: «{target_sku}».")
                elif prod.bonus_product_id != bp.id:
                    prod.bonus_product = bp
                    prod.save(update_fields=["bonus_product", "updated_at"])
                    if res.action == "SKIP":
                        res.action = "UPDATE"

            report.created = sum(1 for r in report.rows if r.action == "CREATE")
            report.updated = sum(1 for r in report.rows if r.action == "UPDATE")
            report.unchanged = sum(1 for r in report.rows if r.action == "SKIP")
            if dry_run or report.error_count:
                raise ImportRollback
            AuditLog.objects.create(
                user=user, action="product.import", model_name="Product",
                changes={
                    "created": report.created, "updated": report.updated,
                    "price_changes": price_changes[:200],
                },
            )
    except ImportRollback:
        pass
    return report
