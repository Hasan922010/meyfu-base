"""v5 C5: xarajat anomaliyalari (z-score)."""
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

import pytest

from apps.core.business_day import business_date
from apps.expenses.models import DistributorExpense

URL = "/api/v1/reports/expense-anomalies/"


def _expense(distributor, category, amount: str, days_ago: int = 0, status="APPROVED"):
    return DistributorExpense.objects.create(
        distributor=distributor, category=category, amount=Decimal(amount),
        date=business_date() - timedelta(days=days_ago), status=status,
        created_by=distributor,
    )


@pytest.fixture
def fuel_history(distributor, expense_categories):
    fuel = expense_categories["fuel"]
    for i, amount in enumerate(["50000", "55000", "48000", "52000", "51000", "49000"]):
        _expense(distributor, fuel, amount, days_ago=i + 1)
    return fuel


@pytest.mark.django_db
def test_spike_is_flagged(manager_api, distributor, fuel_history):
    spike = _expense(distributor, fuel_history, "180000")

    rows = manager_api.get(URL).data["data"]["rows"]

    assert [r["id"] for r in rows] == [str(spike.id)]
    assert rows[0]["z_score"] >= 2.5
    assert rows[0]["times_typical"] == 3.5  # 180 000 / 50 833


@pytest.mark.django_db
def test_normal_expense_not_flagged(manager_api, distributor, fuel_history):
    _expense(distributor, fuel_history, "53000")

    assert manager_api.get(URL).data["data"]["rows"] == []


@pytest.mark.django_db
def test_rejected_expense_ignored(manager_api, distributor, fuel_history):
    _expense(distributor, fuel_history, "180000", status="REJECTED")

    assert manager_api.get(URL).data["data"]["rows"] == []


@pytest.mark.django_db
def test_too_little_history_not_flagged(manager_api, distributor, expense_categories):
    lunch = expense_categories["lunch"]
    _expense(distributor, lunch, "30000", days_ago=1)
    _expense(distributor, lunch, "300000")

    assert manager_api.get(URL).data["data"]["rows"] == []


@pytest.mark.django_db
def test_distributor_cannot_see_anomalies(auth_api):
    assert auth_api.get(URL).status_code == 403
