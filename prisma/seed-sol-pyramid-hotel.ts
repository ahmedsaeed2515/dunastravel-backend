import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedSolPyramidHotel() {
  console.log('Seeding Sol Pyramid Hotel & Rooms into backend database with 5 languages...');

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
          en: "Solpyramid Hotel is a modern 3-star establishment designed for travellers who want to explore Egypt's major sights.",
          ar: "فندق سول بيراميد هو منشأة حديثة فئة 3 نجوم صممت للمسافرين الراغبين في استكشاف معالم مصر الرئيسية.",
          es: "El Hotel Solpyramid es un moderno establecimiento de 3 estrellas diseñado para viajeros que desean explorar los principales lugares de interés de Egipto.",
          it: "L'Hotel Solpyramid è una moderna struttura a 3 stelle progettata per i viaggiatori che desiderano esplorare le principali attrazioni dell'Egitto.",
          pt: "O Hotel Solpyramid é um estabelecimento moderno de 3 estrelas projetado para viajantes que desejam explorar as principais atrações do Egito.",
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
          en: "Solpyramid Hotel is a modern 3-star establishment designed for travellers who want to explore Egypt's major sights.",
          ar: "فندق سول بيراميد هو منشأة حديثة فئة 3 نجوم صممت للمسافرين الراغبين في استكشاف معالم مصر الرئيسية.",
          es: "El Hotel Solpyramid es un moderno establecimiento de 3 estrellas diseñado para viajeros que desean explorar los principales lugares de interés de Egipto.",
          it: "L'Hotel Solpyramid è una moderna struttura a 3 stelle progettata per i viaggiatori che desiderano esplorare le principali attrazioni dell'Egitto.",
          pt: "O Hotel Solpyramid é um estabelecimento moderno de 3 estrelas projetado para viajantes que desejam explorar as principais atrações do Egito.",
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

    console.log(`Upserted Hotel: ${hotel.id}`);

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
          overview: {
            en: 'Elegant double room with Pyramids view and 1 King Bed.',
            ar: 'غرفة دبل أنيقة بإطلالة مباشرة على الأهرامات وسرير ملكي.',
            es: 'Elegante habitación doble con vistas a las Pirámides y 1 cama King.',
            it: 'Elegante camera doppia con vista sulle Piramidi e 1 letto King.',
            pt: 'Elegante quarto duplo com vista para as Pirâmides e 1 cama King.',
          },
          bedType: {
            en: '1 King Bed',
            ar: '1 سرير كينج ملكي',
            es: '1 Cama King Size',
            pt: '1 Cama King',
            it: '1 Letto King',
          },
          viewType: {
            en: 'Pyramids View',
            ar: 'إطلالة على الأهرامات',
            es: 'Vista a las Pirámides',
            pt: 'Vista para as Pirâmides',
            it: 'Vista sulle Piramidi',
          },
          image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=1200',
          gallery: ['https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=1200'],
          amenities: ['wifi', 'ac', 'bathroom', 'minibar', 'coffee', 'linen', 'tv', 'safe'],
          smokingAllowed: false,
          petsAllowed: false,
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
          overview: {
            en: 'Comfortable twin room with double/twin beds and standard view.',
            ar: 'غرفة توين مريحة بأسرة مزدوجة وإطلالة قياسية.',
            es: 'Cómoda habitación twin con camas dobles/twin y vista estándar.',
            it: 'Accogliente camera twin con letti doppi/twin e vista standard.',
            pt: 'Confortável quarto twin com camas duplas/twin e vista padrão.',
          },
          bedType: {
            en: '2 Twin Beds',
            ar: '2 سرير مفرد (توين)',
            es: '2 Camas Individuales',
            pt: '2 Camas de Solteiro',
            it: '2 Letti Singoli',
          },
          viewType: {
            en: 'Garden / City View',
            ar: 'إطلالة على الحديقة / المدينة',
            es: 'Vista al Jardín / Ciudad',
            pt: 'Vista para o Jardim / Cidade',
            it: 'Vista Giardino / Città',
          },
          image: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?q=80&w=1200',
          gallery: ['https://images.unsplash.com/photo-1566665797739-1674de7a421a?q=80&w=1200'],
          amenities: ['wifi', 'ac', 'bathroom', 'minibar', 'coffee', 'linen', 'tv', 'safe'],
          smokingAllowed: false,
          petsAllowed: false,
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
          overview: {
            en: 'Spacious triple room ideal for families or groups of 3 guests.',
            ar: 'غرفة ثلاثية واسعة مثالية للعائلات أو المجموعات حتى 3 ضيوف.',
            es: 'Amplia habitación triple ideal para familias o grupos de 3 huéspedes.',
            it: 'Spaziosa camera tripla ideale per famiglie o gruppi di 3 ospiti.',
            pt: 'Espaçoso quarto triplo ideal para famílias ou grupos de 3 hóspedes.',
          },
          bedType: {
            en: '1 Double Bed + 1 Single Bed',
            ar: '1 سرير مزدوج + 1 سرير مفرد',
            es: '1 Cama Doble + 1 Cama Individual',
            pt: '1 Cama de Casal + 1 Cama de Solteiro',
            it: '1 Letto Matrimoniale + 1 Letto Singolo',
          },
          viewType: {
            en: 'Pyramids View',
            ar: 'إطلالة على الأهرامات',
            es: 'Vista a las Pirámides',
            pt: 'Vista para as Pirâmides',
            it: 'Vista sulle Piramidi',
          },
          image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=1200',
          gallery: ['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=1200'],
          amenities: ['wifi', 'ac', 'bathroom', 'minibar', 'coffee', 'linen', 'tv', 'safe', 'balcony'],
          smokingAllowed: false,
          petsAllowed: false,
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
      console.log(`Upserted Room: ${room.id} ($${room.ratePerNight}/night)`);
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
      description: {
        en: "Solpyramid Hotel is a modern 3-star establishment designed for travellers who want to explore Egypt's major sights.",
        ar: "فندق سول بيراميد هو منشأة حديثة فئة 3 نجوم صممت للمسافرين الراغبين في استكشاف معالم مصر الرئيسية.",
        es: "El Hotel Solpyramid es un moderno establecimiento de 3 estrellas diseñado para viajeros que desean explorar los principales lugares de interés de Egipto.",
        it: "L'Hotel Solpyramid è una moderna struttura a 3 stelle progettata per i viaggiatori che desiderano esplorare le principali attrazioni dell'Egitto.",
        pt: "O Hotel Solpyramid é um estabelecimento moderno de 3 estrelas projetado para viajantes que desejam explorar as principais atrações do Egito.",
      },
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
        data: { content: updatedList as unknown as import('@prisma/client').Prisma.InputJsonValue },
      });
      console.log('Updated CMS Block: hotels_catalog with multilingual Sol Pyramid Hotel');
    } else {
      await prisma.cmsBlock.upsert({
        where: { key: 'hotels_catalog' },
        update: { content: [solPyramidCmsItem] as unknown as import('@prisma/client').Prisma.InputJsonValue },
        create: {
          key: 'hotels_catalog',
          content: [solPyramidCmsItem] as unknown as import('@prisma/client').Prisma.InputJsonValue,
        },
      });
      console.log('Created CMS Block: hotels_catalog with multilingual Sol Pyramid Hotel');
    }

    console.log('Sol Pyramid Hotel 5-language backend seed finished successfully!');
  } catch (err) {
    console.error('Error seeding Sol Pyramid Hotel:', err);
  } finally {
    await prisma.$disconnect();
  }
}

seedSolPyramidHotel();
