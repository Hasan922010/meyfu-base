from django.contrib import admin

from .models import TelegramLinkCode, TelegramMessageLog


@admin.register(TelegramLinkCode)
class TelegramLinkCodeAdmin(admin.ModelAdmin):
    list_display = ("user", "code", "expires_at", "used_at")
    search_fields = ("user__full_name", "code")


@admin.register(TelegramMessageLog)
class TelegramMessageLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "direction", "chat_id", "user", "ok")
    list_filter = ("direction", "ok")
    search_fields = ("chat_id", "text")
    date_hierarchy = "created_at"

    def has_add_permission(self, request) -> bool:
        return False
