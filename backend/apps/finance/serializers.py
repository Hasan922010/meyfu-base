from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from .models import CashAccount, CashTransaction, CompanyExpense

_MONEY = {"max_digits": 16, "decimal_places": 2}


class CashAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = CashAccount
        fields = ("id", "name", "balance", "is_active", "updated_at")
        read_only_fields = fields


class CashTransactionSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(
        source="get_transaction_type_display", read_only=True
    )

    class Meta:
        model = CashTransaction
        fields = (
            "id", "date", "transaction_type", "type_display", "amount",
            "balance_after", "counterparty", "reference_type", "reference_id",
            "note", "created_at",
        )
        read_only_fields = fields


class CashTransactionCreateSerializer(serializers.Serializer):
    transaction_type = serializers.ChoiceField(
        choices=["OTHER_IN", "BANK_DEPOSIT", "SUPPLIER_PAYMENT", "OTHER_OUT"]
    )
    amount = serializers.DecimalField(**_MONEY, min_value=Decimal("0.01"))
    date = serializers.DateField(required=False)
    counterparty = serializers.CharField(required=False, allow_blank=True, default="")
    note = serializers.CharField(required=False, allow_blank=True, default="")


class CompanyExpenseSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(
        source="get_category_display", read_only=True
    )
    date = serializers.DateField(required=False)

    class Meta:
        model = CompanyExpense
        fields = (
            "id", "date", "category", "category_display", "amount",
            "description", "paid_from_cash", "receipt_image",
            "cash_transaction", "created_at",
        )
        read_only_fields = ("id", "cash_transaction", "created_at")
