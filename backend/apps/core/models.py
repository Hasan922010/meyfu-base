"""Yadro modellari — BaseModel va AppendOnlyModel.

CLAUDE.md 6:  har modelda id (UUID), created_at, updated_at, created_by, is_deleted.
CLAUDE.md 5.1: append-only jurnallar hech qachon UPDATE/DELETE qilinmaydi.
"""
from __future__ import annotations

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils.translation import gettext_lazy as _


class SoftDeleteQuerySet(models.QuerySet):
    def delete(self):  # type: ignore[override]
        return super().update(is_deleted=True)

    def hard_delete(self):
        return super().delete()

    def alive(self):
        return self.filter(is_deleted=False)


class SoftDeleteManager(models.Manager):
    """Standart holatda faqat o'chirilmagan yozuvlarni qaytaradi."""

    def get_queryset(self) -> SoftDeleteQuerySet:
        return SoftDeleteQuerySet(self.model, using=self._db).filter(is_deleted=False)


class AllObjectsManager(models.Manager):
    def get_queryset(self) -> SoftDeleteQuerySet:
        return SoftDeleteQuerySet(self.model, using=self._db)


class BaseModel(models.Model):
    """Barcha domen modellari uchun asos."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(_("yaratilgan vaqti"), auto_now_add=True)
    updated_at = models.DateTimeField(_("yangilangan vaqti"), auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        verbose_name=_("kim yaratdi"),
    )
    is_deleted = models.BooleanField(_("o'chirilgan"), default=False, db_index=True)

    objects = SoftDeleteManager()
    all_objects = AllObjectsManager()

    class Meta:
        abstract = True
        ordering = ("-created_at",)

    def delete(self, using=None, keep_parents=False):
        """Yumshoq o'chirish (soft delete)."""
        self.is_deleted = True
        self.save(update_fields=["is_deleted", "updated_at"])

    def hard_delete(self, using=None, keep_parents=False):
        super().delete(using=using, keep_parents=keep_parents)


class AppendOnlyModel(BaseModel):
    """Faqat qo'shiladigan jurnal (append-only).

    Mavjud yozuvni o'zgartirish yoki o'chirishga urinish → ValidationError.
    Xato bo'lsa CORRECTION turidagi yangi yozuv qo'shiladi (CLAUDE.md 5.1).
    """

    class Meta(BaseModel.Meta):
        abstract = True

    def save(self, *args, **kwargs):
        if self._state.adding is False and not self._allow_append_only_update(kwargs):
            raise ValidationError(
                _(
                    "Bu jurnal faqat qo'shish uchun. Mavjud yozuvni o'zgartirib "
                    "bo'lmaydi — tuzatuvchi (CORRECTION) yozuv qo'shing."
                )
            )
        super().save(*args, **kwargs)

    def _allow_append_only_update(self, save_kwargs: dict) -> bool:
        """Faqat yaratilish paytidagi auto_now maydonlariga ruxsat.

        Django `auto_now_add` bilan ba'zan qo'shimcha UPDATE yuboradi;
        shuning uchun `is_deleted`/soft-delete ham bloklanadi — bu ataylab.
        """
        return False

    def delete(self, using=None, keep_parents=False):
        raise ValidationError(_("Append-only jurnal yozuvini o'chirib bo'lmaydi."))

    def hard_delete(self, using=None, keep_parents=False):
        raise ValidationError(_("Append-only jurnal yozuvini o'chirib bo'lmaydi."))


class AuditLog(AppendOnlyModel):
    """Audit jurnali (CLAUDE.md 5.3). Faqat qo'shiladi."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="audit_logs", verbose_name=_("foydalanuvchi"),
    )
    action = models.CharField(_("harakat"), max_length=64)
    model_name = models.CharField(_("model"), max_length=128, blank=True)
    object_id = models.CharField(_("obyekt ID"), max_length=64, blank=True)
    changes = models.JSONField(_("o'zgarishlar"), default=dict, blank=True)
    ip = models.GenericIPAddressField(_("IP"), null=True, blank=True)
    user_agent = models.CharField(_("qurilma / brauzer"), max_length=255, blank=True)

    class Meta(AppendOnlyModel.Meta):
        verbose_name = _("audit yozuvi")
        verbose_name_plural = _("audit jurnali")
        indexes = [
            models.Index(fields=["model_name", "object_id"]),
            models.Index(fields=["action", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.action} · {self.model_name}#{self.object_id}"


class Setting(BaseModel):
    """Tizim sozlamalari — key/value (CLAUDE.md 6)."""

    key = models.CharField(_("kalit"), max_length=128, unique=True)
    value = models.JSONField(_("qiymat"), default=dict, blank=True)
    description = models.CharField(_("izoh"), max_length=255, blank=True)

    class Meta:
        verbose_name = _("sozlama")
        verbose_name_plural = _("sozlamalar")
        ordering = ("key",)

    def __str__(self) -> str:
        return self.key

    @classmethod
    def get(cls, key: str, default=None):
        obj = cls.objects.filter(key=key).first()
        return obj.value if obj else default


class CompanySettings(BaseModel):
    """Kompaniya rekvizitlari va muhri — singleton (v4 T3).

    Nakladnoy / yuklama / chek PDF'larida sarlavha, rekvizit va muhr sifatida
    ishlatiladi. Har o'zgarish AuditLog'ga yoziladi (view'da).
    """

    name = models.CharField(_("nomi"), max_length=255, blank=True)
    legal_name = models.CharField(_("to'liq yuridik nomi"), max_length=255, blank=True)
    inn = models.CharField(_("STIR / INN"), max_length=20, blank=True)
    address = models.CharField(_("manzil"), max_length=255, blank=True)
    phone = models.CharField(_("telefon"), max_length=50, blank=True)
    bank_details = models.TextField(_("bank rekvizitlari"), blank=True)
    director_name = models.CharField(_("rahbar F.I.SH."), max_length=255, blank=True)
    logo = models.ImageField(
        _("logotip"), upload_to="company/", null=True, blank=True
    )
    stamp = models.ImageField(
        _("muhr (PNG, shaffof fon)"), upload_to="company/", null=True, blank=True
    )

    class Meta:
        verbose_name = _("kompaniya rekvizitlari")
        verbose_name_plural = _("kompaniya rekvizitlari")

    def __str__(self) -> str:
        return self.name or "Kompaniya rekvizitlari"

    def save(self, *args, **kwargs):
        # Singleton — mavjud yozuv bo'lsa uni yangilaymiz
        if self._state.adding and type(self).objects.exists():
            self.pk = type(self).objects.order_by("created_at").first().pk
            self._state.adding = False
        super().save(*args, **kwargs)

    @classmethod
    def load(cls) -> CompanySettings:
        obj = cls.objects.order_by("created_at").first()
        if obj is None:
            obj = cls.objects.create()
        return obj


class DocumentSequence(models.Model):
    """Hujjat raqamlash uchun ketma-ketlik (CLAUDE.md 7.13).

    Masalan: KIR-2026-00001, SOT-2026-00042. Har (prefiks, yil) uchun hisoblagich.
    """

    prefix = models.CharField(max_length=16)
    year = models.PositiveIntegerField()
    value = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = _("hujjat ketma-ketligi")
        verbose_name_plural = _("hujjat ketma-ketliklari")
        constraints = [
            models.UniqueConstraint(
                fields=["prefix", "year"], name="uniq_docseq_prefix_year"
            )
        ]

    def __str__(self) -> str:
        return f"{self.prefix}-{self.year}: {self.value}"

    @classmethod
    def next_number(cls, prefix: str, year: int | None = None, width: int = 5) -> str:
        """Keyingi raqamni atomik olib beradi. `transaction.atomic()` ichida chaqiring."""
        from django.utils import timezone

        year = year or timezone.now().year
        row, _created = cls.objects.select_for_update().get_or_create(
            prefix=prefix, year=year
        )
        row.value += 1
        row.save(update_fields=["value"])
        return f"{prefix}-{year}-{row.value:0{width}d}"
