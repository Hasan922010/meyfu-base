"""12-bosqich: maosh (Payroll) — komissiya qoidalari, formula, ushlanmalar,
tasdiqlash/to'lash oqimi, rol ruxsatlari (CLAUDE.md 6, 7.10–7.11, 12, 18)."""
from __future__ import annotations

import datetime
from decimal import Decimal

import pytest

from apps.core.models import Setting
from apps.payroll.constants import CommissionScope, PayrollStatus
from apps.payroll.models import CommissionRule, Payroll
from apps.payroll.services import (
    calculate_payroll,
    payroll_matches_formula,
    resolve_commission,
)

PERIOD = datetime.date(2026, 9, 1)
SALE_DAY = datetime.date(2026, 9, 10)


@pytest.fixture
def paid_distributor(distributor):
    """base_salary + komissiya foizi bo'lgan tarqatuvchi."""
    profile = distributor.distributor_profile
    profile.base_salary = Decimal("3000000")
    profile.commission_percent = Decimal("5")
    profile.save()
    return distributor


def _make_sale(distributor, client, product, qty="10", price="27000",
               day=SALE_DAY, payment="NAQD"):
    from apps.catalog.models import Product
    from apps.sales.services.sale import SaleLine, create_sale

    # conftest `catalog` narxlarni string qiladi — DB'dan qayta o'qiymiz
    product = Product.objects.select_related("category", "unit").get(pk=product.pk)
    return create_sale(
        distributor=distributor,
        client=client,
        payment_type=payment,
        lines=[SaleLine(product=product, quantity=Decimal(qty), price=Decimal(price))],
        date=day,
    ).sale


# --------------------------------------------------------------------------- #
#  Komissiya qoidasi — aniqlik darajasi
# --------------------------------------------------------------------------- #
@pytest.mark.django_db
def test_commission_specificity_distributor_beats_all(paid_distributor, van_stocked):
    product = van_stocked["product"]
    CommissionRule.objects.create(
        scope=CommissionScope.GLOBAL, percent="3", valid_from=PERIOD,
    )
    CommissionRule.objects.create(
        scope=CommissionScope.CATEGORY, target_id=product.category_id, percent="4",
        valid_from=PERIOD,
    )
    CommissionRule.objects.create(
        scope=CommissionScope.PRODUCT, target_id=product.id, percent="6",
        valid_from=PERIOD,
    )
    CommissionRule.objects.create(
        scope=CommissionScope.DISTRIBUTOR, target_id=paid_distributor.id, percent="9",
        valid_from=PERIOD,
    )

    match = resolve_commission(
        distributor=paid_distributor, product=product, on_date=SALE_DAY
    )
    assert match.percent == Decimal("9")
    assert match.scope == CommissionScope.DISTRIBUTOR


@pytest.mark.django_db
def test_commission_priority_breaks_tie(paid_distributor, van_stocked):
    product = van_stocked["product"]
    CommissionRule.objects.create(
        scope=CommissionScope.GLOBAL, percent="3", valid_from=PERIOD, priority=1,
    )
    CommissionRule.objects.create(
        scope=CommissionScope.GLOBAL, percent="7", valid_from=PERIOD, priority=5,
    )
    match = resolve_commission(
        distributor=paid_distributor, product=product, on_date=SALE_DAY
    )
    assert match.percent == Decimal("7")


@pytest.mark.django_db
def test_commission_falls_back_to_profile_percent(paid_distributor, van_stocked):
    match = resolve_commission(
        distributor=paid_distributor, product=van_stocked["product"], on_date=SALE_DAY
    )
    assert match.percent == Decimal("5")  # DistributorProfile.commission_percent


@pytest.mark.django_db
def test_expired_rule_ignored(paid_distributor, van_stocked):
    CommissionRule.objects.create(
        scope=CommissionScope.GLOBAL, percent="20", valid_from=datetime.date(2026, 1, 1),
        valid_to=datetime.date(2026, 6, 30),
    )
    match = resolve_commission(
        distributor=paid_distributor, product=van_stocked["product"], on_date=SALE_DAY
    )
    assert match.percent == Decimal("5")  # eskirgan qoida hisobga olinmaydi


# --------------------------------------------------------------------------- #
#  calculate_payroll — formula
# --------------------------------------------------------------------------- #
@pytest.mark.django_db
def test_calculate_basic_commission_and_formula(paid_distributor, van_stocked):
    client = van_stocked["client"]
    product = van_stocked["product"]
    _make_sale(paid_distributor, client, product, qty="10", price="27000")  # 270 000

    payroll = calculate_payroll(distributor=paid_distributor, period=PERIOD)

    assert payroll.total_sales == Decimal("270000.00")
    assert payroll.commission_amount == Decimal("13500.00")  # 5% dan 270 000
    assert payroll.base_salary == Decimal("3000000.00")
    # final = base + commission + bonus + reimb − ushlanmalar − avans
    assert payroll.final_amount == Decimal("3013500.00")
    assert payroll_matches_formula(payroll)
    assert payroll.details.count() == 1
    assert payroll.status == PayrollStatus.DRAFT


@pytest.mark.django_db
def test_calculate_is_idempotent(paid_distributor, van_stocked):
    _make_sale(paid_distributor, van_stocked["client"], van_stocked["product"])
    p1 = calculate_payroll(distributor=paid_distributor, period=PERIOD)
    p2 = calculate_payroll(distributor=paid_distributor, period=PERIOD)
    assert p1.id == p2.id
    count = Payroll.objects.filter(distributor=paid_distributor, period=PERIOD).count()
    assert count == 1
    assert p2.details.count() == 1  # tafsilotlar takrorlanmadi


@pytest.mark.django_db
def test_advance_reduces_final(paid_distributor, van_stocked, admin_user):
    from apps.payroll.services import create_advance

    _make_sale(paid_distributor, van_stocked["client"], van_stocked["product"])
    create_advance(
        distributor=paid_distributor, amount=Decimal("500000"),
        date=datetime.date(2026, 9, 5), user=admin_user,
    )
    payroll = calculate_payroll(distributor=paid_distributor, period=PERIOD)
    assert payroll.advance == Decimal("500000.00")
    assert payroll.final_amount == Decimal("2513500.00")  # 3 013 500 − 500 000
    assert payroll_matches_formula(payroll)


@pytest.mark.django_db
def test_own_money_expense_is_reimbursed(paid_distributor, van_stocked,
                                         expense_categories, admin_user):
    from apps.expenses.models import ExpenseCategory
    from apps.expenses.services import approve_expense, create_expense

    category = ExpenseCategory.objects.get(pk=expense_categories["lunch"].pk)
    res = create_expense(
        distributor=paid_distributor, category=category,
        amount=Decimal("80000"), payment_source="OWN_MONEY",
        date=datetime.date(2026, 9, 7),
    )
    approve_expense(res.expense, user=admin_user)

    payroll = calculate_payroll(distributor=paid_distributor, period=PERIOD)
    assert payroll.reimbursement_expense == Decimal("80000.00")
    assert payroll.final_amount == Decimal("3080000.00")  # base + reimburse (sotuvsiz)


@pytest.mark.django_db
def test_auto_deduct_shortage_toggle(paid_distributor, van_stocked, admin_user):
    """Kamomad sozlama yoqilgandagina avtomatik ushlanadi (CLAUDE.md 7.11)."""
    from apps.dayclose.constants import DayCloseStatus
    from apps.dayclose.models import DayClose

    DayClose.objects.create(
        distributor=paid_distributor, date=datetime.date(2026, 9, 8),
        status=DayCloseStatus.CLOSED,
        cash_difference=Decimal("-15000"),
        stock_difference_amount=Decimal("20000"),
    )

    # sozlama o'chiq — ushlanma yo'q
    off = calculate_payroll(distributor=paid_distributor, period=PERIOD)
    assert off.deduction_cash_diff == Decimal("0.00")
    assert off.deduction_shortage == Decimal("0.00")

    Setting.objects.create(key="payroll.auto_deduct_shortage", value=True)
    on = calculate_payroll(distributor=paid_distributor, period=PERIOD)
    assert on.deduction_cash_diff == Decimal("15000.00")
    assert on.deduction_shortage == Decimal("20000.00")
    assert on.final_amount == Decimal("2965000.00")  # 3 000 000 − 35 000
    assert payroll_matches_formula(on)


# --------------------------------------------------------------------------- #
#  Tasdiqlash / to'lash oqimi
# --------------------------------------------------------------------------- #
@pytest.mark.django_db
def test_approve_pay_flow_and_locks(paid_distributor, van_stocked, admin_user):
    from apps.core.exceptions import BusinessError
    from apps.finance.models import CashAccount
    from apps.finance.services import get_account
    from apps.payroll.services import approve_payroll, pay_payroll

    get_account()  # kassa hisobварag'ini yaratamiz
    _make_sale(paid_distributor, van_stocked["client"], van_stocked["product"])
    payroll = calculate_payroll(distributor=paid_distributor, period=PERIOD)

    approve_payroll(payroll, user=admin_user)
    payroll.refresh_from_db()
    assert payroll.status == PayrollStatus.APPROVED

    # tasdiqlangач qayta hisoblab bo'lmaydi
    with pytest.raises(BusinessError):
        calculate_payroll(distributor=paid_distributor, period=PERIOD)

    balance_before = CashAccount.objects.get(pk=get_account().pk).balance
    pay_payroll(payroll, user=admin_user)
    payroll.refresh_from_db()
    assert payroll.status == PayrollStatus.PAID
    assert payroll.company_expense is not None
    balance_after = CashAccount.objects.get(pk=get_account().pk).balance
    assert balance_before - balance_after == payroll.final_amount


@pytest.mark.django_db
def test_cannot_pay_before_approve(paid_distributor, van_stocked, admin_user):
    from apps.core.exceptions import BusinessError
    from apps.payroll.services import pay_payroll

    payroll = calculate_payroll(distributor=paid_distributor, period=PERIOD)
    with pytest.raises(BusinessError):
        pay_payroll(payroll, user=admin_user)


# --------------------------------------------------------------------------- #
#  API + rol ruxsatlari
# --------------------------------------------------------------------------- #
@pytest.mark.django_db
def test_distributor_cannot_list_all_payrolls(auth_api, paid_distributor):
    resp = auth_api.get("/api/v1/payrolls/")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_distributor_sees_only_own_via_my(auth_api, admin_api, paid_distributor,
                                          van_stocked):
    _make_sale(paid_distributor, van_stocked["client"], van_stocked["product"])
    calc = admin_api.post(
        "/api/v1/payrolls/calculate/",
        {"distributor": str(paid_distributor.id), "period": "2026-09-01"},
        format="json",
    )
    assert calc.status_code == 200, calc.data
    payroll_id = calc.data["data"]["id"]
    admin_api.post(f"/api/v1/payrolls/{payroll_id}/approve/")

    mine = auth_api.get("/api/v1/payrolls/my/")
    assert mine.status_code == 200
    assert len(mine.data["data"]) == 1
    assert mine.data["data"][0]["id"] == payroll_id


@pytest.mark.django_db
def test_my_payroll_shows_draft_as_estimate(auth_api, admin_api, paid_distributor,
                                            van_stocked):
    """CLAUDE.md 8 — xodim tasdiqlanmagan (DRAFT) taxminiy maoshini ham ko'radi."""
    _make_sale(paid_distributor, van_stocked["client"], van_stocked["product"])
    calc = admin_api.post(
        "/api/v1/payrolls/calculate/",
        {"distributor": str(paid_distributor.id), "period": "2026-09-01"},
        format="json",
    )
    assert calc.status_code == 200, calc.data

    mine = auth_api.get("/api/v1/payrolls/my/")
    assert mine.status_code == 200
    assert len(mine.data["data"]) == 1
    assert mine.data["data"][0]["status"] == "DRAFT"


@pytest.mark.django_db
def test_manager_cannot_create_commission_rule(manager_api):
    resp = manager_api.post(
        "/api/v1/commission-rules/",
        {"scope": "GLOBAL", "percent": "5", "valid_from": "2026-09-01"},
        format="json",
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_admin_creates_commission_rule(admin_api):
    resp = admin_api.post(
        "/api/v1/commission-rules/",
        {"scope": "GLOBAL", "percent": "5", "valid_from": "2026-09-01"},
        format="json",
    )
    assert resp.status_code == 201, resp.data


@pytest.mark.django_db
def test_edit_bonus_recalculates(admin_api, paid_distributor, van_stocked):
    _make_sale(paid_distributor, van_stocked["client"], van_stocked["product"])
    calc = admin_api.post(
        "/api/v1/payrolls/calculate/",
        {"distributor": str(paid_distributor.id), "period": "2026-09-01"},
        format="json",
    )
    payroll_id = calc.data["data"]["id"]
    before = Decimal(calc.data["data"]["final_amount"])

    edit = admin_api.post(
        f"/api/v1/payrolls/{payroll_id}/edit/",
        {"bonus": "200000"},
        format="json",
    )
    assert edit.status_code == 200, edit.data
    assert Decimal(edit.data["data"]["final_amount"]) == before + Decimal("200000")
