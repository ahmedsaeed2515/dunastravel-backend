import { PrismaClient } from '@prisma/client';

export const CANONICAL_FLEET = [
  {
    id: 'tr-bus-1',
    name: 'حافلة الرحلات الذهبية الفاخرة (VIP Golden Bus)',
    serviceType: 'AIRPORT',
    vehicleCategory: 'bus',
    vehicleType: 'VIP Tour Bus 50-Seater',
    capacity: 50,
    doors: 2,
    transmission: 'AUTO',
    basePriceUsd: 450,
    heroImageUrl: '/imgs/transportation/bus1.jpeg',
    isPrivate: false,
    isActive: true,
    featuresJsonb: [
      'مقاعد جلدية مريحة وفخمة',
      'واي فاي عالي السرعة',
      'نظام تكييف مركزي متطور',
      'شاشات عرض ترفيهية',
      'ثلاجة ومشروبات ضيافة منعشة',
      'مساحة واسعة للأمتعة',
      'منافذ شحن USB لكل مقعد',
    ],
    description:
      'حافلة سياحية فاخرة تتسع لـ 50 راكباً، مجهزة بأحدث وسائل الراحة والأمان لضمان تجربة سفر استثنائية عبر أجمل المعالم السياحية.',
  },
  {
    id: 'tr-bus-2',
    name: 'حافلة كلاسيك للرحلات (Classic Coach Bus)',
    serviceType: 'AIRPORT',
    vehicleCategory: 'bus',
    vehicleType: 'Tour Coach 45-Seater',
    capacity: 45,
    doors: 2,
    transmission: 'AUTO',
    basePriceUsd: 400,
    heroImageUrl: '/imgs/transportation/bus2.jpeg',
    isPrivate: false,
    isActive: true,
    featuresJsonb: [
      'تكييف هواء مركزي',
      'واي فاي مجاني',
      'مقاعد مريحة قابلة للتعديل',
      'نظام صوتي متكامل',
      'إضاءة قراءة مخصصة',
      'مساحة للأمتعة',
    ],
    description:
      'حافلة مريحة ومثالية للمجموعات السياحية والرحلات الطويلة، تجمع بين الكفاءة والراحة العالية.',
  },
  {
    id: 'tr-bus-3',
    name: 'حافلة مرسيدس بنز VIP (Mercedes-Benz VIP Bus)',
    serviceType: 'CITY_TO_CITY',
    vehicleCategory: 'bus',
    vehicleType: 'Mercedes-Benz VIP 45-Seater',
    capacity: 45,
    doors: 2,
    transmission: 'AUTO',
    basePriceUsd: 550,
    heroImageUrl: '/imgs/transportation/bus3.jpeg',
    isPrivate: false,
    isActive: true,
    featuresJsonb: [
      'مقاعد جلدية فاخرة فائقة الراحة',
      'إنترنت 5G فائق السرعة',
      'خدمة VIP على متن الحافلة',
      'نظام صوت وفيديو متطور',
      'مشروبات وضيافة فاخرة',
      'مساحة أمتعة رحبة ومؤمنة',
      'مساعد ومرافق للرحلة',
    ],
    description:
      'قمة الفخامة والأناقة في عالم النقل السياحي، مصممة خصيصاً لرحلات كبار الشخصيات بين المدن والمعالم الأثرية.',
  },
  {
    id: 'tr-bus-4',
    name: 'حافلة النخبة السياحية (VIP Tour Coach)',
    serviceType: 'CITY_TO_CITY',
    vehicleCategory: 'bus',
    vehicleType: 'VIP Tour Coach 50-Seater',
    capacity: 50,
    doors: 2,
    transmission: 'AUTO',
    basePriceUsd: 470,
    heroImageUrl: '/imgs/transportation/bus4.jpeg',
    isPrivate: false,
    isActive: true,
    featuresJsonb: [
      'مقاعد فاخرة ومريحة',
      'واي فاي مجاني',
      'تكييف متطور',
      'شاشات عرض',
      'إضاءة ليلية مريحة',
      'نظام تعليق هوائي فائق النعومة',
    ],
    description:
      'حافلة مميزة تجمع بين الفخامة والرحابة لتوفير أقصى درجات الراحة أثناء التنقلات والرحلات الطويلة.',
  },
  {
    id: 'tr-bus-5',
    name: 'حافلة جراند للسياحة والسفر (Grand Travel Bus)',
    serviceType: 'CITY_TO_CITY',
    vehicleCategory: 'bus',
    vehicleType: 'Grand Touring 50-Seater',
    capacity: 50,
    doors: 2,
    transmission: 'AUTO',
    basePriceUsd: 430,
    heroImageUrl: '/imgs/transportation/bus5.jpeg',
    isPrivate: false,
    isActive: true,
    featuresJsonb: [
      'مقاعد مريحة',
      'واي فاي سريع',
      'نظام تكييف ممتاز',
      'شاشات عرض',
      'إضاءة LED هادئة',
      'مساحة حقائب واسعة',
    ],
    description:
      'حافلة واسعة ومجهزة بأحدث التقنيات لضمان رحلة ممتعة وآمنة عبر جميع المسارات السياحية.',
  },
  {
    id: 'tr-bus-6',
    name: 'حافلة إكسبريس السريعة (Express Coach Bus)',
    serviceType: 'HOTEL',
    vehicleCategory: 'bus',
    vehicleType: 'Coach Bus 45-Seater',
    capacity: 45,
    doors: 2,
    transmission: 'AUTO',
    basePriceUsd: 390,
    heroImageUrl: '/imgs/transportation/bus6.jpeg',
    isPrivate: false,
    isActive: true,
    featuresJsonb: [
      'تكييف هواء',
      'واي فاي',
      'مقاعد مريحة',
      'نظام ملاحة حديث',
      'خدمة نقل سريعة',
      'مساحة أمتعة',
    ],
    description:
      'خدمة التوصيل السريع والمريح بين الفنادق والمطارات والمعالم السياحية بأعلى معايير الدقة.',
  },
  {
    id: 'tr-bus-7',
    name: 'حافلة رويال إيليجانس (Royal Elegance Bus)',
    serviceType: 'HOTEL',
    vehicleCategory: 'bus',
    vehicleType: 'Executive Bus 48-Seater',
    capacity: 48,
    doors: 2,
    transmission: 'AUTO',
    basePriceUsd: 480,
    heroImageUrl: '/imgs/transportation/bus7.jpeg',
    isPrivate: false,
    isActive: true,
    featuresJsonb: [
      'مقاعد مريحة فاخرة',
      'واي فاي عالي السرعة',
      'تجهيزات VIP متكاملة',
      'نظام ملاحة متطور',
      'مشروبات وضيافة ترحيبية',
      'خدمة متميزة',
      'أمان وراحة تامة',
    ],
    description:
      'حافلة مخصصة لكبار الزوار والوفود الرسمية لتقديم أرقى تجارب الضيافة والنقل الفندقي.',
  },
  {
    id: 'tr-coaster-1',
    name: 'كوستر تويوتا التنفيذي (Toyota Coaster Executive)',
    serviceType: 'AIRPORT',
    vehicleCategory: 'coaster',
    vehicleType: 'Toyota Coaster 26-Seater',
    capacity: 26,
    doors: 2,
    transmission: 'AUTO',
    basePriceUsd: 260,
    heroImageUrl: '/imgs/transportation/costar.jpeg',
    isPrivate: false,
    isActive: true,
    featuresJsonb: [
      'تكييف قوي',
      'واي فاي',
      'مقاعد مريحة ومتباعدة',
      'نظام صوتي نقي',
      'مساحة للأمتعة الخفيفة',
      'مثالي للمجموعات المتوسطة',
    ],
    description:
      'حافلة ميني كوستر مدمجة ورائعة للمجموعات الصغيرة والعائلات، تجمع بين السرعة وسهولة التنقل في المدن.',
  },
  {
    id: 'tr-coaster-2',
    name: 'كوستر بريميوم VIP (VIP Premium Coaster)',
    serviceType: 'CITY_TO_CITY',
    vehicleCategory: 'coaster',
    vehicleType: 'Toyota Coaster VIP 22-Seater',
    capacity: 22,
    doors: 2,
    transmission: 'AUTO',
    basePriceUsd: 290,
    heroImageUrl: '/imgs/transportation/costar1.jpeg',
    isPrivate: false,
    isActive: true,
    featuresJsonb: [
      'مقاعد جلدية مريحة',
      'واي فاي مجاني',
      'خدمة VIP خاصة',
      'إضاءة هادئة ونظام تكييف ممتاز',
      'شواحن USB',
      'سائق محترف ومرافق',
    ],
    description:
      'ميني باص فاخر مصمم خصيصاً للرحلات الخاصة والجولات السياحية المميزة بأعلى مستويات الخصوصية.',
  },
  {
    id: 'tr-private-1',
    name: 'سيارات سيدان ودفع رباعي VIP (VIP Luxury Sedan & SUV)',
    serviceType: 'AIRPORT',
    vehicleCategory: 'private',
    vehicleType: 'Luxury Sedan & SUV',
    capacity: 4,
    doors: 4,
    transmission: 'AUTO',
    basePriceUsd: 150,
    heroImageUrl: '/imgs/transportation/privte.jpeg',
    isPrivate: true,
    isActive: true,
    featuresJsonb: [
      'سيارة فارهة مجهزة بالكامل',
      'نظام ملاحة GPS حديث',
      'تكييف هواء ثنائي المناطق',
      'واي فاي خاص وسريع',
      'مياه معدنية ومشروبات ضيافة',
      'سائق خاص متعدد اللغات',
      'خدمة التوصيل من الباب إلى الباب',
    ],
    description:
      'خدمة الليموزين والسيارات الفاخرة الخاصة لتنقلات كبار الشخصيات ورجال الأعمال بكل رفاهية وسرية.',
  },
];

export async function seedTransportationServices(
  prisma: PrismaClient,
): Promise<void> {
  console.log('Seeding canonical Transportation Fleet...');
  let created = 0;
  let updated = 0;

  for (const vehicle of CANONICAL_FLEET) {
    const existing = await prisma.transportationService.findUnique({
      where: { id: vehicle.id },
    });

    if (!existing) {
      await prisma.transportationService.create({
        data: {
          id: vehicle.id,
          name: vehicle.name,
          serviceType: vehicle.serviceType,
          vehicleCategory: vehicle.vehicleCategory,
          vehicleType: vehicle.vehicleType,
          capacity: vehicle.capacity,
          doors: vehicle.doors,
          transmission: vehicle.transmission,
          basePriceUsd: vehicle.basePriceUsd,
          heroImageUrl: vehicle.heroImageUrl,
          isPrivate: vehicle.isPrivate,
          isActive: vehicle.isActive,
          featuresJsonb: vehicle.featuresJsonb,
          description: vehicle.description,
        },
      });
      created++;
      console.log(
        '  + Created transportation service: ' +
          vehicle.id +
          ' (' +
          vehicle.name +
          ')',
      );
    } else {
      await prisma.transportationService.update({
        where: { id: vehicle.id },
        data: {
          name: vehicle.name,
          serviceType: vehicle.serviceType,
          vehicleCategory: vehicle.vehicleCategory,
          vehicleType: vehicle.vehicleType,
          capacity: vehicle.capacity,
          doors: vehicle.doors,
          transmission: vehicle.transmission,
          basePriceUsd: vehicle.basePriceUsd,
          heroImageUrl: vehicle.heroImageUrl,
          isPrivate: vehicle.isPrivate,
          isActive: vehicle.isActive,
          featuresJsonb: vehicle.featuresJsonb,
          description: vehicle.description,
        },
      });
      updated++;
      console.log(
        '  * Updated transportation service: ' +
          vehicle.id +
          ' (' +
          vehicle.name +
          ')',
      );
    }
  }

  console.log(
    '  Transportation fleet seed complete: ' +
      created +
      ' created, ' +
      updated +
      ' updated.',
  );
}
