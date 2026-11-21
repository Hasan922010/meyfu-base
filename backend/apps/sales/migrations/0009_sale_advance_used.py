from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("sales", "0008_reconcile_client_debts"),
    ]

    operations = [
        migrations.AddField(
            model_name="sale",
            name="advance_used",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0"),
                max_digits=14,
                verbose_name="avansdan yechildi",
            ),
        ),
    ]
