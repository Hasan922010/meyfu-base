"""Telegram update'larni qayta ishlash (CLAUDE.md 15)."""
from __future__ import annotations

import logging

from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.users.constants import Role

from ..client import answer_callback_query, edit_message_reply_markup
from ..models import TelegramLinkCode, TelegramMessageLog
from .digest import build_overdue_summary, build_today_summary
from .send import tg_send_chat

logger = logging.getLogger("apps.telegram_bot")
_ADMIN_ROLES = {Role.SUPER_ADMIN, Role.MANAGER}

WELCOME = (
    "MeyFu botiga xush kelibsiz!\n\n"
    "Bog'lash uchun ilovadan olgan 6 xonali kodni yuboring."
)
HELP = (
    "Buyruqlar:\n"
    "/hisobot — bugungi qisqa hisobot\n"
    "/qarzdorlar — muddati o'tgan qarzlar\n"
    "/uzish — botni akkauntdan uzish"
)


def handle_update(update: dict) -> None:
    try:
        if "callback_query" in update:
            _handle_callback(update["callback_query"])
        elif "message" in update:
            _handle_message(update["message"])
    except Exception:  # noqa: BLE001 — webhook hech qachon 500 qaytarmasin
        logger.exception("Telegram update qayta ishlashda xato")


def _user_by_chat(chat_id) -> object | None:
    User = get_user_model()
    return User.objects.filter(
        telegram_chat_id=str(chat_id), is_active=True
    ).first()


def _handle_message(message: dict) -> None:
    chat_id = message["chat"]["id"]
    text = (message.get("text") or "").strip()
    TelegramMessageLog.objects.create(
        chat_id=str(chat_id), direction="in", text=text[:5000],
    )

    if text.startswith("/start"):
        parts = text.split(maxsplit=1)
        if len(parts) == 2 and parts[1].isdigit():
            _link(chat_id, parts[1])
        else:
            tg_send_chat(chat_id, WELCOME)
        return

    if text.startswith("/help"):
        tg_send_chat(chat_id, HELP)
        return

    if text.startswith("/uzish"):
        user = _user_by_chat(chat_id)
        if user:
            user.telegram_chat_id = ""
            user.save(update_fields=["telegram_chat_id", "updated_at"])
        tg_send_chat(chat_id, "Bot akkauntdan uzildi.")
        return

    user = _user_by_chat(chat_id)
    if user is None:
        # bog'lanmagan — kod deb qaraymiz
        if text.isdigit() and len(text) == 6:
            _link(chat_id, text)
        else:
            tg_send_chat(chat_id, WELCOME)
        return

    if text.startswith("/hisobot"):
        _require_admin(user, chat_id, lambda: tg_send_chat(
            chat_id, build_today_summary()
        ))
    elif text.startswith("/qarzdorlar"):
        _require_admin(user, chat_id, lambda: tg_send_chat(
            chat_id, build_overdue_summary()
        ))
    else:
        tg_send_chat(chat_id, HELP)


def _require_admin(user, chat_id, fn) -> None:
    if user.is_superuser or user.role in _ADMIN_ROLES:
        fn()
    else:
        tg_send_chat(chat_id, "Bu buyruq faqat admin/menejer uchun.")


def _link(chat_id, code: str) -> None:
    link = TelegramLinkCode.objects.filter(code=code).first()
    if link is None or not link.is_valid:
        tg_send_chat(
            chat_id,
            "Kod noto'g'ri yoki muddati o'tgan. Ilovadan yangi kod oling.",
        )
        return
    user = link.user
    user.telegram_chat_id = str(chat_id)
    user.save(update_fields=["telegram_chat_id", "updated_at"])
    link.used_at = timezone.now()
    link.save(update_fields=["used_at", "updated_at"])
    tg_send_chat(
        chat_id,
        f"✅ <b>{user.full_name}</b> akkaunti bog'landi.\n\n{HELP}",
    )


def _handle_callback(cq: dict) -> None:
    cq_id = cq["id"]
    data = cq.get("data", "")
    chat = cq.get("message", {}).get("chat", {})
    message_id = cq.get("message", {}).get("message_id")
    chat_id = chat.get("id")

    user = _user_by_chat(chat_id)
    if user is None or not (user.is_superuser or user.role in _ADMIN_ROLES):
        answer_callback_query(cq_id, "Ruxsat yo'q")
        return

    if ":" not in data:
        answer_callback_query(cq_id)
        return
    action, obj_id = data.split(":", 1)

    if action in ("exp_approve", "exp_reject"):
        from apps.expenses.models import DistributorExpense
        from apps.expenses.services import approve_expense, reject_expense

        expense = DistributorExpense.objects.filter(pk=obj_id).first()
        if expense is None:
            answer_callback_query(cq_id, "Xarajat topilmadi")
            return
        if expense.status != "PENDING":
            answer_callback_query(cq_id, f"Allaqachon: {expense.get_status_display()}")
        elif action == "exp_approve":
            approve_expense(expense, user=user)
            answer_callback_query(cq_id, "Tasdiqlandi ✅")
            tg_send_chat(chat_id, f"✅ Xarajat tasdiqlandi: {expense.amount} so'm")
        else:
            reject_expense(expense, user=user, reason="Telegram orqali rad etildi")
            answer_callback_query(cq_id, "Rad etildi ❌")
            tg_send_chat(chat_id, f"❌ Xarajat rad etildi: {expense.amount} so'm")
        if message_id:
            edit_message_reply_markup(chat_id, message_id)
    else:
        answer_callback_query(cq_id)
