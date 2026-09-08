import pytest


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
