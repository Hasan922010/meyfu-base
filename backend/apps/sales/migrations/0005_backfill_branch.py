from django.db import migrations

from apps.core.migration_helpers import backfill_branch_from_distributor


class Migration(migrations.Migration):
    dependencies = [
        ("sales", "0004_sale_branch_salereturn_branch"),
        ("users", "0008_alter_user_role"),
    ]

    operations = [
        migrations.RunPython(
            backfill_branch_from_distributor("sales", "Sale", "SaleReturn"),
            migrations.RunPython.noop,
        ),
    ]
