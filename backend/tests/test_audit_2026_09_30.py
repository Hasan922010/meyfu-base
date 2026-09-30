"""Audit №2 (2026-09-30) regressiya testlari — docs/AUDIT_REPORT_2026-09-30.md."""
import uuid
from decimal import Decimal

import pytest

from apps.sales.models import Sale
from apps.warehouse.models import VanStock

SYNC_URL = "/api/v1/sales/bulk-sync/"


def _sync_sale(api, client, product, **item):
    op = {
        "type": "sale",
        "client_uuid": str(uuid.uuid4()),
        "payload": {
            "client": str(client.id),
            "payment_type": "NAQD",
            "items": [{"product": str(product.id), **item}],
        },
    }
    resp = api.post(SYNC_URL, {"operations": [op]}, format="json")
    assert resp.status_code == 200
    return resp.data["data"]["results"][0]


def _van_qty(distributor, product) -> Decimal:
    return VanStock.objects.get(distributor=distributor, product=product).quantity


# ---------- SEC-101: sync orqali manfiy miqdor ----------

@pytest.mark.django_db
def test_sync_sale_negative_quantity_rejected_and_van_unchanged(auth_api, van_stocked):
    product, client = van_stocked["product"], van_stocked["client"]
    before = _van_qty(van_stocked["distributor"], product)

    result = _sync_sale(auth_api, client, product, quantity="-50", price="27000")

    assert result["status"] == "FAILED"
    assert result["error"]["code"] == "INVALID_QUANTITY"
    assert _van_qty(van_stocked["distributor"], product) == before
    assert not Sale.objects.exists()


@pytest.mark.django_db
def test_sync_sale_negative_price_rejected(auth_api, van_stocked):
    result = _sync_sale(auth_api, van_stocked["client"], van_stocked["product"],
                        quantity="1", price="-1000")
    assert result["error"]["code"] == "INVALID_PRICE"


@pytest.mark.django_db
def test_sync_expense_negative_amount_rejected(auth_api, van_stocked, expense_categories):
    op = {
        "type": "expense", "client_uuid": str(uuid.uuid4()),
        "payload": {"category": str(expense_categories["fuel"].id), "amount": "-45000",
                    "payment_source": "CASH_ON_HAND", "description": "x"},
    }
    resp = auth_api.post(SYNC_URL, {"operations": [op]}, format="json")
    assert resp.data["data"]["results"][0]["error"]["code"] == "INVALID_AMOUNT"


# ---------- SEC-102: chegirma bilan min narxni aylanib o'tish ----------

@pytest.mark.django_db
def test_discount_percent_over_100_rejected(auth_api, van_stocked):
    result = _sync_sale(auth_api, van_stocked["client"], van_stocked["product"],
                        quantity="1", price="27000", discount_percent="150")
    assert result["error"]["code"] == "INVALID_DISCOUNT"


@pytest.mark.django_db
def test_discount_below_min_price_rejected_online(auth_api, van_stocked):
    # min_price=24000; 27000 × (1 − 50%) = 13500 < 24000
    resp = auth_api.post("/api/v1/sales/", {
        "client": str(van_stocked["client"].id), "payment_type": "NAQD",
        "items": [{"product": str(van_stocked["product"].id), "quantity": "1",
                   "price": "27000", "discount_percent": "50"}],
    }, format="json")
    assert resp.status_code == 409
    assert resp.data["error"]["code"] == "PRICE_BELOW_MINIMUM"


@pytest.mark.django_db
def test_sale_level_discount_below_min_rejected(auth_api, van_stocked):
    resp = auth_api.post("/api/v1/sales/", {
        "client": str(van_stocked["client"].id), "payment_type": "NAQD",
        "items": [{"product": str(van_stocked["product"].id), "quantity": "2",
                   "price": "27000"}],
        "discount_amount": "50000",
    }, format="json")
    assert resp.status_code == 409
    assert resp.data["error"]["code"] == "PRICE_BELOW_MINIMUM"


@pytest.mark.django_db
def test_serializer_rejects_discount_over_100(auth_api, van_stocked):
    resp = auth_api.post("/api/v1/sales/", {
        "client": str(van_stocked["client"].id), "payment_type": "NAQD",
        "items": [{"product": str(van_stocked["product"].id), "quantity": "1",
                   "price": "27000", "discount_percent": "101"}],
    }, format="json")
    assert resp.status_code == 400


# ---------- BE-115: bir mahsulot ikki qatorda ----------

@pytest.mark.django_db
def test_duplicate_lines_checked_against_total_quantity(auth_api, van_stocked):
    product = van_stocked["product"]
    resp = auth_api.post("/api/v1/sales/", {
        "client": str(van_stocked["client"].id), "payment_type": "NAQD",
        "items": [
            {"product": str(product.id), "quantity": "300", "price": "27000"},
            {"product": str(product.id), "quantity": "300", "price": "27000"},
        ],
    }, format="json")
    assert resp.status_code == 409
    assert resp.data["error"]["details"]["requested"] == "600.000"


# ---------- SEC-103: Telegram bog'lash kodini taxmin qilish ----------

def _tg_msg(chat_id: int, text: str) -> dict:
    return {"message": {"chat": {"id": chat_id}, "message_id": 1, "text": text}}


@pytest.mark.django_db
def test_telegram_link_bruteforce_is_throttled(distributor):
    from apps.telegram_bot.models import TelegramLinkCode
    from apps.telegram_bot.services.webhook import (
        LINK_MAX_FAILS_PER_CHAT,
        handle_update,
    )

    for _ in range(LINK_MAX_FAILS_PER_CHAT):
        handle_update(_tg_msg(777001, "000000"))
    code = TelegramLinkCode.issue(distributor)
    handle_update(_tg_msg(777001, code.code))  # to'g'ri kod ham — bloklangan

    distributor.refresh_from_db()
    assert distributor.telegram_chat_id == ""


@pytest.mark.django_db
def test_telegram_relink_notifies_previous_chat(distributor, monkeypatch):
    from apps.telegram_bot.models import TelegramLinkCode
    from apps.telegram_bot.services import webhook

    sent: list[tuple] = []
    monkeypatch.setattr(
        webhook, "tg_send_chat", lambda chat, text: sent.append((chat, text))
    )
    distributor.telegram_chat_id = "111"
    distributor.save()

    code = TelegramLinkCode.issue(distributor)
    webhook.handle_update(_tg_msg(222, f"/start {code.code}"))

    assert any(chat == "111" for chat, _ in sent)


# ---------- SEC-105: standart webhook siri ----------

@pytest.mark.django_db
def test_webhook_rejects_default_secret(api, settings):
    settings.TELEGRAM_WEBHOOK_SECRET = "dev-webhook-secret"
    resp = api.post(
        "/api/v1/telegram/webhook/", _tg_msg(1, "/help"), format="json",
        HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN="dev-webhook-secret",
    )
    assert resp.status_code == 403


# ---------- SEC-121: filialsiz filial rahbari botda ----------

@pytest.mark.django_db
def test_branchless_branch_manager_denied_in_bot(monkeypatch):
    from apps.telegram_bot.services import webhook
    from apps.users.models import User

    User.objects.create_user(
        phone="+998907770011", password="pass12345", full_name="BM",
        role="BRANCH_MANAGER", telegram_chat_id="4242",
    )
    sent: list[str] = []
    monkeypatch.setattr(webhook, "tg_send_chat", lambda chat, text: sent.append(text))

    webhook.handle_update(_tg_msg(4242, "/hisobot"))

    assert sent and "faqat admin" in sent[-1]
