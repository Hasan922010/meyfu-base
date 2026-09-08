"""v4 T2 — mahsulot rasmlari galereyasi.

Qamrov: yuklash + eskiz, birinchi rasm avtomatik asosiy, asosiyni almashtirish,
yagona-asosiy constraint, asosiy rasm o'chirilsa keyingisi ko'tariladi, rol.
"""
from __future__ import annotations

import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from apps.catalog.models import Product, ProductImage


def _img(name: str = "p.jpg", size: tuple[int, int] = (2000, 1500)) -> SimpleUploadedFile:
    buf = io.BytesIO()
    Image.new("RGB", size, "white").save(buf, format="JPEG")
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/jpeg")


def _url(pid: str, img_id: str | None = None) -> str:
    base = f"/api/v1/products/{pid}/images/"
    return f"{base}{img_id}/" if img_id else base


@pytest.mark.django_db
def test_upload_first_image_becomes_primary_and_resizes(manager_api, catalog):
    product = catalog["product"]
    resp = manager_api.post(
        _url(product.id), {"images": [_img()]}, format="multipart"
    )
    assert resp.status_code == 201, resp.data
    row = resp.data["data"][0]
    assert row["is_primary"] is True
    assert row["thumbnail"]

    obj = ProductImage.objects.get(pk=row["id"])
    with Image.open(obj.image) as im:
        assert max(im.size) <= 1600
    with Image.open(obj.thumbnail) as tm:
        assert max(tm.size) <= 320

    product.refresh_from_db()
    assert product.image.name == obj.image.name  # Product.image sinxron


@pytest.mark.django_db
def test_second_image_not_primary_then_switch(manager_api, catalog):
    product = catalog["product"]
    manager_api.post(_url(product.id), {"images": [_img("a.jpg")]}, format="multipart")
    r2 = manager_api.post(
        _url(product.id), {"images": [_img("b.jpg")]}, format="multipart"
    )
    second_id = r2.data["data"][0]["id"]
    assert r2.data["data"][0]["is_primary"] is False

    patch = manager_api.patch(
        _url(product.id, second_id), {"is_primary": True}, format="json"
    )
    assert patch.status_code == 200, patch.data
    assert patch.data["data"]["is_primary"] is True

    assert ProductImage.objects.filter(product=product, is_primary=True).count() == 1
    product.refresh_from_db()
    assert product.image.name == ProductImage.objects.get(
        pk=second_id
    ).image.name


@pytest.mark.django_db
def test_delete_primary_promotes_next(manager_api, catalog):
    product = catalog["product"]
    r1 = manager_api.post(
        _url(product.id), {"images": [_img("a.jpg")]}, format="multipart"
    )
    manager_api.post(_url(product.id), {"images": [_img("b.jpg")]}, format="multipart")
    first_id = r1.data["data"][0]["id"]

    resp = manager_api.delete(_url(product.id, first_id))
    assert resp.status_code == 200, resp.data

    remaining = ProductImage.objects.filter(product=product)
    assert remaining.count() == 1
    assert remaining.first().is_primary is True
    product.refresh_from_db()
    assert product.image.name == remaining.first().image.name


@pytest.mark.django_db
def test_product_serializer_includes_ordered_images(manager_api, catalog):
    product = catalog["product"]
    manager_api.post(
        _url(product.id),
        {"images": [_img("a.jpg"), _img("b.jpg"), _img("c.jpg")]},
        format="multipart",
    )
    detail = manager_api.get(f"/api/v1/products/{product.id}/")
    imgs = detail.data["data"]["images"]
    assert len(imgs) == 3
    assert [i["sort_order"] for i in imgs] == sorted(i["sort_order"] for i in imgs)
    assert sum(1 for i in imgs if i["is_primary"]) == 1


@pytest.mark.django_db
def test_distributor_cannot_upload(auth_api, catalog):
    resp = auth_api.post(
        _url(catalog["product"].id), {"images": [_img()]}, format="multipart"
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_bad_file_rejected(manager_api, catalog):
    bad = SimpleUploadedFile("x.jpg", b"not an image", content_type="image/jpeg")
    resp = manager_api.post(
        _url(catalog["product"].id), {"images": [bad]}, format="multipart"
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_catalog_sync_exposes_image_thumb(manager_api, catalog):
    product = catalog["product"]
    manager_api.post(_url(product.id), {"images": [_img()]}, format="multipart")
    resp = manager_api.get("/api/v1/sync/catalog/")
    assert resp.status_code == 200
    row = next(
        p for p in resp.data["data"]["products"] if p["id"] == str(product.id)
    )
    assert row["image_thumb"]
    assert row["image_thumb"].startswith("http")


@pytest.mark.django_db
def test_product_without_images_sync_ok(manager_api, catalog):
    # Boshqa mahsulot — rasmsiz
    other = Product.objects.create(
        name="Rasmsiz", sku="NOIMG", category=catalog["category"],
        unit=catalog["unit"], retail_price="1000", min_price="900",
    )
    resp = manager_api.get("/api/v1/sync/catalog/")
    row = next(
        p for p in resp.data["data"]["products"] if p["id"] == str(other.id)
    )
    assert row["image_thumb"] is None
