from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import DistributorProfile, User


class DistributorProfileInline(admin.StackedInline):
    model = DistributorProfile
    extra = 0
    can_delete = False


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    inlines = [DistributorProfileInline]
    list_display = ("phone", "full_name", "role", "is_active", "last_seen_at")
    list_filter = ("role", "is_active", "is_staff")
    search_fields = ("phone", "full_name")
    ordering = ("full_name",)

    fieldsets = (
        (None, {"fields": ("phone", "password")}),
        ("Shaxsiy", {"fields": ("full_name", "avatar", "passport_series",
                                "address", "hire_date")}),
        ("Rol va ruxsatlar", {"fields": ("role", "is_active", "is_staff",
                                         "is_superuser", "groups",
                                         "user_permissions")}),
        ("Qurilma / aloqa", {"fields": ("device_id", "last_seen_at",
                                        "telegram_chat_id")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("phone", "full_name", "role", "password1", "password2"),
        }),
    )
    readonly_fields = ("last_seen_at",)
