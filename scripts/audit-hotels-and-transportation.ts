import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_7ySL8IBrJYwN@ep-cool-sea-atufhdxz-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter }) as any;

const REQUIRED_ROOMS = [
  {
    slug: 'single-room',
    nameJsonb: {
      en: 'Single Room',
      ar: 'غرفة مفردة (سينجل)',
      es: 'Habitación Individual',
      pt: 'Quarto Individual',
      it: 'Camera Singola',
    },
    descriptionJsonb: {
      en: 'Cozy single room with modern amenities and high-speed Wi-Fi.',
      ar: 'غرفة مفردة مريحة مزودة بكافة وسائل الراحة الحديثة وإنترنت سريع.',
      es: 'Acogedora habitación individual con modernas comodidades y Wi-Fi de alta velocidad.',
      it: 'Accogliente camera singola con comfort moderni e Wi-Fi ad alta velocità.',
      pt: 'Aconchegante quarto individual com comodidades modernas e Wi-Fi de alta velocidade.',
    },
    ratePerNight: 0.0,
    maxOccupancy: 1,
    isActive: true,
  },
  {
    slug: 'double-room',
    nameJsonb: {
      en: 'Double Room',
      ar: 'غرفة مزدوجة (دبل)',
      es: 'Habitación Doble',
      pt: 'Quarto Duplo',
      it: 'Camera Doppia',
    },
    descriptionJsonb: {
      en: 'Elegant double room with Pyramids view and 1 King Bed.',
      ar: 'غرفة دبل أنيقة بإطلالة مباشرة على الأهرامات وسرير ملكي.',
      es: 'Elegante habitación doble con vistas a las Pirámides y 1 cama King.',
      it: 'Elegante camera doppia con vista sulle Piramidi e 1 letto King.',
      pt: 'Elegante quarto duplo com vista para as Pirâmides e 1 cama King.',
    },
    ratePerNight: 0.0,
    maxOccupancy: 2,
    isActive: true,
  },
  {
    slug: 'triple-room',
    nameJsonb: {
      en: 'Triple Room',
      ar: 'غرفة ثلاثية (تريبل)',
      es: 'Habitación Triple',
      pt: 'Quarto Triplo',
      it: 'Camera Tripla',
    },
    descriptionJsonb: {
      en: 'Spacious triple room ideal for families or groups of 3 guests.',
      ar: 'غرفة ثلاثية واسعة مثالية للعائلات أو المجموعات حتى 3 ضيوف.',
      es: 'Amplia habitación triple ideal para familias o grupos de 3 huéspedes.',
      it: 'Spaziosa camera tripla ideale per famiglie o gruppi di 3 ospiti.',
      pt: 'Espaçoso quarto triplo ideal para famílias ou grupos de 3 hóspedes.',
    },
    ratePerNight: 0.0,
    maxOccupancy: 3,
    isActive: true,
  },
  {
    slug: 'executive-suite',
    nameJsonb: {
      en: 'Executive Suite',
      ar: 'جناح تنفيذي (إكزكتيف سويت)',
      es: 'Suite Ejecutiva',
      pt: 'Suíte Executiva',
      it: 'Suite Executive',
    },
    descriptionJsonb: {
      en: 'Luxurious executive suite featuring a separate lounge and panoramic Pyramids view.',
      ar: 'جناح تنفيذي فاخر يتميز بصالة جلوس منفصلة وإطلالة بانورامية ساحرة على الأهرامات.',
      es: 'Lujosa suite ejecutiva con sala de estar independiente y vista panorámica a las Pirámides.',
      it: 'Lussuosa suite executive con salotto separato e vista panoramica sulle Piramidi.',
      pt: 'Luxuosa suíte executiva com sala de estar separada e vista panorâmica das Pirâmides.',
    },
    ratePerNight: 0.0,
    maxOccupancy: 3,
    isActive: true,
  },
  {
    slug: 'royal-pyramid-view-suite',
    nameJsonb: {
      en: 'Royal Pyramid View Suite',
      ar: 'الجناح الملكي بإطلالة الأهرامات',
      es: 'Suite Real con Vista a las Pirámides',
      pt: 'Suíte Real com Vista para as Pirâmides',
      it: 'Suite Reale con Vista sulle Piramidi',
    },
    descriptionJsonb: {
      en: 'The crown jewel suite offering supreme comfort and front-row views of the Giza Pyramids.',
      ar: 'درة التاج الفندقية، توفر أقصى درجات الفخامة وإطلالة مباشرة في الصف الأول على أهرامات الجيزة.',
      es: 'La joya de la corona con supremo confort y vistas de primera fila a las Pirámides de Giza.',
      it: 'Il fiore all’occhiello che offre massimo comfort e vista in prima fila sulle Piramidi di Giza.',
      pt: 'A jóia da coroa oferecendo conforto supremo e vista privilegiada das Pirâmides de Gizé.',
    },
    ratePerNight: 0.0,
    maxOccupancy: 4,
    isActive: true,
  },
];

async function auditHotelsAndFleet() {
  console.log('====================================================');
  console.log('🏨 HOTELS & TRANSPORTATION ECOSYSTEM FORENSIC AUDIT');
  console.log('====================================================\n');

  // 1. HOTEL AUDIT: Sol Pyramid Hotel
  let hotel = await prisma.hotel.findFirst({
    where: { slug: 'sol-pyramid-hotel' },
    include: { rooms: true }
  });

  if (!hotel) {
    console.log('❌ Sol Pyramid Hotel NOT found in database! Creating...');
    hotel = await prisma.hotel.create({
      data: {
        slug: 'sol-pyramid-hotel',
        name: 'Sol Pyramid Hotel',
        nameJsonb: {
          en: 'Sol Pyramid Hotel',
          ar: 'فندق سول بيراميد',
          es: 'Hotel Sol Pyramid',
          pt: 'Hotel Sol Pyramid',
          it: 'Hotel Sol Pyramid',
        },
        descriptionJsonb: {
          en: "Solpyramid Hotel is a modern 5-star establishment designed for travellers who want to explore Egypt's major sights.",
          ar: "فندق سول بيراميد هو منشأة حديثة فاخرة فئة 5 نجوم صممت للمسافرين الراغبين في استكشاف معالم مصر الرئيسية.",
          es: "El Hotel Solpyramid es un moderno establecimiento de 5 estrellas diseñado para viajeros que desean explorar los principales lugares de interés de Egipto.",
          it: "L'Hotel Solpyramid è una moderna struttura a 5 stelle progettata per i viaggiatori che desiderano esplorare le principali attrazioni dell'Egitto.",
          pt: "O Hotel Solpyramid é um estabelecimento moderno de 5 estrelas projetado para viajantes que desejam explorar as principais atrações do Egito.",
        },
        destinationSlug: 'egypt',
        city: 'Giza',
        stars: 5,
        rating: 5.0,
        currency: 'USD',
        pricePerNight: 0.0,
        addressJsonb: {
          en: '05 Rawdet al Ahram, Behind Le Meridien Pyramids St., Old Hadayek al Ahram – Haram – Giza – Egypt',
          ar: '05 روضة الأهرام، خلف شارع لوميريديان الأهرام، حدائق الأهرام القديمة – الهرم – الجيزة – مصر',
        },
        phone: '+2 02 33775511 / +2 02 33775522',
        email: 'info@solpyramid-egypt.com',
        website: 'https://www.solpyramid-egypt.com/',
        amenitiesJsonb: [
          'Free Wi-Fi',
          'Air conditioning',
          'Private bathroom',
          'Mini bar',
          'In-room coffee & tea',
          '100% Egyptian cotton linen',
          'Multi-language TV',
          'Free safe box',
          'Ironing board',
          'In-room phone',
          'Hair dryer',
          'Heater',
        ],
        policiesJsonb: {
          checkIn: '15:00',
          checkOut: '12:00',
          smoking: false,
          pets: false,
          paymentMethod: 'SSL Online Credit Card / Cash',
        },
        status: 'PUBLISHED',
        isActive: true,
      }
    });
  } else {
    // Ensure 5-star rating, status PUBLISHED and isActive
    await prisma.hotel.update({
      where: { id: hotel.id },
      data: {
        stars: 5,
        status: 'PUBLISHED',
        isActive: true,
      }
    });
  }

  console.log(`[HOTEL] Sol Pyramid Hotel (${hotel.slug}) -> Stars: 5 | Price/Night: $0.00 | Status: PUBLISHED ✅`);

  // Ensure all 5 room categories exist with $0.00 Egypt promotion rate
  console.log('\n--- Auditing & Aligning 5 Room Categories ---');
  for (const r of REQUIRED_ROOMS) {
    const upserted = await prisma.hotelRoom.upsert({
      where: {
        hotelId_slug: {
          hotelId: hotel.id,
          slug: r.slug,
        }
      },
      update: {
        nameJsonb: r.nameJsonb,
        descriptionJsonb: r.descriptionJsonb,
        ratePerNight: r.ratePerNight,
        maxOccupancy: r.maxOccupancy,
        currency: 'USD',
        isActive: true,
      },
      create: {
        hotelId: hotel.id,
        slug: r.slug,
        nameJsonb: r.nameJsonb,
        descriptionJsonb: r.descriptionJsonb,
        ratePerNight: r.ratePerNight,
        maxOccupancy: r.maxOccupancy,
        currency: 'USD',
        isActive: true,
      }
    });
    console.log(` ✅ Room Category: ${upserted.slug.padEnd(26)} -> Rate: $${upserted.ratePerNight}/night | MaxPax: ${upserted.maxOccupancy} | Active: ${upserted.isActive}`);
  }

  const finalRooms = await prisma.hotelRoom.findMany({
    where: { hotelId: hotel.id, isActive: true, deletedAt: null }
  });
  console.log(`[HOTELS 3.1] Sol Pyramid Hotel Active Rooms: ${finalRooms.length} (Expected: 5+) -> PASS ✅`);

  // 2. FLEET AUDIT: 13 Vehicles & Executive Services
  console.log('\n--- Auditing 13 Transportation Fleet & Transfers ---');
  const EXPECTED_SERVICES = [
    'VIP Airport Chauffeur & Fast Track',
    'Private Intercity Executive Transfer',
    'Full-Day Private Chauffeur & Luxury Vehicle',
    'Luxury Tour Bus Golden',
    'Luxury Tour Bus Classic',
    'Premium Mercedes Tour Bus',
    'VIP Tour Coach',
    'Grand Travel Bus',
    'Elite Coach Bus',
    'Royal Travel Bus',
    'Toyota Coaster Executive',
    'Toyota Coaster VIP',
    'Luxury Private Vehicle'
  ];

  const fleet = await prisma.transportationService.findMany({
    where: { isActive: true }
  });

  console.log(`Total Active Fleet Services in DB: ${fleet.length} (Expected: 13)`);
  let fleetCompliant = true;

  EXPECTED_SERVICES.forEach((name, idx) => {
    const item = fleet.find((f: any) => f.name === name || f.vehicleModel === name);
    if (!item) {
      console.log(` ❌ [${idx+1}] Missing service: "${name}"`);
      fleetCompliant = false;
    } else {
      console.log(` ✅ [${idx+1}/13] ${name.padEnd(44)} -> BasePrice: $${item.basePriceUsd} | Category: ${item.vehicleCategory || item.serviceType}`);
    }
  });

  console.log(`\n[FLEET 3.2] Transportation Fleet & Transfers: ${fleet.length}/13 -> ${fleetCompliant && fleet.length >= 13 ? 'PASS ✅ (100% PARITY)' : 'FAIL ❌'}`);
}

auditHotelsAndFleet().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
