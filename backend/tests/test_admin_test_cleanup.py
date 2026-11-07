from decimal import Decimal
from unittest.mock import patch

import pytest
from django.core.exceptions import PermissionDenied, ValidationError
from django.urls import reverse
from django.utils import timezone

from apps.core.models import AuditLog
from apps.core.services.test_cleanup import CleanupBlocked, build_plan, execute_cleanup
from apps.finance.models import CashAccount, CashTransaction
from apps.finance.services.cash import cash_apply

pytestmark = pytest.mark.django_db


def cash(amount, **extra):
    return cash_apply(
        transaction_type="CORRECTION", amount=Decimal(str(amount)),
        reference_type="manual", **extra,
    )


def clean(entry, user, **kwargs):
    label = entry._meta.label_lower
    plan = build_plan(label, [entry.pk], user=user)
    return execute_cleanup(
        label, [entry.pk], user=user, expected_digest=plan.digest,
        reason="Sinovdagi soxta yozuv", **kwargs,
    )


def test_only_selected_tail_archived_with_snapshot(admin_user):
    real = cash(100)
    fake = cash(30)
    plan = build_plan("finance.cashtransaction", [fake.pk], user=admin_user)
    assert CashTransaction.objects.count() == 2  # Preview has no side effects.
    assert next(iter(plan.effects.values()))[1]["balance"] == Decimal("100")
    assert clean(fake, admin_user) == 1
    assert CashTransaction.objects.filter(pk=real.pk).exists()
    assert not CashTransaction.objects.filter(pk=fake.pk).exists()
    assert CashTransaction.all_objects.get(pk=fake.pk).is_deleted
    assert CashAccount.objects.get(pk=fake.account_id).balance == 100
    audit = AuditLog.objects.get(action="admin.test_operations_cleaned")
    assert audit.changes["rows"][0]["id"] == str(fake.pk)
    assert audit.changes["rows"][0]["fields"]["amount"] == "30.00"
    assert audit.changes["reason"] == "Sinovdagi soxta yozuv"
    real.refresh_from_db()
    assert real.balance_after == 100


def test_non_terminal_entry_blocked(admin_user):
    first = cash(100)
    cash(20)
    with pytest.raises(CleanupBlocked, match="keyin boshqa"):
        clean(first, admin_user)
    assert CashTransaction.objects.count() == 2
    assert not AuditLog.objects.exists()


def test_multiple_selected_terminal_entries(admin_user):
    real = cash(100)
    fake_a, fake_b = cash(10), cash(20)
    ids = [fake_a.pk, fake_b.pk]
    plan = build_plan("finance.cashtransaction", ids, user=admin_user)
    execute_cleanup(
        "finance.cashtransaction", ids, user=admin_user,
        expected_digest=plan.digest, reason="Soxta guruh",
    )
    assert list(CashTransaction.objects.values_list("pk", flat=True)) == [real.pk]
    assert CashAccount.objects.get(pk=real.account_id).balance == 100


def test_permissions_and_immutable_admin_still_protect_journals(manager, admin_user):
    entry = cash(10)
    manager.is_staff = True
    manager.save(update_fields=["is_staff"])
    with pytest.raises(PermissionDenied):
        clean(entry, manager)
    with pytest.raises(ValidationError):
        entry.delete()
    with pytest.raises(ValidationError):
        entry.hard_delete()
    from django.contrib import admin

    model_admin = admin.site._registry[CashTransaction]
    from django.test import RequestFactory

    request = RequestFactory().get("/")
    request.user = manager
    assert "cleanup_selected_test_operations" not in model_admin.get_actions(request)
    request.user = admin_user
    assert "cleanup_selected_test_operations" in model_admin.get_actions(request)
    assert not model_admin.has_delete_permission(request)
    assert not admin.site._registry[AuditLog].has_delete_permission(request)


def test_stale_preview_blocks_without_touching_data(admin_user):
    entry = cash(10)
    plan = build_plan("finance.cashtransaction", [entry.pk], user=admin_user)
    entry.note = "Changed since preview"
    CashTransaction.all_objects.filter(pk=entry.pk).update(note=entry.note)
    with pytest.raises(CleanupBlocked, match="o‘zgargan"):
        execute_cleanup(
            "finance.cashtransaction", [entry.pk], user=admin_user,
            expected_digest=plan.digest, reason="Soxta",
        )
    assert CashTransaction.objects.filter(pk=entry.pk).exists()


def test_audit_failure_rolls_back_archive_and_balance(admin_user):
    entry = cash(10)
    with patch.object(AuditLog.objects, "create", side_effect=RuntimeError("audit failed")):
        with pytest.raises(RuntimeError):
            clean(entry, admin_user)
    assert CashTransaction.objects.get(pk=entry.pk).is_deleted is False
    assert CashAccount.objects.get(pk=entry.account_id).balance == 10


def test_wallet_supplier_and_stock_balances(admin_user, distributor, warehouse, catalog):
    from apps.wallet.services import wallet_apply
    from apps.warehouse.services.stock import apply_movement
    from apps.warehouse.services.supplier_balance import supplier_apply

    wallet = wallet_apply(
        distributor=distributor, transaction_type="CORRECTION", amount=Decimal("50"),
    )
    supplier = supplier_apply(
        supplier=warehouse["supplier"], transaction_type="CORRECTION", amount=Decimal("20"),
    )
    movement = apply_movement(
        warehouse=warehouse["warehouse"], product=catalog["product"],
        quantity=Decimal("10"), movement_type="OPENING_BALANCE",
    )
    for entry in (wallet, supplier, movement):
        clean(entry, admin_user)
    from apps.wallet.models import DistributorWallet
    from apps.warehouse.models import Stock

    assert DistributorWallet.objects.get(distributor=distributor).balance == 0
    warehouse["supplier"].refresh_from_db()
    assert warehouse["supplier"].balance == 0
    assert Stock.objects.get(product=catalog["product"]).quantity == 0
    assert catalog["product"].__class__.objects.filter(pk=catalog["product"].pk).exists()


def test_stock_reserved_and_locked_warehouse_block(admin_user, warehouse, catalog):
    from apps.warehouse.models import Stock
    from apps.warehouse.services.stock import apply_movement

    entry = apply_movement(
        warehouse=warehouse["warehouse"], product=catalog["product"],
        quantity=Decimal("10"), movement_type="OPENING_BALANCE",
    )
    Stock.objects.update(reserved_quantity=Decimal("2"))
    with pytest.raises(CleanupBlocked, match="band qilingan"):
        clean(entry, admin_user)
    Stock.objects.update(reserved_quantity=0)
    wh = warehouse["warehouse"]
    wh.is_opening_locked = True
    wh.save(update_fields=["is_opening_locked"])
    with pytest.raises(CleanupBlocked, match="qulflangan"):
        clean(entry, admin_user)


def test_business_linked_company_expense_is_archived(admin_user):
    from apps.finance.models import CompanyExpense
    from apps.finance.services.cash import get_account

    expense = CompanyExpense.objects.create(date=timezone.localdate(), amount=10)
    entry = cash_apply(
        transaction_type="CORRECTION", amount=Decimal("-10"),
        reference_type="company_expense", reference_id=expense.pk,
    )
    CompanyExpense.objects.filter(pk=expense.pk).update(cash_transaction=entry)
    clean(entry, admin_user)
    assert not CompanyExpense.objects.filter(pk=expense.pk).exists()
    assert CompanyExpense.all_objects.filter(pk=expense.pk, is_deleted=True).exists()
    assert get_account().balance == 0


def test_unknown_business_reference_blocked(admin_user):
    entry = cash_apply(
        transaction_type="CORRECTION", amount=Decimal("10"),
        reference_type="unknown-operation", reference_id="unknown-document",
    )
    with pytest.raises(CleanupBlocked, match="xavfsiz"):
        clean(entry, admin_user)
    assert CashTransaction.objects.filter(pk=entry.pk).exists()


def test_paired_cash_transfer_archives_both_legs(admin_user, warehouse):
    from apps.finance.services.cash import get_account

    branch = warehouse["warehouse"]
    branch.is_branch = True
    branch.save(update_fields=["is_branch"])
    center_entry = cash_apply(
        transaction_type="CORRECTION", amount=Decimal("10"),
        reference_type="branch_cash_transfer", reference_id="paired-test",
    )
    branch_entry = cash_apply(
        transaction_type="CORRECTION", amount=Decimal("-10"), branch=branch,
        reference_type="branch_cash_transfer", reference_id="paired-test",
    )
    assert clean(center_entry, admin_user) == 2
    assert not CashTransaction.objects.filter(pk=branch_entry.pk).exists()
    assert get_account().balance == get_account(branch).balance == 0


def test_sale_archive_restores_van_stock_debt_and_wallet(
    admin_user, distributor, warehouse, catalog,
):
    from apps.clients.models import Client
    from apps.sales.models import Sale, SaleItem, Debt
    from apps.wallet.services import wallet_apply
    from apps.warehouse.models import Loading, LoadingItem, VanStock

    product = catalog["product"]
    loading = Loading.objects.create(
        number="TEST-LOAD", date=timezone.localdate(), distributor=distributor,
        warehouse=warehouse["warehouse"], status="CONFIRMED",
    )
    LoadingItem.objects.create(loading=loading, product=product, quantity=10, price=1)
    customer = Client.objects.create(name="Test customer", current_debt=5)
    sale = Sale.objects.create(
        number="TEST-SALE", date=timezone.localdate(), distributor=distributor,
        client=customer, payment_type="CASH", total_amount=20, paid_amount=15, debt_amount=5,
    )
    item = SaleItem.objects.create(sale=sale, product=product, quantity=2, price=10)
    Debt.objects.create(sale=sale, client=customer, amount=5, remaining=5)
    van = VanStock.objects.create(distributor=distributor, product=product, quantity=8)
    entry = wallet_apply(
        distributor=distributor, transaction_type="SALE_CASH", amount=Decimal("15"),
        reference_type="sale", reference_id=sale.pk,
    )
    clean(entry, admin_user)
    van.refresh_from_db()
    customer.refresh_from_db()
    assert van.quantity == 10
    assert customer.current_debt == 0
    assert not Sale.objects.filter(pk=sale.pk).exists()
    assert not SaleItem.objects.filter(pk=item.pk).exists()
    assert not Debt.objects.filter(sale=sale).exists()
    assert Sale.all_objects.filter(pk=sale.pk, is_deleted=True).exists()
    assert entry.wallet.__class__.objects.get(pk=entry.wallet_id).balance == 0


def test_admin_cleanup_post_requires_csrf(admin_user):
    from django.test import Client

    entry = cash(10)
    client = Client(enforce_csrf_checks=True)
    client.force_login(admin_user)
    response = client.post(reverse("admin:finance_cashtransaction_changelist"), {
        "action": "cleanup_selected_test_operations", "_selected_action": str(entry.pk),
    })
    assert response.status_code == 403
    assert CashTransaction.objects.filter(pk=entry.pk).exists()


def test_admin_confirmation_wrong_password_then_success(client, admin_user):
    entry = cash(25)
    client.force_login(admin_user)
    url = reverse("admin:finance_cashtransaction_changelist")
    selection = {
        "action": "cleanup_selected_test_operations",
        "_selected_action": [str(entry.pk)],
    }
    preview = client.post(url, selection)
    assert preview.status_code == 200
    assert "admin/test_cleanup_confirmation.html" in [t.name for t in preview.templates]
    assert CashTransaction.objects.filter(pk=entry.pk).exists()
    token = preview.context["cleanup_token"]
    confirmation = {
        **selection, "apply_cleanup": "yes", "cleanup_token": token,
        "reason": "Sinov yozuvi", "confirmation": "TOZALASH",
        "acknowledged": "on", "password": "wrong-password",
    }
    wrong = client.post(url, confirmation)
    assert wrong.status_code == 200
    assert "password" in wrong.context["form"].errors
    assert CashTransaction.objects.filter(pk=entry.pk).exists()
    confirmation["password"] = "admin12345"
    done = client.post(url, confirmation)
    assert done.status_code == 302
    assert not CashTransaction.objects.filter(pk=entry.pk).exists()


def test_admin_tampered_selection_and_missing_token_blocked(client, admin_user):
    fake = cash(10)
    client.force_login(admin_user)
    url = reverse("admin:finance_cashtransaction_changelist")
    request = {
        "action": "cleanup_selected_test_operations", "_selected_action": str(fake.pk),
        "apply_cleanup": "yes", "reason": "Soxta", "confirmation": "TOZALASH",
        "acknowledged": "on", "password": "admin12345",
    }
    assert client.post(url, request).status_code == 302
    assert CashTransaction.objects.filter(pk=fake.pk).exists()
    preview = client.post(url, {
        "action": request["action"], "_selected_action": str(fake.pk),
    })
    token = preview.context["cleanup_token"]
    request["cleanup_token"] = token + "-tampered"
    assert client.post(url, request).status_code == 302
    assert CashTransaction.objects.filter(pk=fake.pk).exists()
