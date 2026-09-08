from django_filters import rest_framework as filters

from .models import Product


class ProductFilter(filters.FilterSet):
    min_price_gte = filters.NumberFilter(field_name="min_price", lookup_expr="gte")
    price_lte = filters.NumberFilter(field_name="retail_price", lookup_expr="lte")

    class Meta:
        model = Product
        fields = {
            "category": ["exact"],
            "brand": ["exact"],
            "unit": ["exact"],
            "is_active": ["exact"],
        }
