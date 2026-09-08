import type { Role } from '@/shared/types/api';

/** Yo'riqnoma bloklari — GuidePage shu turlarni chizadi. */
export type GuideBlock =
  | { k: 'p'; text: string }
  | { k: 'steps'; items: string[] }
  | { k: 'list'; items: string[] }
  | { k: 'note'; text: string }
  | { k: 'img'; src: string; caption?: string };

export interface GuideSection {
  title: string;
  blocks: GuideBlock[];
}

export interface RoleGuide {
  /** 'ALL' — hamma uchun umumiy bo'lim. */
  id: Role | 'ALL';
  label: string;
  summary: string;
  sections: GuideSection[];
}

const IMG = (name: string): string => `/help/${name}`;

const common: RoleGuide = {
  id: 'ALL',
  label: 'Hamma uchun',
  summary: 'Kirish, offline ishlash va umumiy qoidalar',
  sections: [
    {
      title: 'Kirish (login)',
      blocks: [
        {
          k: 'steps',
          items: [
            'Ilova manzilini oching (brauzer yoki telefon).',
            "Telefon raqami va parolni kiriting. Telefonni probel va tiresiz yozing: +998901234567",
            '"Tizimga kirish" tugmasini bosing.',
          ],
        },
        {
          k: 'note',
          text: 'Parolni bilmasangiz yoki unutgan bo\'lsangiz — super admindan so\'rang. Faqat u parol o\'rnatadi.',
        },
      ],
    },
    {
      title: 'Internet yo\'q bo\'lsa (offline)',
      blocks: [
        {
          k: 'p',
          text: 'Tarqatuvchi ilovasi internetsiz ham to\'liq ishlaydi. Sotuv, xarajat, qarz to\'lovi darhol saqlanadi — "✅ Saqlandi" chiqadi.',
        },
        {
          k: 'list',
          items: [
            '🟢 Online — hammasi serverga yuborildi',
            '🟡 Yuborilmoqda (N) — N ta operatsiya navbatda',
            '🔴 Offline · N ta kutmoqda — internet yo\'q, N ta saqlangan',
          ],
        },
        {
          k: 'p',
          text: 'Internet paydo bo\'lganda hammasi avtomatik yuboriladi. Ilovani yopib qayta ochsangiz ham ma\'lumot yo\'qolmaydi.',
        },
        {
          k: 'note',
          text: 'Har kuni internet bor joyda ilovani bir marta oching — katalog va narxlar yangilanadi.',
        },
      ],
    },
    {
      title: 'Pul va tovar yozuvlari o\'chirilmaydi',
      blocks: [
        {
          k: 'p',
          text: 'Har bir sotuv, xarajat, tovar harakati, pul harakati doimiy saqlanadi. Xato bo\'lsa yozuv o\'chirilmaydi — tuzatuvchi yozuv qo\'shiladi (kim, qachon, nima sababdan). Barcha muhim o\'zgarishlar audit jurnaliga tushadi.',
        },
      ],
    },
  ],
};

const distributor: RoleGuide = {
  id: 'DISTRIBUTOR',
  label: 'Tarqatuvchi',
  summary: 'Sotuv, xarajat, hamyon, kun yopish',
  sections: [
    {
      title: 'Bosh sahifa',
      blocks: [
        {
          k: 'p',
          text: 'Yuqorida — qo\'lingizdagi pul (jonli hisoblanadi) va bugungi ko\'rsatkichlar. Ikki katta tugma: "+ Yangi sotuv" va "Kunni yopish". Pastda barcha bo\'limlarga tez o\'tish.',
        },
        { k: 'img', src: IMG('dist-01-home.png'), caption: 'Tarqatuvchi bosh sahifasi' },
      ],
    },
    {
      title: 'Ertalab — yuklamani tasdiqlash',
      blocks: [
        {
          k: 'steps',
          items: [
            '"Yuklama" ni oching — omborchi tayyorlagan tovar ro\'yxati.',
            'Miqdorlarni haqiqiy olgan tovar bilan solishtiring.',
            'To\'g\'ri bo\'lsa — "Tasdiqlash". Tovar "mashina qoldig\'ingizga" o\'tadi.',
          ],
        },
        { k: 'note', text: 'Farq bo\'lsa, tasdiqlashdan oldin omborchiga ayting.' },
      ],
    },
    {
      title: 'Sotuv (30 soniya)',
      blocks: [
        { k: 'p', text: '"+ Yangi sotuv" → 4 qadam:' },
        {
          k: 'steps',
          items: [
            'Mijoz — marshrutdagi ro\'yxatdan tanlash.',
            'Tovar — qidirib tanlash → miqdor (katta +/− yoki tez tugmalar) → narx (standart narx avtomatik).',
            'To\'lov — Naqd / Plastik / Qarzga. Aralash bo\'lsa: qancha naqd, qolgani qarzga, muddat.',
            'Saqlash — "✅ Saqlandi" darhol chiqadi, chekni PDF qilib mijozga yuborish mumkin.',
          ],
        },
        { k: 'img', src: IMG('dist-02-sale-client.png'), caption: '1-qadam: mijozni tanlash' },
        { k: 'img', src: IMG('dist-03-sale-item.png'), caption: '2-qadam: tovar, miqdor, narx' },
        {
          k: 'list',
          items: [
            'Mashinada yo\'q tovarni sotib bo\'lmaydi ("Mashinada faqat 8 dona bor").',
            'Minimal narxdan past sotib bo\'lmaydi (ruxsat bo\'lsa — sotiladi, adminga belgi boradi).',
            'Bloklangan mijozga faqat naqd.',
          ],
        },
      ],
    },
    {
      title: 'Xarajat',
      blocks: [
        {
          k: 'steps',
          items: [
            '"Xarajat" → "Yangi xarajat".',
            'Kategoriya (ikonka) → summa (katta klaviatura, tez tugmalar).',
            '📷 "Chek rasmidan summani olish" — AI summani o\'zi to\'ldiradi.',
            'Yoqilg\'i uchun: litr, narx, odometr. Saqlash → qo\'lingizdagi pul kamayadi.',
          ],
        },
        { k: 'img', src: IMG('dist-06-expense.png'), caption: 'Yangi xarajat' },
        {
          k: 'note',
          text: 'Limitdan oshgan xarajat "kutilmoqda" holatida — admin tasdiqlaydi. Rad etilsa sababi ko\'rsatiladi.',
        },
      ],
    },
    {
      title: 'Hamyon',
      blocks: [
        {
          k: 'p',
          text: 'Jonli balans = naqd sotuv + undirilgan qarz − xarajat − topshirilgan. Barcha tranzaksiyalar ro\'yxati ko\'rinadi.',
        },
        { k: 'img', src: IMG('dist-05-wallet.png'), caption: 'Hamyon va tranzaksiyalar' },
        {
          k: 'p',
          text: 'Pulni buxgalterga topshirganda — bu kun yopish paytida amalga oshiriladi (summa, foto, izoh).',
        },
      ],
    },
    {
      title: 'Qarz undirish',
      blocks: [
        {
          k: 'steps',
          items: [
            '"Qarz undirish" — mijoz qarzlari (muddati o\'tganlar qizil).',
            'Mijozni tanlab → to\'lov summasi → to\'lov turi → saqlash.',
            'Undirilgan pul hamyonga (+) qo\'shiladi.',
          ],
        },
      ],
    },
    {
      title: 'Mijozlar va tashriflar',
      blocks: [
        {
          k: 'list',
          items: [
            'Mijozga kelganda GPS check-in qiling — joylashuv faqat ish vaqtida va tashrif/sotuv paytida yoziladi, kun bo\'yi kuzatilmaydi.',
            'Sotuvsiz ketsangiz ham natijani belgilang: SOTUV / SOTUVSIZ / YOPIQ.',
          ],
        },
      ],
    },
    {
      title: 'Kechqurun — kunni yopish',
      blocks: [
        { k: 'p', text: '"Kunni yopish" → 3 qadam:' },
        {
          k: 'steps',
          items: [
            'Tovar — omborga qaytariladigan miqdorni kiriting (yaxshi / brak / muddat alohida). Tovar farqi darhol ko\'rinadi.',
            'Pul — topshiriladigan naqd summasini kiriting. Kassa farqi darhol ko\'rinadi.',
            'Tasdiq — "Kunni yopish". Shundan keyin o\'sha kunni o\'zgartirib bo\'lmaydi.',
          ],
        },
        { k: 'img', src: IMG('dist-04-dayclose.png'), caption: 'Kun yopish — 1-qadam (Tovar)' },
        {
          k: 'note',
          text: 'Kassa yoki tovar farqi bo\'lsa qo\'rqmang — izoh yozing. Bu jarima emas, tushuntirish. Admin ko\'rib chiqadi.',
        },
      ],
    },
    {
      title: 'Mening hisobotim va maoshim',
      blocks: [
        {
          k: 'list',
          items: [
            '"Mening hisobotim" — kun/hafta/oy: savdo, foyda, xarajat, foiz, taxminiy maosh, reja progressi.',
            '"Mening maoshim" — sotuvdan foiz (zakaz + yetkazish alohida), bonus, ushlanmalar, yakuniy summa.',
          ],
        },
      ],
    },
  ],
};

const warehouse: RoleGuide = {
  id: 'WAREHOUSE',
  label: 'Omborchi',
  summary: 'Tovar qabuli, yuklash, qaytarish',
  sections: [
    {
      title: 'Telefonda — tez ish',
      blocks: [
        {
          k: 'list',
          items: [
            'Tovar qabuli — yetkazib beruvchi, nakladnoy №, sana → tovarlar → "Qabulni saqlash".',
            'Naklit skani — nakladnoyni kamera bilan suratga oling, AI o\'qiydi, admin panelda tekshiriladi.',
            'Ombor qoldig\'i — har tovarning joriy qoldig\'i.',
          ],
        },
        {
          k: 'note',
          text: 'Sifatli surat = kam tuzatish. Yorug\' joyda, tekis qo\'yib, to\'liq ramka ichiga.',
        },
      ],
    },
    {
      title: 'Kompyuterda — Ombor bo\'limi',
      blocks: [
        { k: 'p', text: 'Uch bo\'lim: Qoldiq · Tovar qabullari (Kirim) · Yuklamalar.' },
        { k: 'img', src: IMG('admin-06-warehouse.jpg'), caption: 'Ombor — qoldiq' },
        {
          k: 'p',
          text: 'Kirim: "Yangi kirim" → yetkazib beruvchi, nakladnoy №, sana → tovarlar → saqlash. Tovar omborga tushadi, harakat jurnaliga yoziladi (o\'chirilmaydi). PDF / Pechat bilan chop etish mumkin.',
        },
      ],
    },
    {
      title: 'Yuklama tayyorlash',
      blocks: [
        {
          k: 'steps',
          items: [
            '"Yangi yuklama" → tarqatuvchi, ombor, sana.',
            'Tovar va miqdorlarni kiriting (yoki admin "Buyurtmalar → Yuklamaga yig\'ish" dan tayyorlaydi).',
            '"Yuborish" → tarqatuvchi telefonida ko\'radi.',
            'Tarqatuvchi tasdiqlagandan keyin tovar uning "mashina qoldig\'iga" o\'tadi.',
          ],
        },
        {
          k: 'note',
          text: 'Yuborishdan oldin miqdorlarni ikki marta tekshiring — tasdiqlangandan keyin o\'zgartirish qiyin.',
        },
      ],
    },
    {
      title: 'Kechqurun — qaytarish qabuli',
      blocks: [
        {
          k: 'steps',
          items: [
            'Tarqatuvchi telefonida qaytarish ro\'yxatini tuzadi (yaxshi / brak / muddat alohida).',
            'Siz omborda tovarni sanab, qabul qilasiz.',
            'Yaxshi tovar omborga qaytadi, brak alohida hisoblanadi. Tovar farqi avtomatik chiqadi.',
          ],
        },
      ],
    },
  ],
};

const admin: RoleGuide = {
  id: 'SUPER_ADMIN',
  label: 'Super admin / Menejer',
  summary: 'Admin panelning barcha bo\'limlari',
  sections: [
    {
      title: 'Birinchi sozlash tartibi',
      blocks: [
        {
          k: 'steps',
          items: [
            'Sozlamalar → Kompaniya rekvizitlari (nom, STIR, manzil, bank, logo, muhr).',
            'Ma\'lumotnomalar — omborlar, yetkazib beruvchilar, birliklar, kategoriyalar, xarajat kategoriyalari.',
            'Mahsulotlar — har bir tovar: nom, kategoriya, narxlar, rasm.',
            'Xodimlar — tarqatuvchi, omborchi, menejer, buxgalter.',
            'Marshrutlar — har tarqatuvchiga marshrut, unga mijozlar.',
            'Ombor → Kirim — boshlang\'ich tovar qoldig\'i.',
          ],
        },
        {
          k: 'note',
          text: 'Menejer quyidagilarga ruxsatsiz: narx/foizni o\'zgartirish, xodim yaratish, sozlamalar, maosh tasdiqlash.',
        },
      ],
    },
    {
      title: 'Boshqaruv paneli',
      blocks: [
        {
          k: 'p',
          text: 'Jonli ko\'rsatkichlar: bugungi savdo, foyda, naqd, xarajat, tashriflar, jonli lenta, xaritada tarqatuvchilar. Diqqat belgilar (qizil/sariq): narxdan past sotuv, limitdan oshgan xarajat, katta kassa farqi, kam qolgan tovar.',
        },
        { k: 'img', src: IMG('admin-01-dashboard.jpg'), caption: 'Boshqaruv paneli' },
      ],
    },
    {
      title: 'Mahsulotlar',
      blocks: [
        {
          k: 'list',
          items: [
            'Narxlar: tannarx, optom, chakana, minimal narx (bundan past sotib bo\'lmaydi).',
            'Rasm galereyasi: bir nechta rasm, birinchisi asosiy. Tarqatuvchi tovarni rasmi bilan ko\'radi.',
            'Narx o\'zgarishi tarixga va audit jurnaliga yoziladi. Faqat SUPER_ADMIN o\'zgartiradi.',
          ],
        },
        { k: 'img', src: IMG('admin-07-products.jpg'), caption: 'Mahsulotlar ro\'yxati' },
      ],
    },
    {
      title: 'Ombor',
      blocks: [
        {
          k: 'p',
          text: 'Qoldiq · Kirim · Yuklamalar. Kirim: yetkazib beruvchi + nakladnoy № + tovarlar → omborga tushadi. Yuklama: tarqatuvchiga tovar → u telefonda tasdiqlaydi.',
        },
        { k: 'img', src: IMG('admin-06-warehouse.jpg'), caption: 'Ombor — qoldiq' },
      ],
    },
    {
      title: 'Naklit skani (OCR)',
      blocks: [
        {
          k: 'p',
          text: 'Omborchi yuklagan naklit rasmlari shu yerga tushadi. Tekshirish ekranida: chapda rasm, o\'ngda tahrirlanadigan jadval (past ishonchli kataklar sariq). Har qatorni katalogdagi tovarga moslang → tasdiq → avtomatik Kirim.',
        },
        {
          k: 'note',
          text: 'Aniqlik 85% dan past bo\'lsa — qo\'lda kiritish tezroq. "Ombor → Kirim" dan foydalaning.',
        },
      ],
    },
    {
      title: 'Sotuvlar va Buyurtmalar',
      blocks: [
        {
          k: 'p',
          text: 'Sotuvlar: filtr (sana, tarqatuvchi, mijoz, to\'lov), tafsilot, bekor qilish (sabab bilan), Excel eksport. Narxdan past yoki qarz limitidan oshgan sotuvlar belgilangan.',
        },
        { k: 'img', src: IMG('admin-02-sales.jpg'), caption: 'Sotuvlar jadvali' },
        {
          k: 'p',
          text: 'Buyurtmalar: tarqatuvchi yiqqan zakazlarni tasdiqlash yoki bekor qilish. "Yuklamaga yig\'ish" — tasdiqlangan buyurtmalarni bitta yuklamaga birlashtirish.',
        },
      ],
    },
    {
      title: 'Xarajatlar',
      blocks: [
        {
          k: 'list',
          items: [
            'Har biri: summa, kategoriya, chek rasmi, joylashuv.',
            'Tasdiqlash / Rad etish. Rad etsangiz sababini yozing — tarqatuvchi ko\'radi.',
            'Limitdan oshganlar "kutilmoqda" holatida, ajratib ko\'rsatiladi.',
          ],
        },
      ],
    },
    {
      title: 'Kunlik hisob-kitob',
      blocks: [
        {
          k: 'p',
          text: 'Tarqatuvchi kunni yopganda shu yerga tushadi. Jadval: har kun bo\'yicha kassa farqi va tovar farqi. "Faqat farqli kunlar" filtri. Qatorni oching → tafsilot → "Tasdiqlash". Keyin faqat SUPER_ADMIN, sabab bilan tahrirlaydi.',
        },
        {
          k: 'p',
          text: 'kutilgan naqd = naqd sotuv + undirilgan qarz − tasdiqlangan naqd xarajatlar. kassa farqi = topshirilgan − kutilgan (manfiy = kamomad).',
        },
      ],
    },
    {
      title: 'Qarzdorlik va Moliya',
      blocks: [
        {
          k: 'p',
          text: 'Qarzdorlik: yoshi bo\'yicha tahlil (0–7, 8–14, 15–30, 30+ kun), muddati o\'tganlar alohida, to\'lov qabul qilish, eslatma. Moliya: kassa balansi, tushum, yalpi foyda, kassa harakatlari (append-only), kompaniya xarajatlari.',
        },
        { k: 'img', src: IMG('admin-08-debts.jpg'), caption: 'Qarzdorlik — aging' },
      ],
    },
    {
      title: 'Xodimlar',
      blocks: [
        {
          k: 'list',
          items: [
            'Qo\'shish: telefon (login), F.I.SH., rol, parol, passport, ishga kirgan sana.',
            'Tarqatuvchi profili: "Zakaz olgani uchun %" va "Yetkazib bergani uchun %" — ikki bosqichli komissiya. "Komissiya %" (eski) — yuqoridagi ikkitasi 0 bo\'lsagina ishlatiladi.',
            'Asosiy maosh, oylik reja, qarz limiti, kunlik xarajat limiti, "minimal narxdan past sotishga ruxsat".',
            'Bloklash / Faollashtirish, parol o\'rnatish — faqat SUPER_ADMIN.',
          ],
        },
        { k: 'img', src: IMG('admin-03-staff-commission.png'), caption: 'Xodim formasi — komissiya foizlari' },
      ],
    },
    {
      title: 'Tarqatuvchilar 360°',
      blocks: [
        {
          k: 'p',
          text: 'Har tarqatuvchi uchun to\'liq ko\'rinish. Davr tanlagich (Bugun / Hafta / Oy / ...). KPI kartalar oldingi davr bilan ▲▼. Tablar: Umumiy, Pul harakati (farqli kunlar qizil), Sotuvlar, Xarajatlar, Mijozlar, Mahsulotlar, Qarzdorlik, Kunlik jurnal, Maosh. Eksport: Excel / PDF.',
        },
        { k: 'img', src: IMG('admin-05-card360.jpg'), caption: '360° xodim kartasi' },
      ],
    },
    {
      title: 'Maosh',
      blocks: [
        {
          k: 'steps',
          items: [
            'Davr tanlang → "Hisoblash".',
            'Har tarqatuvchi: sotuvdan foiz (zakaz + yetkazish alohida), bonus, ushlanmalar (kamomad, kassa farqi, avans), xarajat qaytarimi, yakuniy summa.',
            'Tekshiring → "Tasdiqlash" → to\'lovdan keyin "To\'landi".',
          ],
        },
        { k: 'img', src: IMG('admin-04-payroll.jpg'), caption: 'Maosh hisoblash' },
        {
          k: 'note',
          text: '"Komissiya qoidalari" tabi — eski bir bosqichli tizim uchun; zakaz/yetkazish bo\'linishiga ta\'sir qilmaydi. Maoshni tasdiqlash — SUPER_ADMIN yoki BUXGALTER.',
        },
      ],
    },
    {
      title: 'Hisobotlar va Tizim salomatligi',
      blocks: [
        {
          k: 'list',
          items: [
            'Hisobotlar: Konstruktor (o\'lchov + filtr), ABC tahlil (Pareto), Foyda-zarar. Excel / PDF eksport.',
            'Tizim salomatligi: xizmatlar holati, butunlik tekshiruvi (balans = jurnal), backup holati, sinxronizatsiya ziddiyatlari.',
          ],
        },
      ],
    },
    {
      title: 'Telegram bot',
      blocks: [
        {
          k: 'p',
          text: 'Sozlamalar → Telegram orqali ulang. Har kuni 20:00 da kunlik xulosa keladi. Darhol ogohlantirish: narxdan past sotuv, limitdan oshgan xarajat, katta kassa farqi, kam qolgan tovar.',
        },
      ],
    },
  ],
};

const accountant: RoleGuide = {
  id: 'ACCOUNTANT',
  label: 'Buxgalter',
  summary: 'Kassa, qarzdorlik, maosh, eksport',
  sections: [
    {
      title: 'Moliya',
      blocks: [
        {
          k: 'list',
          items: [
            'Umumiy: kassa balansi, tushum, yalpi foyda, tarqatuvchi va kompaniya xarajatlari.',
            'Kassa: barcha pul kirim/chiqim harakatlari — o\'zgarmas jurnal (append-only).',
            'Kompaniya xarajatlari: ijara, ish haqi fondi va h.k. qo\'shish.',
          ],
        },
      ],
    },
    {
      title: 'Qarzdorlik',
      blocks: [
        {
          k: 'p',
          text: 'Yoshi bo\'yicha tahlil (aging): 0–7, 8–14, 15–30, 30+ kun. Muddati o\'tganlar alohida. Mijoz bo\'yicha to\'lov qabul qilish, eslatma. To\'lov kiritilganda qarz holati yangilanadi (ACTIVE → PARTIAL → PAID).',
        },
        { k: 'img', src: IMG('admin-08-debts.jpg'), caption: 'Qarzdorlik — aging' },
      ],
    },
    {
      title: 'Xarajatlar',
      blocks: [
        {
          k: 'p',
          text: 'Tarqatuvchilarning yo\'l xarajatlarini ko\'rish: summa, kategoriya, chek rasmi, holat. Tasdiqlangan naqd xarajatlar tarqatuvchining "kutilgan naqd" hisobiga ta\'sir qiladi.',
        },
      ],
    },
    {
      title: 'Maosh',
      blocks: [
        {
          k: 'steps',
          items: [
            'Davr tanlang → "Hisoblash".',
            'Har tarqatuvchi: sotuvdan foiz (zakaz + yetkazish alohida), bonus, ushlanmalar (kamomad, kassa farqi, avans), xarajat qaytarimi, yakuniy summa.',
            'Tekshiring → "Tasdiqlash" → to\'lovdan keyin "To\'landi".',
          ],
        },
        { k: 'img', src: IMG('admin-04-payroll.jpg'), caption: 'Maosh hisoblash' },
        {
          k: 'note',
          text: 'Tasdiqlashdan oldin kamomad va kassa farqi kunlarini 360° kartadan tekshiring. Avanslar keyingi maoshdan avtomatik ushlanadi.',
        },
      ],
    },
    {
      title: 'Hisobotlar va eksport',
      blocks: [
        {
          k: 'p',
          text: 'Konstruktor (o\'lchov + filtr), ABC tahlil (80/20), Foyda-zarar (P&L). Har bir hisobot va 360° xodim kartasini Excel / PDF ga yuklab olish mumkin.',
        },
        { k: 'img', src: IMG('admin-05-card360.jpg'), caption: '360° xodim kartasi — oyni yakunlashda qulay' },
      ],
    },
  ],
};

/** Hamma uchun umumiy bo'lim — hech qachon undefined bo'lmaydi. */
export const COMMON_GUIDE: RoleGuide = common;

export const GUIDES: RoleGuide[] = [common, distributor, warehouse, admin, accountant];

/** Rol uchun mos yo'riqnoma id'si (admin rollari birlashtirilgan). */
export function guideIdForRole(role: Role): RoleGuide['id'] {
  if (role === 'MANAGER') return 'SUPER_ADMIN';
  return role;
}
