"""Yuklash — service layer (CLAUDE.md 1, 5.2, 7.8).

Oqim: DRAFT → (send) SENT → (distributor confirm) CONFIRMED → (kun yopish) CLOSED.
- send:    ombor qoldig'idan band qiladi (reserve)
- confirm: bandlashni bo'shatadi, OUT_LOADING jurnal yozadi, VanStock oshiradi
"""
from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from apps.core.exceptions import BusinessError
from apps.core.models import DocumentSequence

from ..constants import LoadingStatus, MovementType
from ..models import Loading
from .stock import apply_movement, release_reservation, reserve_stock
from .van import van_apply

LOADING_PREFIX = "YK"


def assign_number(loading: Loading) -> str:
    if not loading.number:
        loading.number = DocumentSequence.next_number(
            LOADING_PREFIX, year=loading.date.year
        )
    return loading.number


@transaction.atomic
def send_loading(loading: Loading, user=None) -> Loading:
    loading = Loading.objects.select_for_update().get(pk=loading.pk)
    if loading.status != LoadingStatus.DRAFT:
        raise BusinessError(
            message="Faqat qoralama yuklamani yuborish mumkin.",
            code="INVALID_STATUS",
        )
    items = list(loading.items.select_related("product", "product__unit"))
    if not items:
        raise BusinessError(
            message="Yuklamada kamida bitta qator bo'lishi kerak.",
            code="EMPTY_LOADING",
        )

    for item in items:
        reserve_stock(
            warehouse=loading.warehouse, product=item.product, quantity=item.quantity
        )

    loading.recalc_total()
    loading.status = LoadingStatus.SENT
    loading.sent_at = timezone.now()
    loading.save(update_fields=["status", "sent_at", "total_amount", "updated_at"])
    return loading


@transaction.atomic
def confirm_loading(loading: Loading, user=None) -> Loading:
    loading = Loading.objects.select_for_update().get(pk=loading.pk)
    if loading.status != LoadingStatus.SENT:
        raise BusinessError(
            message="Faqat yuborilgan yuklamani tasdiqlash mumkin.",
            code="INVALID_STATUS",
        )

    items = list(loading.items.select_related("product", "product__unit"))
    for item in items:
        release_reservation(
            warehouse=loading.warehouse, product=item.product, quantity=item.quantity
        )
        apply_movement(
            warehouse=loading.warehouse,
            product=item.product,
            quantity=-item.quantity,
            movement_type=MovementType.OUT_LOADING,
            user=user,
            reference_type="loading",
            reference_id=loading.pk,
            from_location=loading.warehouse.name,
            to_location=f"Mashina: {loading.distributor.full_name}",
            note=f"Yuklama {loading.number}",
        )
        van_apply(
            distributor=loading.distributor,
            product=item.product,
            quantity=item.quantity,
        )

    loading.status = LoadingStatus.CONFIRMED
    loading.confirmed_at = timezone.now()
    loading.save(update_fields=["status", "confirmed_at", "updated_at"])

    from realtime.broadcast import broadcast

    payload = {
        "loading_id": str(loading.id), "number": loading.number,
        "distributor": loading.distributor.full_name,
        "total": str(loading.total_amount),
    }
    broadcast("admin_dashboard", "loading.confirmed", payload)
    broadcast(f"warehouse_{loading.warehouse_id}", "loading.confirmed", payload)
    return loading


@transaction.atomic
def cancel_loading(loading: Loading, user=None) -> Loading:
    """DRAFT — bekor qilinadi; SENT — bandlash bo'shatiladi va DRAFT ga qaytadi."""
    loading = Loading.objects.select_for_update().get(pk=loading.pk)
    if loading.status == LoadingStatus.SENT:
        for item in loading.items.all():
            release_reservation(
                warehouse=loading.warehouse,
                product=item.product,
                quantity=item.quantity,
            )
        loading.status = LoadingStatus.DRAFT
        loading.sent_at = None
        loading.save(update_fields=["status", "sent_at", "updated_at"])
        return loading

    if loading.status != LoadingStatus.DRAFT:
        raise BusinessError(
            message="Tasdiqlangan yuklamani bekor qilib bo'lmaydi.",
            code="INVALID_STATUS",
        )
    loading.delete()
    return loading
