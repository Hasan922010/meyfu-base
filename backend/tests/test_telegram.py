"""10-bosqich: Telegram bot — bog'lash, webhook, tugmalar, xulosa."""
import base64
import hashlib

import pytest
from cryptography.fernet import Fernet
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

from apps.telegram_bot.models import (
    TelegramBotCredential,
    TelegramLinkCode,
    TelegramMessageLog,
)
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
        "/api/v1/telegram/webhook/",
        _msg(1, "/help"),
        format="json",
        HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN=settings.TELEGRAM_WEBHOOK_SECRET,
    )
    assert resp.status_code == 200


@pytest.mark.django_db
def test_webhook_accepts_header_secret(api, settings):
    """SEC-004 — `X-Telegram-Bot-Api-Secret-Token` sarlavhasi ham qabul qilinadi."""
    settings.TELEGRAM_WEBHOOK_SECRET = "s3cret-value-0123456789"
    resp = api.post(
        "/api/v1/telegram/webhook/anything/",
        _msg(1, "/help"),
        format="json",
        HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN="s3cret-value-0123456789",
    )
    assert resp.status_code == 200


@pytest.mark.django_db
def test_webhook_rejects_path_secret_without_header(api, settings):
    resp = api.post(
        f"/api/v1/telegram/webhook/{settings.TELEGRAM_WEBHOOK_SECRET}/",
        _msg(1, "/help"),
        format="json",
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_webhook_rejects_when_secret_unset(api, settings):
    """SEC-004 — kalit bo'sh bo'lsa hech kim o'ta olmaydi (bo'sh == bo'sh emas)."""
    settings.TELEGRAM_WEBHOOK_SECRET = ""
    resp = api.post("/api/v1/telegram/webhook//", _msg(1, "/help"), format="json")
    # bo'sh segment 404 berishi mumkin; aniq segment bilan ham 403 bo'lsin
    resp2 = api.post("/api/v1/telegram/webhook/x/", _msg(1, "/help"), format="json")
    assert resp.status_code in (403, 404)
    assert resp2.status_code == 403


@pytest.mark.django_db
def test_webhook_non_ascii_secret_is_403_not_500(api, settings):
    settings.TELEGRAM_WEBHOOK_SECRET = "ascii-secret-0123456789"
    resp = api.post(
        "/api/v1/telegram/webhook/%C3%BCn%C3%AFcode/", _msg(1, "/help"), format="json"
    )
    assert resp.status_code in (403, 404)  # muhimi: 500 emas


@pytest.mark.django_db
def test_webhook_returns_503_for_transient_processing_error(api, settings, monkeypatch):
    monkeypatch.setattr(
        "apps.telegram_bot.views.handle_update",
        lambda _data: (_ for _ in ()).throw(RuntimeError("temporary failure")),
    )
    resp = api.post(
        "/api/v1/telegram/webhook/",
        _msg(2, "/help"),
        format="json",
        HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN=settings.TELEGRAM_WEBHOOK_SECRET,
    )
    assert resp.status_code == 503
    assert resp.data == {"ok": False}


@pytest.mark.django_db
def test_set_webhook_sends_secret_token(monkeypatch, settings):
    """SEC-004 — setWebhook chaqiruvi `secret_token` ni yuboradi."""
    settings.TELEGRAM_BOT_TOKEN = "123:abc"
    settings.TELEGRAM_WEBHOOK_SECRET = "webhook-secret-0123456789"
    captured: dict = {}

    from apps.telegram_bot import client

    monkeypatch.setattr(
        client, "_call",
        lambda method, payload, **_kwargs: captured.update(payload) or {"ok": 1},
    )
    assert client.set_webhook("https://x.example.com/hook/")
    assert captured["secret_token"] == "webhook-secret-0123456789"


@pytest.mark.django_db
def test_super_admin_can_save_bot_token_without_exposing_it(
    api, admin_user, monkeypatch,
):
    token = "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdef"
    api.force_authenticate(admin_user)
    monkeypatch.setattr(
        "apps.telegram_bot.views.get_me",
        lambda candidate: {"username": "MeyFuTestBot"} if candidate == token else None,
    )
    monkeypatch.setattr(
        "apps.telegram_bot.views.set_webhook",
        lambda *_args, **_kwargs: True,
    )
    monkeypatch.setattr(
        "apps.telegram_bot.views.delete_webhook",
        lambda *_args, **_kwargs: True,
    )

    resp = api.post("/api/v1/telegram/bot-config/", {"token": token}, format="json")

    assert resp.status_code == 200
    assert resp.data["data"]["configured"] is True
    assert resp.data["data"]["bot_username"] == "MeyFuTestBot"
    assert token not in str(resp.data)
    credential = TelegramBotCredential.current()
    assert credential is not None
    assert token not in credential.encrypted_token
    assert credential.get_token() == token
    assert credential.get_webhook_secret()
    assert credential.get_webhook_secret() not in str(resp.data)


@pytest.mark.django_db
def test_non_super_admin_cannot_manage_bot_token(auth_api):
    resp = auth_api.post(
        "/api/v1/telegram/bot-config/",
        {"token": "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdef"},
        format="json",
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_invalid_bot_token_does_not_replace_existing(
    api, admin_user, monkeypatch,
):
    credential = TelegramBotCredential(bot_username="OldBot", created_by=admin_user)
    credential.set_token("123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ_old")
    credential.save()
    api.force_authenticate(admin_user)
    monkeypatch.setattr("apps.telegram_bot.views.get_me", lambda _token: None)

    resp = api.post(
        "/api/v1/telegram/bot-config/",
        {"token": "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ_new"},
        format="json",
    )

    assert resp.status_code == 400
    credential.refresh_from_db()
    assert credential.get_token() == "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ_old"


@pytest.mark.django_db
def test_credential_key_rotation_preserves_saved_secrets(settings):
    settings.SECRET_KEY = "django-key-before-rotation"
    settings.TELEGRAM_CREDENTIAL_KEY_VERSION = "v1"
    settings.TELEGRAM_CREDENTIAL_KEYS = {"v1": "telegram-key-one"}
    credential = TelegramBotCredential(bot_username="RotationBot")
    credential.set_token("123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ_rotate")
    credential.set_webhook_secret("webhook-secret-before-rotation")
    credential.save()
    old_ciphertext = credential.encrypted_token

    settings.SECRET_KEY = "django-key-after-rotation"
    settings.TELEGRAM_CREDENTIAL_KEY_VERSION = "v2"
    settings.TELEGRAM_CREDENTIAL_KEYS = {
        "v2": "telegram-key-two",
        "v1": "telegram-key-one",
    }

    assert credential.get_token() == "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ_rotate"
    assert credential.get_webhook_secret() == "webhook-secret-before-rotation"
    credential.refresh_from_db()
    assert credential.encryption_key_version == "v2"
    assert credential.encrypted_token != old_ciphertext


@pytest.mark.django_db
def test_legacy_secret_key_ciphertext_is_migrated_on_read(settings):
    old_django_key = "old-django-secret-key"
    legacy_cipher = Fernet(
        base64.urlsafe_b64encode(hashlib.sha256(old_django_key.encode()).digest())
    )
    credential = TelegramBotCredential.objects.create(
        bot_username="LegacyBot",
        encrypted_token=legacy_cipher.encrypt(b"123456789:legacy-token").decode(),
        encrypted_webhook_secret=legacy_cipher.encrypt(b"legacy-webhook").decode(),
    )

    settings.SECRET_KEY = "new-django-secret-key"
    settings.TELEGRAM_CREDENTIAL_KEY_VERSION = "v1"
    settings.TELEGRAM_CREDENTIAL_KEYS = {
        "v1": "dedicated-telegram-key",
        "legacy": old_django_key,
    }

    assert credential.get_token() == "123456789:legacy-token"
    credential.refresh_from_db()
    assert credential.encryption_key_version == "v1"
    assert credential.get_webhook_secret() == "legacy-webhook"


@pytest.mark.django_db(transaction=True)
def test_schema_migration_reencrypts_legacy_credentials_before_key_rotation(settings):
    old_django_key = "django-key-used-before-schema-migration"
    legacy_cipher = Fernet(
        base64.urlsafe_b64encode(hashlib.sha256(old_django_key.encode()).digest())
    )
    settings.SECRET_KEY = old_django_key
    settings.TELEGRAM_CREDENTIAL_KEY_VERSION = "v1"
    settings.TELEGRAM_CREDENTIAL_KEYS = {
        "v1": "dedicated-telegram-key-used-by-migration",
    }

    executor = MigrationExecutor(connection)
    old_target = [("telegram_bot", "0003_telegrambotcredential_encrypted_webhook_secret")]
    executor.migrate(old_target)
    old_apps = executor.loader.project_state(old_target).apps
    old_credential_model = old_apps.get_model(
        "telegram_bot", "TelegramBotCredential"
    )
    credential = old_credential_model.objects.create(
        bot_username="MigrationBot",
        encrypted_token=legacy_cipher.encrypt(b"123456789:migration-token").decode(),
        encrypted_webhook_secret=legacy_cipher.encrypt(b"migration-webhook").decode(),
    )

    new_target = [
        ("telegram_bot", "0004_telegrambotcredential_encryption_key_version")
    ]
    executor = MigrationExecutor(connection)
    executor.migrate(new_target)

    settings.SECRET_KEY = "django-key-rotated-after-schema-migration"
    migrated = TelegramBotCredential.objects.get(pk=credential.pk)
    assert migrated.encryption_key_version == "v1"
    assert migrated.get_token() == "123456789:migration-token"
    assert migrated.get_webhook_secret() == "migration-webhook"


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
