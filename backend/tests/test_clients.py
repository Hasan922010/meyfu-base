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
def test_client_opening_debt_without_sale(manager_api, routed_clients):
    """CLAUDE.md 6 — Boshlang'ich qoldiqlar: mijozning boshlang'ich qarzini
    sotuvsiz kiritish (Debt.sale=None), current_debt yangilanadi."""
    from apps.sales.models import Debt

    client = routed_clients["my_client"]
    assert client.current_debt == "0.00" or float(client.current_debt) == 0

    resp = manager_api.post(
        "/api/v1/clients/opening-balance/",
        {"client": str(client.id), "amount": "150000", "note": "Eski qarz"},
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["data"]["sale"] is None

    client.refresh_from_db()
    assert float(client.current_debt) == 150000.0
    debt = Debt.objects.get(client=client)
    assert debt.sale is None
    assert debt.remaining == 150000
    assert debt.status == "ACTIVE"


@pytest.mark.django_db
def test_client_opening_debt_rejects_non_positive(manager_api, routed_clients):
    resp = manager_api.post(
        "/api/v1/clients/opening-balance/",
        {"client": str(routed_clients["my_client"].id), "amount": "0"},
        format="json",
    )
    assert resp.status_code == 400


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
def test_distributor_can_create_client_in_own_route(auth_api, routed_clients):
    # O'z marshrutiga mijoz qo'shishi mumkin
    resp = auth_api.post(
        "/api/v1/clients/",
        {
            "name": "Yangi Do'kon",
            "phone": "+998901112233",
            "route": str(routed_clients["my_route"].id),
        },
        format="json",
    )
    assert resp.status_code == 201

    # Begona marshrutga qo'shish rad etiladi
    other_route = routed_clients["other_client"].route
    resp_other = auth_api.post(
        "/api/v1/clients/",
        {
            "name": "Begona Do'kon",
            "phone": "+998909998877",
            "route": str(other_route.id),
        },
        format="json",
    )
    assert resp_other.status_code == 409


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


@pytest.mark.django_db
def test_client_phone_must_be_uzbek_mobile(manager_api):
    """Audit m2: "123" telefon sifatida qabul qilinmasin."""
    resp = manager_api.post(
        "/api/v1/clients/", {"name": "UX Test", "phone": "123"}, format="json"
    )
    assert resp.status_code == 400
    assert "phone" in resp.data["error"]["details"]


@pytest.mark.django_db
def test_client_local_phone_is_normalized(manager_api):
    resp = manager_api.post(
        "/api/v1/clients/", {"name": "UX Test", "phone": "90 123-45-67"}, format="json"
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["data"]["phone"] == "+998901234567"


@pytest.mark.django_db
def test_assigned_to_client_ownership_and_filtering(
    manager_api, auth_api, distributor, routed_clients
):
    from tests.conftest import _bearer

    other = routed_clients["other_distributor"]
    other_api = _bearer(other.phone)

    # 1. Rahbar marshrutsiz, lekin to'g'ridan-to'g'ri xodimga biriktirilgan mijoz yaratadi
    c1 = manager_api.post(
        "/api/v1/clients/",
        {
            "name": "Ali Shaxsiy Do'koni",
            "assigned_to": str(distributor.id),
            "phone": "+998901010101",
        },
        format="json",
    )
    assert c1.status_code == 201, c1.data
    assert str(c1.data["data"]["assigned_to"]) == str(distributor.id)
    assert c1.data["data"]["assigned_to_name"] == distributor.full_name

    # 2. Mijoz other_route'da bo'lsa ham assigned_to=distributor ustuvor
    c2 = manager_api.post(
        "/api/v1/clients/",
        {
            "name": "Biriktirilgan Qayta",
            "route": str(routed_clients["other_route"].id),
            "assigned_to": str(distributor.id),
        },
        format="json",
    )
    assert c2.status_code == 201, c2.data

    my_names = {c["name"] for c in auth_api.get("/api/v1/clients/").data["data"]["results"]}
    assert "Ali Shaxsiy Do'koni" in my_names
    assert "Biriktirilgan Qayta" in my_names

    other_names = {c["name"] for c in other_api.get("/api/v1/clients/").data["data"]["results"]}
    assert "Ali Shaxsiy Do'koni" not in other_names
    assert "Biriktirilgan Qayta" not in other_names

    # Filtr va saralash
    filtered = manager_api.get(f"/api/v1/clients/?assigned_to={distributor.id}&ordering=assigned_to__full_name")
    assert filtered.status_code == 200
    assert {c["name"] for c in filtered.data["data"]["results"]} == {
        "Ali Shaxsiy Do'koni",
        "Biriktirilgan Qayta",
    }

    # Tashrif va begona xodimni rad etish
    visit_ok = auth_api.post(
        "/api/v1/client-visits/",
        {"client": c1.data["data"]["id"], "result": "SOTUV"},
        format="json",
    )
    assert visit_ok.status_code == 201

    visit_bad = other_api.post(
        "/api/v1/client-visits/",
        {"client": c1.data["data"]["id"], "result": "SOTUV"},
        format="json",
    )
    assert visit_bad.status_code == 403


@pytest.mark.django_db
def test_field_staff_create_client_auto_assigns_to_self(distributor, manager_api):
    from rest_framework.test import APIClient

    from apps.users.models import User

    wh = User.objects.create_user(
        phone="+998904443322", password="pass12345", full_name="Omborchi Mijoz", role="WAREHOUSE"
    )
    wh_api = APIClient()
    wh_api.force_authenticate(user=wh)

    # Omborchi marshrutsiz o'z mijozini yaratadi -> avtomatik assigned_to=wh
    resp = wh_api.post(
        "/api/v1/clients/",
        {"name": "Omborchi Mijozi", "phone": "+998902221100"},
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert str(resp.data["data"]["assigned_to"]) == str(wh.id)

    # Boshqa xodimga yozib bo'lmaydi
    resp_other = wh_api.post(
        "/api/v1/clients/",
        {"name": "Begona", "assigned_to": str(distributor.id)},
        format="json",
    )
    assert resp_other.status_code == 409

    # O'z mijozining mas'ul xodimini o'zgartira olmaydi
    patch_resp = wh_api.patch(
        f"/api/v1/clients/{resp.data['data']['id']}/",
        {"assigned_to": str(distributor.id)},
        format="json",
    )
    assert patch_resp.status_code == 403


@pytest.mark.django_db
def test_central_admin_assigning_branch_staff_propagates_branch_and_rejects_mismatch(admin_api):
    from apps.clients.models import Route
    from apps.users.models import User
    from apps.warehouse.models import Warehouse
    from tests.conftest import _bearer

    branch_a = Warehouse.objects.create(name="Filial A", is_branch=True)
    branch_b = Warehouse.objects.create(name="Filial B", is_branch=True)
    dist_a = User.objects.create_user(
        phone="+998907110001", password="pass12345", full_name="Agent Filial A",
        role="DISTRIBUTOR", warehouse=branch_a,
    )
    route_b = Route.objects.create(name="Marshrut B", branch=branch_b)

    # Markaz rahbari marshrutsiz mijozni Filial A xodimiga biriktiradi -> filial avtomatik o'tadi
    created = admin_api.post(
        "/api/v1/clients/",
        {"name": "Filial A Do'koni", "assigned_to": str(dist_a.id)},
        format="json",
    )
    assert created.status_code == 201, created.data
    assert str(created.data["data"]["branch"]) == str(branch_a.id)

    dist_a_api = _bearer("+998907110001")
    my_clients = dist_a_api.get("/api/v1/clients/")
    assert my_clients.status_code == 200
    assert [c["name"] for c in my_clients.data["data"]["results"]] == ["Filial A Do'koni"]

    # Filial B marshruti bilan Filial A xodimini aralashtirish -> 400 xato
    mismatch = admin_api.post(
        "/api/v1/clients/",
        {
            "name": "Aralash Xato",
            "assigned_to": str(dist_a.id),
            "route": str(route_b.id),
        },
        format="json",
    )
    assert mismatch.status_code == 400


@pytest.mark.django_db
def test_client_debts_endpoint_returns_serialized_items(auth_api, manager_api, van_stocked):
    client = van_stocked["client"]
    product = van_stocked["product"]

    sale_resp = auth_api.post(
        "/api/v1/sales/",
        {
            "client": str(client.id),
            "payment_type": "QARZ",
            "due_date": "2026-12-01",
            "items": [{"product": str(product.id), "quantity": "2", "price": "25000"}],
        },
        format="json",
    )
    assert sale_resp.status_code == 201

    resp = manager_api.get(f"/api/v1/clients/{client.id}/debts/")
    assert resp.status_code == 200
    data = resp.data["data"]
    assert data["current_debt"] == "50000.00"
    assert len(data["items"]) == 1
    assert data["items"][0]["remaining"] == "50000.00"
    assert data["items"][0]["client_phone"] == client.phone

