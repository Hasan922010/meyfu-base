"""Mahsulot rasmlari — yuklash, siqish, asosiy rasm sinxronizatsiyasi (v4 T2).

- Katta rasm max 1600px, JPEG q≈82.
- Eskiz (thumbnail) max 320px, JPEG q≈78.
- `is_primary` rasm `Product.image` bilan sinxronlanadi (eski kod shu maydonni
  ishlatadi). Asosiy rasm o'chirilsa — keyingisi (sort_order) asosiy bo'ladi.
"""
from __future__ import annotations

import io

from django.core.files.base import ContentFile
from django.db import transaction
from PIL import Image, ImageOps

from apps.core.exceptions import BusinessError

from ..models import Product, ProductImage

_MAX_MAIN = 1600
_MAX_THUMB = 320
_MAX_UPLOAD_BYTES = 15 * 1024 * 1024


def _encode(img: Image.Image, max_side: int, quality: int) -> ContentFile:
    work = ImageOps.exif_transpose(img)
    if work.mode not in ("RGB", "L"):
        work = work.convert("RGB")
    work.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    work.save(buf, format="JPEG", quality=quality, optimize=True)
    return ContentFile(buf.getvalue())


def _process(upload) -> tuple[ContentFile, ContentFile]:
    if upload.size and upload.size > _MAX_UPLOAD_BYTES:
        raise BusinessError(
            message="Rasm hajmi 15 MB dan katta.", code="IMAGE_TOO_LARGE",
            status_code=400,
        )
    try:
        upload.seek(0)
        with Image.open(upload) as img:
            img.load()
            main = _encode(img, _MAX_MAIN, 82)
            upload.seek(0)
        with Image.open(upload) as img2:
            thumb = _encode(img2, _MAX_THUMB, 78)
    except BusinessError:
        raise
    except Exception as exc:  # noqa: BLE001 — Pillow turli xatolar beradi
        raise BusinessError(
            message="Faylni rasm sifatida o'qib bo'lmadi.", code="BAD_IMAGE",
            status_code=400,
        ) from exc
    return main, thumb


def _sync_primary(product: Product) -> None:
    """`Product.image` ni joriy asosiy rasmga tenglashtiradi."""
    primary = product.images.filter(is_primary=True).first()
    new_name = primary.image.name if primary else ""
    if (product.image.name or "") != (new_name or ""):
        Product.objects.filter(pk=product.pk).update(image=new_name or None)


@transaction.atomic
def add_product_images(
    product: Product, uploads: list, *, user=None
) -> list[ProductImage]:
    if not uploads:
        raise BusinessError(message="Rasm tanlanmadi.", code="NO_IMAGE")

    has_primary = product.images.filter(is_primary=True).exists()
    start = (
        product.images.order_by("-sort_order")
        .values_list("sort_order", flat=True)
        .first()
        or 0
    )
    created: list[ProductImage] = []
    for offset, upload in enumerate(uploads, start=1):
        main, thumb = _process(upload)
        stem = f"{product.sku}-{product.images.count() + offset}"
        obj = ProductImage(
            product=product,
            sort_order=start + offset,
            is_primary=not has_primary and offset == 1,
            created_by=user,
        )
        obj.image.save(f"{stem}.jpg", main, save=False)
        obj.thumbnail.save(f"{stem}-t.jpg", thumb, save=False)
        obj.save()
        created.append(obj)

    _sync_primary(product)
    return created


@transaction.atomic
def set_primary_image(image: ProductImage, *, user=None) -> ProductImage:
    image.product.images.exclude(pk=image.pk).filter(is_primary=True).update(
        is_primary=False
    )
    if not image.is_primary:
        image.is_primary = True
        image.save(update_fields=["is_primary", "updated_at"])
    _sync_primary(image.product)
    return image


@transaction.atomic
def delete_product_image(image: ProductImage, *, user=None) -> None:
    product = image.product
    was_primary = image.is_primary
    image.delete()  # soft delete
    if was_primary:
        nxt = product.images.filter(is_primary=False).order_by("sort_order").first()
        if nxt:
            nxt.is_primary = True
            nxt.save(update_fields=["is_primary", "updated_at"])
    _sync_primary(product)


@transaction.atomic
def reorder_product_images(
    image: ProductImage, sort_order: int, *, user=None
) -> ProductImage:
    image.sort_order = max(0, int(sort_order))
    image.save(update_fields=["sort_order", "updated_at"])
    return image
