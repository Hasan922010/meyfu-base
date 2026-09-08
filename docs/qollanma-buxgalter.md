# Qo'llanma — Buxgalter

**Kim uchun:** ACCOUNTANT · **Qurilma:** kompyuter (brauzer) · **Manzil:** `/admin`

> Umumiy qoidalar (kirish, offline): [`qollanma.md`](./qollanma.md)

Buxgalterning ish maydoni: **kassa**, **qarzdorlik**, **xarajatlar**, **maosh** va
**eksport**. Narx, foiz, xodim, sozlamalarga aralashmaydi.

---

## 1. Moliya

`/admin/finance` — uch bo'lim:

### Umumiy
Kassa balansi, davr tushumi, yalpi foyda, tarqatuvchi xarajatlari, kompaniya xarajatlari
bir ekranda.

### Kassa
Barcha pul kirim/chiqim harakatlari — **o'zgarmas jurnal** (append-only). Xato yozuvni
o'chirib bo'lmaydi; kerak bo'lsa tuzatuvchi harakat qo'shiladi (sabab bilan).

Tarqatuvchi kunni yopib naqd pulni topshirganda, u kassaga kirim sifatida tushadi.
Topshirilgan summa "kutilgan naqd" bilan solishtiriladi — farq (kamomad) belgilanadi.

### Kompaniya xarajatlari
Ijara, ish haqi fondi, kommunal va boshqa umumiy xarajatlarni qo'shish.

## 2. Qarzdorlik

`/admin/debts`:
- **Aging** (yoshi bo'yicha): 0–7, 8–14, 15–30, 30+ kun.
- Muddati o'tgan qarzlar alohida ajratilgan.
- Mijoz bo'yicha to'lov qabul qilish, eslatma yuborish.
- To'lov kiritilganda qarz qoldig'i kamayadi, holati yangilanadi
  (ACTIVE → PARTIAL → PAID).

## 3. Xarajatlar

`/admin/expenses` — tarqatuvchilarning yo'l xarajatlarini ko'rish:
- Har biri: summa, kategoriya, chek rasmi, joylashuv, holat.
- Tasdiqlangan / rad etilgan / kutilayotgan bo'yicha filtr.
- Kategoriya bo'yicha diagramma.
- Tasdiqlangan naqd xarajatlar tarqatuvchining "kutilgan naqd" hisobiga ta'sir qiladi.

> Xarajatni tasdiqlash/rad etish odatda admin yoki menejer zimmasida, lekin buxgalter
> yakuniy raqamlarni shu yerdan tekshiradi.

## 4. Maosh

`/admin/payroll`:
1. **Davr tanlang → «Hisoblash»** — har tarqatuvchi uchun avtomatik hisoblanadi:
   - sotuvdan foiz (zakaz olgani + yetkazgani uchun alohida),
   - bonus,
   - ushlanmalar: kamomad, kassa farqi, avans,
   - xarajat qaytarimi,
   - **yakuniy summa**.
2. Har birini oching, tekshiring, kerak bo'lsa qo'lda tuzating.
3. **«Tasdiqlash»** → holati "tasdiqlangan" bo'ladi.
4. To'lovni amalga oshirgach **«To'landi»** deb belgilang.

**Avanslar** bo'limi — tarqatuvchiga oy o'rtasida berilgan avans keyingi maoshdan
avtomatik ushlanadi.

## 5. Hisobotlar va eksport

`/admin/reports`:
- **Konstruktor** — o'lchov (kun / tarqatuvchi / mahsulot / mijoz) + filtr → jadval.
- **ABC tahlil** — Pareto (80/20).
- **Foyda-zarar** — davr bo'yicha P&L.

Har bir hisobot va 360° xodim kartasini **Excel / PDF** ga yuklab olish mumkin.

## 6. Tarqatuvchi 360° kartasi

`/admin/distributors/{id}` — bir tarqatuvchining butun moliyaviy manzarasi bir joyda:
pul harakati (kunlik), qarzdorlik, xarajatlar, maosh tarixi, kamomad kunlari.
Buxgalter uchun oyni yakunlashda qulay.

---

## Nimaga e'tibor berish

- **Kassa va pul jurnallari hech qachon o'chirilmaydi.** Har tuzatish — yangi yozuv,
  sabab bilan, audit jurnalida.
- Maoshni tasdiqlashdan oldin kamomad va kassa farqi kunlarini 360° kartadan tekshiring.
- Barcha summalar **UTC** da saqlanadi, ekranda **Asia/Tashkent** vaqtida ko'rsatiladi.
