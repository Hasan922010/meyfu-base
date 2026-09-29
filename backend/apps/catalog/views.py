from __future__ import annotations

from django.db.models import Q, QuerySet
from django.utils.dateparse import parse_datetime
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.branch import user_branch
from apps.core.models import AuditLog
from apps.core.permissions import RolePermission
from apps.core.response import ok
from apps.core.viewsets import BaseModelViewSet
from apps.users.constants import Role
from apps.warehouse.constants import MovementType
from apps.warehouse.services import apply_movement

from .filters import ProductFilter
from .models import BranchPrice, Brand, Category, Product, ProductImage, Unit
from .pricing import PRICE_FIELDS, branch_price_map
from .serializers import (
    BranchPriceSerializer,
    BrandSerializer,
    CategorySerializer,
    ProductImagePatchSerializer,
    ProductImageSerializer,
    ProductImageUploadSerializer,
    ProductLiteSerializer,
    ProductPriceSerializer,
    ProductSerializer,
    UnitSerializer,
)
from .services import (
    add_product_images,
    delete_product_image,
    reorder_product_images,
    set_primary_image,
)

_CATALOG_WRITE = (Role.MANAGER, Role.SUPER_ADMIN)


class CategoryViewSet(BaseModelViewSet):
    queryset = Category.objects.select_related("parent").all()
    serializer_class = CategorySerializer
    write_roles = _CATALOG_WRITE
    central_only_write = True  # katalog va narx — faqat markaz (filial o'qiydi)
    search_fields = ("name",)
    ordering_fields = ("name", "created_at")


class BrandViewSet(BaseModelViewSet):
    queryset = Brand.objects.all()
    serializer_class = BrandSerializer
    write_roles = _CATALOG_WRITE
    central_only_write = True  # katalog va narx — faqat markaz (filial o'qiydi)
    search_fields = ("name",)
    ordering_fields = ("name", "created_at")


class UnitViewSet(BaseModelViewSet):
    queryset = Unit.objects.all()
    serializer_class = UnitSerializer
    write_roles = _CATALOG_WRITE
    central_only_write = True  # katalog va narx — faqat markaz (filial o'qiydi)
    search_fields = ("name", "short_name")


class ProductViewSet(BaseModelViewSet):
    queryset = Product.objects.select_related(
        "category", "brand", "unit"
    ).prefetch_related("images")
    serializer_class = ProductSerializer
    write_roles = _CATALOG_WRITE
    central_only_write = True  # katalog va narx — faqat markaz (filial o'qiydi)
    filterset_class = ProductFilter
    search_fields = ("name", "sku", "barcode")
    # Admin jadvalidagi har bir ustun (UI: shared/table)
    ordering_fields = (
        "name", "sku", "category__name", "retail_price", "wholesale_price", "min_price",
        "is_active", "created_at",
    )
    action_roles = {
        "images": _CATALOG_WRITE,
        "image_detail": _CATALOG_WRITE,
    }

    def get_serializer_context(self) -> dict:
        # Filial xodimi — o'z filiali narxini ko'radi (v5: A7)
        context = super().get_serializer_context()
        context["branch_price_map"] = branch_price_map(user_branch(self.request.user))
        return context

    def perform_create(self, serializer: ProductSerializer) -> None:
        stock_warehouse = serializer.validated_data.pop("initial_stock_warehouse", None)
        stock_quantity = serializer.validated_data.pop("initial_stock_quantity", None)
        product = serializer.save(created_by=self.request.user)
        if stock_warehouse and stock_quantity:
            apply_movement(
                warehouse=stock_warehouse,
                product=product,
                quantity=stock_quantity,
                movement_type=MovementType.OPENING_BALANCE,
                user=self.request.user,
                note="Mahsulot yaratilganda boshlang'ich qoldiq",
            )

    @extend_schema(summary="Mahsulot rasmlari (galereya) — yuklash",
                   request=ProductImageUploadSerializer,
                   responses=ProductImageSerializer(many=True))
    @action(detail=True, methods=["post"], url_path="images",
            parser_classes=[MultiPartParser, FormParser])
    def images(self, request: Request, pk: str | None = None) -> Response:
        product = self.get_object()
        uploads = request.FILES.getlist("images") or request.FILES.getlist("image")
        if not uploads:
            s = ProductImageUploadSerializer(data=request.data)
            s.is_valid(raise_exception=True)
            uploads = s.validated_data["images"]
        created = add_product_images(product, list(uploads), user=request.user)
        return ok(
            ProductImageSerializer(
                created, many=True, context=self.get_serializer_context()
            ).data,
            status_code=201,
        )

    @extend_schema(summary="Bitta rasmni o'zgartirish / o'chirish",
                   request=ProductImagePatchSerializer)
    @action(detail=True, methods=["patch", "delete"],
            url_path=r"images/(?P<img_id>[^/.]+)")
    def image_detail(
        self, request: Request, pk: str | None = None, img_id: str | None = None
    ) -> Response:
        product = self.get_object()
        image = ProductImage.objects.filter(product=product, pk=img_id).first()
        if image is None:
            from apps.core.exceptions import BusinessError

            raise BusinessError(message="Rasm topilmadi.", code="NOT_FOUND",
                                status_code=404)
        if request.method == "DELETE":
            delete_product_image(image, user=request.user)
            return ok({"deleted": str(img_id)})

        s = ProductImagePatchSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data
        if "sort_order" in data:
            image = reorder_product_images(image, data["sort_order"],
                                           user=request.user)
        if data.get("is_primary"):
            image = set_primary_image(image, user=request.user)
        return ok(
            ProductImageSerializer(
                image, context=self.get_serializer_context()
            ).data
        )

    @extend_schema(summary="Mahsulot omborlardagi qoldig'i")
    @action(detail=True, methods=["get"])
    def stock(self, request: Request, pk: str | None = None) -> Response:
        product = self.get_object()
        rows = product.stocks.select_related("warehouse").all()
        data = [
            {
                "warehouse_id": str(s.warehouse_id),
                "warehouse_name": s.warehouse.name,
                "quantity": str(s.quantity),
                "reserved_quantity": str(s.reserved_quantity),
                "available_quantity": str(s.available_quantity),
            }
            for s in rows
        ]
        total = sum((s.quantity for s in rows), start=0)
        return ok(
            {
                "product_id": str(product.id),
                "total": str(total),
                "by_warehouse": data,
            }
        )

    @extend_schema(
        summary="Tez qidiruv (nomi / SKU / barcode)",
        parameters=[OpenApiParameter("q", str, required=True)],
    )
    @action(detail=False, methods=["get"])
    def search(self, request: Request) -> Response:
        q = request.query_params.get("q", "").strip()
        qs: QuerySet[Product] = self.get_queryset().filter(is_active=True)
        if q:
            from django.db.models import Q

            qs = qs.filter(
                Q(name__icontains=q) | Q(sku__icontains=q) | Q(barcode__iexact=q)
            )
        qs = qs[:20]
        data = ProductSerializer(
            qs, many=True, context=self.get_serializer_context()
        ).data
        return ok(data)

    @extend_schema(
        summary="Mahsulot narx tarixi",
        responses=ProductPriceSerializer(many=True),
    )
    @action(detail=True, methods=["get"], url_path="price-history")
    def price_history(self, request: Request, pk: str | None = None) -> Response:
        product = self.get_object()
        return ok(
            ProductPriceSerializer(product.price_history.all(), many=True).data
        )


class BranchPriceViewSet(BaseModelViewSet):
    """Filial narxlari — markaz belgilaydi, filial o'z narxlarini o'qiydi (v5: A7)."""

    queryset = BranchPrice.objects.select_related("branch", "product")
    serializer_class = BranchPriceSerializer
    write_roles = (Role.SUPER_ADMIN,)  # narx — faqat SUPER_ADMIN (CLAUDE.md 2)
    central_only_write = True
    branch_lookup = "branch"
    filterset_fields = ("branch", "product")
    search_fields = ("product__name", "product__sku")
    pagination_class = None

    def perform_create(self, serializer) -> None:
        price = serializer.save(created_by=self.request.user)
        self._audit("branch_price.create", price, {})

    def perform_update(self, serializer) -> None:
        before = {f: str(getattr(serializer.instance, f)) for f in PRICE_FIELDS}
        price = serializer.save()
        self._audit("branch_price.update", price, {"before": before})

    def perform_destroy(self, instance) -> None:
        self._audit("branch_price.delete", instance, {})
        instance.hard_delete()

    def _audit(self, action_name: str, price, extra: dict) -> None:
        # CLAUDE.md 5.3 — narx o'zgarishi majburiy audit
        AuditLog.objects.create(
            user=self.request.user, action=action_name, model_name="BranchPrice",
            object_id=str(price.pk),
            changes={**extra, "branch": price.branch.name, "product": price.product.sku,
                     **{f: str(getattr(price, f)) for f in PRICE_FIELDS}},
        )


class CatalogSyncView(APIView):
    """Offline uchun delta yuklab olish (CLAUDE.md 4.1, 10).

    GET /api/v1/sync/catalog/?since=<ISO8601>
    `since` berilmasa — to'liq katalog. O'chirilganlar ham qaytadi (is_deleted).
    """

    permission_classes = [RolePermission]

    @extend_schema(
        summary="Katalog sinxronizatsiyasi (delta)",
        parameters=[OpenApiParameter("since", str, required=False)],
        responses=ProductLiteSerializer(many=True),
    )
    def get(self, request: Request) -> Response:
        since_raw = request.query_params.get("since")
        branch = user_branch(request.user)
        qs = Product.all_objects.select_related("unit").prefetch_related("images").all()
        if since_raw:
            since = parse_datetime(since_raw)
            if since is None:
                from apps.core.exceptions import BusinessError

                raise BusinessError(
                    message="`since` ISO8601 formatda bo'lishi kerak.",
                    code="INVALID_SINCE",
                    status_code=400,
                )
            # Filial narxi o'zgarsa ham mahsulot qaytadan yuborilsin (A7)
            changed = Q(updated_at__gt=since)
            if branch is not None:
                changed |= Q(branch_prices__branch=branch,
                             branch_prices__updated_at__gt=since)
            qs = qs.filter(changed).distinct()

        from django.utils import timezone

        context = {"request": request, "branch_price_map": branch_price_map(branch)}
        return ok(
            {
                "server_time": timezone.now().isoformat(),
                "count": qs.count(),
                "products": ProductLiteSerializer(qs, many=True, context=context).data,
            }
        )
