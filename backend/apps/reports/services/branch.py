"""Filial (ombor) hisoboti — kartalar, batafsil faoliyat va hujjatlar.

Manba — append-only `StockMovement` jurnali (CLAUDE.md 5.2) va hujjatlar.
Summa — mahsulotning joriy tannarxi bo'yicha (yo'ldagi tovar — jo'natilgan
paytdagi tannarx bo'yicha).
"""
from __future__ import annotations

from datetime import date as date_cls
from decimal import Decimal

from django.db.models import Count, DecimalField, ExpressionWrapper, F, QuerySet, Sum

from apps.core.business_day import business_day_range
from apps.dayclose.models import DailyReturn
from apps.warehouse.constants import MovementType, TransferStatus
from apps.warehouse.models import (
    InventoryCount,
    Loading,
    Purchase,
    Stock,
    StockMovement,
    Transfer,
    TransferItem,
    Warehouse,
)

from .distributor import _pct_change

_ZERO = Decimal("0")
_MONEY = DecimalField(max_digits=20, decimal_places=2)
ACTIVITY_LIMIT = 1000

# kind → (sarlavha, harakat turlari)
MOVEMENT_KINDS: dict[str, tuple[str, list[str]]] = {
    "purchases": ("Kirim — tovar qabuli", [MovementType.IN_PURCHASE]),
    "transfers_in": ("Kelgan ko'chirishlar", [MovementType.TRANSFER]),
    "transfers_out": ("Jo'natilgan ko'chirishlar", [MovementType.TRANSFER]),
    "loadings": ("Yuklamalar (tarqatuvchilarga)", [MovementType.OUT_LOADING]),
    "returns": ("Qaytarishlar", [MovementType.IN_RETURN]),
    "inventory": ("Inventarizatsiya", [MovementType.ADJUSTMENT]),
    "write_offs": ("Hisobdan chiqarish (brak)", [MovementType.WRITE_OFF]),
    "opening": ("Boshlang'ich qoldiq", [MovementType.OPENING_BALANCE]),
    "other": ("Boshqa harakatlar", [MovementType.OUT_SALE, MovementType.CORRECTION]),
}
SPECIAL_KINDS = {"stock": "Joriy qoldiq", "in_transit": "Yo'ldagi tovar (kelayotgan)"}
KINDS: tuple[str, ...] = ("stock", "in_transit", *MOVEMENT_KINDS)

# reference_type → (model, hujjat nomi)
_DOCUMENTS = {
    "purchase": (Purchase, "Tovar qabuli"),
    "loading": (Loading, "Yuklama"),
    "inventory": (InventoryCount, "Inventarizatsiya"),
    "transfer": (Transfer, "Ko'chirish"),
    "daily_return": (DailyReturn, "Qaytarish"),
}


def _value(qty_field: str, price_field: str) -> ExpressionWrapper:
    return ExpressionWrapper(F(qty_field) * F(price_field), output_field=_MONEY)


def _money(value) -> str:
    return str((value or _ZERO).quantize(Decimal("0.01")))


def _qty(value) -> str:
    return str((value or _ZERO).quantize(Decimal("0.001")))


def _warehouse_info(warehouse: Warehouse) -> dict:
    return {
        "id": str(warehouse.pk), "name": warehouse.name,
        "address": warehouse.address, "phone": warehouse.phone,
        "is_branch": warehouse.is_branch,
        "manager_name": warehouse.manager.full_name if warehouse.manager else None,
    }


# --------------------------------------------------------------- harakatlar


def _transfer_ids(warehouse: Warehouse, direction: str) -> list[str]:
    field = "to_warehouse" if direction == "in" else "from_warehouse"
    ids = Transfer.objects.filter(**{field: warehouse}).values_list("pk", flat=True)
    return [str(pk) for pk in ids]


def _movements(
    warehouse: Warehouse, kind: str, start: date_cls, end: date_cls
) -> QuerySet[StockMovement]:
    _label, types = MOVEMENT_KINDS[kind]
    qs = StockMovement.objects.filter(
        warehouse=warehouse, movement_type__in=types,
        created_at__gte=business_day_range(start, end)[0],
        created_at__lt=business_day_range(start, end)[1],
    )
    # Ko'chirish yo'nalishi hujjatdan aniqlanadi: bekor qilish (manbaga qaytish)
    # "jo'natilgan"ni kamaytiradi, "kelgan" bo'lib ko'rinmaydi.
    if kind == "transfers_in":
        qs = qs.filter(reference_id__in=_transfer_ids(warehouse, "in"))
    elif kind == "transfers_out":
        qs = qs.filter(reference_id__in=_transfer_ids(warehouse, "out"))
    return qs


def _movement_totals(qs: QuerySet[StockMovement]) -> dict:
    agg = qs.aggregate(
        total_qty=Sum("quantity"),
        total_amount=Sum(_value("quantity", "product__cost_price")),
    )
    documents = qs.exclude(reference_id="").values("reference_id").distinct().count()
    return {
        "count": documents + qs.filter(reference_id="").count(),
        "quantity": agg["total_qty"] or _ZERO,
        "amount": agg["total_amount"] or _ZERO,
    }


def _in_transit_items(warehouse: Warehouse) -> QuerySet[TransferItem]:
    return TransferItem.objects.filter(
        transfer__to_warehouse=warehouse, transfer__status=TransferStatus.SENT
    )


# ------------------------------------------------------------------- kartalar


def _stock_card(warehouse: Warehouse) -> dict:
    qs = Stock.objects.filter(warehouse=warehouse)
    agg = qs.aggregate(
        total_qty=Sum("quantity"),
        total_amount=Sum(_value("quantity", "product__cost_price")),
    )
    low = qs.filter(
        product__min_stock_alert__gt=0, quantity__lte=F("product__min_stock_alert")
    ).count()
    return {
        "kind": "stock", "label": SPECIAL_KINDS["stock"],
        "count": qs.filter(quantity__gt=0).count(),
        "quantity": _qty(agg["total_qty"]), "amount": _money(agg["total_amount"]),
        "low_count": low, "change": None,
    }


def _in_transit_card(warehouse: Warehouse) -> dict:
    qs = _in_transit_items(warehouse)
    agg = qs.aggregate(
        total_qty=Sum("quantity"), total_amount=Sum(_value("quantity", "cost_price"))
    )
    return {
        "kind": "in_transit", "label": SPECIAL_KINDS["in_transit"],
        "count": qs.values("transfer").distinct().count(),
        "quantity": _qty(agg["total_qty"]), "amount": _money(agg["total_amount"]),
        "change": None,
    }


def branch_cards(
    warehouse: Warehouse, start: date_cls, end: date_cls,
    prev_start: date_cls, prev_end: date_cls,
) -> dict:
    cards = [_stock_card(warehouse), _in_transit_card(warehouse)]
    for kind, (label, _types) in MOVEMENT_KINDS.items():
        current = _movement_totals(_movements(warehouse, kind, start, end))
        previous = _movement_totals(_movements(warehouse, kind, prev_start, prev_end))
        cards.append({
            "kind": kind, "label": label, "count": current["count"],
            "quantity": _qty(current["quantity"]), "amount": _money(current["amount"]),
            "change": _pct_change(abs(current["amount"]), abs(previous["amount"])),
        })
    return {
        "warehouse": _warehouse_info(warehouse),
        "date_from": str(start), "date_to": str(end),
        "cards": cards,
    }


# ----------------------------------------------------------- batafsil qatorlar


def _document_numbers(movements: list[StockMovement]) -> dict[tuple[str, str], str]:
    by_type: dict[str, set[str]] = {}
    for mv in movements:
        if mv.reference_type in _DOCUMENTS and mv.reference_id:
            by_type.setdefault(mv.reference_type, set()).add(mv.reference_id)
    numbers: dict[tuple[str, str], str] = {}
    for ref_type, ids in by_type.items():
        model, _label = _DOCUMENTS[ref_type]
        for pk, number in model.objects.filter(pk__in=ids).values_list("pk", "number"):
            numbers[(ref_type, str(pk))] = number
    return numbers


def _document(ref_type: str, ref_id: str, numbers: dict) -> dict | None:
    if ref_type not in _DOCUMENTS or not ref_id:
        return None
    return {
        "type": ref_type, "id": ref_id, "label": _DOCUMENTS[ref_type][1],
        "number": numbers.get((ref_type, ref_id), ""),
    }


def _row(*, id, date, product, quantity, amount, balance_after="", kind_label="",
         note="", user_name="", document=None) -> dict:
    return {
        "id": str(id), "date": date, "product_name": product.name,
        "product_sku": product.sku, "unit": product.unit.short_name,
        "quantity": _qty(quantity), "amount": _money(amount),
        "balance_after": balance_after, "movement_type": kind_label,
        "note": note, "user_name": user_name, "document": document,
    }


def _movement_rows(qs: QuerySet[StockMovement]) -> list[dict]:
    movements = list(
        qs.select_related("product__unit", "user")
        .order_by("-created_at")[:ACTIVITY_LIMIT]
    )
    numbers = _document_numbers(movements)
    return [
        _row(
            id=mv.pk, date=mv.created_at.isoformat(), product=mv.product,
            quantity=mv.quantity, amount=mv.quantity * mv.product.cost_price,
            balance_after=_qty(mv.balance_after),
            kind_label=mv.get_movement_type_display(), note=mv.note,
            user_name=mv.user.full_name if mv.user else "",
            document=_document(mv.reference_type, mv.reference_id, numbers),
        )
        for mv in movements
    ]


def _stock_rows(warehouse: Warehouse) -> list[dict]:
    stocks = (
        Stock.objects.filter(warehouse=warehouse).exclude(quantity=0)
        .select_related("product__unit").order_by("product__name", "pk")
    )
    return [
        _row(
            id=s.pk, date=s.updated_at.isoformat(), product=s.product,
            quantity=s.quantity, amount=s.quantity * s.product.cost_price,
            balance_after=_qty(s.quantity), kind_label="Qoldiq",
        )
        for s in stocks
    ]


def _in_transit_rows(warehouse: Warehouse) -> list[dict]:
    items = (
        _in_transit_items(warehouse)
        .select_related("product__unit", "transfer__from_warehouse")
        .order_by("-transfer__date", "pk")
    )
    return [
        _row(
            id=i.pk, date=i.transfer.date.isoformat(), product=i.product,
            quantity=i.quantity, amount=i.quantity * i.cost_price,
            kind_label=f"Yo'lda · {i.transfer.from_warehouse.name}",
            note=i.transfer.note,
            document={
                "type": "transfer", "id": str(i.transfer_id),
                "label": _DOCUMENTS["transfer"][1], "number": i.transfer.number,
            },
        )
        for i in items
    ]


def branch_activity(
    warehouse: Warehouse, kind: str, start: date_cls, end: date_cls
) -> dict:
    if kind == "stock":
        rows = _stock_rows(warehouse)
    elif kind == "in_transit":
        rows = _in_transit_rows(warehouse)
    else:
        rows = _movement_rows(_movements(warehouse, kind, start, end))
    label = SPECIAL_KINDS.get(kind) or MOVEMENT_KINDS[kind][0]
    return {
        "warehouse": _warehouse_info(warehouse), "kind": kind, "label": label,
        "date_from": str(start), "date_to": str(end),
        "rows": rows, "truncated": len(rows) >= ACTIVITY_LIMIT,
    }


def _doc_text(document: dict | None) -> str:
    return f"{document['label']} {document['number']}" if document else ""


def branch_activity_rows_for_export(payload: dict) -> list[list]:
    header = ["Sana", "Mahsulot", "SKU", "Miqdor", "Birlik", "Summa (so'm)",
              "Turi", "Hujjat", "Izoh", "Kim"]
    body = [
        [
            r["date"][:10], r["product_name"], r["product_sku"], r["quantity"],
            r["unit"], r["amount"], r["movement_type"],
            _doc_text(r["document"]),
            r["note"], r["user_name"],
        ]
        for r in payload["rows"]
    ]
    return [header, *body]


# ------------------------------------------------------------------- ro'yxat


def branch_list(warehouses: QuerySet[Warehouse], today: date_cls) -> list[dict]:
    """Omborlar kartochkalari — qoldiq summasi, kelayotgan tovar, bugungi harakat."""
    items = list(warehouses.select_related("manager").order_by("is_branch", "name"))
    ids = [w.pk for w in items]
    stock = {
        row["warehouse"]: row
        for row in Stock.objects.filter(warehouse__in=ids).values("warehouse").annotate(
            total_qty=Sum("quantity"),
            total_amount=Sum(_value("quantity", "product__cost_price")),
        )
    }
    transit = dict(
        TransferItem.objects.filter(
            transfer__to_warehouse__in=ids, transfer__status=TransferStatus.SENT
        ).values("transfer__to_warehouse").annotate(q=Sum("quantity"))
        .values_list("transfer__to_warehouse", "q")
    )
    today_counts = dict(
        StockMovement.objects.filter(
            warehouse__in=ids,
            created_at__gte=business_day_range(today, today)[0],
            created_at__lt=business_day_range(today, today)[1],
        )
        .values("warehouse").annotate(c=Count("pk")).values_list("warehouse", "c")
    )
    return [
        {
            **_warehouse_info(w),
            "stock_quantity": _qty(stock.get(w.pk, {}).get("total_qty")),
            "stock_amount": _money(stock.get(w.pk, {}).get("total_amount")),
            "in_transit_quantity": _qty(transit.get(w.pk)),
            "today_movements": today_counts.get(w.pk, 0),
        }
        for w in items
    ]
