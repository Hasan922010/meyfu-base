# MeyFu — Foydalanish qo'llanmasi

Bu qo'llanma har bir rol uchun alohida bo'limlarga bo'lingan. O'zingizga tegishlisini oching:

| Rol | Qo'llanma | Qurilma |
|---|---|---|
| Super admin / Menejer | [`qollanma-admin.md`](./qollanma-admin.md) | Kompyuter (brauzer) |
| Omborchi | [`qollanma-omborchi.md`](./qollanma-omborchi.md) | Kompyuter yoki telefon |
| Tarqatuvchi (agent) | [`qollanma-tarqatuvchi.md`](./qollanma-tarqatuvchi.md) | Telefon (mobil ilova) |
| Buxgalter | [`qollanma-buxgalter.md`](./qollanma-buxgalter.md) | Kompyuter (brauzer) |

---

## Hamma uchun umumiy qoidalar

### 1. Kirish (login)

1. Brauzerda yoki telefonda ilova manzilini oching.
2. **Telefon raqami** va **parol** ni kiriting.
   - Telefonni **probel va tiresiz** yozing: `+998901234567`
3. "Kirish" tugmasini bosing.
4. Keyingi safar telefonda ilova sizni eslab qoladi (PIN so'raydi).

Parolni bilmasangiz yoki unutgan bo'lsangiz — **super admindan** so'rang. Faqat u parol
o'rnatadi/almashtiradi.

### 2. Rollar nima qila oladi

| | Super admin | Menejer | Omborchi | Tarqatuvchi | Buxgalter |
|---|:---:|:---:|:---:|:---:|:---:|
| Sozlama, narx, foiz, xodim | ✅ | — | — | — | — |
| Tovar / katalog | ✅ | ✅ | ko'radi | ko'radi | ko'radi |
| Kirim (nakladnoy) | ✅ | ✅ | ✅ | — | ko'radi |
| Yuklash | ✅ | ✅ | ✅ | tasdiqlaydi | — |
| Sotuv | ✅ | ✅ | — | ✅ | ko'radi |
| Xarajat tasdiqlash | ✅ | ✅ | — | o'ziniki | ko'radi |
| Kun yopish tasdiqlash | ✅ | ✅ | — | topshiradi | ko'radi |
| Kassa, qarz, moliya | ✅ | ko'radi | — | qarz undiradi | ✅ |
| Maosh | ✅ | — | — | o'ziniki | ✅ |
| Hisobotlar | ✅ | ✅ | — | o'ziniki | ✅ |

Menyu barcha adminlarga bir xil ko'rinadi, lekin ruxsatingiz bo'lmagan amalni bajarolmaysiz
(tizim "ruxsat yo'q" deb ogohlantiradi).

### 3. Internet yo'q bo'lsa (offline)

Tarqatuvchi ilovasi **internetsiz ham to'liq ishlaydi**:

- Sotuv, xarajat, qarz to'lovi darhol saqlanadi — "✅ Saqlandi" chiqadi.
- Yuqorida holat ko'rsatiladi:
  - 🟢 **Online** — hammasi yuborildi
  - 🟡 **Yuborilmoqda (N)** — navbatda N ta operatsiya bor
  - 🔴 **Offline · N ta kutmoqda** — internet yo'q, N ta operatsiya saqlangan
- Internet paydo bo'lganda hammasi **avtomatik** serverga yuboriladi.
- Ilovani yopib qayta ochsangiz ham ma'lumot yo'qolmaydi.
- Yuborilmagan operatsiyalarni **"Sinxronizatsiya"** ekranida ko'rasiz va qayta urinishingiz mumkin.

> Katalog (tovar ro'yxati, narxlar) 24 soatdan eski bo'lsa ilova ogohlantiradi —
> internet bor joyda ilovani bir marta oching, u yangilanadi.

### 4. Pul va tovar yozuvlari o'chirilmaydi

Har bir sotuv, xarajat, tovar harakati, pul harakati **doimiy** saqlanadi. Xato bo'lsa
yozuvni o'chirib bo'lmaydi — **tuzatuvchi yozuv** qo'shiladi (kim, qachon, nima sababdan).
Barcha muhim o'zgarishlar audit jurnaliga tushadi.

### 5. Chiqish

Har bir ilovada profil / sozlamalar bo'limida **"Chiqish"** tugmasi bor. Umumiy
kompyuterda ishlaganingizda har safar chiqib qo'ying.
