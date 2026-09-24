"""Parolni Telegram kodi orqali tiklash."""
from __future__ import annotations

import re
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.models import AuditLog
from apps.telegram_bot.models import TelegramMessageLog
from apps.users.models import PasswordResetCode

REQUEST_URL = "/api/v1/auth/password-reset/request/"
CONFIRM_URL = "/api/v1/auth/password-reset/confirm/"
PHONE = "+998901112233"


@pytest.fixture
def sent(monkeypatch):
    """Telegram'ga ketgan xabarlarni ushlab qoladi."""
    messages: list[tuple[str, str]] = []

    def fake_send(chat_id, text, **kwargs):
        messages.append((str(chat_id), text))
        return True

    monkeypatch.setattr("apps.users.services.password_reset.send_message", fake_send)
    return messages


@pytest.fixture
def linked(distributor):
    distributor.telegram_chat_id = "555"
    distributor.save(update_fields=["telegram_chat_id"])
    return distributor


def _code_from(messages) -> str:
    return re.search(r"\b(\d{6})\b", messages[-1][1]).group(1)


def _request(api, phone=PHONE):
    return api.post(REQUEST_URL, {"phone": phone}, format="json")


def _confirm(api, code, password="yangiParol1", phone=PHONE):
    return api.post(
        CONFIRM_URL,
        {"phone": phone, "code": code, "new_password": password},
        format="json",
    )


@pytest.mark.django_db
def test_request_sends_code_to_linked_telegram(api, linked, sent):
    resp = _request(api, "90 111 22 33")

    assert resp.status_code == 200
    assert sent and sent[0][0] == "555"
    assert PasswordResetCode.objects.filter(user=linked).count() == 1


@pytest.mark.django_db
def test_code_is_not_stored_in_plain_text(api, linked, sent):
    _request(api)
    code = _code_from(sent)

    reset = PasswordResetCode.objects.get(user=linked)
    assert code not in reset.code_hash
    assert not TelegramMessageLog.objects.filter(text__contains=code).exists()


@pytest.mark.django_db
@pytest.mark.parametrize("phone", [PHONE, "+998909999999"])
def test_request_response_does_not_reveal_account(api, distributor, sent, phone):
    # Telegram bog'lanmagan va umuman yo'q raqam — javob bir xil
    resp = _request(api, phone)

    assert resp.status_code == 200
    assert sent == []
    assert PasswordResetCode.objects.count() == 0


@pytest.mark.django_db
def test_request_skips_inactive_user(api, linked, sent):
    linked.is_active = False
    linked.save(update_fields=["is_active"])

    assert _request(api).status_code == 200
    assert sent == []


@pytest.mark.django_db
def test_repeat_request_within_cooldown_does_not_resend(api, linked, sent):
    _request(api)
    _request(api)

    assert len(sent) == 1


@pytest.mark.django_db
def test_confirm_sets_new_password_and_revokes_sessions(api, linked, sent):
    old_refresh = RefreshToken.for_user(linked)
    _request(api)

    resp = _confirm(api, _code_from(sent))

    assert resp.status_code == 200, resp.data
    linked.refresh_from_db()
    assert linked.check_password("yangiParol1")
    outstanding = OutstandingToken.objects.get(jti=old_refresh["jti"])
    assert BlacklistedToken.objects.filter(token=outstanding).exists()
    assert AuditLog.objects.filter(
        action="user.password_reset", object_id=str(linked.pk)
    ).exists()


@pytest.mark.django_db
def test_code_works_only_once(api, linked, sent):
    _request(api)
    code = _code_from(sent)
    _confirm(api, code)

    assert _confirm(api, code, password="boshqaParol2").status_code == 400


@pytest.mark.django_db
def test_wrong_code_rejected(api, linked, sent):
    _request(api)
    code = _code_from(sent)
    wrong = "000000" if code != "000000" else "111111"

    resp = _confirm(api, wrong)

    assert resp.status_code == 400
    linked.refresh_from_db()
    assert linked.check_password("pass12345")


@pytest.mark.django_db
def test_code_locked_after_too_many_attempts(api, linked, sent):
    _request(api)
    code = _code_from(sent)
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(PasswordResetCode.MAX_ATTEMPTS):
        _confirm(api, wrong)

    assert _confirm(api, code).status_code == 400


@pytest.mark.django_db
def test_expired_code_rejected(api, linked, sent):
    _request(api)
    PasswordResetCode.objects.update(expires_at=timezone.now() - timedelta(seconds=1))

    assert _confirm(api, _code_from(sent)).status_code == 400


@pytest.mark.django_db
def test_new_password_min_length(api, linked, sent):
    _request(api)

    assert _confirm(api, _code_from(sent), password="short").status_code == 400
