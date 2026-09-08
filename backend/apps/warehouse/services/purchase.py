"""Tovar qabuli — service layer."""
from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from apps.core.exceptions import BusinessError
from apps.core.models import DocumentSequence

from ..constants import MovementType, PurchaseStatus
from ..models import Purchase
from .stock import apply_movement

PURCHASE_PREFIX = "KIR"


@transaction.atomic
def confirm_purchase(purchase: Purchase, user=None) -> Purchase:
    """Qabulni tasdiqlaydi: qoldiqni oshiradi, tannarxni yangilaydi.

    Idempotent emas — faqat DRAFT holatdagini tasdiqlaydi.
    """
    purchase = Purchase.objects.select_for_update().get(pk=purchase.pk)

    if purchase.status == PurchaseStatus.CONFIRMED:
        raise BusinessError(
            message="Bu qabul allaqachon tasdiqlangan.",
            code="ALREADY_CONFIRMED",
        )

    items = list(purchase.items.select_related("product", "product__unit"))
    if not items:
        raise BusinessError(
            message="Qabulda kamida bitta qator bo'lishi kerak.",
            code="EMPTY_PURCHASE",
        )

    for item in items:
        apply_movement(
            warehouse=purchase.warehouse,
            product=item.product,
            quantity=item.quantity,
            movement_type=MovementType.IN_PURCHASE,
            user=user,
            reference_type="purchase",
            reference_id=purchase.pk,
            from_location=purchase.supplier.name,
            to_location=purchase.warehouse.name,
            note=f"Qabul {purchase.number}",
        )
        _update_product_cost(item.product, item.cost_price, user)

    purchase.recalc_totals()
    purchase.status = PurchaseStatus.CONFIRMED
    purchase.confirmed_at = timezone.now()
    purchase.save(
        update_fields=[
            "status", "confirmed_at", "total_amount", "debt_amount", "updated_at"
        ]
    )
    return purchase


def _update_product_cost(product, new_cost, user) -> None:
    """Tannarx o'zgargan bo'lsa — Product.cost_price ni yangilaydi va tarixga yozadi."""
    if new_cost == product.cost_price:
        return

    from apps.catalog.models import ProductPrice

    product.cost_price = new_cost
    product.save(update_fields=["cost_price", "updated_at"])

    ProductPrice.objects.create(
        product=product,
        cost_price=product.cost_price,
        wholesale_price=product.wholesale_price,
        retail_price=product.retail_price,
        min_price=product.min_price,
        effective_from=timezone.now(),
        reason="Qabul tannarxi",
        created_by=user,
    )


def assign_number(purchase: Purchase) -> str:
    """DRAFT qabulga raqam beradi (agar bo'lmasa). atomic ichida chaqiring."""
    if not purchase.number:
        purchase.number = DocumentSequence.next_number(
            PURCHASE_PREFIX, year=purchase.date.year
        )
    return purchase.number
