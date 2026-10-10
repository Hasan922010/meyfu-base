"""Zaxira va tiklash API ko'rinishlari (Backup & Restore Views) — CLAUDE.md 16, 7.7.

Admin paneli orqali:
- Zaxiralar ro'yxatini ko'rish (SUPER_ADMIN, MANAGER, ACCOUNTANT)
- Yangi zaxira yaratish (faqat SUPER_ADMIN)
- Zaxirani yuklab olish (faqat SUPER_ADMIN)
- Zaxirani tiklash (faqat SUPER_ADMIN)
- Tashqi zaxira faylini yuklash (faqat SUPER_ADMIN)
- Zaxirani o'chirish (faqat SUPER_ADMIN)
"""
from __future__ import annotations

import logging

from django.http import FileResponse, Http404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsCentralStaff, RolePermission
from apps.core.response import ok
from apps.core.services.backup import (
    BackupError,
    RestoreError,
    create_backup,
    delete_backup,
    list_backups,
    restore_backup,
    save_uploaded_backup,
    validate_backup_filename,
)
from apps.users.constants import Role

logger = logging.getLogger(__name__)

_ADMIN_ROLES = (Role.SUPER_ADMIN, Role.MANAGER, Role.ACCOUNTANT)


class BackupListView(APIView):
    """Mavjud barcha zaxiralar ro'yxati va yangi zaxira yaratish."""

    permission_classes = [IsAuthenticated, RolePermission, IsCentralStaff]
    read_roles = _ADMIN_ROLES
    write_roles = (Role.SUPER_ADMIN,)

    @extend_schema(summary="Zaxiralar ro'yxati", responses={200: list})
    def get(self, request: Request) -> Response:
        backups = list_backups()
        return ok(backups)

    @extend_schema(summary="Yangi zaxira yaratish", request=dict, responses={201: dict})
    def post(self, request: Request) -> Response:
        format_type = request.data.get("format", "auto")
        note = request.data.get("note", "")
        try:
            result = create_backup(
                format_type=format_type,
                note=note,
                user=request.user,
            )
            return ok(result, status_code=status.HTTP_201_CREATED)
        except BackupError as exc:
            return Response(
                {"success": False, "error": {"code": "BACKUP_FAILED", "message": str(exc)}},
                status=status.HTTP_400_BAD_REQUEST,
            )


class BackupDownloadView(APIView):
    """Zaxira faylini yuklab olish."""

    permission_classes = [IsAuthenticated, RolePermission, IsCentralStaff]
    read_roles = (Role.SUPER_ADMIN,)

    @extend_schema(summary="Zaxira faylini yuklab olish", responses={200: bytes})
    def get(self, request: Request, filename: str) -> FileResponse | Response:
        try:
            file_path = validate_backup_filename(filename)
        except BackupError as exc:
            return Response(
                {"success": False, "error": {"code": "INVALID_FILENAME", "message": str(exc)}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not file_path.is_file():
            raise Http404("Zaxira fayli topilmadi")

        return FileResponse(
            file_path.open("rb"),
            as_attachment=True,
            filename=file_path.name,
            content_type="application/gzip" if file_path.name.endswith(".gz") else "application/octet-stream",
        )


class BackupRestoreView(APIView):
    """Zaxira nusxasidan ma'lumotlarni tiklash."""

    permission_classes = [IsAuthenticated, RolePermission, IsCentralStaff]
    write_roles = (Role.SUPER_ADMIN,)

    @extend_schema(summary="Zaxiradan tiklash", request=dict, responses={200: dict})
    def post(self, request: Request, filename: str) -> Response:
        create_safety = request.data.get("create_safety", True)
        try:
            result = restore_backup(
                filename,
                user=request.user,
                create_safety=create_safety,
            )
            return ok(result)
        except (BackupError, RestoreError) as exc:
            return Response(
                {"success": False, "error": {"code": "RESTORE_FAILED", "message": str(exc)}},
                status=status.HTTP_400_BAD_REQUEST,
            )


class BackupUploadView(APIView):
    """Tashqi zaxira faylini yuklash."""

    permission_classes = [IsAuthenticated, RolePermission, IsCentralStaff]
    write_roles = (Role.SUPER_ADMIN,)
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(summary="Zaxira faylini yuklash", responses={201: dict})
    def post(self, request: Request) -> Response:
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response(
                {"success": False, "error": {"code": "NO_FILE", "message": "Zaxira fayli tanlanmadi"}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = save_uploaded_backup(uploaded_file, user=request.user)
            return ok(result, status_code=status.HTTP_201_CREATED)
        except BackupError as exc:
            return Response(
                {"success": False, "error": {"code": "UPLOAD_FAILED", "message": str(exc)}},
                status=status.HTTP_400_BAD_REQUEST,
            )


class BackupDeleteView(APIView):
    """Zaxira faylini o'chirish."""

    permission_classes = [IsAuthenticated, RolePermission, IsCentralStaff]
    write_roles = (Role.SUPER_ADMIN,)

    @extend_schema(summary="Zaxira faylini o'chirish", responses={200: dict})
    def delete(self, request: Request, filename: str) -> Response:
        try:
            delete_backup(filename, user=request.user)
            return ok({"deleted": True, "filename": filename})
        except BackupError as exc:
            return Response(
                {"success": False, "error": {"code": "DELETE_FAILED", "message": str(exc)}},
                status=status.HTTP_400_BAD_REQUEST,
            )
