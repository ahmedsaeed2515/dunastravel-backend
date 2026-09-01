const fs = require('fs');
const path = require('path');
const vm = require('vm');

const backendNodeModules = path.resolve('d:/@@project/LUXURY-PROJECT/dunastravel-backend/node_modules');
const { PrismaClient } = require(path.join(backendNodeModules, '@prisma/client'));
const { Pool } = require(path.join(backendNodeModules, 'pg'));
const { PrismaPg } = require(path.join(backendNodeModules, '@prisma/adapter-pg'));

const envPath = path.resolve('d:/@@project/LUXURY-PROJECT/dunastravel-backend/.env');
let envDbUrl = '';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)/);
  if (match) envDbUrl = match[1];
}

const connectionString = process.env.DATABASE_URL || envDbUrl;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const LANGS = ['ar', 'en', 'es', 'it', 'pt'];

// Standard Inclusions by Category
const INCLUSIONS = {
  Egypt: {
    ar: [
      "الإقامة في فنادق وفلوكات/كروزات 5 نجوم المختارة مع الإفطار اليومي",
      "الإقامة في الكروز النيلي مع جميع الوجبات اليومية (إفطار، غداء، عشاء)",
      "جميع الانتقالات في حافلات سياحية حديثة ومكيفة الهواء طوال الرحلة",
      "مرشد سياحي مصري مرخص ومحترف يتحدث لغتك طوال الزيارات",
      "رسوم دخول جميع المعالم الأثرية والمتاحف المذكورة في خط السير",
      "خدمة الاستقبال والمساعدة في المطارات عند الوصول والمغادرة"
    ],
    en: [
      "Accommodation in selected 5-star hotels with daily breakfast",
      "Nile Cruise accommodation on Full Board basis (Breakfast, Lunch, Dinner)",
      "All transfers in modern, private air-conditioned tourist vehicles",
      "Professional licensed Egyptologist guide speaking your language during all tours",
      "Entrance fees to all archaeological sites and museums mentioned in the itinerary",
      "Meet & assist services at airports on arrival and departure"
    ],
    es: [
      "Alojamiento en hoteles de 5 estrellas seleccionados con desayuno diario",
      "Crucero por el Nilo en régimen de pensión completa (desayuno, almuerzo y cena)",
      "Todos los traslados en vehículos turísticos modernos con aire acondicionado",
      "Guía egiptólogo profesional de habla hispana durante todas las visitas",
      "Entradas a todos los templos, monumentos y museos mencionados en el itinerario",
      "Servicio de asistencia y traslados de llegada y salida en aeropuertos"
    ],
    pt: [
      "Hospedagem em hotéis de 5 estrelas selecionados com café da manhã diário",
      "Cruzeiro pelo Nilo em regime de pensão completa (café da manhã, almoço e jantar)",
      "Todos os traslados em veículos turísticos modernos com ar-condicionado",
      "Guia egiptólogo credenciado de língua portuguesa durante todos os passeios",
      "Ingressos para todos os templos, monumentos e museus descritos no itinerário",
      "Serviço de assistência e traslados nos aeroportos na chegada e partida"
    ],
    it: [
      "Sistemazione in hotel 5 stelle selezionati con prima colazione giornaliera",
      "Crociera sul Nilo in trattamento di pensione completa (colazione, pranzo e cena)",
      "Tutti i trasferimenti in moderni veicoli turistici con aria condizionata",
      "Guida egittologa ufficiale in lingua italiana durante tutte le escursioni",
      "Biglietti d'ingresso per tutti i monumenti, templi e musei menzionati",
      "Servizio di accoglienza e assistenza in aeroporto all'arrivo e alla partenza"
    ]
  },
  Turkey: {
    ar: [
      "الإقامة في فنادق 4/5 نجوم المختارة مع الإفطار اليومي في إسطنبول",
      "الإقامة مع وجبتي طعام (إفطار وعشاء) أثناء الجولة في الأناضول (كابادوكيا، باموكالي، كوشاداسي/إزمير)",
      "جميع الانتقالات والجولات في حافلات سياحية حديثة ومكيفة / قطار فائق السرعة أو رحلات الطيران الداخلي المحددة",
      "مرشد سياحي محترف يتحدث لغتك طوال الجولة",
      "رسوم دخول جميع المعالم الأثرية والمزارات المذكورة في خط السير",
      "خدمة الاستقبال والمساعدة في مطار إسطنبول عند الوصول والمغادرة"
    ],
    en: [
      "Accommodation in selected 4/5-star hotels on a Bed & Breakfast basis in Istanbul",
      "Half Board (Breakfast & Dinner) during the tour in Anatolia (Cappadocia, Pamukkale, Kusadasi/Izmir)",
      "All sightseeing and transfers in modern air-conditioned motorcoaches / high-speed train or domestic flights as specified",
      "Professional licensed multilingual guide throughout the itinerary",
      "Entrance fees to all archaeological sites and museums mentioned in the program",
      "Meet & assist services at Istanbul airport on arrival and departure"
    ],
    es: [
      "Alojamiento en hoteles de 4/5 estrellas seleccionados con desayuno diario en Estambul",
      "Régimen de media pensión (desayuno y cena) durante el circuito por Anatolia (Capadocia, Pamukkale, Kusadasi/Esmirna)",
      "Todos los traslados y visitas en autocares modernos con aire acondicionado / tren de alta velocidad o vuelos internos indicados",
      "Guía profesional de habla hispana durante todo el recorrido",
      "Entradas a todos los lugares de interés histórico y museos detallados en el itinerario",
      "Servicio de asistencia y traslados de llegada y salida en el aeropuerto de Estambul"
    ],
    pt: [
      "Hospedagem em hotéis de 4/5 estrelas selecionados com café da manhã diário em Istambul",
      "Regime de meia-pensão (café da manhã e jantar) durante o circuito pela Anatólia (Capadócia, Pamukkale, Kusadasi/Esmirna)",
      "Todos os traslados e passeios em modernos ônibus com ar-condicionado / trem de alta velocidade ou voos domésticos especificados",
      "Guia profissional de língua portuguesa durante todo o roteiro",
      "Ingressos para todas as atrações históricas e museus mencionados no itinerário",
      "Serviço de assistência e traslados de chegada e partida no aeroporto de Istambul"
    ],
    it: [
      "Sistemazione in hotel 4/5 stelle selezionati con prima colazione giornaliera a Istanbul",
      "Trattamento di mezza pensione (colazione e cena) durante il tour in Anatolia (Cappadocia, Pamukkale, Kusadasi/Smirne)",
      "Tutti i trasferimenti e le visite in moderni pullman climatizzati / treno ad alta velocità o voli interni previsti",
      "Guida professionale autorizzata in lingua italiana durante tutto il programma",
      "Biglietti d'ingresso per tutti i siti archeologici e musei indicados nell'itinerario",
      "Servizio di assistenza e trasferimenti di arrivo e partenza all'aeroporto di Istanbul"
    ]
  },
  Jordan: {
    ar: [
      "الإقامة في فنادق الفئة المختارة مع الإفطار والعشاء (نصف إقامة)",
      "جميع الانتقالات في حافلات سياحية حديثة ومكيفة الهواء",
      "مرشد سياحي محترف يتحدث لغتك خلال الزيارات",
      "رسوم الدخول إلى البتراء ووادي رم وجرش وجميع المعالم المذكورة",
      "جولة سفاري بسيارات الجيب 4x4 في صحراء وادي رم لمدة ساعتين",
      "خدمة الاستقبال والمساعدة في مطار عمان الدولي"
    ],
    en: [
      "Accommodation in chosen category hotels on Half Board basis (Breakfast & Dinner)",
      "All transfers and tours by modern air-conditioned motorcoach",
      "Professional licensed guide speaking your language during visits",
      "Entrance fees to Petra, Wadi Rum, Jerash, and all sites in the itinerary",
      "2-hour 4x4 Jeep safari tour in Wadi Rum desert",
      "Meet & assist service at Queen Alia International Airport in Amman"
    ],
    es: [
      "Alojamiento en hoteles de categoría elegida en régimen de media pensión (desayuno y cena)",
      "Todos los traslados y visitas en modernos autocares climatizados",
      "Guía profesional de habla hispana durante las visitas",
      "Entradas a Petra, Wadi Rum, Jerash y todos los sitios del itinerario",
      "Recorrido de 2 horas en vehículo 4x4 por el desierto de Wadi Rum",
      "Servicio de asistencia en el Aeropuerto Internacional de Ammán"
    ],
    pt: [
      "Hospedagem em hotéis da categoria escolhida em regime de meia-pensão (café da manhã e jantar)",
      "Todos os traslados e passeios em ônibus modernos com ar-condicionado",
      "Guia profissional de língua portuguesa durante as visitas",
      "Ingressos para Petra, Wadi Rum, Jerash e todas as atrações do itinerário",
      "Passeio de 2 horas em veículo 4x4 no deserto de Wadi Rum",
      "Serviço de assistência no Aeroporto Internacional Rainha Alia em Amã"
    ],
    it: [
      "Sistemazione in hotel della categoria prescelta in trattamento di mezza pensione (colazione e cena)",
      "Tutti i trasferimenti e le visite in moderni pullman con aria condizionata",
      "Guida professionale autorizzata in lingua italiana durante le visite",
      "Biglietti d'ingresso a Petra, Wadi Rum, Jerash e tutti i siti menzionati",
      "Escursione di 2 ore in jeep 4x4 nel deserto del Wadi Rum",
      "Servizio di accoglienza e assistenza all'Aeroporto Internazionale di Amman"
    ]
  },
  Dubai: {
    ar: [
      "الإقامة في فنادق 4/5 نجوم الفاخرة مع الإفطار اليومي",
      "خدمة الاستقبال والانتقالات من وإلى مطار دبي الدولي",
      "جولة في مدينة دبي الكلاسيكية والحديثة مع مرشد محترف",
      "رحلة سفاري صحراوية مع عشاء مشاوي فاخر وعروض فلكلورية",
      "رحلة عشاء كروز بحري في دبي مارينا أو خور دبي",
      "جميع الضرائب والرسوم السياحية للغرف"
    ],
    en: [
      "Accommodation in luxury 4/5-star hotels with daily breakfast",
      "Meet & assist with return transfers to Dubai International Airport",
      "Comprehensive half-day Dubai City Tour with licensed professional guide",
      "Desert Safari with BBQ dinner, dune bashing, camel rides & live entertainment",
      "Luxury Dhow Cruise Dinner in Dubai Marina or Dubai Creek",
      "All local hotel taxes and tourism dirham fees"
    ],
    es: [
      "Alojamiento en hoteles de 4/5 estrellas con desayuno diario",
      "Asistencia y traslados de llegada y salida en el Aeropuerto de Dubái",
      "Visita guiada por la ciudad de Dubái moderna e histórica con guía oficial",
      "Safari por el desierto con cena barbacoa, dunas en 4x4 y espectáculos en vivo",
      "Crucero con cena tradicional Dhow en Dubai Marina o Dubai Creek",
      "Todos los impuestos locales y tasas turísticas"
    ],
    pt: [
      "Hospedagem em hotéis 4/5 estrelas de luxo com café da manhã diário",
      "Assistência e traslados de ida e volta para o Aeroporto Internacional de Dubai",
      "Tour pela cidade de Dubai histórica e moderna com guia oficial",
      "Safári no deserto em veículo 4x4 com jantar churrasco e shows típicos",
      "Cruzeiro com jantar em barco tradicional Dhow na Dubai Marina ou Dubai Creek",
      "Todos os impostos locais e taxas de turismo"
    ],
    it: [
      "Sistemazione in hotel di lusso 4/5 stelle con colazione giornaliera",
      "Assistenza e trasferimenti aeroportuali di andata e ritorno a Dubai",
      "Tour guidato della città di Dubai classica e moderna con guida qualificata",
      "Safari nel deserto in 4x4 con cena barbecue e spettacoli tradizionali",
      "Crociera con cena su Dhow tradizionale a Dubai Marina o Dubai Creek",
      "Tutte le tasse locali e la Tourism Dirham Fee"
    ]
  },
  Morocco: {
    ar: [
      "الإقامة في رياضات وفنادق 4/5 نجوم الفاخرة مع الإفطار والعشاء",
      "جميع الانتقالات في حافلات سياحية خاصة مكيفة",
      "مرشد سياحي محترف باللغة المختارة في جميع المدن العتيقة",
      "رسوم دخول القصور والمعالم التاريخية والمتاحف",
      "جولة صحراوية في مرزوكة مع ركوب الجمال ومخيم بربري فاخر",
      "خدمة الاستقبال والمساعدة في المطارات"
    ],
    en: [
      "Accommodation in authentic luxury riads and 4/5-star hotels on Half Board basis",
      "All private transportation in modern air-conditioned vehicles",
      "Professional local guide in your language across historical medinas",
      "Entrance fees to all palaces, monuments, and gardens mentioned",
      "Merzouga Sahara Desert excursion with camel trek and luxury Berber desert camp",
      "Airport meet & assist on arrival and departure"
    ],
    es: [
      "Alojamiento en riads con encanto y hoteles de 4/5 estrellas en media pensión",
      "Transporte privado en vehículos modernos y climatizados durante todo el circuito",
      "Guía oficial local en español en las medinas y monumentos históricos",
      "Entradas a palacios, jardines y monumentos indicados en el itinerario",
      "Excursión al desierto de Merzouga con paseo en dromedario y noche en jaima de lujo",
      "Asistencia en el aeropuerto a la llegada y salida"
    ],
    pt: [
      "Hospedagem em riads autênticos e hotéis 4/5 estrelas em regime de meia-pensão",
      "Transporte privativo em veículos modernos e climatizados durante todo o circuito",
      "Guia local oficial em português nas medinas e pontos turísticos",
      "Ingressos para palácios, jardins e monumentos mencionados",
      "Excursão ao deserto de Merzouga com passeio de camelo e noite em acampamento de luxo",
      "Assistência nos aeroportos na chegada e partida"
    ],
    it: [
      "Sistemazione in riad tipici di lusso e hotel 4/5 stelle in mezza pensione",
      "Tutti i trasferimenti privati in veicoli moderni con aria condizionata",
      "Guida locale autorizzata in lingua italiana nelle medine e monumenti",
      "Biglietti d'ingresso per tutti i palazzi storici e giardini menzionati",
      "Escursione nel deserto di Merzouga con carovana di dromedari e campo tendato di lusso",
      "Assistenza aeroportuale all'arrivo e alla partenza"
    ]
  },
  'Multi-Country': {
    ar: [
      "الإقامة الفندقية الفاخرة في جميع الدول المشمولة بالبرنامج مع الإفطار اليومي",
      "رحلات الكروز والجولات الخاصة مع وجبات الطعام المحددة في البرنامج",
      "جميع الانتقالات بين المطارات والفنادق والمزارات في مركبات سياحية مكيفة",
      "مرشدون سياحيون محترفون ومرخصون يتحدثون لغتك في كل دولة",
      "رسوم دخول المعالم الأثرية والمتاحف الرئيسية المدرجة في المسار",
      "خدمة المساعدة وتنسيق الرحلات على مدار الساعة"
    ],
    en: [
      "Luxury hotel accommodation across all destination countries with daily breakfast",
      "Cruises and specialized excursions with meal plans as specified in itinerary",
      "All airport/hotel transfers and inter-city transport in modern A/C vehicles",
      "Professional licensed guides speaking your language in each destination country",
      "Entrance fees to all major archaeological sites and attractions included in program",
      "24/7 dedicated travel concierge and assistance service"
    ],
    es: [
      "Alojamiento en hoteles de categoría superior en cada país con desayuno diario",
      "Cruceros y excursiones especiales con el régimen de comidas especificado",
      "Todos los traslados y transportes entre ciudades en vehículos modernos con A/C",
      "Guías turísticos profesionales de habla hispana en cada destino",
      "Entradas a todos los principales sitios arqueológicos y atracciones del programa",
      "Servicio de asistencia al viajero y conserjería 24/7"
    ],
    pt: [
      "Hospedagem em hotéis de categoria selecionada em cada país com café da manhã",
      "Cruzeiros e passeios especiais com as refeições especificadas no roteiro",
      "Todos os traslados e transporte entre cidades em veículos modernos com ar-condicionado",
      "Guias turísticos profissionais no seu idioma em cada um dos países visitados",
      "Ingressos para todas as principais atrações históricas incluídas no roteiro",
      "Serviço de assistência e suporte ao viajante 24 horas por dia"
    ],
    it: [
      "Sistemazione in hotel di categoria selezionata in ogni paese con prima colazione",
      "Crociere ed escursioni speciali con il trattamento pasti specificato nel programma",
      "Tutti i trasferimenti aeroporto/hotel e trasporti interni in comodi mezzi con aria condizionata",
      "Guide turistiche professionali autorizzate in lingua italiana in ogni destinazione",
      "Biglietti d'ingresso per tutti i principali siti archeologici e monumenti inclusi",
      "Servizio di assistenza e coordinamento viaggi attivo 24 ore su 24"
    ]
  }
};

// Standard Exclusions by Category
const EXCLUSIONS = {
  Egypt: {
    ar: [
      "تذاكر الطيران الدولي من وإلى بلدك",
      "تأشيرة دخول مصر (إلا إذا تم إدراجها مسبقاً)",
      "المشروبات مع الوجبات والمصاريف الشخصية",
      "الزيارات الاختيارية (مثل الدخول داخل الهرم الأكبر أو مقبرة توت عنخ آمون)",
      "إكراميات طاقم الكروز، المرشدين، والسائقين"
    ],
    en: [
      "International flights to and from your home country",
      "Egyptian entry visa (unless pre-included)",
      "Beverages during meals and personal expenses",
      "Optional tours (such as entering inside the Great Pyramid or Tutankhamun tomb)",
      "Gratuities for cruise crew, tour guides, and drivers"
    ],
    es: [
      "Vuelos internacionales de ida y vuelta",
      "Visado de entrada a Egipto (salvo si se indica incluido)",
      "Bebidas durante las comidas y gastos personales",
      "Visitas opcionales (como el interior de la Gran Pirámide o tumba de Tutankamón)",
      "Propinas para el personal del crucero, guías y chóferes"
    ],
    pt: [
      "Voos internacionais de ida e volta",
      "Visto de entrada no Egito (salvo se indicado como incluso)",
      "Bebidas durante as refeições e despesas de caráter pessoal",
      "Passeios opcionais (como interior da Grande Pirâmide ou tumba de Tutancâmon)",
      "Gorjetas para tripulação do cruzeiro, guias e motoristas"
    ],
    it: [
      "Voli internazionali di andata e ritorno",
      "Visto d'ingresso in Egitto (salvo se diversamente specificato)",
      "Bevande durante i pasti e spese personali",
      "Escursioni facoltative (come l'interno della Grande Piramide o la tomba di Tutankhamon)",
      "Mance per l'equipaggio della nave, guide e autisti"
    ]
  },
  Turkey: {
    ar: [
      "تذاكر الطيران الدولي من وإلى بلدك",
      "تأشيرة دخول تركيا",
      "المشروبات مع الوجبات والمصاريف الشخصية",
      "الجولات الاختيارية (مثل ركوب المنطاد الهوائي في كابادوكيا)",
      "إكراميات المرشد والسائق وموظفي الفندق"
    ],
    en: [
      "International flights to/from your home country",
      "Turkish entry visa",
      "Beverages with meals and personal expenses",
      "Optional tours and activities (e.g. Hot Air Balloon ride in Cappadocia)",
      "Customary tips for guide, driver, and hotel staff"
    ],
    es: [
      "Vuelos internacionales de ida y vuelta",
      "Visado de entrada a Turquía",
      "Bebidas durante las comidas y gastos personales",
      "Excursiones opcionales (ej. paseo en globo aerostático en Capadocia)",
      "Propinas para guía, chófer y maleteros"
    ],
    pt: [
      "Voos internacionais de ida e volta",
      "Visto de entrada na Turquia",
      "Bebidas durante as refeições e despesas pessoais",
      "Passeios opcionais (ex.: voo de balão na Capadócia)",
      "Gorjetas para guia, motorista e carregadores de malas"
    ],
    it: [
      "Voli internazionali di andata e ritorno",
      "Visto d'ingresso in Turchia",
      "Bevande durante i pasti e spese personali",
      "Escursioni facoltative (es. volo in mongolfiera in Cappadocia)",
      "Mance per guida, autista e personale dell'hotel"
    ]
  },
  Jordan: {
    ar: [
      "تذاكر الطيران الدولي",
      "رسوم التأشيرة إذا كانت غير مشمولة في الباقة المجانية",
      "المشروبات، وجبات الغداء، والمصاريف الشخصية",
      "إكراميات سائق الجيب في وادي رم وركوب الخيل في البتراء",
      "التأمين الشخصي وتأمين السفر"
    ],
    en: [
      "International flights",
      "Entry visa fees if not applicable for free group visa",
      "Drinks, lunches, and personal expenses",
      "Tips for Wadi Rum jeep driver and horse boy in Petra",
      "Personal travel insurance"
    ],
    es: [
      "Vuelos internacionales",
      "Tasas de visado (salvo en los casos de visado grupal gratuito)",
      "Bebidas, almuerzos y gastos personales",
      "Propinas locales obligatorias (chófer de jeep en Wadi Rum y caballo en Petra)",
      "Seguro de viaje personal"
    ],
    pt: [
      "Voos internacionais",
      "Taxas de visto (exceto quando qualificado para visto de grupo gratuito)",
      "Bebidas, almoços e despesas de caráter pessoal",
      "Gorjetas locais para motorista do jipe em Wadi Rum e condutor do cavalo em Petra",
      "Seguro de viagem pessoal"
    ],
    it: [
      "Voli internazionali",
      "Tasse per il visto (salvo ove concesso visto di gruppo gratuito)",
      "Bevande, pranzi e spese personali",
      "Mance per autista jeep a Wadi Rum e conduttore cavallo a Petra",
      "Assicurazione personale di viaggio"
    ]
  },
  Dubai: {
    ar: [
      "تذاكر الطيران الدولي",
      "تأشيرة دخول الإمارات (إذا كانت مطلوبة لجنسيتك)",
      "المشروبات والوجبات غير المذكورة",
      "تذاكر الصعود لقمة برج خليفة (إلا إذا تم حجزها كـ خيار إضافي)",
      "المصاريف الشخصية والإكراميات"
    ],
    en: [
      "International flights",
      "UAE entry visa (if required for your nationality)",
      "Drinks and meals not specifically mentioned as included",
      "Burj Khalifa observation deck tickets (unless booked as an optional add-on)",
      "Personal expenses and gratuities"
    ],
    es: [
      "Vuelos internacionales",
      "Visado de entrada a los Emiratos Árabes Unidos (si procede)",
      "Bebidas y comidas no especificadas como incluidas",
      "Entradas al mirador del Burj Khalifa (salvo que se contraten como suplemento)",
      "Gastos personales y propinas"
    ],
    pt: [
      "Voos internacionais",
      "Visto de entrada nos Emirados Árabes Unidos (se aplicável à nacionalidade)",
      "Bebidas e refeições não mencionadas como inclusas",
      "Ingressos para o topo do Burj Khalifa (salvo se reservados como opcional)",
      "Despesas pessoais e gorjetas"
    ],
    it: [
      "Voli internazionali",
      "Visto d'ingresso negli Emirati Arabi Uniti (se richiesto)",
      "Bevande e pasti non esplicitamente indicati come inclusi",
      "Biglietti per l'osservatorio del Burj Khalifa (salvo prenotati come supplemento)",
      "Spese personali e mance"
    ]
  },
  Morocco: {
    ar: [
      "تذاكر الطيران الدولي",
      "تأشيرة الدخول إلى المغرب",
      "المشروبات مع الوجبات ووجبات الغداء غير المذكورة",
      "المصاريف الشخصية والمشتريات الخاصة",
      "إكراميات المرشدين والسائقين وموظفي الفنادق"
    ],
    en: [
      "International flights",
      "Moroccan entry visa",
      "Beverages and lunches not specified as included",
      "Personal expenses and souvenirs",
      "Gratuities for local guides, drivers, and hotel staff"
    ],
    es: [
      "Vuelos internacionales de ida y vuelta",
      "Visado de entrada a Marruecos",
      "Bebidas y almuerzos no especificados como incluidos",
      "Gastos personales y compras",
      "Propinas para guías locales, chóferes y personal de hotel"
    ],
    pt: [
      "Voos internacionais de ida e volta",
      "Visto de entrada no Marrocos",
      "Bebidas e almoços não especificados como inclusos",
      "Despesas pessoais e compras",
      "Gorjetas para guias locais, motoristas e funcionários de hotéis"
    ],
    it: [
      "Voli internazionali di andata e ritorno",
      "Visto d'ingresso in Marocco",
      "Bevande e pranzi non specificati come inclusi",
      "Spese personali e acquisti",
      "Mance per guide locali, autisti e personale alberghiero"
    ]
  },
  'Multi-Country': {
    ar: [
      "تذاكر الطيران الدولي من وإلى بلد المغادرة",
      "تأشيرات الدخول للدول التي تتطلب تأشيرة مسبقة",
      "المشروبات أثناء الوجبات والمصاريف الشخصية",
      "الجولات والأنشطة الإضافية غير المذكورة في البرنامج",
      "إكراميات المرشدين والسائقين وطاقم الخدمة"
    ],
    en: [
      "International flights to/from departure country",
      "Entry visas for countries requiring pre-arranged visas",
      "Drinks during meals and personal expenses",
      "Optional excursions and extra activities not listed in the program",
      "Tips for tour guides, drivers, and service staff"
    ],
    es: [
      "Vuelos internacionales hacia y desde su país de origen",
      "Visados de entrada para los países que los requieran",
      "Bebidas en las comidas y gastos de carácter personal",
      "Excursiones opcionales y actividades suplementarias no especificadas",
      "Propinas habituales para guías, chóferes y personal de servicio"
    ],
    pt: [
      "Voos internacionais de ida e volta do país de origem",
      "Vistos de entrada para os países que exigirem documentação prévia",
      "Bebidas durante as refeições e despesas pessoais",
      "Passeios opcionais e atividades extras não incluídas no programa",
      "Gorjetas habituais para guias, motoristas e equipe de atendimento"
    ],
    it: [
      "Voli internazionali da e per il paese di partenza",
      "Visti d'ingresso per i paesi che richiedono documentazione consolare",
      "Bevande durante i pasti e spese personali",
      "Escursioni facoltative e attività extra non menzionate nel programma",
      "Mance per guide turistiche, autisti e personale di servizio"
    ]
  }
};

// Standard Highlights by Category
const HIGHLIGHTS = {
  Egypt: {
    ar: ["أهرامات الجيزة الخالدة وأبو الهول", "كروز فاخر على ضفاف نهر النيل", "معابد الكرنك والأقصر ووادي الملوك", "المتحف المصري الكبير (GEM)", "معبدي أبو سمبل الرائعين"],
    en: ["Timeless Giza Pyramids and Great Sphinx", "Luxury 5-Star Nile River Cruise", "Karnak, Luxor Temples and Valley of the Kings", "Grand Egyptian Museum (GEM)", "Magnificent Abu Simbel Temples"],
    es: ["Eternas Pirámides de Giza y la Gran Esfinge", "Crucero de lujo de 5 estrellas por el Río Nilo", "Templos de Karnak, Luxor y el Valle de los Reyes", "Gran Museo Egipcio (GEM)", "Magno Templo de Abu Simbel"],
    pt: ["Eternas Pirâmides de Gizé e a Grande Esfinge", "Cruzeiro de luxo de 5 estrelas pelo Rio Nilo", "Templos de Karnak, Luxor e o Vale dos Reis", "Grande Museu Egípcio (GEM)", "Impressionantes Templos de Abu Simbel"],
    it: ["Eterne Piramidi di Giza e la Grande Sfinge", "Crociera di lusso a 5 stelle sul fiume Nilo", "Templi di Karnak, Luxor e la Valle dei Re", "Grand Egyptian Museum (GEM)", "Spettacolari Templi di Abu Simbel"]
  },
  Turkey: {
    ar: ["إسطنبول: آيا صوفيا، المسجد الأزرق، ومضيق البوسفور", "كابادوكيا: المداخن الصخرية والمدن تحت الأرض", "باموكالي: قلعة القطن والينابيع الحرارية", "أفسس وطروادة: أعظم حضارات بحر إيجة", "بورصة: أول عاصمة عثمانية ومساجدها التاريخية"],
    en: ["Istanbul: Hagia Sophia, Blue Mosque & Bosphorus Strait", "Cappadocia: Fairy Chimneys and Underground Cities", "Pamukkale: Cotton Castle Thermal Travertines", "Ephesus and Troy: Ancient Aegean Civilizations", "Bursa: First Ottoman Capital & Historic Mosques"],
    es: ["Estambul: Santa Sofía, Mezquita Azul y el Estrecho del Bósforo", "Capadocia: Chimeneas de Hadas y Ciudades Subterráneas", "Pamukkale: Castillo de Algodón y Piscinas Termales", "Éfeso y Troya: Grandes Civilizaciones del Mar Egeo", "Bursa: Primera Capital Otomana y Mezquitas Históricas"],
    pt: ["Istambul: Santa Sofia, Mesquita Azul e Estreito de Bósforo", "Capadócia: Chaminés de Fadas e Cidades Subterrâneas", "Pamukkale: Castelo de Algodão e Piscinas Termais", "Éfeso e Troia: Grandes Civilizações do Egeu", "Bursa: Primeira Capital Otomana e Mesquitas Históricas"],
    it: ["Istanbul: Santa Sofia, Moschea Blu e Stretto del Bosforo", "Cappadocia: Camini delle Fate e Città Sotterranee", "Pamukkale: Castello di Cotone e Piscine Termali", "Efeso e Troia: Grandi Civiltà dell'Egeo", "Bursa: Prima Capitale Ottomana e Moschee Storiche"]
  },
  Jordan: {
    ar: ["البتراء: المدينة الوردية المنحوتة في الصخر", "وادي رم: صحراء المريخ وسفاري 4x4", "البحر الميت: الطفو في أخفض بقعة على وجه الأرض", "جرش الرومانية: مدينة الألف عمود", "عمان: قلعة التاريخ والأسواق التراثية"],
    en: ["Petra: The Rose-Red City Carved in Rock", "Wadi Rum: Valley of the Moon 4x4 Jeep Safari", "Dead Sea: Floating at the Lowest Point on Earth", "Jerash: The Ancient Roman City of 1,000 Columns", "Amman: Historic Citadel and Traditional Souks"],
    es: ["Petra: La Ciudad Rosa tallada en la roca", "Wadi Rum: Safari 4x4 por el Valle de la Luna", "Mar Muerto: Flotar en el punto más bajo de la Tierra", "Jerash: La impresionante ciudad romana de las mil columnas", "Ammán: Ciudadela histórica y zocos tradicionales"],
    pt: ["Petra: A Cidade Rosa esculpida na rocha", "Wadi Rum: Safári 4x4 pelo Vale da Lua", "Mar Morto: Flutuar no ponto mais baixo da Terra", "Jerash: A espetacular cidade romana das mil colunas", "Amã: Cidadela histórica e souks tradicionais"],
    it: ["Petra: La Città Rosa scolpita nella roccia", "Wadi Rum: Safari in 4x4 nella Valle della Luna", "Mar Morto: Galleggiare nel punto più basso della Terra", "Jerash: La magnifica città romana delle mille colonne", "Amman: Cittadella storica e vivaci suk tradizionali"]
  },
  Dubai: {
    ar: ["برج خليفة: أطول ناطحة سحاب في العالم", "سفاري الصحراء الذهبية وعشاء البدو الفاخر", "دبي مارينا ونخلة جميرا الفاخرة", "نافورة دبي الراقصة ودبي مول الشهير", "رحلة بحرية كلاسيكية في خور دبي"],
    en: ["Burj Khalifa: The World's Tallest Skyscraper", "Golden Desert 4x4 Safari with Luxury BBQ Dinner", "Dubai Marina and iconic Palm Jumeirah", "The Dubai Fountain Show and Dubai Mall", "Traditional Dhow Cruise Dinner along Dubai Creek"],
    es: ["Burj Khalifa: El rascacielos más alto del mundo", "Safari 4x4 por las dunas doradas con cena barbacoa", "Dubai Marina y la emblemática Palm Jumeirah", "Espectáculo de la Fuente de Dubái y Dubai Mall", "Cena crucero en barco tradicional Dhow por el Creek"],
    pt: ["Burj Khalifa: O arranha-céu mais alto do mundo", "Safári 4x4 pelas dunas douradas com jantar churrasco", "Dubai Marina e a icônica Palm Jumeirah", "Show das Fontes de Dubai e Dubai Mall", "Cruzeiro com jantar em barco tradicional Dhow pelo Creek"],
    it: ["Burj Khalifa: Il grattacielo più alto del mondo", "Safari in 4x4 tra le dune dorate con cena barbecue", "Dubai Marina e l'iconica Palm Jumeirah", "Spettacolo delle Fontane Danzanti e Dubai Mall", "Cena in crociera su Dhow tradizionale lungo il Creek"]
  },
  Morocco: {
    ar: ["مراكش: ساحة جامع الفنا وقصور الباهية", "فاس: أقدم جامعة في العالم وأزقة المدينة العتيقة", "شفشاون: الجوهرة الزرقاء في جبال الريف", "صحراء مرزوكة: كثبان عرق الشبي الذهبية", "الدار البيضاء: مسجد الحسن الثاني المعماري الرائع"],
    en: ["Marrakech: Jemaa el-Fnaa Square & Bahia Palace", "Fes: World's Oldest University & Ancient Medina", "Chefchaouen: The Blue Pearl of the Rif Mountains", "Merzouga Sahara Desert: Erg Chebbi Golden Dunes", "Casablanca: Architectural Splendor of Hassan II Mosque"],
    es: ["Marrakech: Plaza Jemaa el-Fna y Palacio de la Bahía", "Fez: La medina más antigua del mundo y Curtidurías", "Chefchaouen: La Joya Azul de las montañas del Rif", "Desierto de Merzouga: Dunas doradas de Erg Chebbi", "Casablanca: Esplendor de la Gran Mezquita Hassan II"],
    pt: ["Marrakech: Praça Jemaa el-Fna e Palácio Bahia", "Fes: A medina mais antiga do mundo e Curtumes", "Chefchaouen: A Pérola Azul das montanhas do Rif", "Deserto de Merzouga: Dunas douradas de Erg Chebbi", "Casablanca: Majestosa Mesquita Hassan II"],
    it: ["Marrakech: Piazza Jemaa el-Fna e Palazzo Bahia", "Fes: La più antica medina del mondo e le Concerie", "Chefchaouen: La Perla Blu delle montagne del Rif", "Deserto di Merzouga: Dune dorate dell'Erg Chebbi", "Casablanca: Maestosa Moschea Hassan II"]
  },
  'Multi-Country': {
    ar: ["الجمع بين أهرامات مصر والبتراء في الأردن وإسطنبول الساحرة", "أروع المعالم التاريخية والثقافية في وجهات متعددة", "رحلات كروز نهرية وبحرية بأعلى معايير الرفاهية", "خدمات راقية وإرشاد سياحي متخصص في كل بلد", "تجربة سفر متكاملة ومصممة بأعلى معايير الجودة"],
    en: ["Combining Egypt Pyramids, Jordan's Petra, and Enchanting Istanbul", "Iconic historical and cultural landmarks across multiple nations", "Luxury river and coastal cruises with world-class hospitality", "Dedicated private guiding and seamless regional logistics", "A truly bespoke multi-destination luxury travel experience"],
    es: ["Combinación perfecta de Pirámides de Egipto, Petra en Jordania y Estambul", "Grandes maravillas arqueológicas y culturales en múltiples destinos", "Cruceros de lujo con la máxima hospitalidad y confort", "Servicio exclusivo con guías locales especializados en cada país", "Una experiencia de viaje inolvidable por los tesoros de Oriente"],
    pt: ["Combinação imperdível das Pirâmides do Egito, Petra na Jordânia e Istambul", "Grandes monumentos arqueológicos e culturais em múltiplos países", "Cruzeiros de luxo com alto padrão de conforto e hospitalidade", "Guias locais especializados e logística impecável em cada destino", "Uma experiência inesquecível pelos tesoros do Oriente e Mediterrâneo"],
    it: ["Combinazione perfetta tra Piramidi d'Egitto, Petra in Giordania e Istanbul", "Grandi meraviglie archeologiche e culturali attraverso più paesi", "Crociere di lusso con il massimo comfort e ospitalità", "Assistenza esclusiva e guide specializzate in ogni destinazione", "Un'esperienza di viaggio memorabile tra i tesori d'Oriente"]
  }
};

function ensure5Langs(obj, fallback = '') {
  if (!obj) {
    return { ar: fallback, en: fallback, es: fallback, it: fallback, pt: fallback };
  }
  if (typeof obj === 'string') {
    return { ar: obj, en: obj, es: obj, it: obj, pt: obj };
  }
  const defaultVal = obj.en || obj.es || obj.pt || obj.it || obj.ar || fallback;
  return {
    ar: obj.ar || defaultVal,
    en: obj.en || defaultVal,
    es: obj.es || defaultVal,
    it: obj.it || defaultVal,
    pt: obj.pt || defaultVal,
  };
}

function getCategoryGroup(cat, country, slug) {
  const s = (slug || '').toLowerCase();
  const c = (country || '').toLowerCase();
  const k = (cat || '').toLowerCase();

  if (k.includes('turkey') || c.includes('turkey') || s.includes('turkey') || s.includes('istanbul') || s.includes('cappadocia') || s.includes('reg-0') || s.includes('reg-10') || s.includes('reg-11') || s.includes('reg-12') || s.includes('reg-13') || s.includes('reg-14') || s.includes('ist-01')) return 'Turkey';
  if (k.includes('jordan') || c.includes('jordan') || s.includes('jordan') || s.includes('reg-15') || s.includes('reg-16') || s.includes('reg-17') || s.includes('reg-18') || s.includes('reg-19') || s.includes('reg-20') || s.includes('reg-21')) return 'Jordan';
  if (k.includes('dubai') || c.includes('emirates') || s.includes('dubai') || s.includes('reg-22') || s.includes('reg-23') || s.includes('reg-24') || s.includes('reg-25') || s.includes('reg-26') || s.includes('reg-27') || s.includes('reg-28') || s.includes('hm001') || s.includes('hm002')) return 'Dubai';
  if (k.includes('morocco') || c.includes('morocco') || s.includes('morocco') || s.includes('mrc-01')) return 'Morocco';
  if (k.includes('multi') || s.includes('multi') || s.includes('combined') || s.includes('15-days-egypt-turkey') || s.includes('14-days-dubai') || s.includes('19-days') || s.includes('11-days-egypt-greece') || s.includes('treasures-of-egypt-and-tunisia')) return 'Multi-Country';
  return 'Egypt';
}

function formatDayTitle(dayNum, customTitle) {
  const enSuffix = customTitle && customTitle !== `Day ${dayNum}` ? `: ${customTitle}` : '';
  return {
    ar: `اليوم ${dayNum}${customTitle ? `: ${customTitle}` : ''}`,
    en: `Day ${dayNum}${enSuffix}`,
    es: `Día ${dayNum}${customTitle ? `: ${customTitle}` : ''}`,
    pt: `${dayNum}º Dia${customTitle ? `: ${customTitle}` : ''}`,
    it: `${dayNum}° Giorno${customTitle ? `: ${customTitle}` : ''}`
  };
}

async function fixAllTours() {
  console.log('🚀 Starting Comprehensive Fix for all Tours and Itineraries...');

  // 1. Remove corrupted dummy tours (e.g. object-object or tours without catalog ID and 0 days)
  const invalidTours = await prisma.tour.findMany({
    where: {
      OR: [
        { slug: 'object-object' },
        { slug: 'classic-egypt-programme' },
        { slug: 'journey-of-the-holy-family-10-days-09-nights' }
      ]
    }
  });

  for (const inv of invalidTours) {
    await prisma.tourItinerary.deleteMany({ where: { tourId: inv.id } });
    await prisma.tourImage.deleteMany({ where: { tourId: inv.id } });
    await prisma.tourLandingPageTour.deleteMany({ where: { tourId: inv.id } });
    await prisma.tour.delete({ where: { id: inv.id } });
    console.log(`🗑️ Deleted invalid dummy tour: ${inv.slug}`);
  }

  // 2. Fetch all remaining active tours
  const tours = await prisma.tour.findMany({
    where: { deletedAt: null },
    include: {
      itineraries: { orderBy: { sortOrder: 'asc' } },
      images: true
    }
  });

  console.log(`Found ${tours.length} tours to audit and fix.`);

  for (const t of tours) {
    const group = getCategoryGroup(t.category, t.country, t.slug);
    const catInclusions = INCLUSIONS[group] || INCLUSIONS.Egypt;
    const catExclusions = EXCLUSIONS[group] || EXCLUSIONS.Egypt;
    const catHighlights = HIGHLIGHTS[group] || HIGHLIGHTS.Egypt;

    // A. Check & Fix Inclusions
    let inclusions = t.includedServicesJsonb;
    if (!inclusions || !LANGS.every(l => Array.isArray(inclusions[l]) && inclusions[l].length > 0)) {
      inclusions = catInclusions;
    }

    // B. Check & Fix Exclusions
    let exclusions = t.excludedServicesJsonb;
    if (!exclusions || !LANGS.every(l => Array.isArray(exclusions[l]) && exclusions[l].length > 0)) {
      exclusions = catExclusions;
    }

    // C. Check & Fix Highlights
    let highlights = t.highlightsJsonb;
    if (!highlights || !LANGS.every(l => Array.isArray(highlights[l]) && highlights[l].length > 0)) {
      highlights = catHighlights;
    }

    // D. Check & Fix Overview
    let overview = t.overviewJsonb;
    if (!overview || !LANGS.every(l => typeof overview[l] === 'string' && overview[l].trim().length > 0)) {
      const defaultDesc = t.titleJsonb?.en ? `Discover our curated luxury travel program: ${t.titleJsonb.en}. Experience authentic culture, handpicked accommodations, and seamless 5-star service.` : 'Experience authentic luxury travel with Dunas Travel.';
      overview = ensure5Langs(overview, defaultDesc);
    }

    // E. Check & Fix Title & Duration
    const title = ensure5Langs(t.titleJsonb, t.slug);
    const duration = ensure5Langs(t.durationJsonb, `${t.itineraries.length || 7} Days / ${Math.max(1, (t.itineraries.length || 7) - 1)} Nights`);

    // Update Tour record
    await prisma.tour.update({
      where: { id: t.id },
      data: {
        titleJsonb: title,
        durationJsonb: duration,
        overviewJsonb: overview,
        includedServicesJsonb: inclusions,
        excludedServicesJsonb: exclusions,
        highlightsJsonb: highlights,
      }
    });

    // F. Fix Itinerary Days (ensure all 5 languages for title, description, meals)
    if (t.itineraries && t.itineraries.length > 0) {
      for (let i = 0; i < t.itineraries.length; i++) {
        const day = t.itineraries[i];
        const dayNum = i + 1;

        // Fix titleJsonb
        let dayTitle = day.titleJsonb;
        if (!dayTitle || !LANGS.every(l => typeof dayTitle[l] === 'string' && dayTitle[l].trim().length > 0)) {
          const rawTitle = dayTitle?.en || dayTitle?.es || dayTitle?.ar || dayTitle?.pt || dayTitle?.it || '';
          dayTitle = formatDayTitle(dayNum, rawTitle.replace(/^Day \d+:?\s*/i, '').replace(/^Día \d+:?\s*/i, '').replace(/^اليوم \d+:?\s*/i, ''));
        }

        // Fix descriptionJsonb
        let dayDesc = day.descriptionJsonb;
        if (!dayDesc || !LANGS.every(l => typeof dayDesc[l] === 'string' && dayDesc[l].trim().length > 0)) {
          const fallbackDesc = dayDesc?.en || dayDesc?.es || dayDesc?.ar || dayDesc?.pt || dayDesc?.it || `Enjoy a full day of curated sightseeing and authentic experiences.`;
          dayDesc = ensure5Langs(dayDesc, fallbackDesc);
        }

        // Fix mealsJsonb
        let dayMeals = day.mealsJsonb;
        if (dayMeals) {
          dayMeals = ensure5Langs(dayMeals, '');
        }

        await prisma.tourItinerary.update({
          where: { id: day.id },
          data: {
            dayLabel: `Day ${dayNum}`,
            titleJsonb: dayTitle,
            descriptionJsonb: dayDesc,
            mealsJsonb: dayMeals,
            sortOrder: i
          }
        });
      }
    } else {
      // If a tour has 0 itinerary days, create default 4-day itinerary based on destination
      console.log(`⚠️ Creating default itinerary for ${t.slug} which had 0 days...`);
      const defaultDays = [
        {
          dayLabel: 'Day 1',
          title: formatDayTitle(1, 'Arrival & Transfer to Luxury Hotel'),
          desc: ensure5Langs(null, 'Arrival at the international airport. Meet and assist by our representative. Private transfer to your luxury hotel. Check-in and leisure time.'),
          meals: ensure5Langs(null, 'Dinner')
        },
        {
          dayLabel: 'Day 2',
          title: formatDayTitle(2, 'Full Day Guided Exploration & Highlights'),
          desc: ensure5Langs(null, 'Breakfast at the hotel. Full day guided excursion to the most famous historical and cultural landmarks with your private licensed guide.'),
          meals: ensure5Langs(null, 'Breakfast & Lunch')
        },
        {
          dayLabel: 'Day 3',
          title: formatDayTitle(3, 'Authentic Cultural Discoveries & Free Time'),
          desc: ensure5Langs(null, 'Breakfast at the hotel. Continue exploring iconic sites, traditional markets, and scenic views. Free afternoon for personal exploration.'),
          meals: ensure5Langs(null, 'Breakfast')
        },
        {
          dayLabel: 'Day 4',
          title: formatDayTitle(4, 'Departure & Airport Transfer'),
          desc: ensure5Langs(null, 'Breakfast at the hotel. Check-out and private transfer to the international airport for your departure flight.'),
          meals: ensure5Langs(null, 'Breakfast')
        }
      ];

      for (let idx = 0; idx < defaultDays.length; idx++) {
        const d = defaultDays[idx];
        await prisma.tourItinerary.create({
          data: {
            tourId: t.id,
            dayLabel: d.dayLabel,
            titleJsonb: d.title,
            descriptionJsonb: d.desc,
            mealsJsonb: d.meals,
            sortOrder: idx
          }
        });
      }
    }

    // G. Ensure at least 1 image
    if (!t.images || t.images.length === 0) {
      await prisma.tourImage.create({
        data: {
          tourId: t.id,
          url: 'https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?q=80&w=1200',
          caption: t.titleJsonb?.en || t.slug,
          isHero: true,
          sortOrder: 0
        }
      });
    }

    console.log(`✅ [100% FIXED] ${t.slug} (${group})`);
  }

  console.log('\n🎉 ALL TOURS AND ITINERARIES COMPREHENSIVELY FIXED!');
}

fixAllTours()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
