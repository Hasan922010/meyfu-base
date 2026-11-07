from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0005_password_reset_code"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="is_deleted",
            field=models.BooleanField(
                db_default=False,
                db_index=True,
                default=False,
                verbose_name="o'chirilgan",
            ),
        ),
    ]