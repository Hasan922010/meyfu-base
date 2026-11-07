from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("clients", "0004_client_route_order")]
    operations = [
        migrations.AlterField(
            model_name="client",
            name="route_order",
            field=models.PositiveIntegerField(
                db_default=0, default=0, verbose_name="marshrutdagi tartib"
            ),
        ),
    ]