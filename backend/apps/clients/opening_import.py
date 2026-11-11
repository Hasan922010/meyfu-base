"""Mijozlar boshlang'ich qarzi va bazada yo'q mijozlarni Excel'dan import qilish."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from decimal import Decimal
from typing import IO, Any

from django.db import transaction
from openpyxl.utils import get_column_letter

from apps.core.branch import staff_branch
from apps.core.exceptions import BusinessError
from apps.core.models import AuditLog
from apps.core.services.excel_import import (
    ImportRollback,
    cell_text,
    norm_key,
    open_xlsx_sheet,
    parse_non_negative_decimal,
)
from apps.users.models import User

from .models import Client, Route

_ZERO = Decimal("0")
_UZ_PHONE_RE = re.compile(r"\+998\d{9}")

TARGET_FIELDS: list[dict[str, Any]] = [
    {"key": "name", "label": "Do'kon / Mijoz nomi", "required": True},
    {"key": "amount", "label": "Boshlang'ich qarz summasi", "required": True},
    {"key": "assigned_to", "label": "Mas'ul xodim (kimning mijozi)", "required": False},
    {"key": "phone", "label": "Telefon", "required": False},
    {"key": "owner_name", "label": "Egasi (F.I.SH.)", "required": False},
    {"key": "address", "label": "Manzil", "required": False},
    {"key": "route", "label": "Marshrut", "required": False},
    {"key": "debt_limit", "label": "Qarz limiti", "required": False},
    {"key": "note", "label": "Izoh", "required": False},
]
TARGET_KEYS = {f["key"] for f in TARGET_FIELDS}

_ALIASES: dict[str, str] = {
    "do'kon nomi": "name",
    "dokon nomi": "name",
    "do'kon": "name",
    "dokon": "name",
    "mijoz nomi": "name",
    "mijoz": "name",
    "nomi": "name",
    "name": "name",
    "client": "name",
    "client_name": "name",
    "boshlang'ich qarz": "amount",
    "boshlangich qarz": "amount",
    "qarz": "amount",
    "qarz summasi": "amount",
    "summa": "amount",
    "amount": "amount",
    "debt": "amount",
    "opening_debt": "amount",
    "opening_balance": "amount",
    "qoldiq": "amount",
    "xodim": "assigned_to",
    "mas'ul xodim": "assigned_to",
    "masul xodim": "assigned_to",
    "kimning mijozi": "assigned_to",
    "agent": "assigned_to",
    "tarqatuvchi": "assigned_to",
    "zakaz oluvchi": "assigned_to",
    "employee": "assigned_to",
    "staff": "assigned_to",
    "assigned_to": "assigned_to",
    "distributor": "assigned_to",
    "telefon": "phone",
    "tel": "phone",
    "phone": "phone",
    "telefon raqam": "phone",
    "egasi": "owner_name",
    "mas'ul shaxs": "owner_name",
    "masul shaxs": "owner_name",
    "owner": "owner_name",
    "owner_name": "owner_name",
    "manzil": "address",
    "address": "address",
    "mo'ljal": "address",
    "moljal": "address",
    "marshrut": "route",
    "yo'nalish": "route",
    "yonalish": "route",
    "route": "route",
    "qarz limiti": "debt_limit",
    "limit": "debt_limit",
    "debt_limit": "debt_limit",
    "izoh": "note",
    "eslatma": "note",
    "note": "note",
    "comment": "note",
}

TEMPLATE_HEADER = [
    "do'kon nomi",
    "xodim",
    "boshlang'ich qarz",
    "telefon",
    "egasi",
    "manzil",
    "marshrut",
    "qarz limiti",
    "izoh",
]
TEMPLATE_SAMPLE = [
    "Omad market",
    "Ali Valiyev",
    1500000,
    "+998901234567",
    "Alisher",
    "Chilonzor 5",
    "Chilonzor",
    5000000,
    "Eski qarz",
]


@dataclass
class ClientOpeningRowResult:
    row: int
    client_name: str
    assigned_to_name: str
    current_debt: str
    target_debt: str
    delta: str
    action: str  # CREATE_AND_DEBT | CREATE_CLIENT | ADD_DEBT | SKIP | ERROR
    errors: list[str] = field(default_factory=list)
    client_phone: str = ""


@dataclass
class ClientOpeningImportReport:
    dry_run: bool
    created_clients: int = 0
    existing_clients: int = 0
    debts_applied: int = 0
    skipped: int = 0
    rows: list[ClientOpeningRowResult] = field(default_factory=list)

    @property
    def error_count(self) -> int:
        return sum(1 for r in self.rows if r.action == "ERROR")

    def as_dict(self) -> dict[str, Any]:
        return {
            "dry_run": self.dry_run,
            "created_clients": self.created_clients,
            "existing_clients": self.existing_clients,
            "debts_applied": self.debts_applied,
            "skipped": self.skipped,
            "errors": self.error_count,
            "rows": [r.__dict__ for r in self.rows],
        }


@dataclass
class _ExistingPlan:
    report_idx: int
    client_id: Any
    target_debt: Decimal | None
    assign_staff: User | None
    note: str
    assign_phone: str = ""


@dataclass
class _CreatePlan:
    name: str
    owner_name: str
    phone: str
    address: str
    route_name: str
    staff: User | None
    debt_limit: Decimal
    note: str
    effective_branch: Any
    target_debt: Decimal


def _load_sheet(file: IO[bytes]) -> tuple[list[str], list[tuple[int, tuple[Any, ...]]]]:
    raw_header, rows = open_xlsx_sheet(file)
    max_col = -1
    for idx, val in enumerate(raw_header):
        if cell_text(val) != "":
            max_col = idx
    for _, values in rows:
        for idx, val in enumerate(values):
            if val not in (None, "") and idx > max_col:
                max_col = idx

    if max_col < 0:
        raise BusinessError(message="Fayl sarlavhasi bo'sh.", code="EMPTY_FILE")

    headers: list[str] = []
    for idx in range(max_col + 1):
        val = raw_header[idx] if idx < len(raw_header) else None
        label = cell_text(val)
        headers.append(label or f"Ustun {get_column_letter(idx + 1)}")

    trimmed_rows = [
        (num, tuple(vals[i] if i < len(vals) else None for i in range(max_col + 1)))
        for num, vals in rows
    ]
    return headers, trimmed_rows


def _auto_mapping(headers: list[str]) -> dict[str, int]:
    used_fields: set[str] = set()
    mapping: dict[str, int] = {}
    for idx, h in enumerate(headers):
        target = _ALIASES.get(norm_key(h))
        if target and target not in used_fields:
            mapping[target] = idx
            used_fields.add(target)
    return mapping


def inspect_client_opening_excel(file: IO[bytes]) -> dict[str, Any]:
    """Excel fayl sarlavhalari, namuna qatorlar va avtomatik ustun mosligini qaytaradi."""
    headers, rows = _load_sheet(file)
    columns = [
        {"index": i, "letter": get_column_letter(i + 1), "header": h}
        for i, h in enumerate(headers)
    ]
    sample_rows = [[cell_text(c) for c in row] for _, row in rows[:5]]
    return {
        "headers": headers,
        "columns": columns,
        "sample_rows": sample_rows,
        "total_rows": len(rows),
        "auto_mapping": _auto_mapping(headers),
        "target_fields": TARGET_FIELDS,
    }


def _clean_mapping(raw_mapping: dict[str, Any], col_count: int) -> dict[str, int]:
    cleaned: dict[str, int] = {}
    used_cols: set[int] = set()
    for key, val in (raw_mapping or {}).items():
        if key not in TARGET_KEYS or val in (None, ""):
            continue
        try:
            idx = int(val)
        except (TypeError, ValueError) as exc:
            raise BusinessError(
                message=f"«{key}» uchun ustun raqami noto'g'ri.",
                code="INVALID_MAPPING",
            ) from exc
        if idx < 0 or idx >= col_count:
            raise BusinessError(
                message=f"«{key}» uchun tanlangan ustun faylda mavjud emas.",
                code="INVALID_MAPPING",
            )
        if idx in used_cols:
            raise BusinessError(
                message="Bitta Excel ustunini ikkita maydonga biriktirib bo'lmaydi.",
                code="DUPLICATE_MAPPING",
            )
        cleaned[key] = idx
        used_cols.add(idx)

    if "name" not in cleaned or "amount" not in cleaned:
        raise BusinessError(
            message="Kamida «Do'kon / Mijoz nomi» va «Boshlang'ich qarz summasi» ustunlarini tanlang.",
            code="MISSING_MAPPING",
        )
    return cleaned


class _StaffIndex:
    """Fayl bo'yicha xodimni telefon yoki F.I.SH. orqali tezkor topish."""

    def __init__(self, branch) -> None:
        qs = User.objects.select_related("warehouse").filter(is_deleted=False)
        if branch is not None:
            qs = qs.filter(warehouse=branch)
        self._by_phone: dict[str, User] = {}
        self._by_name: dict[str, list[User]] = {}
        for u in qs:
            if u.phone:
                self._by_phone[u.phone] = u
            k = norm_key(u.full_name or "")
            if k:
                self._by_name.setdefault(k, []).append(u)

    def resolve(self, raw_value: str) -> tuple[User | None, str | None]:
        cleaned = raw_value.strip()
        if not cleaned:
            return None, None
        norm_phone = User.normalize_phone(cleaned)
        if _UZ_PHONE_RE.fullmatch(norm_phone) and norm_phone in self._by_phone:
            return self._by_phone[norm_phone], None
        matches = self._by_name.get(norm_key(cleaned), [])
        if len(matches) == 1:
            return matches[0], None
        if len(matches) > 1:
            return (
                None,
                f"Bir nechta «{cleaned}» xodimi topildi — telefon raqami bilan kiriting.",
            )
        return None, f"Xodim topilmadi: «{cleaned}»."


class _RouteIndex:
    """Marshrutlarni 1 so'rovda yuklab, faqat yozish bosqichida yaratadi/tiklaydi."""

    def __init__(self, branch) -> None:
        qs = Route.all_objects.select_related("branch")
        if branch is not None:
            qs = qs.filter(branch=branch)
        self._by_name: dict[str, Route] = {}
        for r in qs:
            k = norm_key(r.name)
            if k not in self._by_name or (self._by_name[k].is_deleted and not r.is_deleted):
                self._by_name[k] = r

    def peek(self, route_name: str) -> Route | None:
        return self._by_name.get(norm_key(route_name))

    def get_or_create(self, route_name: str, *, default_branch, user) -> Route:
        key = norm_key(route_name)
        obj = self._by_name.get(key)
        if obj is not None:
            if obj.is_deleted:
                obj.is_deleted = False
                obj.save(update_fields=["is_deleted", "updated_at"])
            return obj
        obj = Route.objects.create(
            name=route_name,
            branch=default_branch,
            created_by=user,
        )
        self._by_name[key] = obj
        return obj


class _ClientIndex:
    """Fayl bo'yicha mavjud mijozlarni 1 so'rov bilan xotirada indekslaydi."""

    def __init__(self, branch) -> None:
        qs = Client.objects.select_related("assigned_to", "branch")
        if branch is not None:
            qs = qs.filter(branch=branch)
        self._by_phone: dict[str, list[Client]] = {}
        self._by_name: dict[str, list[Client]] = {}
        for c in qs:
            if c.phone:
                self._by_phone.setdefault(c.phone, []).append(c)
            self._by_name.setdefault(norm_key(c.name), []).append(c)

    def bind_phone(self, client: Client, phone: str) -> None:
        if phone and not client.phone:
            client.phone = phone
            self._by_phone.setdefault(phone, []).append(client)

    def match(
        self, *, name: str, phone: str, staff: User | None
    ) -> tuple[Client | None, str | None]:
        name_k = norm_key(name)
        if phone:
            by_phone = self._by_phone.get(phone, [])
            if len(by_phone) == 1:
                only = by_phone[0]
                if norm_key(only.name) != name_k:
                    return (
                        None,
                        f"«{phone}» raqami «{only.name}» mijoziga biriktirilgan — "
                        "nomini tekshiring yoki telefonsiz kiriting.",
                    )
                return only, None
            if len(by_phone) > 1:
                exact = [c for c in by_phone if norm_key(c.name) == name_k]
                if len(exact) == 1:
                    return exact[0], None
                if len(exact) > 1 and staff is not None:
                    by_staff = [c for c in exact if c.assigned_to_id == staff.id]
                    if len(by_staff) == 1:
                        return by_staff[0], None
                if not exact:
                    return (
                        None,
                        f"«{phone}» raqami boshqa nomdagi mijozlarga biriktirilgan — nomini tekshiring.",
                    )
                return None, f"«{phone}» raqami bir nechta mijozga biriktirilgan."

            # Telefon ko'rsatilgan, lekin bazada shu raqam topilmadi:
            # agar bazada ayni shu nomli faqat 1 ta telefonsiz mijoz bo'lsa — bog'lanadi;
            # boshqa raqamli (bir xil nomli) mijoz bo'lsa — yangi mijoz sifatida farqlanadi.
            by_name = self._by_name.get(name_k, [])
            if len(by_name) == 1 and not by_name[0].phone:
                return by_name[0], None
            return None, None

        by_name = self._by_name.get(name_k, [])
        if not by_name:
            return None, None
        if len(by_name) == 1:
            return by_name[0], None
        if staff is not None:
            by_staff = [c for c in by_name if c.assigned_to_id == staff.id]
            if len(by_staff) == 1:
                return by_staff[0], None
        return (
            None,
            f"«{name}» nomli bir nechta mijoz bor — qarzdorlikni farqlash uchun telefon raqamini ko'rsating.",
        )


def import_client_opening_balances(
    file: IO[bytes],
    *,
    mapping: dict[str, Any],
    default_assigned_to_id: str | None = None,
    auto_create_missing: bool = True,
    note: str = "",
    user,
    branch=None,
    dry_run: bool = True,
) -> ClientOpeningImportReport:
    from apps.sales.services.debt import create_opening_debt

    headers, rows = _load_sheet(file)
    col_map = _clean_mapping(mapping, len(headers))

    default_staff: User | None = None
    if default_assigned_to_id:
        default_qs = User.objects.select_related("warehouse").filter(
            is_deleted=False, pk=default_assigned_to_id
        )
        if branch is not None:
            default_qs = default_qs.filter(warehouse=branch)
        default_staff = default_qs.first()
        if default_staff is None:
            raise BusinessError(
                message="Tanlangan standart mas'ul xodim topilmadi.",
                code="INVALID_STAFF",
            )

    staff_index = _StaffIndex(branch)
    route_index = _RouteIndex(branch)
    client_index = _ClientIndex(branch)

    report = ClientOpeningImportReport(dry_run=dry_run)
    seen_existing: set[str] = set()
    seen_new_phones: set[str] = set()
    seen_new_keys: set[str] = set()
    planned_route_branch: dict[str, Any] = {}
    existing_plans: list[_ExistingPlan] = []
    create_plans: list[_CreatePlan] = []

    def cell(values: tuple[Any, ...], key: str) -> str:
        idx = col_map.get(key)
        if idx is None or idx >= len(values):
            return ""
        return cell_text(values[idx])

    def add_error(
        number: int,
        client_name: str,
        staff_label: str,
        errors: list[str],
        *,
        client_phone: str = "",
        current: str = "0",
        target: str = "0",
    ) -> None:
        report.rows.append(
            ClientOpeningRowResult(
                row=number,
                client_name=client_name,
                assigned_to_name=staff_label,
                current_debt=current,
                target_debt=target,
                delta="0",
                action="ERROR",
                errors=errors,
                client_phone=client_phone,
            )
        )

    for number, values in rows:
        name = cell(values, "name")
        row_errors: list[str] = []

        if not name:
            row_errors.append("Do'kon / mijoz nomi bo'sh.")

        raw_staff = cell(values, "assigned_to")
        staff: User | None = default_staff
        if raw_staff:
            resolved_staff, staff_err = staff_index.resolve(raw_staff)
            if staff_err:
                row_errors.append(staff_err)
            else:
                staff = resolved_staff
        staff_label = staff.full_name if staff else "—"

        raw_phone = cell(values, "phone")
        phone = ""
        if raw_phone:
            norm_p = User.normalize_phone(raw_phone)
            if not _UZ_PHONE_RE.fullmatch(norm_p):
                row_errors.append(
                    f"Telefon +998XXXXXXXXX ko'rinishida bo'lsin: «{raw_phone}»."
                )
            else:
                phone = norm_p

        raw_amount = values[col_map["amount"]] if col_map["amount"] < len(values) else None
        amount_val, amount_err = parse_non_negative_decimal(raw_amount, "Boshlang'ich qarz")
        if amount_err:
            row_errors.append(amount_err)

        raw_limit = (
            values[col_map["debt_limit"]]
            if "debt_limit" in col_map and col_map["debt_limit"] < len(values)
            else None
        )
        debt_limit_val, limit_err = parse_non_negative_decimal(raw_limit, "Qarz limiti")
        if limit_err:
            row_errors.append(limit_err)

        if row_errors:
            add_error(
                number,
                name or "—",
                staff_label,
                row_errors,
                client_phone=phone or raw_phone,
                target=cell_text(raw_amount) or "0",
            )
            continue

        matched, match_err = client_index.match(name=name, phone=phone, staff=staff)
        if match_err:
            add_error(
                number,
                name,
                staff_label,
                [match_err],
                client_phone=phone,
                target=str(amount_val if amount_val is not None else _ZERO),
            )
            continue

        row_note = cell(values, "note") or note
        s_b = staff_branch(staff)

        if matched is not None:
            cid = str(matched.id)
            effective_staff = matched.assigned_to or staff
            effective_staff_name = effective_staff.full_name if effective_staff else "—"
            target_str = str(amount_val if amount_val is not None else matched.current_debt)
            report_phone = phone or matched.phone

            if cid in seen_existing:
                add_error(
                    number,
                    matched.name,
                    effective_staff_name,
                    ["Bu mijoz faylda takrorlangan."],
                    client_phone=report_phone,
                    current=str(matched.current_debt),
                    target=target_str,
                )
                continue
            seen_existing.add(cid)

            if matched.is_blocked:
                add_error(
                    number,
                    matched.name,
                    effective_staff_name,
                    ["Bloklangan mijozga boshlang'ich qarz kiritib bo'lmaydi."],
                    client_phone=report_phone,
                    current=str(matched.current_debt),
                    target=target_str,
                )
                continue

            if branch is None and s_b is not None and matched.branch_id not in (None, s_b.pk):
                add_error(
                    number,
                    matched.name,
                    effective_staff_name,
                    [f"«{matched.name}» boshqa filialga tegishli, «{staff.full_name}» esa boshqa filial xodimi."],
                    client_phone=report_phone,
                    current=str(matched.current_debt),
                    target=target_str,
                )
                continue

            assign_phone = phone if (phone and not matched.phone) else ""
            if assign_phone:
                client_index.bind_phone(matched, assign_phone)

            report.existing_clients += 1
            current = matched.current_debt
            assign_staff = staff if matched.assigned_to_id is None and staff is not None else None

            if amount_val is None:
                report.skipped += 1
                report_idx = len(report.rows)
                report.rows.append(
                    ClientOpeningRowResult(
                        row=number,
                        client_name=matched.name,
                        assigned_to_name=effective_staff_name,
                        current_debt=str(current),
                        target_debt=str(current),
                        delta="0",
                        action="SKIP",
                        client_phone=report_phone,
                    )
                )
                if assign_staff is not None or assign_phone:
                    existing_plans.append(
                        _ExistingPlan(
                            report_idx, matched.id, None, assign_staff, row_note, assign_phone
                        )
                    )
                continue

            delta = amount_val - current
            if delta < _ZERO:
                report.rows.append(
                    ClientOpeningRowResult(
                        row=number,
                        client_name=matched.name,
                        assigned_to_name=effective_staff_name,
                        current_debt=str(current),
                        target_debt=str(amount_val),
                        delta=str(delta),
                        action="ERROR",
                        errors=[
                            f"Joriy qarz ({current}) kiritilgan summadan ({amount_val}) katta — "
                            "kamaytirish qarz to'lovi orqali kiritiladi."
                        ],
                        client_phone=report_phone,
                    )
                )
                continue

            report_idx = len(report.rows)
            if delta == _ZERO:
                report.skipped += 1
                report.rows.append(
                    ClientOpeningRowResult(
                        row=number,
                        client_name=matched.name,
                        assigned_to_name=effective_staff_name,
                        current_debt=str(current),
                        target_debt=str(amount_val),
                        delta="0",
                        action="SKIP",
                        client_phone=report_phone,
                    )
                )
            else:
                report.debts_applied += 1
                report.rows.append(
                    ClientOpeningRowResult(
                        row=number,
                        client_name=matched.name,
                        assigned_to_name=effective_staff_name,
                        current_debt=str(current),
                        target_debt=str(amount_val),
                        delta=str(delta),
                        action="ADD_DEBT",
                        client_phone=report_phone,
                    )
                )
            existing_plans.append(
                _ExistingPlan(
                    report_idx, matched.id, amount_val, assign_staff, row_note, assign_phone
                )
            )
            continue

        # Bazada yo'q mijoz
        if not auto_create_missing:
            missing_label = f"{name} ({phone})" if phone else name
            add_error(
                number,
                name,
                staff_label,
                [f"«{missing_label}» bazada topilmadi."],
                client_phone=phone,
                target=str(amount_val if amount_val is not None else _ZERO),
            )
            continue

        if phone and phone in seen_new_phones:
            add_error(
                number,
                name,
                staff_label,
                [f"«{phone}» raqami faylda takrorlangan."],
                client_phone=phone,
                target=str(amount_val if amount_val is not None else _ZERO),
            )
            continue

        dedup_new_key = (
            f"{norm_key(name)}::{phone}"
            if phone
            else f"{norm_key(name)}::{staff.id if staff else ''}"
        )
        if dedup_new_key in seen_new_keys:
            add_error(
                number,
                name,
                staff_label,
                ["Bu yangi mijoz faylda takrorlangan."],
                client_phone=phone,
                target=str(amount_val if amount_val is not None else _ZERO),
            )
            continue

        route_name = cell(values, "route")
        existing_route = route_index.peek(route_name) if route_name else None
        r_b = existing_route.branch if existing_route is not None else None
        if r_b is None and route_name:
            r_b = planned_route_branch.get(norm_key(route_name))

        if r_b is not None and s_b is not None and r_b.pk != s_b.pk:
            add_error(
                number,
                name,
                staff_label,
                [f"«{route_name}» marshruti boshqa filialga tegishli, «{staff.full_name}» bilan mos emas."],
                client_phone=phone,
                target=str(amount_val if amount_val is not None else _ZERO),
            )
            continue

        if phone:
            seen_new_phones.add(phone)
        seen_new_keys.add(dedup_new_key)

        effective_branch = branch or r_b or s_b
        if route_name and effective_branch is not None:
            planned_route_branch.setdefault(norm_key(route_name), effective_branch)

        target_val = amount_val if amount_val is not None else _ZERO
        report.created_clients += 1
        if target_val > _ZERO:
            report.debts_applied += 1
            action = "CREATE_AND_DEBT"
        else:
            report.skipped += 1
            action = "CREATE_CLIENT"

        create_plans.append(
            _CreatePlan(
                name=name,
                owner_name=cell(values, "owner_name"),
                phone=phone,
                address=cell(values, "address"),
                route_name=route_name,
                staff=staff,
                debt_limit=debt_limit_val if debt_limit_val is not None else _ZERO,
                note=row_note,
                effective_branch=effective_branch,
                target_debt=target_val,
            )
        )
        report.rows.append(
            ClientOpeningRowResult(
                row=number,
                client_name=name,
                assigned_to_name=staff_label,
                current_debt="0",
                target_debt=str(target_val),
                delta=str(target_val),
                action=action,
                client_phone=phone,
            )
        )

    if dry_run or report.error_count:
        return report

    try:
        with transaction.atomic():
            if existing_plans:
                lock_ids = sorted({p.client_id for p in existing_plans}, key=str)
                locked_clients = {
                    c.pk: c
                    for c in Client.objects.select_for_update()
                    .filter(pk__in=lock_ids)
                    .order_by("pk")
                }
                for plan in existing_plans:
                    client = locked_clients[plan.client_id]
                    row_res = report.rows[plan.report_idx]
                    if client.is_blocked:
                        row_res.action = "ERROR"
                        row_res.errors.append(
                            "Bloklangan mijozga boshlang'ich qarz kiritib bo'lmaydi."
                        )
                        continue

                    update_fields: list[str] = []
                    if not client.phone and plan.assign_phone:
                        client.phone = plan.assign_phone
                        update_fields.append("phone")
                    if client.assigned_to_id is None and plan.assign_staff is not None:
                        client.assigned_to = plan.assign_staff
                        update_fields.append("assigned_to")
                    s_b = staff_branch(plan.assign_staff)
                    if client.branch_id is None and s_b is not None:
                        client.branch = s_b
                        update_fields.append("branch")
                    if update_fields:
                        client.save(update_fields=[*update_fields, "updated_at"])

                    if plan.target_debt is None:
                        continue

                    was_add = row_res.action == "ADD_DEBT"
                    current = client.current_debt
                    delta = plan.target_debt - current
                    row_res.current_debt = str(current)
                    row_res.delta = str(delta)

                    if delta < _ZERO:
                        if was_add:
                            report.debts_applied -= 1
                        else:
                            report.skipped -= 1
                        row_res.action = "ERROR"
                        row_res.errors.append(
                            f"Joriy qarz ({current}) kiritilgan summadan ({plan.target_debt}) katta — "
                            "kamaytirish qarz to'lovi orqali kiritiladi."
                        )
                        continue

                    if delta == _ZERO:
                        if was_add:
                            report.debts_applied -= 1
                            report.skipped += 1
                        row_res.action = "SKIP"
                        continue

                    if not was_add:
                        report.skipped -= 1
                        report.debts_applied += 1
                    row_res.action = "ADD_DEBT"
                    create_opening_debt(
                        client=client,
                        amount=delta,
                        note=plan.note,
                        user=user,
                    )

                if report.error_count:
                    raise ImportRollback

            for plan in create_plans:
                route_obj = (
                    route_index.get_or_create(
                        plan.route_name,
                        default_branch=plan.effective_branch,
                        user=user,
                    )
                    if plan.route_name
                    else None
                )
                new_client = Client.objects.create(
                    name=plan.name,
                    owner_name=plan.owner_name,
                    phone=plan.phone,
                    address=plan.address,
                    route=route_obj,
                    assigned_to=plan.staff,
                    debt_limit=plan.debt_limit,
                    note=plan.note,
                    branch=plan.effective_branch,
                    created_by=user,
                )
                if plan.target_debt > _ZERO:
                    create_opening_debt(
                        client=new_client,
                        amount=plan.target_debt,
                        note=plan.note,
                        user=user,
                    )

            AuditLog.objects.create(
                user=user,
                action="client.opening_import",
                model_name="Client",
                changes={
                    "created_clients": report.created_clients,
                    "existing_clients": report.existing_clients,
                    "debts_applied": report.debts_applied,
                    "skipped": report.skipped,
                    "note": note,
                },
            )
    except ImportRollback:
        pass

    return report
