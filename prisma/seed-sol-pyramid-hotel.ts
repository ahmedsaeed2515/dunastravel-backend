import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedSolPyramidHotel() {
  console.log('Seeding Sol Pyramid Hotel & Rooms into backend database...');

  try {
    const hotel = await prisma.hotel.upsert({
      where: { slug: 'sol-pyramid-hotel' },
      update: {
        nameJsonb: {
          en: 'Sol Pyramid Hotel',
          ar: 'فندق سول بيراميد',
          es: 'Hotel Sol Pyramid',
          pt: 'Hotel Sol Pyramid',
          it: 'Hotel Sol Pyramid',
        },
        descriptionJsonb: {
          en: "Solpyramid Hotel is a modern 3-star establishment built in 2025, designed for travellers who want to explore Egypt's greatest sights.",
          ar: 'فندق سول بيراميد هو منشأة حديثة فئة 3 نجوم تم إنشاؤها في عام 2025، مصممة للمسافرين الذين يرغبون في استكشاف أعظم معالم مصر.',
        },
        destinationSlug: 'egypt',
        city: 'Giza',
        stars: 3,
        rating: 5.0,
        currency: 'USD',
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
      },
      create: {
        slug: 'sol-pyramid-hotel',
        nameJsonb: {
          en: 'Sol Pyramid Hotel',
          ar: 'فندق سول بيراميد',
          es: 'Hotel Sol Pyramid',
          pt: 'Hotel Sol Pyramid',
          it: 'Hotel Sol Pyramid',
        },
        descriptionJsonb: {
          en: "Solpyramid Hotel is a modern 3-star establishment built in 2025, designed for travellers who want to explore Egypt's greatest sights.",
          ar: 'فندق سول بيراميد هو منشأة حديثة فئة 3 نجوم تم إنشاؤها في عام 2025، مصممة للمسافرين الذين يرغبون في استكشاف أعظم معالم مصر.',
        },
        destinationSlug: 'egypt',
        city: 'Giza',
        stars: 3,
        rating: 5.0,
        currency: 'USD',
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
      },
    });

    console.log(Upserted Hotel: \ (\));

    const rooms = [
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
        },
        ratePerNight: 85.0,
        maxOccupancy: 2,
        isActive: true,
      },
      {
        slug: 'twin-room',
        nameJsonb: {
          en: 'Twin Room',
          ar: 'غرفة توين (أسرة مزدوجة)',
          es: 'Habitación Twin',
          pt: 'Quarto Twin',
          it: 'Camera Twin',
        },
        descriptionJsonb: {
          en: 'Comfortable twin room with double/twin beds and standard view.',
          ar: 'غرفة توين مريحة بأسرة مزدوجة وإطلالة قياسية.',
        },
        ratePerNight: 85.0,
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
        },
        ratePerNight: 110.0,
        maxOccupancy: 3,
        isActive: true,
      },
    ];

    for (const roomData of rooms) {
      const room = await prisma.hotelRoom.upsert({
        where: {
          hotelId_slug: {
            hotelId: hotel.id,
            slug: roomData.slug,
          },
        },
        update: {
          nameJsonb: roomData.nameJsonb,
          descriptionJsonb: roomData.descriptionJsonb,
          ratePerNight: roomData.ratePerNight,
          maxOccupancy: roomData.maxOccupancy,
          isActive: roomData.isActive,
        },
        create: {
          hotelId: hotel.id,
          slug: roomData.slug,
          nameJsonb: roomData.nameJsonb,
          descriptionJsonb: roomData.descriptionJsonb,
          ratePerNight: roomData.ratePerNight,
          maxOccupancy: roomData.maxOccupancy,
          isActive: roomData.isActive,
        },
      });
      console.log(Upserted Room: \ (\$\/night));
    }

    const solPyramidCmsItem = {
      id: 'prog-hot-1',
      slug: 'sol-pyramid-hotel',
      name: 'Sol Pyramid Hotel',
      destination: 'egypt',
      city: 'Giza',
      stars: 3,
      rating: 5.0,
      pricePerNight: 85,
      image: 'https://www.solpyramid-egypt.com/wp-content/uploads/2022/08/Hotel.jpg',
      description: "Solpyramid Hotel is a modern 3-star establishment designed for travellers who want to explore Egypt's major sights.",
      amenities: [
        'Free Wi-Fi',
        'Air conditioning',
        'Private bathroom',
        'Mini bar',
        'Coffee & tea',
        'Free safe box',
      ],
    };

    const cmsBlock = await prisma.cmsBlock.findUnique({
      where: { key: 'hotels_catalog' },
    });

    if (cmsBlock && Array.isArray(cmsBlock.content)) {
      const existingList = cmsBlock.content as Array<Record<string, unknown>>;
      const updatedList = [
        solPyramidCmsItem,
        ...existingList.filter((item) => item.slug !== 'sol-pyramid-hotel' && item.id !== 'prog-hot-1'),
      ];

      await prisma.cmsBlock.update({
        where: { key: 'hotels_catalog' },
        data: { content: updatedList },
      });
      console.log('Updated CMS Block: hotels_catalog with Sol Pyramid Hotel');
    } else {
      await prisma.cmsBlock.upsert({
        where: { key: 'hotels_catalog' },
        update: { content: [solPyramidCmsItem] },
        create: {
          key: 'hotels_catalog',
          content: [solPyramidCmsItem],
        },
      });
      console.log('Created CMS Block: hotels_catalog with Sol Pyramid Hotel');
    }

    console.log('Sol Pyramid Hotel backend seed finished successfully!');
  } catch (err) {
    console.error('Error seeding Sol Pyramid Hotel:', err);
  } finally {
    await prisma.();
  }
}

seedSolPyramidHotel();
