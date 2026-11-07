from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.urls import reverse
from django.utils import timezone

from apps.core.models import AuditLog
from apps.core.services.test_cleanup import CleanupBlocked, build_plan, execute_cleanup
from apps.dayclose.models import CashHandover, DayClose
from apps.finance.models import CashAccount, CashTransaction
from apps.finance.services.cash import cash_apply
from apps.wallet.models import DistributorWallet, WalletTransaction
from apps.wallet.services import wallet_apply

pytestmark = pytest.mark.django_db


@pytest.fixture
def handover_case(admin_user, distributor):
    date = timezone.localdate()
    cash_control = cash_apply(
        transaction_type="CORRECTION", amount=Decimal("10"),
        reference_type="manual", date=date,
    )
    wallet_control = wallet_apply(
        distributor=distributor, transaction_type="CORRECTION", amount=Decimal("100"),
        reference_type="opening_balance", date=date,
    )
    close = DayClose.objects.create(
        distributor=distributor, date=date, status="CLOSED",
        cash_expected=100, cash_handed_amount=30, cash_difference=-70,
        wallet_balance_end=70, sold_amount=1234, returned_amount=266,
        closed_by=admin_user, closed_at=timezone.now(),
    )
    handover = CashHandover.objects.create(
        distributor=distributor, day_close=close, date=date,
        amount=30, confirmed=True, received_by=admin_user,
    )
    cash_entry = cash_apply(
        transaction_type="HANDOVER_IN", amount=Decimal("30"), date=date,
        reference_type="cash_handover", reference_id=handover.pk,
    )
    wallet_entry = wallet_apply(
        distributor=distributor, transaction_type="HANDOVER", amount=Decimal("-30"),
        date=date, reference_type="cash_handover", reference_id=handover.pk,
    )
    return {
        "handover": handover, "close": close, "cash": cash_entry, "wallet": wallet_entry,
        "cash_control": cash_control, "wallet_control": wallet_control,
    }


def clean(entry, user):
    label = entry._meta.label_lower
    plan = build_plan(label, [entry.pk], user=user)
    return execute_cleanup(
        label, [entry.pk], user=user, expected_digest=plan.digest,
        reason="Soxta naqd topshirish",
    )


@pytest.mark.parametrize("side", ["cash", "wallet"])
def test_handover_cleans_both_sides_and_updates_only_cash_snapshot(handover_case, admin_user, side):
    case = handover_case
    close = case["close"]
    old_closed_at = close.closed_at
    assert clean(case[side], admin_user) == 3
    assert not CashHandover.objects.filter(pk=case["handover"].pk).exists()
    assert CashHandover.all_objects.get(pk=case["handover"].pk).is_deleted
    assert not CashTransaction.objects.filter(pk=case["cash"].pk).exists()
    assert not WalletTransaction.objects.filter(pk=case["wallet"].pk).exists()
    assert CashTransaction.objects.filter(pk=case["cash_control"].pk).exists()
    assert WalletTransaction.objects.filter(pk=case["wallet_control"].pk).exists()
    assert CashAccount.objects.get(pk=case["cash"].account_id).balance == 10
    assert DistributorWallet.objects.get(pk=case["wallet"].wallet_id).balance == 100
    close.refresh_from_db()
    assert close.cash_handed_amount == 0
    assert close.cash_difference == -100
    assert close.wallet_balance_end == 100
    assert close.status == "CLOSED" and close.closed_at == old_closed_at
    assert close.sold_amount == 1234 and close.returned_amount == 266
    assert close.closed_by_id == admin_user.pk
    audit = AuditLog.objects.get(action="admin.test_operations_cleaned")
    assert len(audit.changes["rows"]) == 3
    assert any(e["before"]["model"] == "dayclose.dayclose" for e in audit.changes["effects"])


def test_preview_does_not_mutate_handover(handover_case, admin_user):
    case = handover_case
    plan = build_plan("finance.cashtransaction", [case["cash"].pk], user=admin_user)
    assert len(plan.rows) == 3
    assert plan.effects[("dayclose.dayclose", str(case["close"].pk))][1] == {
        "cash_handed_amount": Decimal("0"),
        "cash_difference": Decimal("-100"),
        "wallet_balance_end": Decimal("100"),
    }
    assert CashHandover.objects.filter(pk=case["handover"].pk).exists()
    assert CashAccount.objects.get(pk=case["cash"].account_id).balance == 40
    assert not AuditLog.objects.filter(action="admin.test_operations_cleaned").exists()


def test_missing_pair_blocks_without_partial_cleanup(handover_case, admin_user):
    case = handover_case
    WalletTransaction.all_objects.filter(pk=case["wallet"].pk).update(
        reference_id="missing-reference",
    )
    with pytest.raises(CleanupBlocked, match="juftligi mos emas"):
        clean(case["cash"], admin_user)
    assert CashTransaction.objects.filter(pk=case["cash"].pk).exists()
    assert CashHandover.objects.filter(pk=case["handover"].pk).exists()
    assert CashAccount.objects.get(pk=case["cash"].account_id).balance == 40


def test_mismatched_dayclose_blocks(handover_case, admin_user):
    case = handover_case
    DayClose.objects.filter(pk=case["close"].pk).update(cash_handed_amount=999)
    with pytest.raises(CleanupBlocked, match="pul ko‘rsatkichlari"):
        clean(case["cash"], admin_user)
    assert CashHandover.objects.filter(pk=case["handover"].pk).exists()


def test_later_dayclose_remains_protected(handover_case, admin_user, distributor):
    case = handover_case
    DayClose.objects.create(
        distributor=distributor, date=case["close"].date + timedelta(days=1),
        status="CLOSED", wallet_balance_end=70,
    )
    with pytest.raises(CleanupBlocked, match="keyin boshqa kun yopish"):
        clean(case["cash"], admin_user)
    assert CashHandover.objects.filter(pk=case["handover"].pk).exists()


def test_other_later_cash_operation_is_not_removed(handover_case, admin_user):
    case = handover_case
    later = cash_apply(
        transaction_type="CORRECTION", amount=Decimal("5"), reference_type="manual",
    )
    with pytest.raises(CleanupBlocked, match="keyin boshqa operatsiyalar"):
        clean(case["cash"], admin_user)
    assert CashTransaction.objects.filter(pk=later.pk).exists()
    assert CashAccount.objects.get(pk=case["cash"].account_id).balance == 45


def test_audit_failure_rolls_back_both_legs_and_dayclose(handover_case, admin_user):
    case = handover_case
    with patch.object(AuditLog.objects, "create", side_effect=RuntimeError("audit unavailable")):
        with pytest.raises(RuntimeError):
            clean(case["cash"], admin_user)
    assert CashTransaction.objects.filter(pk=case["cash"].pk).exists()
    assert WalletTransaction.objects.filter(pk=case["wallet"].pk).exists()
    case["close"].refresh_from_db()
    assert case["close"].cash_handed_amount == 30
    assert case["close"].wallet_balance_end == 70


def test_cash_handover_admin_confirmation(client, admin_user, handover_case):
    case = handover_case
    client.force_login(admin_user)
    url = reverse("admin:finance_cashtransaction_changelist")
    selection = {
        "action": "cleanup_selected_test_operations",
        "_selected_action": [str(case["cash"].pk)],
    }
    preview = client.post(url, selection)
    assert preview.status_code == 200
    assert len(preview.context["rows"]) == 3
    assert any(
        change["new"] == -100 for effect in preview.context["effects"]
        for change in effect["changes"]
    )
    response = client.post(url, {
        **selection, "apply_cleanup": "yes", "cleanup_token": preview.context["cleanup_token"],
        "reason": "Soxta kun yopish topshirishi", "confirmation": "TOZALASH",
        "password": "admin12345", "acknowledged": "on",
    })
    assert response.status_code == 302
    assert not CashHandover.objects.filter(pk=case["handover"].pk).exists()
    assert CashAccount.objects.get(pk=case["cash"].account_id).balance == 10


@pytest.mark.parametrize("both", [False, True])
def test_multiple_handovers_same_day_preserve_unselected_pair(
    handover_case, admin_user, distributor, both,
):
    case = handover_case
    close = case["close"]
    second = CashHandover.objects.create(
        distributor=distributor, day_close=close, date=close.date,
        amount=20, confirmed=True, received_by=admin_user,
    )
    cash_entry = cash_apply(
        transaction_type="HANDOVER_IN", amount=Decimal("20"), date=close.date,
        reference_type="cash_handover", reference_id=second.pk,
    )
    wallet_apply(
        distributor=distributor, transaction_type="HANDOVER", amount=Decimal("-20"),
        date=close.date, reference_type="cash_handover", reference_id=second.pk,
    )
    DayClose.objects.filter(pk=close.pk).update(
        cash_handed_amount=50, cash_difference=-50, wallet_balance_end=50,
    )
    ids = [cash_entry.pk] + ([case["cash"].pk] if both else [])
    plan = build_plan("finance.cashtransaction", ids, user=admin_user)
    count = execute_cleanup(
        "finance.cashtransaction", ids, user=admin_user,
        expected_digest=plan.digest, reason="Soxta topshirishlar",
    )
    assert count == (6 if both else 3)
    assert CashHandover.objects.filter(pk=case["handover"].pk).exists() is not both
    close.refresh_from_db()
    assert close.cash_handed_amount == (0 if both else 30)
    assert close.wallet_balance_end == (100 if both else 70)
    assert close.cash_difference == close.cash_handed_amount - 100
    assert CashAccount.objects.get(pk=cash_entry.account_id).balance == (10 if both else 40)


def test_changed_dayclose_invalidates_confirmation(handover_case, admin_user):
    case = handover_case
    plan = build_plan("finance.cashtransaction", [case["cash"].pk], user=admin_user)
    DayClose.objects.filter(pk=case["close"].pk).update(sold_amount=9999)
    with pytest.raises(CleanupBlocked, match="Ma’lumot o‘zgargan"):
        execute_cleanup(
            "finance.cashtransaction", [case["cash"].pk], user=admin_user,
            expected_digest=plan.digest, reason="Soxta",
        )
    assert CashHandover.objects.filter(pk=case["handover"].pk).exists()
