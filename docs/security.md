# Xavfsizlik auditi (CLAUDE.md 16)

Holat: 16-bosqich, 2026-09-07. `python manage.py check --deploy` — **0 muammo**
(prod sozlamalari bilan).

## Autentifikatsiya va sessiya
| Nazorat | Holat |
|---|---|
| Parol login: telefon + parol, keyingi kirishlar PIN | ✅ |
| JWT access muddati | 15 daqiqa (`JWT_ACCESS_TOKEN_LIFETIME_MIN`) |
| JWT refresh | 7 kun, **rotatsiya yoqilgan** (`ROTATE_REFRESH_TOKENS=True`) |
| Parol validatorlari (uzunlik, umumiy, raqamli) | ✅ Django standart |
| Superuser/rol tekshiruvi har endpointda | ✅ `RolePermission` |
| Tarqatuvchi boshqa xodim ma'lumotini ko'ra olmaydi | ✅ test bilan qoplangan |

> Kelajak: `BLACKLIST_AFTER_ROTATION` + `token_blacklist` app — chiqishda tokenni
> darhol bekor qilish uchun (hozir refresh muddati tugaguncha amal qiladi).

## Rate limiting (throttling)
`DEFAULT_THROTTLE_CLASSES` = Anon + User + Scoped. Stavkalar:

| Scope | Rate | Qamrov |
|---|---|---|
| `anon` | 30/min | autentifikatsiyasiz so'rovlar |
| `user` | 1000/min | har foydalanuvchi (barcha API) |
| `login` | 10/min | `/auth/login/` — brute-force himoyasi |
| `ocr` | 20/min | naklit/chek skani (`create`, `reprocess`) — API xarajati |

## Transport va sarlavhalar (`config/settings/prod.py`)
- `SECURE_SSL_REDIRECT`, `SECURE_PROXY_SSL_HEADER` (nginx orqasida)
- HSTS 1 yil + `includeSubDomains` + `preload`
- `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`
- `SECURE_CONTENT_TYPE_NOSNIFF`, `X_FRAME_OPTIONS = DENY`
- CORS/CSRF — faqat `CORS_ALLOWED_ORIGINS` / `CSRF_TRUSTED_ORIGINS` dagi domenlar
- Prod'da Browsable API renderer o'chirilgan (faqat JSON)

## Ma'lumot butunligi
- Pul/tovar jurnallari append-only: `WalletTransaction`, `StockMovement`,
  `CashTransaction`, `AuditLog` — `save()`/`delete()` override bilan himoyalangan,
  Django admin'da `has_delete_permission=False`
- Tungi `check_integrity` — denormalized balans == jurnal yig'indisi
- Audit jurnali: narx o'zgarishi, kun yopilgandan keyingi tahrir, xarajat
  tasdiqlash/rad, maosh tasdiqlash, butunlik tuzatish — kim/qachon/eski→yangi/IP/qurilma

## Fayllar (media)
- Naklit va chek rasmlari — `MEDIA_ROOT` yoki S3/MinIO (`USE_S3`)
- Nginx `internal` location + `X-Accel-Redirect` yoki S3 imzoli URL orqali
  rolli kirish (deploy vaqtida sozlanadi)
- Frontendda yuklashdan oldin siqish (max 1600px) — server yukini kamaytiradi

## Sirlar (secrets)
- `.env` `.gitignore` da (tekshirilgan)
- `SECRET_KEY`, `TELEGRAM_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`, DB parol — faqat env
- `seed_demo` / standart admin parollari — **faqat dev**; prod'da `ensure_superuser`
  kuchli parol talab qiladi

## Ochiq (kelajak uchun) elementlar
- [ ] Token blacklist (chiqishda darhol bekor qilish)
- [ ] 2FA adminlar uchun
- [ ] Media'ga imzoli URL avtomatlashtirish (hozir deploy qo'lda)
- [ ] Bog'liqliklar skani (pip-audit / Dependabot) CI ga
