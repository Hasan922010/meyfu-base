"""3-bosqich: Client/Route CRUD, tarqatuvchi ko'rish doirasi, tashrif (GPS)."""
import pytest

from apps.clients.models import Client, ClientVisit


@pytest.mark.django_db
def test_users_list_for_route_assignment(manager_api, distributor):
    resp = manager_api.get("/api/v1/users/?role=DISTRIBUTOR")
    assert resp.status_code == 200
    phones = [u["phone"] for u in resp.data["data"]["results"]]
    assert "+998901112233" in phones


@pytest.mark.django_db
def test_users_list_forbidden_for_distributor(auth_api):
    assert auth_api.get("/api/v1/users/").status_code == 403


@pytest.mark.django_db
def test_manager_creates_route_and_client(manager_api, distributor):
    r = manager_api.post(
        "/api/v1/routes/",
        {"name": "Sergeli", "distributor": str(distributor.id),
         "days_of_week": [2, 4]},
        format="json",
    )
    assert r.status_code == 201, r.data
    route_id = r.data["data"]["id"]

    c = manager_api.post(
        "/api/v1/clients/",
        {"name": "Yangi do'kon", "route": route_id, "phone": "+998900001122",
         "client_type": "SHOP", "debt_limit": "500000"},
        format="json",
    )
    assert c.status_code == 201, c.data
    assert Client.objects.filter(name="Yangi do'kon").exists()


@pytest.mark.django_db
def test_invalid_days_of_week_rejected(manager_api, distributor):
    r = manager_api.post(
        "/api/v1/routes/",
        {"name": "X", "distributor": str(distributor.id), "days_of_week": [0, 9]},
        format="json",
    )
    assert r.status_code == 400


@pytest.mark.django_db
def test_distributor_sees_only_own_route_clients(auth_api, routed_clients):
    resp = auth_api.get("/api/v1/clients/")
    assert resp.status_code == 200
    names = [c["name"] for c in resp.data["data"]["results"]]
    assert "Do'kon A" in names
    assert "Do'kon B" not in names


@pytest.mark.django_db
def test_distributor_cannot_create_client(auth_api, routed_clients):
    resp = auth_api.post(
        "/api/v1/clients/", {"name": "hack"}, format="json"
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_routes_my(auth_api, routed_clients):
    resp = auth_api.get("/api/v1/routes/my/")
    assert resp.status_code == 200
    data = resp.data["data"]
    assert len(data) == 1
    assert data[0]["name"] == "Chilonzor"
    assert data[0]["clients_count"] == 1
    assert data[0]["days_display"] == ["Dushanba", "Chorshanba", "Juma"]


@pytest.mark.django_db
def test_client_visit_checkin(auth_api, routed_clients):
    payload = {
        "client": str(routed_clients["my_client"].id),
        "latitude": "41.311081",
        "longitude": "69.240562",
        "result": "SOTUVSIZ",
        "note": "Egasi yo'q edi",
    }
    resp = auth_api.post("/api/v1/client-visits/", payload, format="json")
    assert resp.status_code == 201, resp.data
    visit = ClientVisit.objects.get()
    assert visit.distributor_id == routed_clients["my_client"].route.distributor_id
    assert visit.checked_in_at is not None
    assert str(visit.latitude) == "41.311081"


@pytest.mark.django_db
def test_visit_on_foreign_client_rejected(auth_api, routed_clients):
    resp = auth_api.post(
        "/api/v1/client-visits/",
        {"client": str(routed_clients["other_client"].id),
         "result": "SOTUV"},
        format="json",
    )
    assert resp.status_code == 403
    assert resp.data["error"]["code"] == "CLIENT_NOT_ON_ROUTE"


@pytest.mark.django_db
def test_visit_idempotent_client_uuid(auth_api, routed_clients):
    import uuid

    cu = str(uuid.uuid4())
    body = {
        "client": str(routed_clients["my_client"].id),
        "result": "SOTUV",
        "client_uuid": cu,
    }
    first = auth_api.post("/api/v1/client-visits/", body, format="json")
    assert first.status_code == 201
    second = auth_api.post("/api/v1/client-visits/", body, format="json")
    assert second.status_code == 400  # unique client_uuid
    assert ClientVisit.objects.filter(client_uuid=cu).count() == 1


@pytest.mark.django_db
def test_clients_sync_scoped_delta(auth_api, manager_api, routed_clients):
    full = auth_api.get("/api/v1/sync/clients/")
    assert full.status_code == 200
    assert full.data["data"]["count"] == 1  # faqat o'z marshruti

    all_clients = manager_api.get("/api/v1/sync/clients/")
    assert all_clients.data["data"]["count"] == 2


@pytest.mark.django_db
def test_blocked_client_flag(manager_api, routed_clients):
    cid = routed_clients["my_client"].id
    resp = manager_api.patch(
        f"/api/v1/clients/{cid}/", {"is_blocked": True}, format="json"
    )
    assert resp.status_code == 200
    routed_clients["my_client"].refresh_from_db()
    assert routed_clients["my_client"].is_blocked is True
