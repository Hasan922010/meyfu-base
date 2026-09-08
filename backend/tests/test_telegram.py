"""10-bosqich: Telegram bot — bog'lash, webhook, tugmalar, xulosa."""
import pytest

from apps.telegram_bot.models import TelegramLinkCode, TelegramMessageLog
from apps.telegram_bot.services.webhook import handle_update

WEBHOOK_SECRET = "test-secret-key-not-for-production-0123456789abcdef"  # noqa: S105


def _msg(chat_id: int, text: str) -> dict:
    return {"message": {"chat": {"id": chat_id}, "message_id": 1, "text": text}}


def _cb(chat_id: int, data: str) -> dict:
    return {
        "callback_query": {
            "id": "cq1", "data": data,
            "message": {"chat": {"id": chat_id}, "message_id": 5},
        }
    }


@pytest.mark.django_db
def test_link_flow(auth_api, distributor):
    resp = auth_api.post("/api/v1/telegram/link/")
    assert resp.status_code == 200
    code = resp.data["data"]["code"]
    assert resp.data["data"]["deep_link"].endswith(f"start={code}")

    handle_update(_msg(555001, f"/start {code}"))

    distributor.refresh_from_db()
    assert distributor.telegram_chat_id == "555001"
    assert TelegramLinkCode.objects.get(code=code).used_at is not None


@pytest.mark.django_db
def test_link_bad_code(distributor):
    handle_update(_msg(555002, "/start 000000"))
    distributor.refresh_from_db()
    assert distributor.telegram_chat_id == ""


@pytest.mark.django_db
def test_link_expired_code(auth_api, distributor):
    from django.utils import timezone

    code = TelegramLinkCode.issue(distributor)
    code.expires_at = timezone.now() - timezone.timedelta(minutes=1)
    code.save()

    handle_update(_msg(555003, f"/start {code.code}"))
    distributor.refresh_from_db()
    assert distributor.telegram_chat_id == ""


@pytest.mark.django_db
def test_status_and_unlink(auth_api, distributor):
    distributor.telegram_chat_id = "999"
    distributor.save()

    st = auth_api.get("/api/v1/telegram/status/")
    assert st.data["data"]["linked"] is True

    auth_api.post("/api/v1/telegram/unlink/")
    distributor.refresh_from_db()
    assert distributor.telegram_chat_id == ""


@pytest.mark.django_db
def test_webhook_wrong_secret(api):
    resp = api.post(
        "/api/v1/telegram/webhook/wrong-secret/", {}, format="json"
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_webhook_right_secret(api, settings):
    resp = api.post(
        f"/api/v1/telegram/webhook/{settings.TELEGRAM_WEBHOOK_SECRET}/",
        _msg(1, "/help"),
        format="json",
    )
    assert resp.status_code == 200


@pytest.mark.django_db
def test_expense_approval_via_callback(admin_user, van_stocked, auth_api,
                                       expense_categories):
    admin_user.telegram_chat_id = "700700"
    admin_user.save()

    exp = auth_api.post(
        "/api/v1/expenses/",
        {"category": str(expense_categories["lunch"].id), "amount": "20000"},
        format="json",
    ).data["data"]

    handle_update(_cb(700700, f"exp_approve:{exp['id']}"))

    from apps.expenses.models import DistributorExpense

    assert DistributorExpense.objects.get(pk=exp["id"]).status == "APPROVED"


@pytest.mark.django_db
def test_callback_from_non_admin_ignored(distributor, van_stocked, auth_api,
                                         expense_categories):
    distributor.telegram_chat_id = "800800"
    distributor.save()

    exp = auth_api.post(
        "/api/v1/expenses/",
        {"category": str(expense_categories["lunch"].id), "amount": "20000"},
        format="json",
    ).data["data"]

    handle_update(_cb(800800, f"exp_approve:{exp['id']}"))

    from apps.expenses.models import DistributorExpense

    assert DistributorExpense.objects.get(pk=exp["id"]).status == "PENDING"


@pytest.mark.django_db
def test_notify_writes_telegram_log(distributor):
    from apps.notifications.services import notify

    distributor.telegram_chat_id = "123123"
    distributor.save()

    notify(distributor, title="Salom", body="test xabar")

    assert TelegramMessageLog.objects.filter(
        chat_id="123123", direction="out"
    ).exists()


@pytest.mark.django_db
def test_daily_digest_builds(manager, van_stocked, auth_api):
    from apps.telegram_bot.services.digest import (
        build_overdue_summary,
        build_today_summary,
    )

    auth_api.post(
        "/api/v1/sales/",
        {"client": str(van_stocked["client"].id), "payment_type": "NAQD",
         "items": [{"product": str(van_stocked["product"].id),
                    "quantity": "5", "price": "27000"}]},
        format="json",
    )

    text = build_today_summary()
    assert "Bugungi hisobot" in text
    assert "Savdo" in text
    assert "Muddati o'tgan qarzlar" in build_overdue_summary()


@pytest.mark.django_db
def test_hisobot_command_admin_only(admin_user, manager, distributor):
    admin_user.telegram_chat_id = "1"
    admin_user.save()
    distributor.telegram_chat_id = "2"
    distributor.save()

    handle_update(_msg(1, "/hisobot"))
    handle_update(_msg(2, "/hisobot"))

    logs = list(
        TelegramMessageLog.objects.filter(direction="out").order_by("created_at")
    )
    assert any("Bugungi hisobot" in log_.text for log_ in logs if log_.chat_id == "1")
    assert any("faqat admin" in log_.text for log_ in logs if log_.chat_id == "2")
