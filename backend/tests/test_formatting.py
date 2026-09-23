"""UX audit m2: bildirishnomada `25000.00 so'm` emas, `25 000 so'm` bo'lsin."""
from decimal import Decimal

import pytest

from apps.core.formatting import fmt_money
from apps.expenses.models import DistributorExpense
from apps.expenses.services import approve_expense
from apps.notifications.models import Notification


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (Decimal("25000.00"), "25 000 so'm"),
        (Decimal("3151750.00"), "3 151 750 so'm"),
        (Decimal("0"), "0 so'm"),
        ("135000.00", "135 000 so'm"),
        (Decimal("999.50"), "1 000 so'm"),
        (Decimal("-15000"), "−15 000 so'm"),
    ],
)
def test_fmt_money(value, expected):
    assert fmt_money(value) == expected


@pytest.mark.django_db
def test_expense_approved_notification_has_formatted_amount(
    auth_api, van_stocked, expense_categories
):
    resp = auth_api.post(
        "/api/v1/expenses/",
        {"category": str(expense_categories["lunch"].id), "amount": "25000",
         "description": "Tushlik"},
        format="json",
    )
    assert resp.status_code == 201, resp.data
    expense = DistributorExpense.objects.get(id=resp.data["data"]["id"])

    approve_expense(expense)

    note = Notification.objects.filter(
        user=van_stocked["distributor"], type="expense.approved"
    ).latest("created_at")
    assert "25 000 so'm" in note.body
    assert "25000.00" not in note.body
