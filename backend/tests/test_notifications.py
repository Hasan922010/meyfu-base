"""8-bosqich: bildirishnomalar (persist + event)."""
import pytest

from apps.notifications.models import Notification
from apps.notifications.services import notify, notify_admins


@pytest.mark.django_db
def test_notify_creates_row(distributor):
    n = notify(distributor, type="general", title="Salom", body="test")
    assert Notification.objects.filter(user=distributor, title="Salom").exists()
    assert n.is_read is False


@pytest.mark.django_db
def test_notify_admins_reaches_all_admins(admin_user, manager, distributor):
    notify_admins(type="general", title="Diqqat", body="hammaga")
    assert Notification.objects.filter(user=admin_user, title="Diqqat").exists()
    assert Notification.objects.filter(user=manager, title="Diqqat").exists()
    assert not Notification.objects.filter(user=distributor).exists()


@pytest.mark.django_db
def test_flagged_sale_notifies_admins(auth_api, admin_user, van_stocked, distributor):
    distributor.distributor_profile.can_sell_below_price = True
    distributor.distributor_profile.save()
    client, product = van_stocked["client"], van_stocked["product"]

    resp = auth_api.post(
        "/api/v1/sales/",
        {
            "client": str(client.id), "payment_type": "NAQD",
            "items": [{"product": str(product.id), "quantity": "5", "price": "20000"}],
        },
        format="json",
    )
    assert resp.status_code == 201
    assert Notification.objects.filter(
        user=admin_user, type="sale.flagged"
    ).exists()


@pytest.mark.django_db
def test_expense_approval_notifies_distributor(
    auth_api, admin_api, van_stocked, expense_categories, distributor
):
    exp = auth_api.post(
        "/api/v1/expenses/",
        {"category": str(expense_categories["lunch"].id), "amount": "20000"},
        format="json",
    ).data["data"]
    admin_api.post(f"/api/v1/expenses/{exp['id']}/approve/")

    assert Notification.objects.filter(
        user=distributor, type="expense.approved"
    ).exists()


@pytest.mark.django_db
def test_notifications_api(auth_api, distributor):
    notify(distributor, title="Bir")
    notify(distributor, title="Ikki")

    lst = auth_api.get("/api/v1/notifications/")
    assert lst.data["data"]["count"] == 2

    unread = auth_api.get("/api/v1/notifications/unread-count/")
    assert unread.data["data"]["count"] == 2

    first_id = lst.data["data"]["results"][0]["id"]
    auth_api.post(f"/api/v1/notifications/{first_id}/read/")
    assert auth_api.get(
        "/api/v1/notifications/unread-count/"
    ).data["data"]["count"] == 1

    auth_api.post("/api/v1/notifications/read-all/")
    assert auth_api.get(
        "/api/v1/notifications/unread-count/"
    ).data["data"]["count"] == 0


@pytest.mark.django_db
def test_notifications_scoped_to_user(auth_api, distributor, manager):
    notify(manager, title="Menejer uchun")
    assert auth_api.get("/api/v1/notifications/").data["data"]["count"] == 0


@pytest.mark.django_db
def test_overdue_debt_task(auth_api, van_stocked, admin_user):
    import datetime

    from apps.sales.models import Debt
    from realtime.tasks import check_overdue_debts

    client, product = van_stocked["client"], van_stocked["product"]
    sale = auth_api.post(
        "/api/v1/sales/",
        {
            "client": str(client.id), "payment_type": "QARZ",
            "due_date": "2026-08-01",
            "items": [{"product": str(product.id), "quantity": "5", "price": "27000"}],
        },
        format="json",
    ).data["data"]

    Debt.objects.filter(sale__id=sale["id"]).update(
        due_date=datetime.date(2026, 8, 1)
    )
    check_overdue_debts()

    assert Debt.objects.get(sale__id=sale["id"]).status == "OVERDUE"
    assert Notification.objects.filter(
        user=admin_user, type="debt.overdue"
    ).exists()
