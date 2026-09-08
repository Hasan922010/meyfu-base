from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .constants import Role
from .models import DistributorProfile

User = get_user_model()


class DistributorProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = DistributorProfile
        fields = (
            "vehicle_number", "base_salary", "commission_percent",
            "order_commission_percent", "delivery_commission_percent",
            "monthly_plan", "debt_limit", "can_sell_below_price",
            "daily_expense_limit", "expenses_covered_by",
        )


class UserSerializer(serializers.ModelSerializer):
    distributor_profile = DistributorProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = (
            "id", "phone", "full_name", "role", "avatar",
            "passport_series", "address", "hire_date",
            "is_active", "last_seen_at", "telegram_chat_id",
            "distributor_profile",
        )
        read_only_fields = ("id", "last_seen_at", "role")


class UserWriteSerializer(serializers.ModelSerializer):
    """Xodim yaratish/tahrirlash (faqat SUPER_ADMIN). CLAUDE.md 2, 6."""

    password = serializers.CharField(write_only=True, required=False, min_length=8)
    distributor_profile = DistributorProfileSerializer(required=False)

    class Meta:
        model = User
        fields = (
            "id", "phone", "full_name", "role", "passport_series", "address",
            "hire_date", "is_active", "password", "distributor_profile",
        )
        read_only_fields = ("id",)
        extra_kwargs = {"phone": {"validators": []}}  # normalizatsiya validate_phone'da

    def validate_password(self, value: str) -> str:
        validate_password(value)
        return value

    def validate_phone(self, value: str) -> str:
        normalized = User.normalize_phone(value)
        qs = User.objects.filter(phone=normalized)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Bu telefon raqami band.")
        return normalized

    def validate(self, attrs: dict) -> dict:
        if self.instance is None and not attrs.get("password"):
            raise serializers.ValidationError(
                {"password": "Yangi xodim uchun parol majburiy."}
            )
        return attrs

    @transaction.atomic
    def create(self, validated_data: dict):
        password = validated_data.pop("password")
        profile_data = validated_data.pop("distributor_profile", None)
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        if user.role == Role.DISTRIBUTOR:
            DistributorProfile.objects.create(user=user, **(profile_data or {}))
        return user

    @transaction.atomic
    def update(self, instance, validated_data: dict):
        password = validated_data.pop("password", None)
        profile_data = validated_data.pop("distributor_profile", None)

        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
        instance.save()

        if instance.role == Role.DISTRIBUTOR:
            # instance'ga bog'langan (select_related'dan keshlangan) profilni
            # ishlatamiz — shunda to_representation yangi qiymatlarni ko'radi.
            profile = getattr(instance, "distributor_profile", None)
            if profile is None:
                profile = DistributorProfile.objects.create(user=instance)
            if profile_data:
                for field, value in profile_data.items():
                    setattr(profile, field, value)
                profile.save()
        return instance

    def to_representation(self, instance):
        return UserSerializer(instance, context=self.context).data


class LoginSerializer(TokenObtainPairSerializer):
    """JWT + foydalanuvchi ma'lumoti bitta javobda."""

    username_field = "phone"

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["full_name"] = user.full_name
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        return {
            "success": True,
            "data": {
                "access": data["access"],
                "refresh": data["refresh"],
                "user": UserSerializer(self.user).data,
            },
        }


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_old_password(self, value: str) -> str:
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Joriy parol noto'g'ri.")
        return value

    def save(self, **kwargs) -> None:
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password", "updated_at"])
