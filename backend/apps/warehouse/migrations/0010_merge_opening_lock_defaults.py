from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("warehouse", "0009_alter_warehouse_phone"),
        ("warehouse", "0008_purchaseitem_purchase_item_quantity_gt_zero_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="warehouse",
            name="is_opening_locked",
            field=models.BooleanField(
                db_default=False,
                default=False,
                db_index=True,
                verbose_name="boshlang'ich qoldiq tasdiqlangan",
            ),
        ),
    ]
