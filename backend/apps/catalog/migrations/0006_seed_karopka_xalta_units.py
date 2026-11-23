"""Karopka va Xalta o'lchov birliklarini qo'shish."""
from django.db import migrations


def seed_units(apps, schema_editor):
    Unit = apps.get_model("catalog", "Unit")
    for name, short in (("Karopka", "karopka"), ("Xalta", "xalta")):
        Unit.objects.get_or_create(name=name, defaults={"short_name": short})


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0005_product_bonus_product_product_bonus_reward_qty_and_more"),
    ]

    operations = [
        migrations.RunPython(seed_units, migrations.RunPython.noop),
    ]
