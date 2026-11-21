import uuid
from decimal import Decimal

import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("clients", "0006_client_assigned_to_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="client",
            name="advance_balance",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0"),
                max_digits=14,
                validators=[django.core.validators.MinValueValidator(Decimal("0"))],
                verbose_name="oldindan to'lov (avans)",
            ),
        ),
        migrations.CreateModel(
            name="ClientAdvance",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True, verbose_name="yaratilgan")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="yangilangan")),
                ("is_deleted", models.BooleanField(db_index=True, default=False, verbose_name="o'chirilgan")),
                ("deleted_at", models.DateTimeField(blank=True, null=True, verbose_name="o'chirilgan vaqti")),
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("amount", models.DecimalField(decimal_places=2, max_digits=14, validators=[django.core.validators.MinValueValidator(Decimal("0.01"))], verbose_name="summa")),
                ("payment_type", models.CharField(choices=[("NAQD", "Naqd"), ("PLASTIK", "Plastik"), ("OTKAZMA", "O'tkazma")], default="NAQD", max_length=10, verbose_name="to'lov turi")),
                ("date", models.DateField(verbose_name="sana")),
                ("note", models.CharField(blank=True, max_length=255, verbose_name="izoh")),
                ("client", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="advances", to="clients.client", verbose_name="mijoz")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to=settings.AUTH_USER_MODEL, verbose_name="yaratuvchi")),
                ("received_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="received_client_advances", to=settings.AUTH_USER_MODEL, verbose_name="kim oldi")),
            ],
            options={
                "verbose_name": "mijoz avansi",
                "verbose_name_plural": "mijoz avanslari",
                "ordering": ("-date", "-created_at"),
            },
        ),
    ]
