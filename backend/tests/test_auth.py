import pytest
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)
from rest_framework_simplejwt.tokens import RefreshToken


@pytest.mark.django_db
def test_login_returns_token_and_user(api, distributor):
    resp = api.post(
        "/api/v1/auth/login/",
        {"phone": "+998901112233", "password": "pass12345"},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["success"] is True
    data = resp.data["data"]
    assert data["access"] and data["refresh"]
    assert data["user"]["role"] == "DISTRIBUTOR"


@pytest.mark.django_db
@pytest.mark.parametrize(
    "typed_phone",
    ["+998 90 111 22 33", "998901112233", "901112233", "+998901112233 "],
)
def test_login_accepts_unnormalized_phone(api, distributor, typed_phone):
    resp = api.post(
        "/api/v1/auth/login/",
        {"phone": typed_phone, "password": "pass12345"},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    assert resp.data["data"]["user"]["phone"] == "+998901112233"


@pytest.mark.django_db
def test_login_wrong_password(api, distributor):
    resp = api.post(
        "/api/v1/auth/login/",
        {"phone": "+998901112233", "password": "wrong"},
        format="json",
    )
    assert resp.status_code == 401
    assert resp.data["success"] is False
    assert "error" in resp.data


@pytest.mark.django_db
def test_me_requires_auth(api):
    assert api.get("/api/v1/auth/me/").status_code == 401


@pytest.mark.django_db
def test_me_returns_current_user(auth_api):
    resp = auth_api.get("/api/v1/auth/me/")
    assert resp.status_code == 200
    assert resp.data["data"]["phone"] == "+998901112233"


@pytest.mark.django_db
def test_phone_normalized_on_create(distributor):
    assert distributor.phone.startswith("+")


@pytest.mark.django_db
def test_logout_blacklists_supplied_refresh_token(auth_api, distributor):
    refresh_token = str(RefreshToken.for_user(distributor))
    response = auth_api.post(
        "/api/v1/auth/logout/",
        {"refresh": refresh_token},
        format="json",
    )
    assert response.status_code == 200
    outstanding = OutstandingToken.objects.get(
        token=refresh_token
    )
    assert BlacklistedToken.objects.filter(token=outstanding).exists()


@pytest.mark.django_db
def test_websocket_ticket_requires_auth_and_has_short_expiry(auth_api):
    response = auth_api.post("/api/v1/auth/ws-ticket/", {}, format="json")
    assert response.status_code == 200
    assert len(response.data["data"]["ticket"]) >= 32
    assert response.data["data"]["expires_in"] == 30

    unauthenticated = auth_api.__class__()
    assert unauthenticated.post("/api/v1/auth/ws-ticket/").status_code == 401
