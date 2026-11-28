# Generated manually for Product.warehouse FK

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0006_seed_karopka_xalta_units"),
        ("warehouse", "0010_merge_opening_lock_defaults"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="warehouse",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="products",
                to="warehouse.warehouse",
                verbose_name="ombor",
            ),
        ),
    ]
