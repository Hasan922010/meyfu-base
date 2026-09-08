"""Rasmni OCR uchun tayyorlash (CLAUDE.md 9.3).

opencv mavjud bo'lmasa — rasm o'zgartirilmaydi (graceful degrade).
"""
from __future__ import annotations

import logging

logger = logging.getLogger("apps.ocr")

try:
    import cv2
    import numpy as np

    _CV2 = True
except Exception:  # noqa: BLE001
    _CV2 = False


def preprocess_image(image_bytes: bytes) -> bytes:
    """grayscale → deskew → kontrast → denoise. Xato bo'lsa — asl rasm."""
    if not _CV2:
        return image_bytes
    try:
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return image_bytes

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        gray = _deskew(gray)
        # kontrast (CLAHE) + denoise
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        gray = clahe.apply(gray)
        gray = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)

        ok, buf = cv2.imencode(".jpg", gray, [cv2.IMWRITE_JPEG_QUALITY, 85])
        return buf.tobytes() if ok else image_bytes
    except Exception:  # noqa: BLE001
        logger.warning("Rasmni tayyorlashda xato", exc_info=True)
        return image_bytes


def _deskew(gray) -> object:
    coords = cv2.findNonZero(cv2.bitwise_not(
        cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
    ))
    if coords is None:
        return gray
    angle = cv2.minAreaRect(coords)[-1]
    angle = -(90 + angle) if angle < -45 else -angle
    if abs(angle) < 0.5:
        return gray
    h, w = gray.shape
    m = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
    return cv2.warpAffine(gray, m, (w, h),
                          flags=cv2.INTER_CUBIC,
                          borderMode=cv2.BORDER_REPLICATE)
