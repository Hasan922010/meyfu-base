from django.contrib import admin

from .models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ("amount",)


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("number", "date", "client", "taken_by", "assigned_to",
                    "status", "total_amount")
    list_filter = ("status", "date")
    search_fields = ("number", "client__name", "taken_by__full_name")
    date_hierarchy = "date"
    inlines = [OrderItemInline]
    readonly_fields = ("number", "total_amount", "cancelled_at")
