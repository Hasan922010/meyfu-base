"""Naklit skani orkestratori (CLAUDE.md 9)."""
from __future__ import annotations

import hashlib
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from django.utils.dateparse import parse_date

from apps.core.exceptions import BusinessError
from apps.warehouse.services.purchase import confirm_purchase

from ..constants import MatchStatus, ScanStatus
from ..models import InvoiceScan, InvoiceScanLine
from .matching import learn_alias, match_line
from .preprocess import preprocess_image
from .providers import get_provider

_ZERO = Decimal("0")


def image_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _dec(value, default=None):
    try:
        s = str(value).replace(" ", "").replace(",", ".")
        return Decimal(s) if s not in ("", "None") else default
    except (InvalidOperation, TypeError):
        return default


def cost_used(*, days: int = 1) -> Decimal:
    since = timezone.now() - timezone.timedelta(days=days)
    return InvoiceScan.objects.filter(created_at__gte=since).aggregate(
        s=Sum("cost_usd")
    )["s"] or _ZERO


def check_cost_limit() -> str | None:
    """Limit oshgan bo'lsa sabab qaytaradi (aks holda None)."""
    if cost_used(days=1) >= Decimal(str(settings.OCR_DAILY_COST_LIMIT_USD)):
        return "DAILY_LIMIT"
    if cost_used(days=30) >= Decimal(str(settings.OCR_MONTHLY_COST_LIMIT_USD)):
        return "MONTHLY_LIMIT"
    return None


@transaction.atomic
def process_scan(scan_id: str) -> InvoiceScan:
    scan = InvoiceScan.objects.select_for_update().get(pk=scan_id)
    if scan.status not in (ScanStatus.UPLOADED, ScanStatus.FAILED):
        return scan

    scan.status = ScanStatus.PROCESSING
    scan.save(update_fields=["status", "updated_at"])

    pages = list(scan.pages.order_by("page_number"))
    if not pages:
        return _fail(scan, "Rasm yo'q")

    # rasm hash — dublikat bo'lsa keshdan
    first_bytes = pages[0].image.read()
    pages[0].image.seek(0)
    h = image_hash(first_bytes)
    scan.image_hash = h
    cached = (
        InvoiceScan.objects.filter(
            image_hash=h, status=ScanStatus.CONFIRMED
        ).exclude(pk=scan.pk).order_by("-created_at").first()
    )
    if cached and cached.ai_response:
        return _apply_ai(scan, cached.ai_response, from_cache=True)

    limit = check_cost_limit()
    if limit:
        return _fail(scan, f"OCR xarajat limiti: {limit}", notify=True)

    processed_bytes = []
    for page in pages:
        raw = page.image.read()
        page.image.seek(0)
        pre = preprocess_image(raw)
        processed_bytes.append(pre)

    provider = get_provider()
    result = provider.extract(processed_bytes)

    scan.provider = result.provider
    scan.tokens_used = result.tokens_used
    scan.cost_usd = result.cost_usd
    scan.processing_time_ms = result.processing_time_ms
    scan.raw_text = result.raw_text

    if result.error:
        return _fail(scan, result.error)

    return _apply_ai(scan, result.ai_response)


def _apply_ai(scan: InvoiceScan, ai: dict, *, from_cache: bool = False) -> InvoiceScan:
    scan.ai_response = ai
    scan.detected_supplier_name = str(ai.get("supplier") or "")
    scan.detected_invoice_number = str(ai.get("invoice_number") or "")
    scan.detected_date = (
        parse_date(str(ai["date"])) if ai.get("date") else None
    )
    scan.detected_total = _dec(ai.get("total"))
    scan.confidence = _dec(ai.get("confidence"), _ZERO) or _ZERO

    scan.lines.all().delete()
    lines = []
    low_threshold = Decimal("0.75")
    for i, item in enumerate(ai.get("items") or [], start=1):
        raw_name = str(item.get("name") or "")
        qty = _dec(item.get("quantity"))
        price = _dec(item.get("price"))
        product, conf, mstatus = match_line(
            raw_name, supplier_id=scan.supplier_id
        )
        low = (
            scan.confidence < low_threshold
            or mstatus in (MatchStatus.FUZZY, MatchStatus.NEW, MatchStatus.UNMATCHED)
            or qty is None or price is None
        )
        lines.append(InvoiceScanLine(
            scan=scan, line_number=i,
            raw_name=raw_name,
            raw_quantity=str(item.get("quantity") or ""),
            raw_unit=str(item.get("unit") or ""),
            raw_price=str(item.get("price") or ""),
            raw_amount=str(item.get("amount") or ""),
            matched_product=product,
            match_confidence=conf,
            match_status=mstatus,
            final_product=product if mstatus == MatchStatus.EXACT else None,
            final_quantity=qty,
            final_price=price,
            low_confidence=low,
            created_by=scan.uploaded_by,
        ))
    InvoiceScanLine.objects.bulk_create(lines)

    scan.status = ScanStatus.NEEDS_REVIEW
    scan.error_message = ""
    scan.save()
    _broadcast(scan, "invoice_scan.completed")
    return scan


def _fail(scan: InvoiceScan, message: str, *, notify: bool = False) -> InvoiceScan:
    scan.status = ScanStatus.FAILED
    scan.error_message = message[:500]
    scan.save(update_fields=["status", "error_message", "provider", "tokens_used",
                             "cost_usd", "processing_time_ms", "raw_text",
                             "image_hash", "updated_at"])
    _broadcast(scan, "invoice_scan.failed")
    if notify:
        try:
            from apps.notifications.services import notify_admins

            notify_admins(
                type="general", title="OCR xarajat limiti oshdi",
                body=message,
            )
        except Exception:  # noqa: BLE001
            pass
    return scan


def _broadcast(scan: InvoiceScan, event: str) -> None:
    try:
        from realtime.broadcast import broadcast

        payload = {"scan_id": str(scan.id), "status": scan.status,
                   "number": scan.detected_invoice_number}
        broadcast(f"user_{scan.uploaded_by_id}", event, payload)
        broadcast(f"warehouse_{scan.warehouse_id}", event, payload)
        broadcast("admin_dashboard", event, payload)
    except Exception:  # noqa: BLE001
        pass


@transaction.atomic
def confirm_scan(scan_id: str, user=None) -> InvoiceScan:
    from datetime import date as date_cls

    from apps.warehouse.models import Purchase, PurchaseItem
    from apps.warehouse.services.purchase import assign_number

    scan = InvoiceScan.objects.select_for_update().get(pk=scan_id)
    if scan.status == ScanStatus.CONFIRMED:
        raise BusinessError(message="Skan allaqachon tasdiqlangan.",
                            code="ALREADY_CONFIRMED")
    if scan.status != ScanStatus.NEEDS_REVIEW:
        raise BusinessError(message="Skan tekshiruv holatida emas.",
                            code="INVALID_STATUS")
    if scan.supplier_id is None:
        raise BusinessError(message="Yetkazib beruvchi tanlanmagan.",
                            code="SUPPLIER_REQUIRED")

    usable = [
        ln for ln in scan.lines.select_related("final_product")
        if ln.final_product_id and ln.final_quantity and ln.final_price is not None
    ]
    if not usable:
        raise BusinessError(
            message="Tasdiqlash uchun kamida bitta to'liq qator kerak "
                    "(mahsulot + miqdor + narx).",
            code="NO_USABLE_LINES",
        )

    purchase = Purchase(
        supplier=scan.supplier, warehouse=scan.warehouse,
        invoice_number=scan.detected_invoice_number,
        date=scan.detected_date or date_cls.today(),
        source="SCAN", created_by=user,
    )
    assign_number(purchase)
    purchase.save()

    for ln in usable:
        PurchaseItem.objects.create(
            purchase=purchase, product=ln.final_product,
            quantity=ln.final_quantity, cost_price=ln.final_price,
            amount=ln.final_quantity * ln.final_price, created_by=user,
        )
        ln.is_confirmed = True
        ln.save(update_fields=["is_confirmed", "updated_at"])
        # tizim o'rganadi (9.7)
        if ln.raw_name and (
            ln.was_corrected or ln.match_status != MatchStatus.EXACT
        ):
            learn_alias(ln.final_product, ln.raw_name, supplier=scan.supplier)

    purchase.recalc_totals()
    purchase.save(update_fields=["total_amount", "debt_amount", "updated_at"])
    confirm_purchase(purchase, user=user)

    scan.purchase = purchase
    scan.status = ScanStatus.CONFIRMED
    scan.confirmed_at = timezone.now()
    scan.save(update_fields=["purchase", "status", "confirmed_at", "updated_at"])
    return scan
