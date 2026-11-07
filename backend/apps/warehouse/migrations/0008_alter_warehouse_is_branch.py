from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("warehouse", "0007_merge_replit_defaults")]
    operations = [
        migrations.AlterField(
            model_name="warehouse",
            name="is_branch",
            field=models.BooleanField(
                db_default=False, db_index=True, default=False, verbose_name="filial"
            ),
        ),
    ]