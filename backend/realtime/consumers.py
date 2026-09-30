"""Real-time event consumer (CLAUDE.md 11).

Bitta ulanish quyidagi guruhlarga qo'shiladi (rolga qarab):
  - user_{id}          — har doim (shaxsiy bildirishnomalar)
  - admin_dashboard    — markaz: SUPER_ADMIN, MANAGER, ACCOUNTANT
  - admin_dashboard_{filial} — filialga biriktirilgan admin rollar (SEC-116)
  - distributor_{id}   — DISTRIBUTOR
  - warehouse_{id}     — WAREHOUSE (o'z ombori bo'yicha)

Muhim: WS uzilsa ilova ishlashda davom etadi — bu faqat qulaylik.
"""
from __future__ import annotations

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from apps.users.constants import Role
from realtime.broadcast import ADMIN_GROUP, admin_branch_group

_ADMIN_ROLES = {Role.SUPER_ADMIN, Role.MANAGER, Role.ACCOUNTANT, Role.BRANCH_MANAGER}


def _admin_group(user) -> str | None:
    """Markaz — umumiy guruh; filial xodimi — faqat o'z filiali guruhi."""
    from apps.core.branch import NO_BRANCH, branch_scope

    if user.is_superuser:
        return ADMIN_GROUP
    scope = branch_scope(user)
    if scope is None:
        return ADMIN_GROUP
    if scope is NO_BRANCH:
        return None
    return admin_branch_group(scope)


class EventConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self) -> None:
        user = self.scope.get("user")
        if user is None or not user.is_authenticated:
            await self.close(code=4401)
            return

        self.groups_joined: list[str] = [f"user_{user.id}"]
        role = getattr(user, "role", None)

        if user.is_superuser or role in _ADMIN_ROLES:
            group = await database_sync_to_async(_admin_group)(user)
            if group:
                self.groups_joined.append(group)
        if role == Role.DISTRIBUTOR:
            self.groups_joined.append(f"distributor_{user.id}")
        if role == Role.WAREHOUSE:
            warehouse_id = getattr(user, "warehouse_id", None)
            self.groups_joined.append(
                f"warehouse_{warehouse_id}" if warehouse_id else "warehouse_all"
            )

        for group in self.groups_joined:
            await self.channel_layer.group_add(group, self.channel_name)

        await self.accept()
        await self.send_json({"event": "connected", "payload": {
            "groups": self.groups_joined,
        }})

    async def disconnect(self, code) -> None:
        for group in getattr(self, "groups_joined", []):
            await self.channel_layer.group_discard(group, self.channel_name)

    async def receive_json(self, content, **kwargs) -> None:
        # Mijoz faqat "ping" yuboradi — javob "pong"
        if content.get("type") == "ping":
            await self.send_json({"event": "pong", "payload": {}})

    async def broadcast_message(self, message: dict) -> None:
        """`broadcast(group, event, payload)` shu handlerga tushadi."""
        await self.send_json({
            "event": message.get("event", ""),
            "payload": message.get("payload", {}),
        })
