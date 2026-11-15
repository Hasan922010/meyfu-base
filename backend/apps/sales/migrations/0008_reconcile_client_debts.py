from decimal import Decimal

from django.db import migrations
from django.db.models import Q, Sum

_ZERO = Decimal("0")


def reconcile_debts(apps, schema_editor):
    Debt = apps.get_model("sales", "Debt")
    Client = apps.get_model("clients", "Client")

    for debt in Debt.objects.filter(is_deleted=False).annotate(
        actual_paid=Sum("payments__amount", filter=Q(payments__is_deleted=False))
    ):
        paid = debt.actual_paid or _ZERO
        remaining = debt.amount - paid
        if remaining <= _ZERO:
            status = "PAID"
        elif paid > _ZERO:
            status = "PARTIAL"
        else:
            status = "ACTIVE"
        if (
            debt.paid_amount != paid
            or debt.remaining != remaining
            or debt.status != status
        ):
            Debt.objects.filter(pk=debt.pk).update(
                paid_amount=paid, remaining=remaining, status=status
            )

    for client in Client.objects.annotate(
        actual_debt=Sum("debts__remaining", filter=Q(debts__is_deleted=False))
    ):
        ledger = client.actual_debt or _ZERO
        if client.current_debt != ledger:
            Client.objects.filter(pk=client.pk).update(current_debt=ledger)


class Migration(migrations.Migration):
    dependencies = [
        ("sales", "0007_saleitem_saleitem_sale_bonus_prod_idx"),
        ("clients", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(reconcile_debts, migrations.RunPython.noop),
    ]
