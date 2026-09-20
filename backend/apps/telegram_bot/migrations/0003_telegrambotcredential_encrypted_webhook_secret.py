from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("telegram_bot", "0002_telegrambotcredential"),
    ]

    operations = [
        migrations.AddField(
            model_name="telegrambotcredential",
            name="encrypted_webhook_secret",
            field=models.TextField(blank=True, verbose_name="shifrlangan webhook siri"),
        ),
    ]