import { PrismaClient } from '@prisma/client';

export const CANONICAL_FLEET = [
  {
    id: 'tr-bus-1',
    name: 'حافلة سياحية كبرى فاخرة (VIP Golden Bus)',
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
      'تكييف هوائي مركزي',
      'واي فاي فائق السرعة',
      'سائق محترف متعدد اللغات',
      'دورة مياه داخلية',
      'مقاعد جلدية مريحة قابلة للإمالة',
      'مساحة أمتعة واسعة',
      'منافذ شحن USB',
    ],
    description:
      'حافلة سياحية فاخرة 50 مقعداً مجهزة بأحدث وسائل الراحة والترفيه وشاشات العرض للرحلات الطويلة بين القاهرة والأقصر وأسوان والغردقة.',
  },
  {
    id: 'tr-bus-2',
    name: 'حافلة كلاسيك جراند (Classic Coach Bus)',
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
      'تكييف كامل',
      'واي فاي مجاني',
      'سائق سياحي معتمد',
      'دورة مياه',
      'نظام صوتي متطور',
      'مقاعد مريحة',
    ],
    description:
      'حافلة مريحة مثالية للمجموعات السياحية الكبيرة مع تعليق هوائي ونوافذ بانورامية عازلة للحرارة.',
  },
  {
    id: 'tr-bus-3',
    name: 'حافلة مرسيدس توريزمو VIP (Mercedes-Benz VIP Bus)',
    serviceType: 'AIRPORT',
    vehicleCategory: 'bus',
    vehicleType: 'Mercedes Tourismo VIP 50-Seater',
    capacity: 50,
    doors: 2,
    transmission: 'AUTO',
    basePriceUsd: 500,
    heroImageUrl: '/imgs/transportation/bus3.jpeg',
    isPrivate: false,
    isActive: true,
    featuresJsonb: [
      'تكييف مركزي متطور',
      'إنترنت 5G مجاني',
      'سائق VIP خاص',
      'دورة مياه فاخرة',
      'مقاعد جلدية فاخرة',
      'منافذ شحن فردية لكل مقعد',
      'ثلاجة ومشروبات',
    ],
    description:
      'قمة الفخامة الألمانية لرحلات كبار الشخصيات والوفود الرسمية مع أعلى درجات الأمان والهدوء داخل المقصورة.',
  },
  {
    id: 'tr-bus-4',
    name: 'حافلة كوتش VIP رويال (VIP Tour Coach)',
    serviceType: 'CITY_TO_CITY',
    vehicleCategory: 'bus',
    vehicleType: 'VIP Tour Coach 48-Seater',
    capacity: 48,
    doors: 2,
    transmission: 'AUTO',
    basePriceUsd: 420,
    heroImageUrl: '/imgs/transportation/bus4.jpeg',
    isPrivate: false,
    isActive: true,
    featuresJsonb: [
      'تكييف هوائي',
      'واي فاي سريع',
      'سائق محترف',
      'دورة مياه',
      'نظام صوتي نقي',
      'إضاءة محيطية هادئة',
    ],
    description:
      'حافلة سياحية رحبة توفر راحة تامة أثناء التنقل بين المزارات والمعالم السياحية الرئيسية.',
  },
  {
    id: 'tr-bus-5',
    name: 'حافلة جراند ترافيل إكسكيوتيف (Grand Travel Bus)',
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
      'تكييف مركزي',
      'واي فاي فائق السرعة',
      'سائق متمرس',
      'دورة مياه',
      'شاشات عرض LED',
      'منافذ شحن',
    ],
    description:
      'حافلة السفر الطويل المتميزة برحابة المساحات بين المقاعد وإمكانيات ترفيه متكاملة للركاب.',
  },
  {
    id: 'tr-bus-6',
    name: 'حافلة سياحية إكسبريس (Express Coach Bus)',
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
      'سائق معتمد',
      'نظام صوتي',
      'مساحة أمتعة كبيرة',
      'مقاعد مريحة',
    ],
    description:
      'حافلة متوازنة وعملية لنقل المجموعات بين الفنادق والمطارات والجولات اليومية بكفاءة عالية.',
  },
  {
    id: 'tr-bus-7',
    name: 'حافلة رويال إليغانس (Royal Elegance Bus)',
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
      'تكييف مركزي',
      'واي فاي عالي السرعة',
      'سائق VIP',
      'دورة مياه',
      'مقاعد جلدية مريحة',
      'ثلاجة ومشروبات',
      'نوافذ بانورامية',
    ],
    description:
      'تصميم أنيق وتجهيزات فائقة الجودة لرحلات ممتعة وإطلالات بانورامية خلابة على أجمل المناظر الطبيعية.',
  },
  {
    id: 'tr-coaster-1',
    name: 'كوستر تويوتا تنفيذي (Toyota Coaster Executive)',
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
      'سائق سياحي محترف',
      'نظام صوتي نقي',
      'مساحة واسعة للأقدام',
      'أماكن مخصصة للحقائب',
    ],
    description:
      'الخيار الأمثل للمجموعات المتوسطة والعائلات الكبيرة، سهولة حركة وأقصى درجات الراحة والمرونة.',
  },
  {
    id: 'tr-coaster-2',
    name: 'كوستر VIP بريميوم (VIP Premium Coaster)',
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
      'تكييف متطور',
      'واي فاي سريع',
      'سائق VIP خاص',
      'مقاعد جلدية كابتن واسعة',
      'منافذ شحن USB',
      'نظام صوتي فائق',
    ],
    description:
      'مقصورة مخصصة لرجال الأعمال والمجموعات الخاصة بمقاعد كابتن مريحة ومساحات رحبة للغاية.',
  },
  {
    id: 'tr-private-1',
    name: 'سيارة فاخرة خاصة مع سائق (VIP Luxury Sedan & SUV)',
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
      'تكييف هواء فاخر',
      'نظام ملاحة GPS',
      'وسائد هوائية متطورة',
      'واي فاي متنقل',
      'سائق خاص بلباس رسمي',
      'مقاعد جلدية فاخرة',
      'مياه معدنية وضيافة',
    ],
    description:
      'خدمة استقبال وتوصيل خاصة فاخرة لكبار الشخصيات ورجال الأعمال مع سائق خاص يتحدث عدة لغات.',
  },
];

export async function seedTransportationServices(prisma: PrismaClient): Promise<void> {
  console.log('\n🚍 Seeding canonical Transportation Fleet...');
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
      console.log(`  ✅ Created transportation service: ${vehicle.id} (${vehicle.name})`);
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
      console.log(`  🔄 Updated transportation service: ${vehicle.id} (${vehicle.name})`);
    }
  }

  console.log(`  🏁 Transportation fleet seed complete: ${created} created, ${updated} updated.`);
}
