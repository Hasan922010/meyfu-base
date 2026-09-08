"""Buyurtma (zakaz) — service layer (v4 T1).

Statuslar: DRAFT → PLACED → APPROVED → LOADED → DELIVERED|PARTIALLY_DELIVERED,
istalgan ochiq holatdan → CANCELLED.

Buyurtma — bu va'da: narx/qoldiq tekshiruvi yumshoq (qoldiq keyin bo'lishi mumkin).
Yetkazishda (`fulfill_order`) haqiqiy `sales.Sale` yaratiladi va o'sha yerda barcha
qattiq biznes qoidalari (VanStock, qarz limiti, minimal narx) qo'llanadi.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.core.exceptions import BusinessError
from apps.core.models import AuditLog, DocumentSequence
from apps.notifications.services import notify
from apps.sales.services.sale import SaleLine, create_sale
from apps.warehouse.services.loading import assign_number
from realtime.broadcast import broadcast

from ..constants import OPEN_STATUSES, ORDER_PREFIX, OrderStatus
from ..models import Order, OrderItem

_ZERO = Decimal("0")


@dataclass
class OrderLine:
    product: object
    quantity: Decimal
    price: Decimal


@dataclass
class OrderResult:
    order: Order
    created: bool = True
    duplicate: bool = False


def _next_number(date) -> str:
    return DocumentSequence.next_number(ORDER_PREFIX, year=date.year)


@transaction.atomic
def create_order(
    *,
    client,
    taken_by,
    lines: list[OrderLine],
    date=None,
    payment_intent: str = "",
    desired_date=None,
    note: str = "",
    client_uuid: str | None = None,
    device_time=None,
    place: bool = False,
    user=None,
) -> OrderResult:
    date = date or timezone.localdate()

    if client_uuid:
        existing = Order.objects.filter(client_uuid=client_uuid).first()
        if existing:
            return OrderResult(order=existing, created=False, duplicate=True)

    if not lines:
        raise BusinessError(
            message="Buyurtmada kamida bitta qator bo'lishi kerak.",
            code="EMPTY_ORDER",
        )

    order = Order(
        number=_next_number(date),
        date=date,
        client=client,
        taken_by=taken_by,
        status=OrderStatus.PLACED if place else OrderStatus.DRAFT,
        payment_intent=payment_intent or "",
        desired_date=desired_date,
        note=note,
        client_uuid=client_uuid or None,
        device_time=device_time,
        created_by=user or taken_by,
    )
    order.save()

    OrderItem.objects.bulk_create([
        OrderItem(
            order=order, product=ln.product, quantity=ln.quantity,
            price=ln.price, amount=(ln.quantity or _ZERO) * (ln.price or _ZERO),
            created_by=user or taken_by,
        )
        for ln in lines
    ])
    order.recalc()
    order.save(update_fields=["total_amount", "updated_at"])

    AuditLog.objects.create(
        user=user or taken_by, action="order.created", model_name="Order",
        object_id=str(order.id),
        changes={"number": order.number, "client": client.name,
                 "total": str(order.total_amount), "placed": place},
    )
    broadcast("admin_dashboard", "order.placed" if place else "order.created", {
        "order_id": str(order.id), "number": order.number,
        "client": client.name, "taken_by": taken_by.full_name,
        "total": str(order.total_amount), "status": order.status,
    })
    return OrderResult(order=order, created=True)


def _guard(order: Order, allowed: tuple[str, ...], action: str) -> None:
    if order.status not in allowed:
        raise BusinessError(
            message=f"«{order.number}» holati «{order.get_status_display()}» — "
                    f"{action} mumkin emas.",
            code="INVALID_ORDER_STATE",
            details={"status": order.status},
        )


@transaction.atomic
def place_order(order: Order, *, user=None) -> Order:
    order = Order.objects.select_for_update().get(pk=order.pk)
    _guard(order, (OrderStatus.DRAFT,), "berish")
    order.status = OrderStatus.PLACED
    order.save(update_fields=["status", "updated_at"])
    AuditLog.objects.create(
        user=user, action="order.placed", model_name="Order",
        object_id=str(order.id), changes={"number": order.number},
    )
    broadcast("admin_dashboard", "order.placed", {
        "order_id": str(order.id), "number": order.number,
    })
    return order


@transaction.atomic
def approve_order(order: Order, *, user=None) -> Order:
    order = Order.objects.select_for_update().get(pk=order.pk)
    _guard(order, (OrderStatus.DRAFT, OrderStatus.PLACED), "tasdiqlash")
    order.status = OrderStatus.APPROVED
    order.save(update_fields=["status", "updated_at"])
    AuditLog.objects.create(
        user=user, action="order.approved", model_name="Order",
        object_id=str(order.id), changes={"number": order.number},
    )
    notify(
        order.taken_by, type="order.approved",
        title="Buyurtma tasdiqlandi",
        body=f"{order.number} · {order.client.name} · {order.total_amount} so'm",
        data={"order_id": str(order.id)},
    )
    broadcast("admin_dashboard", "order.approved", {
        "order_id": str(order.id), "number": order.number,
    })
    return order


@transaction.atomic
def cancel_order(order: Order, *, user=None, reason: str = "") -> Order:
    order = Order.objects.select_for_update().get(pk=order.pk)
    _guard(order, OPEN_STATUSES, "bekor qilish")
    if order.sales.exclude(status="CANCELLED").exists():
        raise BusinessError(
            message="Buyurtma bo'yicha sotuv bor — avval sotuvni bekor qiling.",
            code="ORDER_HAS_SALES",
        )
    order.status = OrderStatus.CANCELLED
    order.cancelled_at = timezone.now()
    order.cancel_reason = reason
    order.save(update_fields=["status", "cancelled_at", "cancel_reason", "updated_at"])
    AuditLog.objects.create(
        user=user, action="order.cancelled", model_name="Order",
        object_id=str(order.id), changes={"number": order.number, "reason": reason},
    )
    return order


@transaction.atomic
def attach_to_loading(order: Order, loading, *, user=None) -> Order:
    order = Order.objects.select_for_update().get(pk=order.pk)
    _guard(order, (OrderStatus.APPROVED,), "yuklamaga olish")
    order.loading = loading
    order.assigned_to = loading.distributor
    order.status = OrderStatus.LOADED
    order.save(update_fields=["loading", "assigned_to", "status", "updated_at"])
    AuditLog.objects.create(
        user=user, action="order.loaded", model_name="Order",
        object_id=str(order.id),
        changes={"number": order.number, "loading": str(loading.pk),
                 "distributor": loading.distributor.full_name},
    )
    notify(
        loading.distributor, type="order.loaded",
        title="Yangi buyurtma yetkazishga",
        body=f"{order.number} · {order.client.name}",
        data={"order_id": str(order.id)},
    )
    return order


@transaction.atomic
def build_loading_from_orders(
    *, distributor, warehouse, orders: list[Order], date=None, user=None
):
    """APPROVED buyurtmalardan bitta DRAFT `warehouse.Loading` yig'adi.

    Miqdorlar mahsulot bo'yicha jamlanadi. Yuklama keyin oddiy oqim bilan
    (send → confirm) yuboriladi. Har buyurtma LOADED holatga o'tadi.
    """
    from django.db.models import Sum

    from apps.warehouse.models import Loading, LoadingItem

    date = date or timezone.localdate()
    if not orders:
        raise BusinessError(message="Buyurtma tanlanmadi.", code="NO_ORDERS")
    for order in orders:
        if order.status != OrderStatus.APPROVED:
            raise BusinessError(
                message=f"«{order.number}» tasdiqlanmagan — yuklamaga qo'shib bo'lmaydi.",
                code="ORDER_NOT_APPROVED",
            )

    loading = Loading.objects.create(
        date=date, distributor=distributor, warehouse=warehouse,
        created_by=user,
    )
    assign_number(loading)

    order_ids = [o.pk for o in orders]
    rows = (
        OrderItem.objects.filter(order_id__in=order_ids)
        .values("product_id")
        .annotate(qty=Sum("quantity"))
    )
    from apps.catalog.models import Product

    products = {p.id: p for p in Product.objects.filter(
        id__in=[r["product_id"] for r in rows]
    )}
    for row in rows:
        product = products[row["product_id"]]
        LoadingItem.objects.create(
            loading=loading, product=product, quantity=row["qty"],
            price=product.wholesale_price,
            amount=row["qty"] * product.wholesale_price,
        )
    loading.recalc_total()
    loading.save(update_fields=["number", "total_amount", "updated_at"])

    for order in orders:
        attach_to_loading(order, loading, user=user)

    AuditLog.objects.create(
        user=user, action="loading.built_from_orders", model_name="Loading",
        object_id=str(loading.id),
        changes={"loading": loading.number, "orders": [o.number for o in orders]},
    )
    return loading


@dataclass
class FulfillLine:
    item: OrderItem
    delivered_quantity: Decimal
    price: Decimal | None = None


@transaction.atomic
def fulfill_order(
    order: Order,
    fulfill_lines: list[FulfillLine],
    *,
    distributor=None,
    payment_type: str | None = None,
    paid_amount: Decimal | None = None,
    due_date=None,
    latitude=None,
    longitude=None,
    note: str = "",
    client_uuid: str | None = None,
    device_time=None,
    strict: bool = True,
    user=None,
):
    """Buyurtmani yetkazadi: `sales.Sale` yaratadi, yetkazilgan miqdorlarni yozadi.

    `sales.services.create_sale` barcha qattiq qoidalarni qo'llaydi (VanStock, narx,
    qarz limiti) — bu yerda ularni takrorlamaymiz.
    """
    # 7.9 — idempotentlik: shu client_uuid bilan sotuv allaqachon bo'lsa qaytaramiz
    if client_uuid:
        from apps.sales.models import Sale
        from apps.sales.services.sale import SaleResult

        existing = Sale.objects.filter(client_uuid=client_uuid).first()
        if existing:
            return SaleResult(sale=existing, created=False, duplicate=True)

    order = Order.objects.select_for_update().get(pk=order.pk)
    _guard(order, (OrderStatus.APPROVED, OrderStatus.LOADED), "yetkazish")

    distributor = distributor or order.assigned_to
    if distributor is None:
        raise BusinessError(
            message="Yetkazuvchi belgilanmagan.", code="NO_DISTRIBUTOR",
        )
    payment_type = payment_type or order.payment_intent
    if not payment_type:
        raise BusinessError(
            message="To'lov turi ko'rsatilmagan.", code="NO_PAYMENT_TYPE",
        )
    # Yetkazuvchi belgilanmagan bo'lsa — haqiqatda yetkazgan odam (hisobot uchun)
    if order.assigned_to_id is None:
        order.assigned_to = distributor

    items_by_id = {str(it.id): it for it in order.items.select_related("product")}
    sale_lines: list[SaleLine] = []
    touched: list[OrderItem] = []
    for fl in fulfill_lines:
        item = items_by_id.get(str(fl.item.id if isinstance(fl.item, OrderItem)
                                   else fl.item))
        if item is None:
            raise BusinessError(
                message="Buyurtma qatori topilmadi.", code="ORDER_LINE_NOT_FOUND",
            )
        qty = Decimal(fl.delivered_quantity or 0)
        if qty <= _ZERO:
            continue
        price = Decimal(fl.price) if fl.price is not None else item.price
        sale_lines.append(SaleLine(product=item.product, quantity=qty, price=price))
        item.delivered_quantity = (item.delivered_quantity or _ZERO) + qty
        touched.append(item)

    if not sale_lines:
        raise BusinessError(
            message="Yetkazilgan miqdor kiritilmadi.", code="NOTHING_DELIVERED",
        )

    result = create_sale(
        distributor=distributor,
        client=order.client,
        payment_type=payment_type,
        lines=sale_lines,
        date=timezone.localdate(),
        paid_amount=paid_amount,
        due_date=due_date or order.desired_date,
        latitude=latitude,
        longitude=longitude,
        note=note,
        client_uuid=client_uuid,
        device_time=device_time,
        strict=strict,
        order=order,
    )

    for item in touched:
        item.save(update_fields=["delivered_quantity", "updated_at"])

    fully = all(
        (it.delivered_quantity or _ZERO) >= it.quantity for it in order.items.all()
    )
    order.status = (
        OrderStatus.DELIVERED if fully else OrderStatus.PARTIALLY_DELIVERED
    )
    order.save(update_fields=["status", "assigned_to", "updated_at"])

    AuditLog.objects.create(
        user=user or distributor, action="order.delivered", model_name="Order",
        object_id=str(order.id),
        changes={"number": order.number, "sale": result.sale.number,
                 "status": order.status},
    )
    event = ("order.delivered" if order.status == OrderStatus.DELIVERED
             else "order.partially_delivered")
    broadcast("admin_dashboard", event, {
        "order_id": str(order.id), "number": order.number,
        "sale": result.sale.number, "status": order.status,
    })
    if order.taken_by_id != distributor.id:
        notify(
            order.taken_by, type=event,
            title="Buyurtmangiz yetkazildi"
            if order.status == OrderStatus.DELIVERED else "Buyurtma qisman yetkazildi",
            body=f"{order.number} · {order.client.name}",
            data={"order_id": str(order.id), "sale_id": str(result.sale.id)},
        )
    return result
