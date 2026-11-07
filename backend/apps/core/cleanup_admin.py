"""Confirmation UI shared only by transaction journal admins."""
from django import forms
from django.contrib import admin, messages
from django.core import signing
from django.core.exceptions import PermissionDenied
from django.db import DatabaseError
from django.http import HttpResponseRedirect
from django.template.response import TemplateResponse

from .services.test_cleanup import (
    CleanupBlocked,
    build_plan,
    execute_cleanup,
    is_test_cleanup_enabled,
    require_superuser,
)

SALT = "admin.selected-test-operations"


class CleanupConfirmationForm(forms.Form):
    reason = forms.CharField(label="Nega bu operatsiyalar soxta?", max_length=500)
    confirmation = forms.CharField(
        label="Tasdiqlash uchun TOZALASH deb yozing", max_length=20,
    )
    password = forms.CharField(
        label="Joriy superuser parolingiz",
        widget=forms.PasswordInput(attrs={"autocomplete": "current-password"}),
    )
    acknowledged = forms.BooleanField(
        label="Bog‘liq yozuvlar va balans ta’sirini tekshirdim; bular soxta ma’lumotlar.",
    )

    def __init__(self, *args, user, **kwargs):
        super().__init__(*args, **kwargs)
        self.user = user

    def clean_confirmation(self):
        if self.cleaned_data["confirmation"] != "TOZALASH":
            raise forms.ValidationError("TOZALASH deb aniq yozing.")
        return self.cleaned_data["confirmation"]

    def clean_password(self):
        value = self.cleaned_data["password"]
        if not self.user.check_password(value):
            raise forms.ValidationError("Parol noto‘g‘ri.")
        return value


class TestCleanupAdminMixin:
    actions = ("cleanup_selected_test_operations",)

    def has_test_cleanup_permission(self, request):
        u = request.user
        return bool(u.is_active and u.is_staff and u.is_superuser and is_test_cleanup_enabled())

    @admin.action(
        description="Tanlangan soxta operatsiyalarni tozalash…",
        permissions=["test_cleanup"],
    )
    def cleanup_selected_test_operations(self, request, queryset):
        require_superuser(request.user)
        if request.method != "POST":
            raise PermissionDenied
        ids = sorted(str(pk) for pk in queryset.values_list("pk", flat=True)[:101])
        # Do not silently limit a select-across request to the first 100 rows.
        if queryset.count() > 100:
            self.message_user(request, "Ko‘pi bilan 100 ta yozuv tanlang.", messages.ERROR)
            return HttpResponseRedirect(request.path)
        label = self.model._meta.label_lower
        applied = request.POST.get("apply_cleanup") == "yes"
        try:
            plan = build_plan(label, ids, user=request.user)
            if applied:
                try:
                    signed = signing.loads(
                        request.POST.get("cleanup_token", ""), salt=SALT, max_age=600,
                    )
                except signing.BadSignature as exc:
                    raise CleanupBlocked(
                        "Tasdiqlash muddati tugagan yoki ma’lumot noto‘g‘ri. Qayta tanlang."
                    ) from exc
                if signed.get("user") != str(request.user.pk) or signed.get("model") != label:
                    raise PermissionDenied
                if signed.get("ids") != ids or signed.get("digest") != plan.digest:
                    raise CleanupBlocked("Tanlov yoki balans o‘zgargan. Qayta tanlang.")
                token = request.POST["cleanup_token"]
            else:
                token = signing.dumps({
                    "user": str(request.user.pk), "model": label, "ids": ids,
                    "digest": plan.digest,
                }, salt=SALT)
            form = CleanupConfirmationForm(
                request.POST if applied else None, user=request.user,
            )
            if applied and form.is_valid():
                count = execute_cleanup(
                    label, ids, user=request.user, expected_digest=plan.digest,
                    reason=form.cleaned_data["reason"],
                )
                self.message_user(
                    request,
                    f"{count} ta soxta/bog‘liq yozuv faol hisoblardan chiqarildi. "
                    "Balanslar moslandi, audit nusxasi saqlandi.",
                    messages.SUCCESS,
                )
                return HttpResponseRedirect(request.path)
        except CleanupBlocked as exc:
            self.message_user(request, str(exc), messages.ERROR)
            return HttpResponseRedirect(request.path)
        except DatabaseError:
            self.message_user(
                request,
                "Baza band yoki amal bajarilmadi. Hech narsa qisman tozalanmadi. "
                "Boshqa qurilmalardagi ishlarni to‘xtatib, qayta urinib ko‘ring.",
                messages.ERROR,
            )
            return HttpResponseRedirect(request.path)
        payload = plan.payload()
        effects = [
            {
                "label": str(obj),
                "changes": [
                    {
                        "field": obj._meta.get_field(field).verbose_name,
                        "old": getattr(obj, field), "new": value,
                    }
                    for field, value in changes.items()
                ],
            }
            for obj, changes in plan.effects.values()
        ]
        return TemplateResponse(request, "admin/test_cleanup_confirmation.html", {
            **self.admin_site.each_context(request),
            "title": "Tanlangan soxta operatsiyalarni tozalash",
            "opts": self.model._meta, "form": form, "rows": payload["rows"],
            "effects": effects, "selected_ids": ids, "cleanup_token": token,
            "action_name": "cleanup_selected_test_operations",
        })
