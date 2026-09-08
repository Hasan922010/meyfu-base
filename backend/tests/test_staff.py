"""Xodimlar boshqaruvi — CRUD (CLAUDE.md 2, 6, 18)."""
from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model

from apps.users.models import DistributorProfile

User = get_user_model()


@pytest.mark.django_db
def test_super_admin_creates_distributor_with_profile(admin_api):
    resp = admin_api.post(
        "/api/v1/users/",
        {
            "phone": "998907001122",
            "full_name": "Yangi Tarqatuvchi",
            "role": "DISTRIBUTOR",
            "password": "startpass123",
            "distributor_profile": {
                "commission_percent": "6", "base_salary": "2500000",
                "debt_limit": "1500000",
            },
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["data"]["phone"] == "+998907001122"  # normalizatsiya
    user = User.objects.get(phone="+998907001122")
    assert user.check_password("startpass123")
    assert user.distributor_profile.commission_percent == 6

    # login ishlaydi
    login = admin_api.post(
        "/api/v1/auth/login/",
        {"phone": "+998907001122", "password": "startpass123"},
        format="json",
    )
    assert login.status_code == 200


@pytest.mark.django_db
def test_manager_cannot_create_user(manager_api):
    resp = manager_api.post(
        "/api/v1/users/",
        {"phone": "998907003344", "full_name": "X", "role": "MANAGER",
         "password": "startpass123"},
        format="json",
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_create_requires_password(admin_api):
    resp = admin_api.post(
        "/api/v1/users/",
        {"phone": "998907005566", "full_name": "X", "role": "WAREHOUSE"},
        format="json",
    )
    assert resp.status_code == 400
    assert "password" in resp.data["error"]["details"]


@pytest.mark.django_db
def test_duplicate_phone_rejected(admin_api, distributor):
    resp = admin_api.post(
        "/api/v1/users/",
        {"phone": "998901112233", "full_name": "Dubl", "role": "MANAGER",
         "password": "startpass123"},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_edit_user_and_profile(admin_api, distributor):
    resp = admin_api.patch(
        f"/api/v1/users/{distributor.id}/",
        {"full_name": "Yangilangan Ism",
         "distributor_profile": {"commission_percent": "8"}},
        format="json",
    )
    assert resp.status_code == 200
    distributor.refresh_from_db()
    assert distributor.full_name == "Yangilangan Ism"
    assert DistributorProfile.objects.get(user=distributor).commission_percent == 8


@pytest.mark.django_db
def test_two_stage_commission_percents_round_trip(admin_api, distributor):
    resp = admin_api.patch(
        f"/api/v1/users/{distributor.id}/",
        {"distributor_profile": {
            "order_commission_percent": "2.5",
            "delivery_commission_percent": "3",
        }},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    profile = resp.data["data"]["distributor_profile"]
    assert profile["order_commission_percent"] == "2.50"
    assert profile["delivery_commission_percent"] == "3.00"

    prof = DistributorProfile.objects.get(user=distributor)
    assert prof.order_commission_percent == 2.5
    assert prof.delivery_commission_percent == 3


@pytest.mark.django_db
def test_toggle_active_blocks_and_audits(admin_api, distributor):
    resp = admin_api.post(f"/api/v1/users/{distributor.id}/toggle_active/")
    assert resp.status_code == 200
    distributor.refresh_from_db()
    assert distributor.is_active is False

    from apps.core.models import AuditLog
    assert AuditLog.objects.filter(
        action="user.block", object_id=str(distributor.id)
    ).exists()


@pytest.mark.django_db
def test_cannot_block_self(admin_api, admin_user):
    resp = admin_api.post(f"/api/v1/users/{admin_user.id}/toggle_active/")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_delete_not_allowed(admin_api, distributor):
    resp = admin_api.delete(f"/api/v1/users/{distributor.id}/")
    assert resp.status_code == 405
