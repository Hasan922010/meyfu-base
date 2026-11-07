from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0006_alter_user_is_deleted"),
        ("users", "0008_alter_user_role"),
    ]
    operations = []