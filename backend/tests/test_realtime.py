"""8-bosqich: WebSocket consumer + event yetkazish (CLAUDE.md 11)."""
import pytest
from asgiref.sync import sync_to_async
from channels.testing import WebsocketCommunicator
from rest_framework_simplejwt.tokens import AccessToken

from config.asgi import application
from realtime.broadcast import broadcast


def _token(user) -> str:
    return str(AccessToken.for_user(user))


async def _connect(token: str | None):
    path = "/ws/events/" + (f"?token={token}" if token else "")
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
    assert msg["payload"]["number"] == "SOT-2026-00001"
    await comm.disconnect()


@pytest.mark.django_db(transaction=True)
async def test_ping_pong(distributor):
    comm, _ = await _connect(_token(distributor))
    await comm.receive_json_from()  # connected
    await comm.send_json_to({"type": "ping"})
    pong = await comm.receive_json_from()
    assert pong["event"] == "pong"
    await comm.disconnect()
