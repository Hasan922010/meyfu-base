from django.db import models
from django_filters import rest_framework as filters

from .models import Product


class ProductFilter(filters.FilterSet):
    min_price_gte = filters.NumberFilter(field_name="min_price", lookup_expr="gte")
    price_lte = filters.NumberFilter(field_name="retail_price", lookup_expr="lte")
    retail_price_min = filters.NumberFilter(field_name="retail_price", lookup_expr="gte")
    retail_price_max = filters.NumberFilter(field_name="retail_price", lookup_expr="lte")
    warehouse = filters.UUIDFilter(method="filter_warehouse")
    stock_status = filters.ChoiceFilter(
        choices=(("out", "out"), ("low", "low"), ("ok", "ok")),
        method="filter_stock_status",
    )

    def filter_warehouse(self, queryset, name, value):
        return queryset.filter(stocks__warehouse_id=value, stocks__is_deleted=False).distinct()

    def filter_stock_status(self, queryset, name, value):
        if value == "out":
            return queryset.filter(available_stock__lte=0)
        if value == "low":
            return queryset.filter(
                available_stock__gt=0,
                available_stock__lte=models.F("min_stock_alert"),
            )
        return queryset.filter(available_stock__gt=models.F("min_stock_alert"))

    class Meta:
        model = Product
        fields = {
            "category": ["exact"],
            "brand": ["exact"],
            "unit": ["exact"],
            "is_active": ["exact"],
        }
