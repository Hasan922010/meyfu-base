# Buyurtma Oluvchi Profilida Qadoq Birligi Bo'yicha Sotish va Hisoblash Spetsifikatsiyasi

## 1. Talab Tafsilotlari (User Prompt Specification)
- **Rol va Sahifa:** Buyurtma oluvchi (Order Taker) — Yangi buyurtma yaratish ekrani (`NewOrderPage.tsx`).
- **Asosiy Maqsad:** Mijozga tovarlar ro'yxatini shakllantirganda tovarni ham donada (asosiy o'lchov birligida), ham qadoqda (qop, xalta, pachka, karopka, blok va h.k.) sotish imkoniyatini taqdim etish.
- **Hisoblash Mantiqi:**
  - Agar tovar qadog'i bilan olinsa (`unit_mode === 'package'`):
    - Foydalanuvchi kiritadigan miqdor: Qadoq soni (`package_count`, masalan: 10).
    - Asosiy o'lchov birligidagi jami miqdor: `jami_dona = package_count * pack_quantity` (masalan: `10 * 12 = 120 dona`).
    - Jami hisoblangan pul summasi: `jami_summa = jami_dona * narx` (masalan: `10 * 12 * 25 000 = 3 000 000 so'm`).
  - Agar tovar donada olinsa (`unit_mode === 'base'`):
    - Foydalanuvchi kiritadigan miqdor: Dona soni (`quantity`).
    - Jami hisoblangan pul summasi: `jami_summa = quantity * narx`.

## 2. Foydalanuvchi Interfeysi (UI / UX)
1. **Tovar Tanlanganda:**
   - Agar tovarning `pack_quantity > 1` yoki `package_type` to'ldirilgan bo'lsa:
   - Tanlov tugmalari chiqadi:
     - `[ Dona ({unit}) ]`
     - `[ Qadoq ({package_type} — {pack_quantity} {unit}) ]`
2. **Qadoq Rejimi Tanlanganda:**
   - Sanoq va tezkor tugmalar (1, 3, 5, 10, 12, 20) qadoq sonini o'zgartiradi.
   - Jonli hisob-kitob paneli ko'rsatiladi:
     `{package_count} {package_type} × {pack_quantity} {unit} = {total_base_qty} {unit}`
     `{total_base_qty} {unit} × {narx} so'm = {total_price} so'm`
3. **Savat (Cart) Qatorlari:**
   - Qadoq bo'yicha kiritilgan tovarlar uchun:
     `{product_name} · {package_count} {package_type} ({total_base_qty} {unit}) × {narx} = {total_price}`
   - Oddiy kiritilgan tovarlar uchun:
     `{product_name} · {quantity} {unit} × {narx} = {total_price}`

## 3. Ma'lumotlar Tuzilmasi va Sinxronizatsiya
- `CachedProduct` (`db.ts`): `pack_quantity`, `package_type` maydonlari qo'shiladi.
- `pullReferenceData` (`sync.ts`): Serverdan olingan mahsulotlarning `pack_quantity` va `package_type` qiymatlarini keshlaydi.
- `LocalOrderLine` (`actions.ts`): `quantity` ga doimo bazaviy miqdor (`total_base_qty`) yoziladi, `package_count`, `package_type`, `unit_mode` ixtiyoriy saqlanadi.
- Bu orqali backend, ombor, yuklama va yetkazish jarayonlari bazaviy birlikda uzluksiz va to'g'ri ishlaydi.

