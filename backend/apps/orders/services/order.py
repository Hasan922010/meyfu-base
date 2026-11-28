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

from apps.core.business_day import business_date
from apps.core.exceptions import BusinessError
from apps.core.formatting import fmt_money
from apps.core.models import AuditLog, DocumentSequence
from apps.notifications.services import notify
from apps.sales.services.sale import SaleLine, create_sale
from apps.warehouse.services.loading import assign_number
from realtime.broadcast import broadcast_admin

from ..constants import OPEN_STATUSES, ORDER_PREFIX, OrderStatus
from ..models import Order, OrderItem

_ZERO = Decimal("0")


@dataclass
class OrderLine:
    product: object
    quantity: Decimal
    price: Decimal
    is_bonus: bool = False


@dataclass
class OrderResult:
    order: Order
    created: bool = True
    duplicate: bool = False


def _next_number(date) -> str:
    return DocumentSequence.next_number(ORDER_PREFIX, year=date.year)


def _order_warehouse(client, taken_by=None, user=None):
    """Buyurtmaga tegishli ombor: mijoz filiali -> xodim ombori -> asosiy ombor."""
    from apps.warehouse.models import Warehouse

    if getattr(client, "branch", None) is not None:
        return client.branch
    for actor in (taken_by, user):
        wh = getattr(actor, "warehouse", None)
        if wh is not None:
            return wh
    return (
        Warehouse.objects.filter(is_branch=False, is_active=True).order_by("created_at").first()
        or Warehouse.objects.filter(is_active=True).order_by("created_at").first()
    )


def _item_warehouse(product, fallback_wh, client=None):
    """Mahsulot ombori: mijoz filiali -> mahsulotning o'z ombori -> buyurtma ombori."""
    if getattr(client, "branch", None) is not None:
        return client.branch
    product_wh = getattr(product, "warehouse", None)
    if product_wh is not None:
        return product_wh
    return fallback_wh


def _reserve_order_stock(order: Order, wh) -> None:
    if wh is None:
        return
    from apps.warehouse.models import Stock
    from apps.warehouse.services.stock import reserve_stock

    for it in order.items.select_related("product", "product__warehouse").order_by("product_id"):
        item_wh = _item_warehouse(it.product, wh, order.client)
        if item_wh is None:
            continue
        stock = (
            Stock.objects.select_for_update()
            .filter(warehouse=item_wh, product=it.product)
            .first()
        )
        if stock is not None and stock.available_quantity > _ZERO:
            to_reserve = min(it.quantity, stock.available_quantity)
            reserve_stock(warehouse=item_wh, product=it.product, quantity=to_reserve)
            it.reserved_quantity = to_reserve
            it.save(update_fields=["reserved_quantity", "updated_at"])


def _release_order_reservation(order: Order, wh) -> None:
    if wh is None:
        return
    from apps.warehouse.services.stock import release_reservation

    for it in (
        order.items.select_related("product", "product__warehouse")
        .filter(reserved_quantity__gt=_ZERO)
        .order_by("product_id")
    ):
        item_wh = _item_warehouse(it.product, wh, order.client)
        if item_wh is None:
            continue
        release_reservation(warehouse=item_wh, product=it.product, quantity=it.reserved_quantity)
        it.reserved_quantity = _ZERO
        it.save(update_fields=["reserved_quantity", "updated_at"])


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
    date = date or business_date()

    if client_uuid:
        existing = Order.objects.filter(client_uuid=client_uuid).first()
        if existing:
            return OrderResult(order=existing, created=False, duplicate=True)

    if not lines:
        raise BusinessError(
            message="Buyurtmada kamida bitta qator bo'lishi kerak.",
            code="EMPTY_ORDER",
        )

    actor = user
    if actor and not getattr(actor, "is_superuser", False):
        from apps.clients.models import is_client_off_route
        from apps.core.permissions import is_order_taker
        from apps.sales.services.sale import ensure_client_in_scope

        ensure_client_in_scope(actor, client)
        if is_client_off_route(
            actor, client, require_owner_if_unassigned=is_order_taker(actor)
        ):
            raise BusinessError(
                message=f"«{client.name}» sizning mijozingiz yoki marshrutingizda emas.",
                code="CLIENT_NOT_ON_ROUTE",
                details={"client_id": str(client.id)},
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
            is_bonus=ln.is_bonus,
            created_by=user or taken_by,
        )
        for ln in lines
    ])
    order.recalc()
    order.save(update_fields=["total_amount", "updated_at"])
    _reserve_order_stock(order, _order_warehouse(client, taken_by, user))

    AuditLog.objects.create(
        user=user or taken_by, action="order.created", model_name="Order",
        object_id=str(order.id),
        changes={"number": order.number, "client": client.name,
                 "total": str(order.total_amount), "placed": place},
    )
    broadcast_admin(order.client.branch_id, "order.placed" if place else "order.created", {
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
    broadcast_admin(order.client.branch_id, "order.placed", {
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
        body=f"{order.number} · {order.client.name} · {fmt_money(order.total_amount)}",
        data={"order_id": str(order.id)},
    )
    broadcast_admin(order.client.branch_id, "order.approved", {
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
    _release_order_reservation(order, _order_warehouse(order.client, order.taken_by, user))
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

    date = date or business_date()
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
        .annotate(qty=Sum("quantity"), total_amount=Sum("amount"))
    )
    from apps.catalog.models import Product
    from apps.catalog.pricing import branch_price_map, price_for
    from apps.core.branch import staff_branch

    products = {p.id: p for p in Product.objects.filter(
        id__in=[r["product_id"] for r in rows]
    )}
    branch = staff_branch(distributor)
    price_map = branch_price_map(branch, products)
    for row in rows:
        product = products[row["product_id"]]
        qty = row["qty"]
        order_amount = row["total_amount"]
        # Mijoz bilan kelishilgan buyurtmadagi narx
        if qty and order_amount:
            price = (order_amount / qty).quantize(Decimal("0.01"))
            amount = order_amount
        else:
            price = price_for(product, branch, price_map).wholesale_price or product.cost_price
            amount = qty * price
        LoadingItem.objects.create(
            loading=loading, product=product, quantity=qty,
            price=price, amount=amount,
        )
    loading.recalc_total()
    loading.save(update_fields=["number", "total_amount", "updated_at"])

    for order in orders:
        _release_order_reservation(order, _order_warehouse(order.client, order.taken_by, user))
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
    _guard(order, (OrderStatus.APPROVED, OrderStatus.LOADED, OrderStatus.PARTIALLY_DELIVERED), "yetkazish")

    distributor = distributor or order.assigned_to
    if distributor is None:
        raise BusinessError(
            message="Yetkazuvchi belgilanmagan.", code="NO_DISTRIBUTOR",
        )
    # Boshqa yetkazuvchiga biriktirilgan buyurtmani yetkazib bo'lmaydi (SEC-108)
    if order.assigned_to_id not in (None, distributor.pk):
        raise BusinessError(
            message="Bu buyurtma boshqa yetkazuvchiga biriktirilgan.",
            code="ORDER_NOT_ASSIGNED",
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
    pending: list[tuple[OrderItem, Decimal]] = []
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
        sale_lines.append(
            SaleLine(
                product=item.product,
                quantity=qty,
                price=price,
                is_bonus=item.is_bonus,
            )
        )
        pending.append((item, qty))

    if not sale_lines:
        raise BusinessError(
            message="Yetkazilgan miqdor kiritilmadi.", code="NOTHING_DELIVERED",
        )

    result = create_sale(
        distributor=distributor,
        client=order.client,
        payment_type=payment_type,
        lines=sale_lines,
        date=business_date(),
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

    from apps.sales.constants import SaleStatus

    if result.sale.status == SaleStatus.CONFLICT:
        AuditLog.objects.create(
            user=user or distributor, action="order.fulfill_conflict", model_name="Order",
            object_id=str(order.id),
            changes={"number": order.number, "sale": result.sale.number,
                     "sale_id": str(result.sale.id)},
        )
        return result

    for item, qty in pending:
        item.delivered_quantity = (item.delivered_quantity or _ZERO) + qty
        fields = ["delivered_quantity", "updated_at"]
        if order.loading_id is None and item.reserved_quantity > _ZERO:
            from apps.warehouse.services.stock import release_reservation

            rel = min(qty, item.reserved_quantity)
            wh = _order_warehouse(order.client, order.taken_by, user)
            if wh is not None and rel > _ZERO:
                release_reservation(warehouse=wh, product=item.product, quantity=rel)
                item.reserved_quantity -= rel
                fields.append("reserved_quantity")
        item.save(update_fields=fields)

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
    broadcast_admin(order.client.branch_id, event, {
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


@transaction.atomic
def give_order_on_debt(order: Order, *, user=None) -> Order:
    """Buyurtmani mijozga qarzga berish: ombordan chiqim, Sale/SaleItem va avans/qarz yozadi."""
    from datetime import timedelta

    from django.db.models import F

    from apps.clients.models import Client
    from apps.sales.constants import DebtStatus, PaymentType, SaleStatus
    from apps.sales.models import Debt, Sale, SaleItem
    from apps.sales.services.sale import _next_number as _next_sale_number
    from apps.sales.services.sale import ensure_client_in_scope
    from apps.warehouse.constants import MovementType
    from apps.warehouse.services.stock import apply_movement

    if user is not None and hasattr(user, "has_app_permission") and not user.has_app_permission("can_sell_on_debt"):
        raise BusinessError(
            message="Sizda qarzga (nasiyaga) tovar berish huquqi yo'q.",
            code="DEBT_SALE_FORBIDDEN",
            status_code=403,
        )

    order = Order.objects.select_for_update().get(pk=order.pk)
    _guard(
        order,
        (
            OrderStatus.DRAFT,
            OrderStatus.PLACED,
            OrderStatus.APPROVED,
            OrderStatus.LOADED,
            OrderStatus.PARTIALLY_DELIVERED,
        ),
        "berish",
    )
    if order.total_amount <= _ZERO:
        raise BusinessError(
            message="Buyurtma summasi musbat bo'lishi kerak.",
            code="INVALID_AMOUNT",
        )

    client = Client.objects.select_for_update().get(pk=order.client_id)
    if user is not None:
        ensure_client_in_scope(user, client)
    if client.is_blocked:
        raise BusinessError(
            message=f"«{client.name}» bloklangan — qarzga berib bo'lmaydi.",
            code="CLIENT_BLOCKED",
        )

    order_items = list(
        order.items.select_related("product", "product__warehouse").order_by("product_id")
    )
    remaining_items: list[tuple[OrderItem, Decimal]] = []
    for it in order_items:
        rem = it.quantity - (it.delivered_quantity or _ZERO)
        if rem > _ZERO:
            remaining_items.append((it, rem))
    if not remaining_items:
        raise BusinessError(
            message="Yetkaziladigan tovar qolmagan.",
            code="NOTHING_DELIVERED",
        )

    # Agar buyurtma tasdiqlangan yuklamaga biriktirilgan bo'lsa, tovarlar tarqatuvchi
    # mashinasida (VanStock) turadi — o'sha yerdan qarzga sotuv yaratib yakunlaymiz.
    if order.loading_id is not None:
        from apps.warehouse.constants import LoadingStatus

        loading = order.loading
        if loading.status == LoadingStatus.SENT:
            raise BusinessError(
                message="Buyurtma yuborilgan yuklamada — avval yuklamani tasdiqlang.",
                code="LOADING_NOT_CONFIRMED",
            )
        if loading.status == LoadingStatus.CONFIRMED:
            distributor = order.assigned_to or loading.distributor or user
            fulfill_lines = [
                FulfillLine(item=it, delivered_quantity=rem, price=it.price)
                for it, rem in remaining_items
            ]
            fulfill_order(
                order,
                fulfill_lines,
                distributor=distributor,
                payment_type=PaymentType.DEBT,
                due_date=order.desired_date or (business_date() + timedelta(days=14)),
                note=f"Buyurtma {order.number}",
                user=user,
            )
            order.refresh_from_db()
            return order

    wh = _order_warehouse(client, order.taken_by, user)
    if wh is None:
        raise BusinessError(
            message="Buyurtmani berish uchun ombor topilmadi.",
            code="WAREHOUSE_REQUIRED",
        )
    _release_order_reservation(order, wh)
    for it, rem in remaining_items:
        item_wh = _item_warehouse(it.product, wh, client)
        apply_movement(
            warehouse=item_wh,
            product=it.product,
            quantity=-rem,
            movement_type=MovementType.OUT_SALE,
            user=user,
            reference_type="order",
            reference_id=str(order.id),
            from_location=item_wh.name,
            to_location=client.name,
            note=f"Buyurtma {order.number}",
        )

    remaining_total = sum((rem * it.price for it, rem in remaining_items), _ZERO)
    advance_used = min(max(_ZERO, client.advance_balance), remaining_total)
    debt_amount = max(_ZERO, remaining_total - advance_used)
    if debt_amount > _ZERO and client.debt_limit > _ZERO:
        projected = client.current_debt + debt_amount
        if projected > client.debt_limit:
            raise BusinessError(
                message=(
                    f"«{client.name}» qarz limiti oshib ketadi "
                    f"({projected} > {client.debt_limit})."
                ),
                code="DEBT_LIMIT_EXCEEDED",
                details={
                    "current": str(client.current_debt),
                    "limit": str(client.debt_limit),
                    "requested": str(debt_amount),
                },
            )

    today = business_date()
    due_date = order.desired_date or (today + timedelta(days=14))
    seller = user or order.taken_by
    sale = Sale(
        number=_next_sale_number(today),
        date=today,
        distributor=seller,
        client=client,
        order=order,
        branch=wh if wh.is_branch else None,
        payment_type=PaymentType.DEBT,
        total_amount=remaining_total,
        paid_amount=_ZERO,
        advance_used=advance_used,
        debt_amount=debt_amount,
        due_date=due_date,
        status=SaleStatus.COMPLETED,
        is_synced=True,
        note=f"Buyurtma {order.number}",
        created_by=seller,
    )
    sale.save()

    sale_items: list[SaleItem] = []
    for it, rem in remaining_items:
        si = SaleItem(
            sale=sale,
            product=it.product,
            quantity=rem,
            price=it.price,
            cost_price=it.product.cost_price,
            is_bonus=it.is_bonus,
            created_by=seller,
        )
        si.compute()
        sale_items.append(si)
    SaleItem.objects.bulk_create(sale_items)
    sale.recalc()
    sale.save(update_fields=["total_amount", "updated_at"])

    if advance_used > _ZERO:
        Client.objects.filter(pk=client.pk).update(
            advance_balance=F("advance_balance") - advance_used
        )
    if debt_amount > _ZERO:
        Debt.objects.create(
            client=client,
            sale=sale,
            amount=debt_amount,
            remaining=debt_amount,
            due_date=due_date,
            status=DebtStatus.ACTIVE,
            created_by=user,
        )
        Client.objects.filter(pk=client.pk).update(
            current_debt=F("current_debt") + debt_amount
        )
    order.items.update(delivered_quantity=F("quantity"))
    order.status = OrderStatus.DELIVERED
    order.save(update_fields=["status", "updated_at"])
    AuditLog.objects.create(
        user=user,
        action="order.given_on_debt",
        model_name="Order",
        object_id=str(order.id),
        changes={
            "number": order.number,
            "sale": sale.number,
            "amount": str(order.total_amount),
            "advance_used": str(advance_used),
            "debt_amount": str(debt_amount),
            "client": str(order.client_id),
        },
    )
    return order
