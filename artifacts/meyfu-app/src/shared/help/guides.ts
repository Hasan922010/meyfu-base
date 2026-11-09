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
  summary: 'Kirish, offline ishlash, qadoq birliklari va bonus qoidalari',
  sections: [
    {
      title: 'Kirish (Login) va PIN-kod',
      blocks: [
        {
          k: 'steps',
          items: [
            'Ilova manzilini oching (kompyuter brauzeri yoki mobil telefon).',
            'Telefon raqamingizni xalqaro formatda kiriting: +998901234567 (probel va tiresiz).',
            'Parolingizni kiritib, "Tizimga kirish" tugmasini bosing.',
            'Mobil ilovada birinchi kirishda 4 xonali tezkor PIN-kod o\'rnating — keyingi safar tez ochiladi.',
          ],
        },
        {
          k: 'note',
          text: 'Parolni unutgan bo\'lsangiz, faqat Super Admin uni xodimlar bo\'limida o\'zgartirib bera oladi.',
        },
      ],
    },
    {
      title: 'Internet yo\'q bo\'lsa (Offline-First)',
      blocks: [
        {
          k: 'p',
          text: 'Tarqatuvchi va Zakazchi ilovalari internetsiz (podval, bozor, yo\'lda) ham 100% to\'liq ishlaydi. Har bir sotuv, buyurtma, xarajat yoki to\'lov telefon xotirasida xavfsiz saqlanadi.',
        },
        {
          k: 'list',
          items: [
            '🟢 Online — barcha operatsiyalar serverga to\'liq yetib borgan',
            '🟡 Yuborilmoqda (N ta) — internet paydo bo\'ldi, N ta ma\'lumot serverga yuklanmoqda',
            '🔴 Offline (N ta kutmoqda) — internet yo\'q, N ta operatsiya telefon xotirasida navbatda turibdi',
          ],
        },
        {
          k: 'p',
          text: 'Internet ulanganda ma\'lumotlar avtomatik tarzda server bilan sinxronlanadi. Ilovani yopib qayta ochsangiz ham hech narsa yo\'qolmaydi.',
        },
        {
          k: 'note',
          text: 'Har kuni ertalab internet bor joyda ilovani bir marta oching — yangi mahsulotlar, qoldiqlar va aksiyalar avtomatik yuklanadi.',
        },
      ],
    },
    {
      title: 'Yangi: Qadoq Birliklari Bo\'yicha Savdo',
      blocks: [
        {
          k: 'p',
          text: 'Tovarlarni nafaqat dona, balki ulgurji qadoqlarda (karopka, qop, xalta, pachka) sotish va buyurtma qilish mumkin.',
        },
        {
          k: 'list',
          items: [
            'Qadoq tanlash oynasida "Dona" yoki "Qadoq" tugmasini tanlang.',
            'Masalan: 2 karopka kiritilganda (agar 1 karopkada 12 dona bo\'lsa), tizim 24 dona deb hisoblaydi va summani to\'g\'ri chiqaradi.',
            'Ombor va mashina qoldig\'i doimo asosiy birlikda (donada) aniq kamayadi.',
          ],
        },
      ],
    },
    {
      title: 'Yangi: Aksiya va Bepul Bonus Tovarlar',
      blocks: [
        {
          k: 'p',
          text: 'Kompaniyada e\'lon qilingan aksiyalar doirasida beriladigan bepul bonus tovarlar avtomatik hisoblanadi:',
        },
        {
          k: 'list',
          items: [
            'Savatga tovar miqdori kiritilganda aksiya shartiga yetsa (masalan: 10 ta olganga 1 ta bepul), bepul tovar avtomatik savatga qo\'shiladi.',
            'Bonus tovar narxi: 0 so\'m (BEPUL) deb aks etadi va yashil yorliq bilan ko\'rsatiladi.',
            'Bonus tovar ombor va mashina qoldig\'idan aniq hisobdan chiqariladi — hech qanday kamomad vujudga kelmaydi.',
          ],
        },
      ],
    },
    {
      title: 'Buxgalteriya Qat\'iyligi (Append-Only)',
      blocks: [
        {
          k: 'p',
          text: 'Har bir sotuv, pul harakati, xarajat va tovar harakati tizimda o\'zgarmas tarix sifatida saqlanadi. Xato yozuvlarni orqaga o\'chirib bo\'lmaydi — faqat sababi ko\'rsatilgan holda rasmiy tuzatuvchi operatsiya kiritiladi.',
        },
      ],
    },
  ],
};

const distributor: RoleGuide = {
  id: 'DISTRIBUTOR',
  label: 'Tarqatuvchi (Haydovchi)',
  summary: '5-tabli mobil ilova, sotuv, qadoq, aksiya bonuslari, kun yopish',
  sections: [
    {
      title: 'Mobil Ilova Tuzilishi (5 ta Tab)',
      blocks: [
        {
          k: 'p',
          text: 'Ekranning pastki qismida 5 ta asosiy bo\'lim mavjud: Bosh (hamyon va ko\'rsatkichlar), Sotuv (yangi sotuv va tarix), Buyurtma (yetkazish zakazlari), Hamyon (xarajat va qarz undirish), Mijozlar (marshrut va GPS).',
        },
        { k: 'img', src: IMG('dist-01-home.png'), caption: 'Tarqatuvchi bosh ekrani' },
      ],
    },
    {
      title: 'Ertalab — Yuklamani Tasdiqlash',
      blocks: [
        {
          k: 'steps',
          items: [
            'Bosh ekrandan "Yuklamalar" bo\'limini oching.',
            'Omborchi tayyorlagan tovarlar ro\'yxati va qadoq miqdorlarini mashinaga yuklangan haqiqiy tovar bilan solishtiring.',
            'Hammasi to\'g\'ri bo\'lsa — "Tasdiqlash" tugmasini bosing.',
            'Tovar sizning moddiy javobgarligingizga ("mashina qoldig\'iga") o\'tadi.',
          ],
        },
        { k: 'note', text: 'Farq bo\'lsa, tasdiqlashdan oldin omborchiga ayting va tuzatish kiriting.' },
      ],
    },
    {
      title: 'Do\'konda — Tezkor Sotuv (Van-Sale)',
      blocks: [
        { k: 'p', text: '"+ Yangi sotuv" tugmasini bosing — jarayon 4 qadamda bajariladi:' },
        {
          k: 'steps',
          items: [
            'Mijoz — marshrutdagi do\'konni tanlang.',
            'Tovar va Qadoq — mahsulotni tanlang, "Dona" yoki "Qadoq" (karopka) miqdorini kiriting. Formula avtomatik hisoblaydi.',
            'Aksiya Bonusi — agar mahsulot aksiyada bo\'lsa, bepul bonus tovar avtomatik 0 so\'m bo\'lib savatga qo\'shiladi.',
            'To\'lov — Naqd, Plastik yoki Qarzga (muddat bilan). Aralash to\'lov ham mumkin.',
            'Saqlash — "✅ Saqlandi" chiqadi, chekni PDF qilib mijozga Telegram orqali yuborishingiz mumkin.',
          ],
        },
        { k: 'img', src: IMG('dist-02-sale-client.png'), caption: 'Mijoz va tovar tanlash' },
        {
          k: 'list',
          items: [
            'Mashina qoldig\'ida yo\'q tovar sotilmaydi.',
            'Minimal narxdan past sotishga ruxsat faqat admin ruxsat bergan bo\'lsa ishlaydi.',
            'Bloklangan mijozga faqat naqd savdo qilish mumkin.',
          ],
        },
      ],
    },
    {
      title: 'Hamyon, Xarajat va Qarz Undirish',
      blocks: [
        {
          k: 'p',
          text: 'Hamyon balansi = Naqd sotuv + Undirilgan qarz − Tasdiqlangan yo\'l xarajatlari − Kassaga topshirilgan pul.',
        },
        {
          k: 'steps',
          items: [
            'Xarajat: yoqilg\'i, tushlik, ta\'mirlash summasini kiriting. "Chek rasmidan summani olish" tugmasi AI bilan summani o\'zi to\'ldiradi.',
            'Qarz undirish: mijozlar qarzidan to\'lov qabul qiling, naqd pul darhol hamyoningizga qo\'shiladi.',
          ],
        },
        { k: 'img', src: IMG('dist-05-wallet.png'), caption: 'Hamyon va pul harakatlari' },
      ],
    },
    {
      title: 'Kechqurun — Kunni Yopish (3 Bosqichli)',
      blocks: [
        { k: 'p', text: '"Kunni yopish" tugmasi bosilganda 3 bosqichli oyna ochiladi:' },
        {
          k: 'steps',
          items: [
            '1-bosqich (Tovar): Omborga qaytariladigan tovar miqdorini kiriting (yaroqli, brak, muddati o\'tgan). Tovar farqi darhol chiqadi.',
            '2-bosqich (Pul): Kassaga topshiriladigan naqd pul summasini kiriting. Kassa farqi (kamomad) bo\'lsa, sababini izohlab yozing.',
            '3-bosqich (Tasdiq): Yakuniy ma\'lumotlarni ko\'rib chiqib "Kunni yopish" tugmasini bosing.',
          ],
        },
        { k: 'img', src: IMG('dist-04-dayclose.png'), caption: 'Kunni yopish vizardi' },
      ],
    },
    {
      title: 'Mening Maoshim va Hisobotlarim',
      blocks: [
        {
          k: 'list',
          items: [
            '"Mening maoshim" (/m/payroll) — yetkazib berganlik uchun % va zakaz olganlik uchun % bo\'yicha kunlik hisoblangan oylik maosh.',
            '"Mening hisobotim" (/m/reports) — kunlik, haftalik va oylik sof savdo va reja bajarilish ko\'rsatkichlari.',
          ],
        },
      ],
    },
  ],
};

const orderTaker: RoleGuide = {
  id: 'ORDER_TAKER',
  label: 'Zakaz Oluvchi (Pre-Seller)',
  summary: 'Mijozlardan buyurtma olish, qadoqlar, aksiya bonuslari, ombor qoldig\'i',
  sections: [
    {
      title: 'Zakazchining Asosiy Vazifasi',
      blocks: [
        {
          k: 'p',
          text: 'Savdo agenti (Pre-seller) marshrut bo\'ylab do\'konlarni aylanib sifatli buyurtma yig\'adi. Zakazchi tovar yuklamaydi va naqd pul yig\'maydi — yetkazish va pul qabul qilish haydovchi zimmasidadir.',
        },
      ],
    },
    {
      title: 'Buyurtma Olish Jarayoni',
      blocks: [
        {
          k: 'steps',
          items: [
            'Bosh ekrandagi "+ Yangi Buyurtma" tugmasini bosing va marshrutdagi do\'konni tanlang (GPS check-in avtomatik).',
            'Tovar qidirib tanlang. "Dona" yoki "Qadoq" (karopka, pachka) tanlang — tizim qadoqni donaga ko\'paytirib summani hisoblaydi.',
            'Aksiya bonuslari — agar aksiya bo\'lsa, bepul bonus tovar avtomatik 0 so\'m narxda savatga tushadi.',
            'To\'lov sharti va kutilgan yetkazish sanasini belgilab, "Buyurtmani saqlash" tugmasini bosing.',
          ],
        },
        {
          k: 'note',
          text: 'Internet yo\'q joyda ham buyurtma oling — internet paydo bo\'lishi bilan serverga avtomatik jo\'natiladi.',
        },
      ],
    },
    {
      title: 'Ombor Qoldig\'i Monitoringi (/m/stock)',
      blocks: [
        {
          k: 'p',
          text: 'Do\'konga kirishdan oldin "Ombor qoldig\'i" bo\'limini tekshiring. Omborda tugagan tovarlarga buyurtma olmang, aks holda haydovchi yetkaza olmaydi.',
        },
      ],
    },
    {
      title: 'Buyurtmalar Holati va Komissiya Foizi',
      blocks: [
        {
          k: 'list',
          items: [
            'Buyurtma holatlari: Kutilmoqda → Tasdiqlandi → Yuklamaga kiritildi → Yetkazilmoqda → Yetkazildi (sotuv bo\'ldi).',
            'Sizga hisoblangan komissiya aynan buyurtma yetkazilganda "Zakaz olgani uchun %" bo\'yicha to\'liq yoziladi.',
            '"Mening maoshim" bo\'limida har kuni qancha komissiya ishlaganingizni jonli kuzatishingiz mumkin.',
          ],
        },
      ],
    },
  ],
};

const warehouse: RoleGuide = {
  id: 'WAREHOUSE',
  label: 'Omborchi (Ombor Mudiri)',
  summary: 'Kirim, AI naklit skani, yuklamalar, buyurtma olish va tarqatish',
  sections: [
    {
      title: 'Yangi: Mobil Buyurtma Olish va Tarqatish (Sotuv)',
      blocks: [
        {
          k: 'p',
          text: 'Omborchi smartfon orqali bevosita savdo do‘konlaridan buyurtma olishi va tovarlarni tarqatishi (sotishi) mumkin:',
        },
        {
          k: 'list',
          items: [
            '+ Yangi Tarqatish / Sotuv — do\'konga tovar yetkazib sotish, qadoq tanlash (dona/karopka) va avtomatik aksiya bonuslari (0 so\'m).',
            '+ Buyurtma Olish — mijozlardan buyurtma qabul qilish va "Buyurtmalarim" bo\'limida holatini kuzatish.',
            'Tarqatish Yuklamalari — mashinaga yuklangan tovarlar va tarqatish varaqasi.',
          ],
        },
      ],
    },
    {
      title: 'Tovar Qabuli (Kirim Nakladnoy)',
      blocks: [
        {
          k: 'steps',
          items: [
            'Kompyuterda: Ombor → Kirim → "+ Yangi Kirim".',
            'Yetkazib beruvchi tashkilot, nakladnoy raqami va sanasini kiriting.',
            'Tovarlarni qadoq (karopka) va dona miqdorida kirim tannarxi bilan kiriting.',
            'Saqlang — tovar ombor zaxirasiga qo\'shiladi va o\'zgarmas harakat jurnaliga yoziladi. PDF nakladnoy chop etish mumkin.',
          ],
        },
      ],
    },
    {
      title: 'AI Naklit Skani (OCR)',
      blocks: [
        {
          k: 'p',
          text: 'Qog\'oz nakladnoyni qo\'lda terib o\'tirmaslik uchun mobil telefonda "Naklit skani" tugmasini bosing va suratga oling. AI jadvaldagi tovar nomlari, qadoqlar, miqdorlar va narxlarni bir necha soniyada o\'qib oladi. Admin panelda tekshirib bitta tugma bilan Kirimga o\'tkazasiz.',
        },
      ],
    },
    {
      title: 'Yuklamalar (Haydovchiga Tovar Berish)',
      blocks: [
        {
          k: 'steps',
          items: [
            'Buyurtmalardan yig\'ish: tasdiqlangan buyurtmalarni avtomatik bitta yuklamaga komplektatsiya qiling.',
            'Erkin yuklama: haydovchi va tovarlarni tanlab yangi yuklama tuzing.',
            'Yuklama varaqasini (PDF) chop etib haydovchiga imzo chektiring.',
            'Haydovchi telefonida tasdiqlagach, tovar ombordan chiqib uning mashina qoldig\'iga o\'tadi.',
          ],
        },
      ],
    },
    {
      title: 'Kechqurun — Qaytarish Qabuli va Bonuslar Hisobi',
      blocks: [
        {
          k: 'steps',
          items: [
            'Haydovchi kunni yopganda mashinada qolgan tovarlarni omborga qaytaradi.',
            'Yaroqli tovar, brak (yaroqsiz) va muddati o\'tgan tovarlarni sanab qabul qiling.',
            'Tovar farqi = Yuklangan − Sotilgan (pullik va bepul bonuslar) − Qaytarilgan.',
          ],
        },
        {
          k: 'note',
          text: 'Aksiya doirasida bepul berilgan bonus tovarlar ham qoldiqdan xuddi sotilgan tovardek aniq chiqadi — qoldiqda farq bo\'lmaydi.',
        },
      ],
    },
    {
      title: 'Ombor Qoldiqlari va Inventarizatsiya',
      blocks: [
        {
          k: 'list',
          items: [
            'Qoldiqlar sahifasida kam qolgan tovarlar qizil ogohlantirish bilan ko\'rinadi.',
            'Inventarizatsiya: haqiqiy qoldiq sanaladi, tizimdagi farqlar aniqlanadi va tasdiqlangach tuzatuvchi akt tuziladi.',
          ],
        },
      ],
    },
  ],
};

const admin: RoleGuide = {
  id: 'SUPER_ADMIN',
  label: 'Super Admin / Menejer',
  summary: '5 guruhli boshqaruv, mahsulotlar, aksiyalar, xodimlar, 6 xil hisobot',
  sections: [
    {
      title: '5 Guruhli Yangi Qulay Navigatsiya',
      blocks: [
        {
          k: 'list',
          items: [
            '1. Tezkor & Monitoring — Jonli Boshqaruv Paneli, Xarita (GPS) va Jonli Lenta.',
            '2. Savdo & Mijozlar — Yangi Sotuv, Sotuvlar tarixi, Buyurtmalar va Mijozlar.',
            '3. Ombor & Logistika — Ombor Qoldig\'i, Kirim (nakladnoy), Yuklamalar, AI Naklit Skani va Inventarizatsiya.',
            '4. Moliya & Hisobotlar — Kassa Balansi, Kunlik Hisob-Kitob, Mijozlar Qarzdorligi, Xarajatlar va barcha Kengaytirilgan Hisobotlar.',
            '5. Jamoa & Sozlamalar — Mahsulotlar Katalogi, Xodimlar & Filiallar, Maosh (Payroll), Tizim Salomatligi va Sinxronizatsiya Audit Jurnali.',
          ],
        },
      ],
    },
    {
      title: 'Mahsulotlar, Narxlar va Qadoq Birligi',
      blocks: [
        {
          k: 'list',
          items: [
            'Yagona tannarx (cost_price): tovarning haqiqiy tannarxi.',
            'Sotuv narxlari: Standart optom narx, chakana narx va minimal narx (ruxsatsiz bundan past sotib bo\'lmaydi).',
            'Qadoq birligi: mahsulot qadog\'i nomi (karopka, pachka, qop) va bitta qadoqdagi dona soni (masalan 1 karopka = 12 dona).',
          ],
        },
        { k: 'img', src: IMG('admin-07-products.jpg'), caption: 'Mahsulotlar katalogi' },
      ],
    },
    {
      title: 'Aksiya va Bepul Bonus Tovarlar Sozlamasi',
      blocks: [
        {
          k: 'p',
          text: 'Har bir mahsulot kartasida aksiya shartlarini belgilash mumkin: qaysi tovardan minimal qancha sotib olinsa, qaysi tovardan qancha miqdor bepul bonus berilishi. Masalan: 10 ta Shokoladga + 1 ta Shokolad yoki + 1 ta Choy bepul. Ilovada barcha hisob-kitob avtomatik ishlaydi.',
        },
      ],
    },
    {
      title: 'Xodimlar va Ikki Bosqichli Maosh Stavkalari',
      blocks: [
        {
          k: 'list',
          items: [
            'Zakaz olgani uchun % — buyurtma oluvchi agentlar uchun stavka (masalan 2.5%).',
            'Yetkazib bergani uchun % — haydovchi-tarqatuvchilar uchun stavka (masalan 1.5%).',
            'Fiks asosiy oylik maosh (oklad) — omborchi, buxgalter va boshqa xodimlar uchun.',
            'Kunlik xarajat limiti, ruxsat etilgan qarz limiti va minimal narxdan past sotish ruxsati.',
          ],
        },
        { k: 'img', src: IMG('admin-03-staff-commission.png'), caption: 'Xodim komissiya stavkalari' },
      ],
    },
    {
      title: 'Kengaytirilgan Hisobotlar (6 xil)',
      blocks: [
        {
          k: 'list',
          items: [
            'Tovar harakati (Sotuv / Bonus) — pullik sotilgan tovarlar va aksiya bo\'yicha bepul berilgan bonus tovarlar donasi va tannarx qiymati bo\'yicha aniq hisobot (Excel eksport bilan).',
            'P&L (Foyda va Zarar) — yalpi tushum, tannarx, yalpi foyda, yo\'l va operatsion xarajatlar, sof foyda.',
            'ABC Tahlil — Pareto 80/20 qoidasi bo\'yicha eng ko\'p daromad keltiruvchi tovarlar.',
            'Hisobotlar Konstruktori — erkin o\'lchovlar va filtrlar bo\'yicha tahliliy jadval.',
            'Mijozlar Qarzdorligi (Aging) — 0-7, 8-14, 15-30, 30+ kunlik qarzlar va Akt-sverka PDF.',
            'Kunlik hisob-kitob jurnali — kassa va tovar farqlari nazorati.',
          ],
        },
      ],
    },
    {
      title: 'Tizim Salomatligi va Audit Jurnali (/admin/sync-log)',
      blocks: [
        {
          k: 'p',
          text: 'Tizim xizmatlari holati, kassa balansining jurnallar bilan butunligi, mobil ilovalar sinxronizatsiyasi audit jurnali (/admin/sync-log) orqali to\'liq nazorat qilinadi.',
        },
      ],
    },
  ],
};

const accountant: RoleGuide = {
  id: 'ACCOUNTANT',
  label: 'Buxgalter / Kassir',
  summary: 'Kassa jurnali, qarzdorlik, Akt-sverka, Tovar harakati hisoboti, maosh',
  sections: [
    {
      title: 'Moliya va Kassa Harakatlari',
      blocks: [
        {
          k: 'list',
          items: [
            'Kassa balansi: naqd pul va bank hisob raqami qoldiqlari.',
            'O\'zgarmas kassa jurnali (Append-only): barcha kirim, chiqim va tuzatish yozuvlari xavfsiz saqlanadi, o\'chirib bo\'lmaydi.',
            'Haydovchilar kunni yopganda topshirgan naqd pullarni tekshirish va qabul qilish.',
            'Kompaniya operatsion xarajatlarini (ijara, kommunal, oylik avanslar) kiritish.',
          ],
        },
      ],
    },
    {
      title: 'Mijozlar Qarzdorligi va Akt-Sverka (PDF)',
      blocks: [
        {
          k: 'p',
          text: 'Debitorlik qarzdorligi yoshi bo\'yicha (Aging: 0–7, 8–14, 15–30, 30+ kun) monitoring qilinadi. Har bir mijoz bo\'yicha to\'liq solishtirma dalolatnoma (Akt-sverka) bir marta bosishda PDF formatida chop etiladi (xaridlar, to\'lovlar va yakuniy qarz qoldig\'i bilan).',
        },
        { k: 'img', src: IMG('admin-08-debts.jpg'), caption: 'Qarzdorlik — aging tahlili' },
      ],
    },
    {
      title: 'Yangi: Tovar Harakati (Sotuv va Bonuslar Hisoboti)',
      blocks: [
        {
          k: 'p',
          text: 'Hisobotlar bo\'limidagi "Tovar harakati (Sotuv / Bonus)" jadvali orqali pullik sotilgan tovarlar va bepul berilgan bonus tovarlar tahlil qilinadi. Bepul bonuslarning kompaniyaga tushgan tannarx qiymati (marketing xarajati) aniq ko\'rinadi. Ma\'lumotlarni Excel (.xlsx) formatida yuklab olish mumkin.',
        },
      ],
    },
    {
      title: 'Ikki Bosqichli Oylik Maosh (Payroll)',
      blocks: [
        {
          k: 'steps',
          items: [
            'Davrni tanlang va "Hisoblash" tugmasini bosing.',
            'Zakazchilar uchun "Zakaz %", haydovchilar uchun "Yetkazish %", boshqa xodimlar uchun fiks maosh hisoblanadi.',
            'Ushlanmalar (kassa kamomadi, avanslar) avtomatik chegiriladi.',
            'Vedomostni tekshirib "Tasdiqlash" va to\'langach "To\'landi" maqomiga o\'tkazing.',
          ],
        },
        { k: 'img', src: IMG('admin-04-payroll.jpg'), caption: 'Oylik maosh hisoblash oynasi' },
      ],
    },
    {
      title: 'Foyda-Zarar (P&L) va 1C Eksport',
      blocks: [
        {
          k: 'list',
          items: [
            'Foyda va Zarar (P&L): yalpi tushum, tovarlar tannarxi, transport va operatsion xarajatlar, sof foyda.',
            'Barcha kunlik operatsiyalar va nakladnoylarni 1C dasturiga import qilish uchun standart formatlarda yuklab olish.',
          ],
        },
      ],
    },
  ],
};

/** Hamma uchun umumiy bo'lim — hech qachon undefined bo'lmaydi. */
export const COMMON_GUIDE: RoleGuide = common;

export const GUIDES: RoleGuide[] = [
  common, distributor, orderTaker, warehouse, admin, accountant,
];

/** Rol uchun mos yo'riqnoma id'si (admin rollari birlashtirilgan). */
export function guideIdForRole(role: Role): RoleGuide['id'] {
  if (role === 'MANAGER' || role === 'BRANCH_MANAGER') return 'SUPER_ADMIN';
  return role;
}
