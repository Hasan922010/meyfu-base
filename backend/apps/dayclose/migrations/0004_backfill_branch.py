from django.db import migrations

from apps.core.migration_helpers import backfill_branch_from_distributor


class Migration(migrations.Migration):
    dependencies = [
        ("dayclose", "0003_cashhandover_branch_dayclose_branch"),
        ("users", "0008_alter_user_role"),
    ]

    operations = [
        migrations.RunPython(
            backfill_branch_from_distributor("dayclose", "DayClose", "CashHandover"),
            migrations.RunPython.noop,
        ),
    ]
