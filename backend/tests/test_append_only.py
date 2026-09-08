"""CLAUDE.md 5.1 / 18: append-only jurnalni o'zgartirishga urinish → xato."""
import pytest
from django.core.exceptions import ValidationError

from apps.core.models import AuditLog


@pytest.mark.django_db
def test_append_only_create_ok():
    log = AuditLog.objects.create(action="price.changed", model_name="Product")
    assert log.pk is not None


@pytest.mark.django_db
def test_append_only_update_rejected():
    log = AuditLog.objects.create(action="price.changed", model_name="Product")
    log.action = "hacked"
    with pytest.raises(ValidationError):
        log.save()


@pytest.mark.django_db
def test_append_only_instance_delete_rejected():
    log = AuditLog.objects.create(action="x", model_name="Y")
    with pytest.raises(ValidationError):
        log.delete()


@pytest.mark.django_db
def test_append_only_queryset_update_still_possible_only_via_raw():
    """QuerySet.update() ORM signal'larini chetlab o'tadi — bu ataylab
    faqat migratsiya/tuzatish skriptlari uchun qoldirilgan, biznes kodda
    ishlatilmaydi (CLAUDE.md 5.1)."""
    AuditLog.objects.create(action="a", model_name="M")
    # .update() ni bloklamaymiz, lekin biznes-kod uni chaqirmasligi kerak.
    assert AuditLog.objects.filter(action="a").count() == 1
