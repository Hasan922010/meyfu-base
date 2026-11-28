from django.db import migrations


def enable_debt_sale_for_order_takers(apps, schema_editor):
    User = apps.get_model("users", "User")
    User.objects.filter(role="ORDER_TAKER", can_sell_on_debt=False).update(
        can_sell_on_debt=True
    )


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0011_order_taker_can_collect_debts"),
    ]

    operations = [
        migrations.RunPython(
            enable_debt_sale_for_order_takers,
            migrations.RunPython.noop,
        ),
    ]
