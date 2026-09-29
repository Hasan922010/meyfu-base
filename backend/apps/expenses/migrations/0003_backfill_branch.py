from django.db import migrations

from apps.core.migration_helpers import backfill_branch_from_distributor


class Migration(migrations.Migration):
    dependencies = [
        ("expenses", "0002_distributorexpense_branch"),
        ("users", "0008_alter_user_role"),
    ]

    operations = [
        migrations.RunPython(
            backfill_branch_from_distributor("expenses", "DistributorExpense"),
            migrations.RunPython.noop,
        ),
    ]
