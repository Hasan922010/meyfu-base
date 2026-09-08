"""Sotuv qaytarishi — service layer (CLAUDE.md 6)."""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.core.exceptions import BusinessError
from apps.core.models import DocumentSequence
from apps.warehouse.services.van import van_apply

from ..constants import SaleStatus
from ..models import SaleItem, SaleReturn, SaleReturnItem

RETURN_PREFIX = "QYT"
_ZERO = Decimal("0")
_ACTIVE_SALE = (SaleStatus.COMPLETED, SaleStatus.FLAGGED)


@dataclass
class ReturnLine:
    product: object
    quantity: Decimal
    price: Decimal = _ZERO


@dataclass
class SaleReturnResult:
    sale_return: SaleReturn
    created: bool = True
    duplicate: bool = False


def _guard_return_quantities(*, client, sale, lines: list[ReturnLine]) -> None:
    """Qatorlarni tekshiradi: miqdor > 0 va (sotilgan − avval qaytarilgan) dan
    oshmaydi. `sale` berilgan bo'lsa — o'sha sotuv kesimida, aks holda mijoz
    bo'yicha umumiy."""
    # kerakli mahsulotlar bo'yicha jamlangan miqdor (bir mahsulot bir necha qator)
    wanted: dict = {}
    for line in lines:
        if line.quantity is None or line.quantity <= _ZERO:
            raise BusinessError(
                message="Qaytarish miqdori musbat bo'lishi kerak.",
                code="INVALID_QUANTITY",
            )
        wanted[line.product.id] = wanted.get(line.product.id, _ZERO) + line.quantity

    sold_q = SaleItem.objects.filter(
        sale__client=client, sale__status__in=_ACTIVE_SALE,
        product_id__in=wanted,
    )
    ret_q = SaleReturnItem.objects.filter(
        sale_return__client=client, product_id__in=wanted,
    )
    if sale is not None:
        sold_q = sold_q.filter(sale=sale)
        ret_q = ret_q.filter(sale_return__sale=sale)

    sold = {r["product_id"]: r["s"] for r in
            sold_q.values("product_id").annotate(s=Sum("quantity"))}
    returned = {r["product_id"]: r["s"] for r in
                ret_q.values("product_id").annotate(s=Sum("quantity"))}

    for line in lines:
        pid = line.product.id
        available = (sold.get(pid) or _ZERO) - (returned.get(pid) or _ZERO)
        if wanted[pid] > available:
            raise BusinessError(
                message=(
                    f"«{line.product.name}» — qaytarish mumkin bo'lgan miqdor "
                    f"{max(available, _ZERO)} (sotilgan minus avval qaytarilgan)."
                ),
                code="RETURN_EXCEEDS_SOLD",
                details={"product_id": str(pid), "available": str(max(available, _ZERO))},
            )


@transaction.atomic
def create_sale_return(
    *,
    distributor,
    client,
    reason: str,
    lines: list[ReturnLine],
    sale=None,
    restock: bool = True,
    date=None,
    note: str = "",
    client_uuid: str | None = None,
    device_time=None,
) -> SaleReturnResult:
    date = date or timezone.localdate()

    if client_uuid:
        existing = SaleReturn.objects.filter(client_uuid=client_uuid).first()
        if existing:
            return SaleReturnResult(sale_return=existing, created=False, duplicate=True)

    if not lines:
        raise BusinessError(message="Qaytarishda kamida bitta qator bo'lishi kerak.",
                            code="EMPTY_RETURN")

    # Har mahsulot uchun qaytariladigan miqdor sotilgandan oshmasin
    # (aks holda mashina qoldig'i "soxta" tovar bilan shishadi).
    _guard_return_quantities(client=client, sale=sale, lines=lines)

    sr = SaleReturn.objects.create(
        number=DocumentSequence.next_number(RETURN_PREFIX, year=date.year),
        date=date, distributor=distributor, client=client, sale=sale,
        reason=reason, restock=restock, note=note,
        client_uuid=client_uuid or None, device_time=device_time,
        created_by=distributor,
    )

    total = _ZERO
    items = []
    for line in lines:
        amount = line.quantity * line.price
        total += amount
        items.append(SaleReturnItem(
            sale_return=sr, product=line.product, quantity=line.quantity,
            price=line.price, amount=amount, created_by=distributor,
        ))
        if restock:
            van_apply(distributor=distributor, product=line.product,
                      quantity=line.quantity)
    SaleReturnItem.objects.bulk_create(items)

    sr.total_amount = total
    sr.save(update_fields=["total_amount", "updated_at"])
    return SaleReturnResult(sale_return=sr, created=True)
