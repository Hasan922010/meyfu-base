"""Append-only modellar uchun himoyalangan admin bazasi (CLAUDE.md 5.1)."""
from django.contrib import admin

from .models import AuditLog, CompanySettings, Setting


class AppendOnlyAdmin(admin.ModelAdmin):
    """O'zgartirish va o'chirishni bloklaydi. Faqat ko'rish."""

    def has_add_permission(self, request) -> bool:
        return False

    def has_change_permission(self, request, obj=None) -> bool:
        return False

    def has_delete_permission(self, request, obj=None) -> bool:
        return False


@admin.register(AuditLog)
class AuditLogAdmin(AppendOnlyAdmin):
    list_display = ("created_at", "action", "model_name", "object_id", "user", "ip")
    list_filter = ("action", "model_name")
    search_fields = ("object_id", "action", "user__full_name")
    date_hierarchy = "created_at"


@admin.register(Setting)
class SettingAdmin(admin.ModelAdmin):
    list_display = ("key", "description", "updated_at")
    search_fields = ("key", "description")


@admin.register(CompanySettings)
class CompanySettingsAdmin(admin.ModelAdmin):
    list_display = ("name", "inn", "phone", "updated_at")

    def has_add_permission(self, request) -> bool:
        return not CompanySettings.objects.exists()
