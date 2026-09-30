"""8-bosqich: WebSocket consumer + event yetkazish (CLAUDE.md 11)."""
import hashlib
import re
from datetime import timedelta

import pytest
from asgiref.sync import sync_to_async
from channels.testing import WebsocketCommunicator
from django.utils import timezone
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from apps.users.models import WebSocketTicket
from config.asgi import application
from realtime.broadcast import broadcast


def _token(user) -> str:
    return str(AccessToken.for_user(user))


def _refresh_token(user) -> str:
    return str(RefreshToken.for_user(user))


async def _connect(token: str | None = None, *, ticket: str | None = None):
    query = f"?ticket={ticket}" if ticket else f"?token={token}" if token else ""
    path = "/ws/events/" + query
    comm = WebsocketCommunicator(application, path)
    connected, _ = await comm.connect()
    return comm, connected


@pytest.mark.django_db(transaction=True)
async def test_reject_without_token():
    comm, connected = await _connect(None)
    assert connected is False
    await comm.disconnect()


@pytest.mark.django_db(transaction=True)
async def test_reject_bad_token():
    comm, connected = await _connect("garbage.token.here")
    assert connected is False
    await comm.disconnect()


@pytest.mark.django_db(transaction=True)
async def test_reject_refresh_token(distributor):
    refresh_token = await sync_to_async(_refresh_token)(distributor)
    comm, connected = await _connect(refresh_token)
    assert connected is False
    await comm.disconnect()


@pytest.mark.django_db(transaction=True)
async def test_reject_malformed_query_token():
    comm, connected = await _connect("%00")
    assert connected is False
    await comm.disconnect()


@pytest.mark.django_db(transaction=True)
async def test_one_time_ticket_cannot_be_replayed(distributor):
    raw_ticket = "test-one-time-ticket"
    ticket = await sync_to_async(WebSocketTicket.objects.create)(
        user=distributor,
        token_hash=hashlib.sha256(raw_ticket.encode()).hexdigest(),
        expires_at=timezone.now() + timedelta(seconds=30),
    )
    comm, connected = await _connect(ticket=raw_ticket)
    assert connected is True
    await comm.receive_json_from()
    await comm.disconnect()
    replay, replay_connected = await _connect(ticket=raw_ticket)
    assert replay_connected is False
    await replay.disconnect()


@pytest.mark.django_db(transaction=True)
async def test_distributor_joins_own_group(distributor):
    comm, connected = await _connect(_token(distributor))
    assert connected is True
    hello = await comm.receive_json_from()
    assert hello["event"] == "connected"
    assert f"distributor_{distributor.id}" in hello["payload"]["groups"]
    assert "user_" + str(distributor.id) in hello["payload"]["groups"]
    assert "admin_dashboard" not in hello["payload"]["groups"]
    await comm.disconnect()


@pytest.mark.django_db(transaction=True)
async def test_admin_joins_dashboard_group(admin_user):
    comm, connected = await _connect(_token(admin_user))
    assert connected is True
    hello = await comm.receive_json_from()
    assert "admin_dashboard" in hello["payload"]["groups"]
    await comm.disconnect()


@pytest.mark.django_db(transaction=True)
async def test_broadcast_reaches_client(admin_user):
    comm, connected = await _connect(_token(admin_user))
    assert connected is True
    await comm.receive_json_from()  # connected

    await sync_to_async(broadcast)(
        "admin_dashboard", "sale.created", {"number": "SOT-2026-00001"}
    )

    msg = await comm.receive_json_from()
    assert msg["event"] == "sale.created"
    assert re.fullmatch(r"SOT-\d{4}-00001", msg["payload"]["number"])
    await comm.disconnect()


@pytest.mark.django_db(transaction=True)
async def test_ping_pong(distributor):
    comm, _ = await _connect(_token(distributor))
    await comm.receive_json_from()  # connected
    await comm.send_json_to({"type": "ping"})
    pong = await comm.receive_json_from()
    assert pong["event"] == "pong"
    await comm.disconnect()


# ------------------------------------------------ audit SEC-116 (2026-09-30)

@pytest.mark.django_db(transaction=True)
async def test_branch_manager_joins_only_own_branch_dashboard():
    from apps.users.models import User
    from apps.warehouse.models import Warehouse

    branch = await sync_to_async(Warehouse.objects.create)(name="Filial X", is_branch=True)
    manager = await sync_to_async(User.objects.create_user)(
        phone="+998907778899", password="pass12345", full_name="Rahbar X",
        role="BRANCH_MANAGER", warehouse=branch,
    )
    comm, connected = await _connect(_token(manager))
    assert connected is True
    groups = (await comm.receive_json_from())["payload"]["groups"]

    assert "admin_dashboard" not in groups
    assert f"admin_dashboard_{branch.pk}" in groups
    await comm.disconnect()
