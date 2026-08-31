import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:password@127.0.0.1:5432/dunastravel_db';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const LANDING_PAGES = [
  {
    slug: 'egypt',
    type: 'DESTINATION',
    titleJsonb: {
      en: 'Egypt',
      ar: 'مصر',
      es: 'Egipto',
      pt: 'Egito',
      it: 'Egitto',
    },
    subtitleJsonb: {
      en: 'Land of the Pharaohs',
      ar: 'أرض الفراعنة',
      es: 'Tierra de los Faraones',
      pt: 'Terra dos Faraós',
      it: 'Terra dei Faraoni',
    },
    descriptionJsonb: {
      en: 'From the timeless Pyramids of Giza to the golden temples of Luxor and the crystal waters of the Red Sea, Egypt offers a journey through history like no other.',
      ar: 'من أهرامات الجيزة الخالدة إلى معابد الأقصر الذهبية ومياه البحر الأحمر البلورية، تقدم مصر رحلة عبر التاريخ لا مثيل لها.',
      es: 'Desde las intemporales Pirámides de Guiza hasta los dorados templos de Luxor y las cristalinas aguas del Mar Rojo.',
      pt: 'Das intemporais Pirâmides de Gizé aos templos dourados de Luxor e às águas cristalinas do Mar Vermelho.',
      it: 'Dalle intramontabili Piramidi di Giza ai templi dorati di Luxor e alle acque cristalline del Mar Rosso.',
    },
    briefJsonb: {
      en: 'A civilisation that has captivated the world for millennia. Egypt blends monumental history with warm hospitality.',
      ar: 'حضارة أسرت العالم لآلاف السنين. تجمع مصر بين التاريخ العظيم وحفاوة الاستقبال.',
      es: 'Una civilización que ha cautivado al mundo durante milenios. Egipto combina historia monumental con cálida hospitalidad.',
      pt: 'Uma civilização que cativou o mundo durante milénios.',
      it: 'Una civiltà che ha affascinato il mondo per millenni.',
    },
    heroImageUrl: '/imgs/egyothero.png',
    seoTitleJsonb: {
      en: 'Luxury Egypt Tours & Vacations | Dunas Travel',
      ar: 'رحلات مصر الملكية والفاخرة | دوناس ترافيل',
      es: 'Tours y Viajes de Lujo en Egipto | Dunas Travel',
      pt: 'Viagens de Luxo no Egito | Dunas Travel',
      it: 'Tour di Lusso in Egitto | Dunas Travel',
    },
    seoDescriptionJsonb: {
      en: 'Discover Egypt in grand style with tailor-made luxury itineraries.',
      ar: 'اكتشف مصر بأسلوب ملكي فاخر مع برامج سفر مصممة خصيصاً.',
      es: 'Descubre Egipto a lo grande con itinerarios personalizados de lujo.',
      pt: 'Descubra o Egito com itinerários de luxo sob medida.',
      it: 'Scopri l\'Egitto con itinerari di lusso su misura.',
    },
    status: 'PUBLISHED',
    isActive: true,
    sortOrder: 1,
  },
  {
    slug: 'turkey',
    type: 'DESTINATION',
    titleJsonb: {
      en: 'Turkey',
      ar: 'تركيا',
      es: 'Turquía',
      pt: 'Turquia',
      it: 'Turchia',
    },
    subtitleJsonb: {
      en: 'Where East Meets West',
      ar: 'حيث يلتقي الشرق بالغرب',
      es: 'Donde el Oriente se encuentra con el Occidente',
      pt: 'Onde o Oriente encontra o Ocidente',
      it: 'Dove l\'Oriente incontra l\'Occidente',
    },
    descriptionJsonb: {
      en: 'From the majestic Hagia Sophia to the fairy chimneys of Cappadocia and the turquoise waters of the Aegean, Turkey bridges continents and millennia.',
      ar: 'من آيا صوفيا المهيبة إلى مداخن الجنيات في كابادوكيا والمياه الفيروزية وبحر إيجة.',
      es: 'Desde la majestuosa Santa Sofía hasta las chimeneas de hadas de Capadocia.',
      pt: 'Da majestosa Basílica de Santa Sofia às chaminés de fadas da Capadócia.',
      it: 'Dalla maestosa Basilica di Santa Sofia ai camini delle fate della Cappadocia.',
    },
    heroImageUrl: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=1920&q=80',
    seoTitleJsonb: {
      en: 'Luxury Turkey Tours & Vacations | Dunas Travel',
      ar: 'رحلات تركيا الفاخرة | دوناس ترافيل',
      es: 'Tours de Lujo en Turquía | Dunas Travel',
      pt: 'Tours de Luxo na Turquia | Dunas Travel',
      it: 'Tour di Lusso in Turchia | Dunas Travel',
    },
    status: 'PUBLISHED',
    isActive: true,
    sortOrder: 2,
  },
  {
    slug: 'jordan',
    type: 'DESTINATION',
    titleJsonb: {
      en: 'Jordan',
      ar: 'الأردن',
      es: 'Jordania',
      pt: 'Jordânia',
      it: 'Giordania',
    },
    subtitleJsonb: {
      en: 'The Rose-Red Kingdom',
      ar: 'المملكة الوردية',
      es: 'El Reino de la Ciudad Rosa',
      pt: 'O Reino Vermelho-Rosa',
      it: 'Il Regno Rosa-Rosso',
    },
    descriptionJsonb: {
      en: 'From the rose-red city of Petra to the otherworldly desert of Wadi Rum and the healing waters of the Dead Sea.',
      ar: 'من مدينة البتراء الوردية إلى صحراء وادي رم الساحرة والمياه الشافية للبحر الميت.',
      es: 'Desde la ciudad rosa de Petra hasta el desierto de Wadi Rum y las aguas curativas del Mar Muerto.',
      pt: 'Da cidade de Petra ao deserto de Wadi Rum e às águas do Mar Morto.',
      it: 'Dalla città rosa di Petra al deserto di Wadi Rum e al Mar Morto.',
    },
    heroImageUrl: 'https://cdn.al-ain.com/lg/images/2022/11/24/62-021616-best-tourist-areas-jordan-4.jpeg',
    status: 'PUBLISHED',
    isActive: true,
    sortOrder: 3,
  },
  {
    slug: 'morocco',
    type: 'DESTINATION',
    titleJsonb: {
      en: 'Morocco',
      ar: 'المغرب',
      es: 'Marruecos',
      pt: 'Marrocos',
      it: 'Marocco',
    },
    subtitleJsonb: {
      en: 'Kingdom of Color & Spice',
      ar: 'مملكة الألوان والتوابل',
      es: 'El Reino de los Colores y las Especias',
      pt: 'O Reino das Cores e Especiarias',
      it: 'Il Regno dei Colori e delle Spezie',
    },
    descriptionJsonb: {
      en: 'Explore imperial cities, vibrant souks, breathtaking Atlas mountains and desert dunes in luxury.',
      ar: 'استكشف المدن الإمبراطورية والأسواق النابضة وجبال الأطلس وجبال الصحراء.',
      es: 'Explora ciudades imperiales, zocos vibrantes y las dunas del Sahara.',
      pt: 'Explore cidades imperiais, souks vibrantes e as dunas do Saara.',
      it: 'Esplora le città imperiali, i vivaci souk e le dune del Sahara.',
    },
    heroImageUrl: 'https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?auto=format&fit=crop&w=1920&q=80',
    status: 'PUBLISHED',
    isActive: true,
    sortOrder: 4,
  },
  {
    slug: 'greece',
    type: 'DESTINATION',
    titleJsonb: {
      en: 'Greece',
      ar: 'اليونان',
      es: 'Grecia',
      pt: 'Grécia',
      it: 'Grecia',
    },
    subtitleJsonb: {
      en: 'Cradle of Antiquity',
      ar: 'مهد الحضارة القديمة',
      es: 'Cuna de la Antigüedad',
      pt: 'Berço da Antiguidade',
      it: 'Culla dell\'Antichità',
    },
    descriptionJsonb: {
      en: 'Immerse in ancient mythologies, stunning islands, Aegean sunsets and Mediterranean cuisine.',
      ar: 'انغمس في الأساطير القديمة والجزر الساحرة وغروب الشمس في إيجة.',
      es: 'Sumérgete en mitologías antiguas, islas impresionantes y puestas de sol en el Egeo.',
      pt: 'Mergulhe em mitologias antigas e ilhas deslumbrantes.',
      it: 'Immergiti nelle mitologie antiche e nelle splendide isole.',
    },
    heroImageUrl: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1920&q=80',
    status: 'PUBLISHED',
    isActive: true,
    sortOrder: 5,
  },
  {
    slug: 'dubai',
    type: 'DESTINATION',
    titleJsonb: {
      en: 'Dubai',
      ar: 'دبي',
      es: 'Dubái',
      pt: 'Dubai',
      it: 'Dubai',
    },
    subtitleJsonb: {
      en: 'Futuristic Luxury & Desert Wonders',
      ar: 'الفخامة المستقبلية وعجائب الصحراء',
      es: 'Lujo Futuro y Maravillas del Desierto',
      pt: 'Luxo Futurista e Maravilhas do Deserto',
      it: 'Lusso Futuristico e Meraviglie del Deserto',
    },
    descriptionJsonb: {
      en: 'Experience ultra-modern architecture, high-end shopping, luxury desert safaris and world-class attractions.',
      ar: 'استمتع بالمعمار الحديث والتسوق الفاخر ورحلات الصحراء المتميزة.',
      es: 'Disfruta de arquitectura ultra moderna y compras de alto nivel.',
      pt: 'Experimente arquitetura ultra moderna e compras de luxo.',
      it: 'Vivi l\'architettura ultra moderna e lo shopping di lusso.',
    },
    heroImageUrl: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1920&q=80',
    status: 'PUBLISHED',
    isActive: true,
    sortOrder: 6,
  },
  {
    slug: 'tunisia',
    type: 'DESTINATION',
    titleJsonb: {
      en: 'Tunisia',
      ar: 'تونس',
      es: 'Túnez',
      pt: 'Tunísia',
      it: 'Tunisia',
    },
    subtitleJsonb: {
      en: 'Mediterranean Heritage & Sahara Oasis',
      ar: 'التراث المتوسطي وواحات الصحراء',
      es: 'Patrimonio Mediterráneo y Oasis del Sahara',
      pt: 'Património Mediterrâneo e Oásis do Saara',
      it: 'Patrimonio Mediterraneo e Oasi del Sahara',
    },
    descriptionJsonb: {
      en: 'Discover ancient Carthage, blue-and-white Sidi Bou Said, Saharan oasis towns and golden beaches.',
      ar: 'اكتشف قرطاج القديمة وسيدي بوسعيد والواحات الصحراوية والشواطئ الذهبية.',
      es: 'Descubre la antigua Cartago, Sidi Bou Said y los oasis del Sahara.',
      pt: 'Descubra a antiga Cartago, Sidi Bou Said e os oásis do Saara.',
      it: 'Scopri l\'antica Cartagine, Sidi Bou Said e le oasi del Sahara.',
    },
    heroImageUrl: 'https://images.unsplash.com/photo-1589139264847-75f850259e8b?auto=format&fit=crop&w=1920&q=80',
    status: 'PUBLISHED',
    isActive: true,
    sortOrder: 7,
  },
  {
    slug: 'holyland',
    type: 'DESTINATION',
    titleJsonb: {
      en: 'Holy Land',
      ar: 'الأراضي المقدسة',
      es: 'Tierra Santa',
      pt: 'Terra Santa',
      it: 'Terra Santa',
    },
    subtitleJsonb: {
      en: 'Sacred Pilgrimages & Spiritual Journeys',
      ar: 'رحلات الحج والمزارات المقدسة',
      es: 'Peregrinaciones Sagradas y Viajes Espirituales',
      pt: 'Peregrinações Sagradas e Viagens Espirituais',
      it: 'Pellegrinaggi Sacri e Viaggi Spirituali',
    },
    descriptionJsonb: {
      en: 'Walk through historic sacred sites in Jerusalem, Bethlehem, Nazareth, Mount Nebo and ancient monasteries.',
      ar: 'قم بزيارة الأماكن المقدسة التاريخية في القدس وبيت لحم والناصرة وجبل نيبو.',
      es: 'Recorre sitios sagrados históricos en Jerusalén, Belén, Nazaret y el Monte Nebo.',
      pt: 'Caminhe por locais sagrados históricos em Jerusalém e Belém.',
      it: 'Cammina attraverso i luoghi sacri storici a Gerusalemme e Betlemme.',
    },
    heroImageUrl: 'https://www.holylandmaptours.com/wp-content/uploads/2023/02/Jerusalem-01-800x600.webp',
    status: 'PUBLISHED',
    isActive: true,
    sortOrder: 8,
  },
  {
    slug: 'multi-country',
    type: 'THEME',
    titleJsonb: {
      en: 'Multi-Country Tours',
      ar: 'برامج الجولات متعددة الدول',
      es: 'Tours Multi-País',
      pt: 'Tours Multi-Países',
      it: 'Tour Multi-Paese',
    },
    subtitleJsonb: {
      en: 'Epic Cross-Border Odysseys',
      ar: 'رحلات عبر الحدود ملحمية',
      es: 'Odiseas Transfronterizas Épicas',
      pt: 'Odisséias Transfronteiriças Épicas',
      it: 'Odissee Transfrontaliere Epiche',
    },
    descriptionJsonb: {
      en: 'Combine two or three iconic destinations (Egypt & Jordan, Egypt & Turkey, Jordan & Holy Land) in one seamless luxury itinerary.',
      ar: 'اجمع بين وجهتين أو ثلاث وجهات (مصر والأردن، مصر وتركيا) في برامج سياحية متكاملة.',
      es: 'Combina dos o tres destinos icónicos en un itinerario de lujo sin interrupciones.',
      pt: 'Combine dois ou três destinos icónicos num itinerário de luxo.',
      it: 'Combina due o tre destinazioni iconiche in un unico itinerario di lusso.',
    },
    heroImageUrl: '/imgs/multicountryhero.png',
    status: 'PUBLISHED',
    isActive: true,
    sortOrder: 9,
  },
  {
    slug: 'religious',
    type: 'THEME',
    titleJsonb: {
      en: 'Religious & Pilgrimage Programs',
      ar: 'البرامج الدينية والحج',
      es: 'Programas Religiosos y Peregrinaciones',
      pt: 'Programas Religiosos e Peregrinações',
      it: 'Programmi Religiosi e Pellegrinaggi',
    },
    subtitleJsonb: {
      en: 'Spiritual Footsteps & Ancient Monasteries',
      ar: 'على خطى الأنبياء والديرة القديمة',
      es: 'Pasos Espirituales y Monasterios Antiguos',
      pt: 'Passos Espirituais e Monastérios Antigos',
      it: 'Passi Spirituali e Antichi Monasteri',
    },
    descriptionJsonb: {
      en: 'Embark on sacred journeys through ancient Coptic monasteries in Egypt, Saint Catherine, Mount Sinai and Holy Land sites.',
      ar: 'انطلق في رحلات إيمانية زيارة الأديرة القبطية ودير سانت كاترين وجبل موسى.',
      es: 'Embarca en viajes sagrados a través de monasterios cópticos y sitios sagrados.',
      pt: 'Embarque em viagens sagradas por monastérios cópticos.',
      it: 'Parti per viaggi sacri attraverso antichi monasteri copti.',
    },
    heroImageUrl: 'https://www.holylandmaptours.com/wp-content/uploads/2023/02/Jerusalem-01-800x600.webp',
    status: 'PUBLISHED',
    isActive: true,
    sortOrder: 10,
  },
  {
    slug: 'honeymooners',
    type: 'THEME',
    titleJsonb: {
      en: 'Honeymooners Package',
      ar: 'باقات شهر العسل',
      es: 'Paquetes de Luna de Miel',
      pt: 'Pacotes de Lua de Mel',
      it: 'Pacchetti Luna di Miele',
    },
    subtitleJsonb: {
      en: 'Love Stories Begin Here',
      ar: 'قصص الحب تبدأ هنا',
      es: 'Las Historias de Amor Comienzan Aquí',
      pt: 'Histórias de Amor Começam Aqui',
      it: 'Le Storie d\'Amore Iniziano Qui',
    },
    descriptionJsonb: {
      en: 'Let us craft the most romantic chapter of your life. From timeless pyramids to romantic Nile cruises and Red Sea resorts.',
      ar: 'دعنا نصنع أجمل فصول حياتك الرومانسية من الأهرامات إلى رحلات النيل وبحر الجمال.',
      es: 'Déjanos diseñar el capítulo más romántico de tu vida. Desde pirámides atemporales hasta cruceros románticos por el Nilo y resorts del Mar Rojo.',
      pt: 'Deixe-nos criar o capítulo mais romântico da sua vida. Das pirâmides intemporais aos cruzeiros românticos no Nilo e resorts no Mar Vermelho.',
      it: 'Lasciati creare il capitolo più romantico della tua vita. Dalle piramidi senza tempo alle crociere romantiche sul Nilo e ai resort del Mar Rosso.',
    },
    heroImageUrl: 'https://hl-tourism.com/media/typecms/Honeymoon_Planning_Guide_2025_Complete_Resource.webp',
    status: 'PUBLISHED',
    isActive: true,
    sortOrder: 11,
  },
];

async function main() {
  console.log('Seeding Tour Landing Pages...');

  for (const item of LANDING_PAGES) {
    const createdOrUpdated = await prisma.tourLandingPage.upsert({
      where: { slug: item.slug },
      create: {
        slug: item.slug,
        type: item.type,
        titleJsonb: item.titleJsonb,
        subtitleJsonb: item.subtitleJsonb,
        descriptionJsonb: item.descriptionJsonb,
        briefJsonb: item.briefJsonb,
        heroImageUrl: item.heroImageUrl,
        seoTitleJsonb: item.seoTitleJsonb || item.titleJsonb,
        seoDescriptionJsonb: item.seoDescriptionJsonb || item.descriptionJsonb,
        status: item.status,
        isActive: item.isActive,
        sortOrder: item.sortOrder,
      },
      update: {
        type: item.type,
        status: item.status,
        isActive: item.isActive,
        sortOrder: item.sortOrder,
      },
    });

    console.log(`Upserted Landing Page: ${createdOrUpdated.slug} (${createdOrUpdated.id})`);
  }

  // Also auto-assign existing tours to their destination landing pages
  const tours = await prisma.tour.findMany({ where: { deletedAt: null } });
  console.log(`Found ${tours.length} existing tours in DB to check for auto-assignment.`);

  for (const tour of tours) {
    const country = tour.country ? tour.country.toLowerCase() : '';
    const category = tour.category ? tour.category.toLowerCase() : '';
    const slug = tour.slug.toLowerCase();

    const targetSlugs: string[] = [];
    if (country.includes('egypt') || country.includes('مصر')) targetSlugs.push('egypt');
    if (country.includes('turkey') || country.includes('تركيا') || country.includes('turquia')) targetSlugs.push('turkey');
    if (country.includes('jordan') || country.includes('الأردن') || country.includes('jordania')) targetSlugs.push('jordan');
    if (country.includes('morocco') || country.includes('المغرب') || country.includes('marruecos')) targetSlugs.push('morocco');
    if (country.includes('greece') || country.includes('اليونان') || country.includes('grecia')) targetSlugs.push('greece');
    if (country.includes('dubai') || country.includes('دبي') || country.includes('uae')) targetSlugs.push('dubai');
    if (country.includes('tunisia') || country.includes('تونس')) targetSlugs.push('tunisia');
    if (country.includes('holyland') || country.includes('الأراضي المقدسة') || category.includes('holy')) targetSlugs.push('holyland');

    if (category.includes('multi') || slug.includes('multi')) targetSlugs.push('multi-country');
    if (category.includes('religious') || category.includes('coptic') || slug.includes('religious')) targetSlugs.push('religious');
    if (category.includes('honeymoon') || slug.includes('honeymoon')) targetSlugs.push('honeymooners');

    for (const targetSlug of targetSlugs) {
      const lp = await prisma.tourLandingPage.findUnique({ where: { slug: targetSlug } });
      if (lp) {
        await prisma.tourLandingPageTour.upsert({
          where: { landingPageId_tourId: { landingPageId: lp.id, tourId: tour.id } },
          create: {
            landingPageId: lp.id,
            tourId: tour.id,
            isFeatured: tour.isFeatured,
            isVisible: true,
          },
          update: {},
        });
        console.log(`Attached Tour '${tour.slug}' to Landing Page '${lp.slug}'`);
      }
    }
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
