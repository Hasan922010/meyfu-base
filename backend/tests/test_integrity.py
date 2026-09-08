"""15-bosqich: butunlik nazorati va tizim salomatligi (CLAUDE.md 5.2, 15, 18)."""
from __future__ import annotations

from decimal import Decimal
from io import StringIO

import pytest
from django.core.management import call_command

from apps.core.models import AuditLog
from apps.core.services.integrity import run_integrity_check
from apps.wallet.models import DistributorWallet
from apps.wallet.services import wallet_apply


@pytest.fixture
def walleted(distributor):
    """Hamyoni bor tarqatuvchi — balans jurnal bilan mos."""
    wallet_apply(
        distributor=distributor, transaction_type="SALE_CASH",
        amount=Decimal("100000"),
    )
    return distributor


@pytest.mark.django_db
def test_clean_system_has_no_mismatch(walleted):
    result = run_integrity_check()
    assert result["ok"] is True
    assert result["mismatch_count"] == 0


@pytest.mark.django_db
def test_wallet_drift_is_detected(walleted):
    DistributorWallet.objects.filter(distributor=walleted).update(
        balance=Decimal("99999")
    )
    result = run_integrity_check()

    assert result["ok"] is False
    assert result["mismatch_count"] == 1
    m = result["mismatches"][0]
    assert m["kind"] == "wallet"
    assert m["stored"] == "99999.00"
    assert m["ledger"] == "100000.00"


@pytest.mark.django_db
def test_command_exits_nonzero_on_mismatch(walleted):
    DistributorWallet.objects.filter(distributor=walleted).update(
        balance=Decimal("0")
    )
    with pytest.raises(SystemExit) as exc:
        call_command("check_integrity", stdout=StringIO())
    assert exc.value.code == 1


@pytest.mark.django_db
def test_command_fix_resyncs_denormalized_value(walleted):
    DistributorWallet.objects.filter(distributor=walleted).update(
        balance=Decimal("5")
    )
    call_command("check_integrity", "--fix", stdout=StringIO())

    wallet = DistributorWallet.objects.get(distributor=walleted)
    assert wallet.balance == Decimal("100000")
    # jurnal tegilmagan — bitta yozuv (CORRECTION qo'shilmagan)
    assert wallet.transactions.count() == 1


@pytest.mark.django_db
def test_nightly_task_writes_auditlog_and_notifies(walleted, admin_user):
    from apps.core.tasks import check_integrity
    from apps.notifications.models import Notification

    DistributorWallet.objects.filter(distributor=walleted).update(
        balance=Decimal("1")
    )
    check_integrity()

    log = AuditLog.objects.filter(action="integrity.check").latest("created_at")
    assert log.changes["ok"] is False
    assert log.changes["mismatch_count"] == 1
    assert Notification.objects.filter(
        user=admin_user, type="integrity.mismatch"
    ).exists()


# --------------------------------------------------------------------------- #
#  Endpointlar
# --------------------------------------------------------------------------- #
@pytest.mark.django_db
def test_health_endpoint_public(api):
    resp = api.get("/api/v1/health/")
    assert resp.status_code == 200
    assert resp.data["data"]["checks"]["db"] is True
    assert "disk" in resp.data["data"]["checks"]


@pytest.mark.django_db
def test_system_status_requires_admin(auth_api, manager_api):
    assert auth_api.get("/api/v1/system/status/").status_code == 403

    resp = manager_api.get("/api/v1/system/status/")
    assert resp.status_code == 200
    body = resp.data["data"]
    assert "health" in body and "integrity" in body and "backup" in body


@pytest.mark.django_db
def test_integrity_endpoint_get_and_fix(admin_api, manager_api, distributor):
    wallet_apply(
        distributor=distributor, transaction_type="SALE_CASH",
        amount=Decimal("50000"),
    )
    DistributorWallet.objects.filter(distributor=distributor).update(
        balance=Decimal("40000")
    )

    # MANAGER ko'radi, tuzata olmaydi
    assert manager_api.get("/api/v1/system/integrity/").data["data"]["ok"] is False
    assert manager_api.post("/api/v1/system/integrity/").status_code == 403

    # SUPER_ADMIN tuzatadi
    resp = admin_api.post("/api/v1/system/integrity/")
    assert resp.status_code == 200
    assert resp.data["data"]["ok"] is True
    assert DistributorWallet.objects.get(
        distributor=distributor
    ).balance == Decimal("50000")
    assert AuditLog.objects.filter(action="integrity.fix").exists()
