from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("created_at", "user", "type", "title", "is_read")
    list_filter = ("type", "is_read")
    search_fields = ("user__full_name", "title", "body")
    date_hierarchy = "created_at"
