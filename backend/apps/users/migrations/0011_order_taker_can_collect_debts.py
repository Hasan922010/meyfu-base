from django.db import migrations


def enable_debt_collection_for_order_takers(apps, schema_editor):
    User = apps.get_model("users", "User")
    User.objects.filter(role="ORDER_TAKER", can_collect_debts=False).update(
        can_collect_debts=True
    )


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0010_user_can_collect_debts_user_can_make_sales_and_more"),
    ]

    operations = [
        migrations.RunPython(
            enable_debt_collection_for_order_takers,
            migrations.RunPython.noop,
        ),
    ]
