"""OCR provayderlari (CLAUDE.md 9.4).

- ClaudeProvider — Anthropic API (Claude vision), qat'iy JSON prompt
- MockProvider   — kalit yo'q bo'lsa / testda (deterministik)
- Tesseract      — 2-fazada qo'shiladi (binar + uz/ru til paketi kerak)
"""
from __future__ import annotations

import base64
import json
import logging
import re
import time
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

from django.conf import settings

from ..constants import OcrProvider

logger = logging.getLogger("apps.ocr")

_SYSTEM_PROMPT = (
    "Sen omborchi yordamchisisan. Naklit (nakladnoy) rasmini o'qib, "
    "faqat JSON qaytarasan — boshqa hech qanday matn yo'q. "
    "Format qat'iy:\n"
    '{"supplier": str, "invoice_number": str, "date": "YYYY-MM-DD"|null, '
    '"items": [{"name": str, "quantity": number, "unit": str, '
    '"price": number, "amount": number}], "total": number, "confidence": 0..1}\n'
    "Raqamlarni faqat sonlar sifatida ber (bo'sh joysiz, valyuta belgisisiz). "
    "O'qib bo'lmaydigan katakcha uchun 0 yoki bo'sh string qo'y."
)


@dataclass
class OcrResult:
    provider: str
    supplier: str = ""
    invoice_number: str = ""
    date: str | None = None
    total: Decimal | None = None
    confidence: Decimal = Decimal("0")
    items: list[dict[str, Any]] = field(default_factory=list)
    raw_text: str = ""
    ai_response: dict[str, Any] = field(default_factory=dict)
    tokens_used: int = 0
    cost_usd: Decimal = Decimal("0")
    processing_time_ms: int = 0
    error: str = ""


def get_provider() -> BaseOcrProvider:
    if settings.ANTHROPIC_API_KEY:
        return ClaudeProvider()
    return MockProvider()


class BaseOcrProvider:
    name = ""

    def extract(self, image_bytes_list: list[bytes]) -> OcrResult:  # pragma: no cover
        raise NotImplementedError


def _parse_json(text: str) -> dict[str, Any]:
    text = text.strip()
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.MULTILINE).strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    return json.loads(match.group(0) if match else text)


def _to_result(data: dict, provider: str) -> OcrResult:
    def _dec(v):
        try:
            return Decimal(str(v))
        except Exception:  # noqa: BLE001
            return None

    return OcrResult(
        provider=provider,
        supplier=str(data.get("supplier") or ""),
        invoice_number=str(data.get("invoice_number") or ""),
        date=data.get("date") or None,
        total=_dec(data.get("total")),
        confidence=_dec(data.get("confidence")) or Decimal("0"),
        items=list(data.get("items") or []),
        ai_response=data,
    )


class ClaudeProvider(BaseOcrProvider):
    name = OcrProvider.CLAUDE

    def extract(self, image_bytes_list: list[bytes]) -> OcrResult:
        import anthropic

        started = time.monotonic()
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

        content: list[dict[str, Any]] = []
        for img in image_bytes_list:
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/jpeg",
                    "data": base64.standard_b64encode(img).decode(),
                },
            })
        content.append({"type": "text", "text": "Naklitni JSON qilib qaytar."})

        try:
            resp = client.messages.create(
                model=settings.OCR_MODEL,
                max_tokens=4096,
                system=_SYSTEM_PROMPT,
                output_config={"effort": "low"},
                messages=[{"role": "user", "content": content}],
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Claude OCR xatosi", exc_info=True)
            return OcrResult(
                provider=self.name, error=str(exc)[:400],
                processing_time_ms=int((time.monotonic() - started) * 1000),
            )

        text = "".join(b.text for b in resp.content if b.type == "text")
        try:
            data = _parse_json(text)
        except Exception:  # noqa: BLE001
            return OcrResult(
                provider=self.name, raw_text=text,
                error="JSON ajratib bo'lmadi",
                processing_time_ms=int((time.monotonic() - started) * 1000),
            )

        result = _to_result(data, self.name)
        result.raw_text = text
        result.tokens_used = resp.usage.input_tokens + resp.usage.output_tokens
        result.cost_usd = (
            Decimal(resp.usage.input_tokens) / 1_000_000
            * Decimal(str(settings.OCR_PRICE_INPUT_PER_MTOK))
            + Decimal(resp.usage.output_tokens) / 1_000_000
            * Decimal(str(settings.OCR_PRICE_OUTPUT_PER_MTOK))
        ).quantize(Decimal("0.00001"))
        result.processing_time_ms = int((time.monotonic() - started) * 1000)
        return result


class MockProvider(BaseOcrProvider):
    """Deterministik natija — kalitsiz dev/test uchun.

    `MOCK_OCR_RESULT` context var orqali natijani boshqarish mumkin (testlar).
    """

    name = OcrProvider.MOCK
    override: dict | None = None

    def extract(self, image_bytes_list: list[bytes]) -> OcrResult:
        data = self.override or {
            "supplier": "Zavod #1",
            "invoice_number": "MOCK-0001",
            "date": "2026-09-06",
            "items": [
                {"name": "Test kukun 3kg", "quantity": 50, "unit": "dona",
                 "price": 20000, "amount": 1000000},
                {"name": "Nomalum tovar XYZ", "quantity": 10, "unit": "dona",
                 "price": 5000, "amount": 50000},
            ],
            "total": 1050000,
            "confidence": 0.9,
        }
        result = _to_result(data, self.name)
        result.raw_text = json.dumps(data, ensure_ascii=False)
        result.tokens_used = 0
        result.cost_usd = Decimal("0")
        result.processing_time_ms = 1
        return result
