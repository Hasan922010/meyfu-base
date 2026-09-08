"""Core serializerlar — kompaniya rekvizitlari (v4 T3)."""
from __future__ import annotations

import base64
import mimetypes

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
