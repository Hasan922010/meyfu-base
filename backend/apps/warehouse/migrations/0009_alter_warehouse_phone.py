from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("warehouse", "0008_alter_warehouse_is_branch")]
    operations = [
        migrations.AlterField(
            model_name="warehouse",
            name="phone",
            field=models.CharField(
                blank=True, db_default="", max_length=20, verbose_name="telefon"
            ),
        ),
    ]