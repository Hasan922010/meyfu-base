from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("warehouse", "0004_supplier_balance_suppliertransaction"),
    ]

    operations = [
        migrations.AlterField(
            model_name="supplier",
            name="balance",
            field=models.DecimalField(
                db_default=Decimal("0"),
                decimal_places=2,
                default=Decimal("0"),
                max_digits=14,
                verbose_name="balans",
            ),
        ),
    ]