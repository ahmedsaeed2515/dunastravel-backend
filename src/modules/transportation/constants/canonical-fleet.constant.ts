import { PrismaClient } from '@prisma/client';

export const CANONICAL_FLEET = [
  {
    id: 'tr-bus-1',
    name: 'Õ«›·… ”Ì«ÕÌ… ﬂ»—Ï ›«Œ—… (VIP Golden Bus)',
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
      ' ﬂÌÌ› ÂÊ«∆Ì „—ﬂ“Ì',
      'Ê«Ì ›«Ì ›«∆ﬁ «·”—⁄…',
      '”«∆ﬁ „Õ —› „ ⁄œœ «··€« ',
      'œÊ—… „Ì«Â œ«Œ·Ì…',
      '„ﬁ«⁄œ Ã·œÌ… „—ÌÕ… ﬁ«»·… ··≈„«·…',
      '„”«Õ… √„ ⁄… Ê«”⁄…',
      '„‰«›– ‘Õ‰ USB',
    ],
    description:
      'Õ«›·… ”Ì«ÕÌ… ›«Œ—… 50 „ﬁ⁄œ« „ÃÂ“… »√ÕœÀ Ê”«∆· «·—«Õ… Ê«· —›ÌÂ Ê‘«‘«  «·⁄—÷ ··—Õ·«  «·ÿÊÌ·… »Ì‰ «·ﬁ«Â—… Ê«·√ﬁ’— Ê√”Ê«‰ Ê«·€—œﬁ….',
  },
  {
    id: 'tr-bus-2',
    name: 'Õ«›·… ﬂ·«”Ìﬂ Ã—«‰œ (Classic Coach Bus)',
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
      ' ﬂÌÌ› ﬂ«„·',
      'Ê«Ì ›«Ì „Ã«‰Ì',
      '”«∆ﬁ ”Ì«ÕÌ „⁄ „œ',
      'œÊ—… „Ì«Â',
      '‰Ÿ«„ ’Ê Ì „ ÿÊ—',
      '„ﬁ«⁄œ „—ÌÕ…',
    ],
    description:
      'Õ«›·… „—ÌÕ… „À«·Ì… ··„Ã„Ê⁄«  «·”Ì«ÕÌ… «·ﬂ»Ì—… „⁄  ⁄·Ìﬁ ÂÊ«∆Ì Ê‰Ê«›– »«‰Ê—«„Ì… ⁄«“·… ··Õ—«—….',
  },
  {
    id: 'tr-bus-3',
    name: 'Õ«›·… „—”Ìœ”  Ê—Ì“„Ê VIP (Mercedes-Benz VIP Bus)',
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
      ' ﬂÌÌ› „—ﬂ“Ì „ ÿÊ—',
      '≈‰ —‰  5G „Ã«‰Ì',
      '”«∆ﬁ VIP Œ«’',
      'œÊ—… „Ì«Â ›«Œ—…',
      '„ﬁ«⁄œ Ã·œÌ… ›«Œ—…',
      '„‰«›– ‘Õ‰ ›—œÌ… ·ﬂ· „ﬁ⁄œ',
      'À·«Ã… Ê„‘—Ê»« ',
    ],
    description:
      'ﬁ„… «·›Œ«„… «·√·„«‰Ì… ·—Õ·«  ﬂ»«— «·‘Œ’Ì«  Ê«·Ê›Êœ «·—”„Ì… „⁄ √⁄·Ï œ—Ã«  «·√„«‰ Ê«·ÂœÊ¡ œ«Œ· «·„ﬁ’Ê—….',
  },
  {
    id: 'tr-bus-4',
    name: 'Õ«›·… ﬂÊ ‘ VIP —ÊÌ«· (VIP Tour Coach)',
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
      ' ﬂÌÌ› ÂÊ«∆Ì',
      'Ê«Ì ›«Ì ”—Ì⁄',
      '”«∆ﬁ „Õ —›',
      'œÊ—… „Ì«Â',
      '‰Ÿ«„ ’Ê Ì ‰ﬁÌ',
      '≈÷«¡… „ÕÌÿÌ… Â«œ∆…',
    ],
    description:
      'Õ«›·… ”Ì«ÕÌ… —Õ»…  Ê›— —«Õ…  «„… √À‰«¡ «· ‰ﬁ· »Ì‰ «·„“«—«  Ê«·„⁄«·„ «·”Ì«ÕÌ… «·—∆Ì”Ì….',
  },
  {
    id: 'tr-bus-5',
    name: 'Õ«›·… Ã—«‰œ  —«›Ì· ≈ﬂ”ﬂÌÊ Ì› (Grand Travel Bus)',
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
      ' ﬂÌÌ› „—ﬂ“Ì',
      'Ê«Ì ›«Ì ›«∆ﬁ «·”—⁄…',
      '”«∆ﬁ „ „—”',
      'œÊ—… „Ì«Â',
      '‘«‘«  ⁄—÷ LED',
      '„‰«›– ‘Õ‰',
    ],
    description:
      'Õ«›·… «·”›— «·ÿÊÌ· «·„ „Ì“… »—Õ«»… «·„”«Õ«  »Ì‰ «·„ﬁ«⁄œ Ê≈„ﬂ«‰Ì«   —›ÌÂ „ ﬂ«„·… ··—ﬂ«».',
  },
  {
    id: 'tr-bus-6',
    name: 'Õ«›·… ”Ì«ÕÌ… ≈ﬂ”»—Ì” (Express Coach Bus)',
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
      ' ﬂÌÌ› ÂÊ«¡',
      'Ê«Ì ›«Ì',
      '”«∆ﬁ „⁄ „œ',
      '‰Ÿ«„ ’Ê Ì',
      '„”«Õ… √„ ⁄… ﬂ»Ì—…',
      '„ﬁ«⁄œ „—ÌÕ…',
    ],
    description:
      'Õ«›·… „ Ê«“‰… Ê⁄„·Ì… ·‰ﬁ· «·„Ã„Ê⁄«  »Ì‰ «·›‰«œﬁ Ê«·„ÿ«—«  Ê«·ÃÊ·«  «·ÌÊ„Ì… »ﬂ›«¡… ⁄«·Ì….',
  },
  {
    id: 'tr-bus-7',
    name: 'Õ«›·… —ÊÌ«· ≈·Ì€«‰” (Royal Elegance Bus)',
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
      ' ﬂÌÌ› „—ﬂ“Ì',
      'Ê«Ì ›«Ì ⁄«·Ì «·”—⁄…',
      '”«∆ﬁ VIP',
      'œÊ—… „Ì«Â',
      '„ﬁ«⁄œ Ã·œÌ… „—ÌÕ…',
      'À·«Ã… Ê„‘—Ê»« ',
      '‰Ê«›– »«‰Ê—«„Ì…',
    ],
    description:
      ' ’„Ì„ √‰Ìﬁ Ê ÃÂÌ“«  ›«∆ﬁ… «·ÃÊœ… ·—Õ·«  „„ ⁄… Ê≈ÿ·«·«  »«‰Ê—«„Ì… Œ·«»… ⁄·Ï √Ã„· «·„‰«Ÿ— «·ÿ»Ì⁄Ì….',
  },
  {
    id: 'tr-coaster-1',
    name: 'ﬂÊ” —  ÊÌÊ «  ‰›Ì–Ì (Toyota Coaster Executive)',
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
      ' ﬂÌÌ› ﬁÊÌ',
      'Ê«Ì ›«Ì',
      '”«∆ﬁ ”Ì«ÕÌ „Õ —›',
      '‰Ÿ«„ ’Ê Ì ‰ﬁÌ',
      '„”«Õ… Ê«”⁄… ··√ﬁœ«„',
      '√„«ﬂ‰ „Œ’’… ··Õﬁ«∆»',
    ],
    description:
      '«·ŒÌ«— «·√„À· ··„Ã„Ê⁄«  «·„ Ê”ÿ… Ê«·⁄«∆·«  «·ﬂ»Ì—…° ”ÂÊ·… Õ—ﬂ… Ê√ﬁ’Ï œ—Ã«  «·—«Õ… Ê«·„—Ê‰….',
  },
  {
    id: 'tr-coaster-2',
    name: 'ﬂÊ” — VIP »—Ì„ÌÊ„ (VIP Premium Coaster)',
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
      ' ﬂÌÌ› „ ÿÊ—',
      'Ê«Ì ›«Ì ”—Ì⁄',
      '”«∆ﬁ VIP Œ«’',
      '„ﬁ«⁄œ Ã·œÌ… ﬂ«» ‰ Ê«”⁄…',
      '„‰«›– ‘Õ‰ USB',
      '‰Ÿ«„ ’Ê Ì ›«∆ﬁ',
    ],
    description:
      '„ﬁ’Ê—… „Œ’’… ·—Ã«· «·√⁄„«· Ê«·„Ã„Ê⁄«  «·Œ«’… »„ﬁ«⁄œ ﬂ«» ‰ „—ÌÕ… Ê„”«Õ«  —Õ»… ··€«Ì….',
  },
  {
    id: 'tr-private-1',
    name: '”Ì«—… ›«Œ—… Œ«’… „⁄ ”«∆ﬁ (VIP Luxury Sedan & SUV)',
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
      ' ﬂÌÌ› ÂÊ«¡ ›«Œ—',
      '‰Ÿ«„ „·«Õ… GPS',
      'Ê”«∆œ ÂÊ«∆Ì… „ ÿÊ—…',
      'Ê«Ì ›«Ì „ ‰ﬁ·',
      '”«∆ﬁ Œ«’ »·»«” —”„Ì',
      '„ﬁ«⁄œ Ã·œÌ… ›«Œ—…',
      '„Ì«Â „⁄œ‰Ì… Ê÷Ì«›…',
    ],
    description:
      'Œœ„… «” ﬁ»«· Ê Ê’Ì· Œ«’… ›«Œ—… ·ﬂ»«— «·‘Œ’Ì«  Ê—Ã«· «·√⁄„«· „⁄ ”«∆ﬁ Œ«’ Ì ÕœÀ ⁄œ… ·€« .',
  },
];

export async function seedTransportationServices(prisma: PrismaClient): Promise<void> {
  console.log('\n?? Seeding canonical Transportation Fleet...');
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
      console.log(`  ? Created transportation service: ${vehicle.id} (${vehicle.name})`);
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
      console.log(`  ?? Updated transportation service: ${vehicle.id} (${vehicle.name})`);
    }
  }

  console.log(`  ?? Transportation fleet seed complete: ${created} created, ${updated} updated.`);
}
