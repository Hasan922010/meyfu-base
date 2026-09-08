from django.contrib import admin

from apps.core.admin import AppendOnlyAdmin

from .models import DistributorWallet, WalletTransaction


@admin.register(DistributorWallet)
class DistributorWalletAdmin(admin.ModelAdmin):
    list_display = ("distributor", "balance", "updated_at")
    search_fields = ("distributor__full_name",)
    readonly_fields = ("balance",)

    def has_add_permission(self, request) -> bool:
        return False


@admin.register(WalletTransaction)
class WalletTransactionAdmin(AppendOnlyAdmin):
    list_display = (
        "created_at", "wallet", "transaction_type", "amount", "balance_after",
        "reference_type",
    )
    list_filter = ("transaction_type", "date")
    search_fields = ("wallet__distributor__full_name", "reference_id")
    date_hierarchy = "date"
