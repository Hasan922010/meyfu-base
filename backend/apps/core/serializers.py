"""Core serializerlar — kompaniya rekvizitlari (v4 T3)."""
from __future__ import annotations

import base64
import mimetypes
from decimal import Decimal

from rest_framework import serializers

from .models import CompanySettings

_MAX_ASSET_BYTES = 2 * 1024 * 1024


class CompanySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanySettings
        fields = (
            "id", "name", "legal_name", "inn", "address", "phone",
            "bank_details", "director_name", "logo", "stamp", "updated_at",
        )
        read_only_fields = ("id", "updated_at")


def _data_uri(field) -> str | None:
    if not field:
        return None
    try:
        field.open("rb")
        try:
            raw = field.read(_MAX_ASSET_BYTES + 1)
        finally:
            field.close()
    except (FileNotFoundError, ValueError):
        return None
    if len(raw) > _MAX_ASSET_BYTES:
        return None
    mime = mimetypes.guess_type(field.name)[0] or "image/png"
    return f"data:{mime};base64,{base64.b64encode(raw).decode()}"


class CompanyPublicSerializer(serializers.ModelSerializer):
    """Mobil offline kesh uchun — rasmlar base64 data-URI ko'rinishida (v4 T4)."""

    logo = serializers.SerializerMethodField()
    stamp = serializers.SerializerMethodField()

    class Meta:
        model = CompanySettings
        fields = (
            "name", "legal_name", "inn", "address", "phone",
            "bank_details", "director_name", "logo", "stamp", "updated_at",
        )

    def get_logo(self, obj: CompanySettings) -> str | None:
        return _data_uri(obj.logo)

    def get_stamp(self, obj: CompanySettings) -> str | None:
        return _data_uri(obj.stamp)


class OpeningSheetRowSerializer(serializers.Serializer):
    """Boshlang'ich qoldiqlar ro'yxati qatori — joriy balans bilan."""

    id = serializers.UUIDField()
    name = serializers.CharField()
    code = serializers.CharField(allow_blank=True)
    current = serializers.CharField()


class OpeningRowSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    # Yakuniy qoldiq — farqni server hisoblaydi (qayta yuborish xavfsiz)
    target = serializers.DecimalField(max_digits=14, decimal_places=3)


class OpeningBulkSerializer(serializers.Serializer):
    """Ommaviy boshlang'ich qoldiq. context: `non_negative`, `decimal_places`."""

    rows = OpeningRowSerializer(many=True, allow_empty=False)
    note = serializers.CharField(
        required=False, allow_blank=True, default="", max_length=200
    )

    def validate_rows(self, rows: list[dict]) -> list[dict]:
        ids = [row["id"] for row in rows]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError("Bir yozuv ikki marta kiritilgan.")
        if self.context.get("non_negative") and any(r["target"] < 0 for r in rows):
            raise serializers.ValidationError("Qoldiq manfiy bo'lishi mumkin emas.")
        places = self.context.get("decimal_places", 3)
        step = Decimal(1).scaleb(-places)
        if any(r["target"] != r["target"].quantize(step) for r in rows):
            raise serializers.ValidationError(
                f"Kasr qismi ko'pi bilan {places} xona bo'lishi mumkin."
            )
        return rows
