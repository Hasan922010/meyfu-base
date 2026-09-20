import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("telegram_bot", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="TelegramBotCredential",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="yaratilgan vaqti")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="yangilangan vaqti")),
                ("is_deleted", models.BooleanField(db_index=True, default=False, verbose_name="o'chirilgan")),
                ("encrypted_token", models.TextField(verbose_name="shifrlangan token")),
                ("bot_username", models.CharField(max_length=64, verbose_name="bot username")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to=settings.AUTH_USER_MODEL, verbose_name="kim yaratdi")),
            ],
            options={
                "verbose_name": "Telegram bot sozlamasi",
                "verbose_name_plural": "Telegram bot sozlamalari",
            },
        ),
    ]