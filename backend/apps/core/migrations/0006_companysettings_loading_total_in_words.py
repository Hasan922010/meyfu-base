from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0005_synclog"),
    ]

    operations = [
        migrations.AddField(
            model_name="companysettings",
            name="loading_total_in_words",
            field=models.BooleanField(
                default=True,
                verbose_name="yuklama hujjatida jami summani so'z bilan yozish",
            ),
        ),
    ]
