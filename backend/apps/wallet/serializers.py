from __future__ import annotations

from rest_framework import serializers

from .models import DistributorWallet, WalletTransaction


class WalletTransactionSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(
        source="get_transaction_type_display", read_only=True
    )

    class Meta:
        model = WalletTransaction
        fields = (
            "id", "date", "transaction_type", "type_display", "amount",
            "balance_after", "reference_type", "reference_id", "note",
            "created_at",
        )
        read_only_fields = fields


class WalletSerializer(serializers.ModelSerializer):
    distributor_name = serializers.CharField(
        source="distributor.full_name", read_only=True
    )
    live_balance = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )
    pending_expense_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )

    class Meta:
        model = DistributorWallet
        fields = (
            "id", "distributor", "distributor_name", "balance",
            "live_balance", "pending_expense_amount", "updated_at",
        )
        read_only_fields = fields
