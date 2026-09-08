from django.contrib import admin

from apps.core.admin import AppendOnlyAdmin

from .models import Client, ClientVisit, Route


@admin.register(Route)
class RouteAdmin(admin.ModelAdmin):
    list_display = ("name", "distributor", "days_of_week", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "distributor__full_name")
    autocomplete_fields = ("distributor",)


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = (
        "name", "owner_name", "phone", "route", "client_type",
        "current_debt", "debt_limit", "is_blocked",
    )
    list_filter = ("client_type", "is_blocked", "route")
    search_fields = ("name", "owner_name", "phone", "phone2", "inn")
    autocomplete_fields = ("route",)
    readonly_fields = ("current_debt",)


@admin.register(ClientVisit)
class ClientVisitAdmin(AppendOnlyAdmin):
    list_display = (
        "checked_in_at", "client", "distributor", "result",
        "latitude", "longitude",
    )
    list_filter = ("result",)
    search_fields = ("client__name", "distributor__full_name")
    date_hierarchy = "checked_in_at"
