const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '../prisma/data/ahmed-tours.normalized.json');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const programs = Array.isArray(data) ? data : data.programs;

const classicProgramData = {
  sourceId: 'eg-classic-001',
  slug: 'classic-program',
  category: 'CULTURAL',
  country: 'Egypt',
  basePriceUsd: 0,
  currency: 'USD',
  status: 'PUBLISHED',
  isActive: true,
  languages: ['ar', 'en', 'es', 'pt', 'it'],
  tags: ['egypt', 'classic', 'pyramids', 'nile-cruise', 'cairo'],
  titleJsonb: {
    ar: 'برنامج مصر الكلاسيكي',
    en: 'Classic Egypt Program',
    es: 'Programa Egipto Clásico',
    pt: 'Programa Egito Clássico',
    it: 'Egitto Classico'
  },
  durationJsonb: {
    ar: '8 أيام',
    en: '8 Days',
    es: '8 Días',
    pt: '8 Dias',
    it: '8 Giorni'
  },
  minPaxJsonb: {
    ar: '2-16',
    en: '2-16',
    es: '2-16',
    pt: '2-16',
    it: '2-16'
  },
  overviewJsonb: {
    ar: 'رحلة لا تُنسى عبر عجائب مصر العريقة. من غموض أهرامات الجيزة إلى سحر النيل، ومن مقابر الفراعنة إلى أجواء القاهرة التاريخية النابضة بالحياة — هذا البرنامج الكلاسيكي مصمم لمن يريد اكتشاف مصر بشكل كامل ومريح وأصيل.',
    en: "An unforgettable journey through Egypt's millennia-old wonders. From the mystery of the Pyramids of Giza to the magic of the Nile, from the tombs of the Pharaohs to the vibrant atmosphere of historic Cairo — this classic programme is designed for those who want to experience Egypt in a complete, comfortable and authentic way.",
    es: 'Un viaje inolvidable a través de las maravillas milenarias de Egipto. Desde el misterio de las Pirámides de Guiza hasta la magia del Nilo, desde las tumbas de los Faraones hasta el ambiente vibrante del Cairo histórico — este programa clásico está diseñado para quienes desean vivir Egipto de manera completa, cómoda y auténtica.',
    pt: 'Uma viagem inesquecível pelas maravilhas milenares do Egito. Do mistério das Pirâmides de Gizé à magia do Nilo, das tumbas dos Faraós à atmosfera vibrante do Cairo histórico — este programa clássico é pensado para quem quer viver o Egito de forma completa, confortável e autêntica.',
    it: "Un viaggio indimenticabile attraverso le meraviglie millenarie dell'Egitto. Dal mistero delle Piramidi di Giza alla magia del Nilo, dalle tombe dei Faraoni all'atmosfera vivace del Cairo storico — questo programma classico è pensato per chi vuole vivere l'Egitto in modo completo, confortevole e autentico."
  },
  highlightsJsonb: {
    ar: [
      'زيارة الأهرامات الشهيرة في الجيزة وأبو الهول',
      'رحلة نيلية بإقامة كاملة من أسوان إلى الأقصر',
      'معابد فيلة وكوم أمبو وإدفو والكرنك والأقصر',
      'جولة اختيارية إلى أبو سمبل',
      'استكشاف القاهرة التاريخية: القلعة، مسجد الألباستر، خان الخليلي، الحي القبطي، والمتحف المصري'
    ],
    en: [
      'Visit to the iconic Pyramids of Giza and the Sphinx',
      'Nile cruise with full board from Aswan to Luxor',
      'Temples of Philae, Kom Ombo, Edfu, Karnak and Luxor',
      'Optional excursion to Abu Simbel',
      'Exploration of historic Cairo: the Citadel, the Alabaster Mosque, Khan el Khalili, the Coptic Quarter and the Egyptian Museum'
    ],
    es: [
      'Visita a las icónicas Pirámides de Guiza y la Esfinge',
      'Crucero por el Nilo con pensión completa desde Asuán hasta Luxor',
      'Templos de Philae, Kom Ombo, Edfu, Karnak y Luxor',
      'Excursión opcional a Abu Simbel',
      'Exploración del Cairo histórico: la Ciudadela, la Mezquita de Alabastro, Khan el Khalili, el barrio copto y el Museo Egipcio'
    ],
    pt: [
      'Visita às icónicas Pirâmides de Gizé e à Esfinge',
      'Cruzeiro no Nilo com pensão completa de Assuã a Luxor',
      'Templos de Philae, Kom Ombo, Edfu, Karnak e Luxor',
      'Excursão opcional a Abu Simbel',
      'Exploração do Cairo histórico: a Cidadela, a Mesquita de Alabastro, Khan el Khalili, o Bairro Copta e o Museu Egípcio'
    ],
    it: [
      'Visita delle iconiche Piramidi di Giza e della Sfinge',
      'Crociera sul Nilo con pensione completa da Aswan a Luxor',
      'Templi di Philae, Kom Ombo, Edfu, Karnak e Luxor',
      'Escursione facoltativa ad Abu Simbel',
      'Esplorazione del Cairo storico: Cittadella, Moschea di Alabastro, Khan el Khalili, quartiere copto e Museo Egizio'
    ]
  },
  includedServicesJsonb: {
    ar: [
      'جميع وسائل النقل من البداية إلى النهاية.',
      'المساعدة في المطارات.',
      'مرشد سياحي يتحدث لغتك خلال الزيارات.',
      'الزيارات والتذاكر والنقل حسب البرنامج.',
      '04 ليالٍ في القاهرة مع الإقامة والإفطار بالإضافة إلى 03 ليالٍ رحلة نيلية بإقامة كاملة.'
    ],
    en: [
      'All transport from start to finish.',
      'Assistance at airports.',
      'English speaking tour guide during visits.',
      'Visits, entrance tickets and transport as per programme.',
      '04 nights in Cairo on B&B basis plus 03 nights Nile Cruise on full board basis.'
    ],
    es: [
      'Todos los transportes de principio a fin.',
      'Asistencia en los aeropuertos.',
      'Guía oficial durante las visitas.',
      'Visitas, entradas y traslados según el itinerario.',
      '04 noches en El Cairo en alojamiento y desayuno más 03 noches de crucero por el Nilo en pensión completa.'
    ],
    pt: [
      'Todos os transportes do início ao fim.',
      'Assistência nos aeroportos.',
      'Guia oficial durante as visitas.',
      'Visitas, bilhetes e transferências de acordo com o itinerário.',
      '04 noites no Cairo com alojamento e pequeno-almoço mais 03 noites de cruzeiro no Nilo com pensão completa.'
    ],
    it: [
      "Tutti i trasporti dall'inizio alla fine.",
      'Assistenza negli aeroporti.',
      'Guida parlante italiano durante le visite.',
      "Visite, biglietti e trasferimenti secondo l'itinerario.",
      '04 notti al Cairo in pernottamento e colazione più 03 notti di crociera sul Nilo in pensione completa.'
    ]
  },
  excludedServicesJsonb: {
    ar: [
      'إكراميات السفر العامة 45 يورو للبالغ أو القاصر (إكراميات المرشد غير مشمولة).',
      'الوجبات والمشروبات أو أي مصاريف أخرى غير مذكورة ضمن المشمولات.',
      'الرحلات الجوية الداخلية والدولية.',
      'التأشيرة 25 يورو للبالغ/القاصر.'
    ],
    en: [
      'General travel gratuities €45 per adult or minor (guide tips excluded).',
      'Meals, drinks or any other expense not mentioned in inclusions.',
      'Domestic and international flights.',
      'Visa €25 per adult/minor.'
    ],
    es: [
      'Propinas generales de viaje 45€ por adulto o menor (propinas de la guía no incluidas).',
      'Comidas, bebidas o cualquier otro gasto no mencionado como incluido.',
      'Vuelos nacionales e internacionales.',
      'Visado 25€ por adulto/menor.'
    ],
    pt: [
      'Gorjetas gerais de viagem 45€ por adulto ou menor (gorjetas do guia não incluídas).',
      'Refeições, bebidas ou qualquer outra despesa não mencionada como incluída.',
      'Voos domésticos e internacionais.',
      'Visto 25€ por adulto/menor.'
    ],
    it: [
      'Mance generali di viaggio 45€ per adulto o minore (mance della guida non comprese).',
      'Pasti, bevande o qualsiasi altra spesa non menzionata come inclusa.',
      'Voli nazionali e internazionali.',
      'Visto 25€ per adulto/minore.'
    ]
  },
  itineraries: [
    {
      day: 1,
      titleJsonb: {
        ar: 'اليوم 1: مدينة المنشأ – القاهرة',
        en: 'Day 1: City of Origin – Cairo',
        es: 'Día 1: Ciudad de Origen – El Cairo',
        pt: 'Dia 1: Cidade de Origem – Cairo',
        it: "Giorno 1: Città d'Origine – Cairo"
      },
      descriptionJsonb: {
        ar: 'في اليوم الأول، سننتظرك في مطار القاهرة لمنحك تأشيرتك ومساعدتك في إجراءات الهجرة وإيصالك إلى فندقك.',
        en: 'On the first day, we will be waiting for you at Cairo airport to give you your visa, help you with immigration checks and take you to your hotel.',
        es: 'El primer día, te esperaremos en el aeropuerto de El Cairo para darte tu visado, ayudarte con los controles de inmigración y llevarte a tu hotel.',
        pt: 'No primeiro dia, estaremos à sua espera no aeroporto do Cairo para lhe dar o seu visto, ajudá-lo com os controlos de imigração e levá-lo ao seu hotel.',
        it: "Il primo giorno, ti aspetteremo all'aeroporto di Cairo per darti il tuo visto, aiutarti con i controlli sull'immigrazione e portarti al tuo hotel."
      }
    },
    {
      day: 2,
      titleJsonb: {
        ar: 'اليوم 2: القاهرة',
        en: 'Day 2: Cairo',
        es: 'Día 2: El Cairo',
        pt: 'Dia 2: Cairo',
        it: 'Giorno 2: Cairo'
      },
      descriptionJsonb: {
        ar: 'بعد الإفطار في الفندق والمغادرة لزيارة أهرامات الجيزة: خوفو وخفرع ومنقرع. ثم التوقف عند النقطة البانورامية للأهرامات لالتقاط صور رائعة، ثم زيارة أبو الهول، رأس الفرعون وجسم الأسد، حارس الأهرامات. زيارة اختيارية لمنف وسقارة، أطلال القاهرة الأصلية.',
        en: 'After breakfast at the hotel, departure to visit the Pyramids of Giza: Cheops, Chephren and Mycerinus. Then, stop at the panoramic viewpoint of the pyramids for beautiful photos and then visit the Sphinx, head of the Pharaoh and body of the Lion, guardian of the Pyramids. Optional visit to Memphis and Saqqara, the ruins of the original Cairo.',
        es: 'Después del desayuno en el hotel, salida para visitar las pirámides de Guiza: Keops, Kefrén y Micerinos. Luego, parada en el punto panorámico de las pirámides para bellísimas fotos y después visita a la Esfinge, cabeza del Faraón y cuerpo del León, guardiana de las Pirámides. Visita opcional a Menfis y Sakkara, las ruinas del Cairo original.',
        pt: 'Após o pequeno-almoço no hotel, partida para visitar as pirâmides de Gizé: Quéops, Quéfren e Miquerinos. De seguida, paragem no miradouro panorâmico das pirâmides para fotografias maravilhosas e depois visita à Esfinge, cabeça do Faraó e corpo do Leão, guardiã das Pirâmides. Visita opcional a Mênfis e Sacará, as ruínas do Cairo original.',
        it: 'Dopo la colazione in hotel, partenza per la visita delle piramidi di Giza: Cheope, Chefren e Mequerinos. Quindi, sosta al punto panoramico delle piramidi per bellissime foto e poi visita la Sfinge, testa del Faraone e corpo del Leone, guardiano delle Piramidi. Visita facoltativa a Memphis e Sakkara, le rovine del Cairo originale.'
      }
    },
    {
      day: 3,
      titleJsonb: {
        ar: 'اليوم 3: القاهرة / أسوان',
        en: 'Day 3: Cairo / Aswan',
        es: 'Día 3: El Cairo / Asuán',
        pt: 'Dia 3: Cairo / Assuã',
        it: 'Giorno 3: Cairo / Aswan'
      },
      descriptionJsonb: {
        ar: 'بعد تناول الطعام سنتوجه إلى المطار للقيام برحلة جوية إلى أسوان، وسنستقبلك في مطار أسوان. ثم سنأخذك إلى السفينة السياحية حيث تنتظرك الإقامة الكاملة مع الوجبات. سنزور معبد فيلة: البداية المثالية!',
        en: 'After eating we will head to the airport to take a flight to Aswan, we will pick you up at Aswan airport. Then we will take you to the cruise ship, where full board accommodation awaits you. We will visit the Temple of Philae: the perfect beginning!',
        es: 'Después de comer nos dirigiremos al aeropuerto para tomar un vuelo a Asuán, iremos a recogerte al aeropuerto de Asuán. Luego te llevaremos al crucero, donde te esperan alojamiento y comidas completas. Visitaremos el Templo de Philae: ¡el comienzo perfecto!',
        pt: 'Depois de comer dirigir-nos-emos ao aeroporto para apanhar um voo para Assuã, iremos buscá-lo ao aeroporto de Assuã. Depois levá-lo-emos ao navio de cruzeiro, onde o espera alojamento e refeições completas. Visitaremos o Templo de Philae: o começo perfeito!',
        it: "Dopo aver mangiato ci dirigeremo all'aeroporto per prendere un volo per Aswan, vi verremo a prendere all'aeroporto di Aswan. Poi vi porteremo alla nave da crociera, dove ti aspettano vitto e alloggio completi. Visiteremo il Tempio di Philae: l'inizio perfetto!"
      }
    },
    {
      day: 4,
      titleJsonb: {
        ar: 'اليوم 4: رحلة نيلية (إقامة كاملة)',
        en: 'Day 4: Nile Cruise (full board)',
        es: 'Día 4: Crucero por el Nilo (pensión completa)',
        pt: 'Dia 4: Cruzeiro no Nilo (pensão completa)',
        it: 'Giorno 4: Crociera sul Nilo (pensione completa)'
      },
      descriptionJsonb: {
        ar: 'بعد الإفطار، زيارة اختيارية لمعابد أبو سمبل والتي تحظى بتقدير كبير ويُنصح بها بشدة. ثم نعود إلى السفينة ونتناول الطعام ونبدأ الإبحار على طول النيل وصولاً إلى كوم أمبو. بعد زيارة المعبد، نواصل الإبحار نحو إدفو حيث نرسو لتناول العشاء والمبيت.',
        en: 'After breakfast, optional visit to the temples of Abu Simbel, which is very much appreciated and recommended. Then, back on the boat, we will eat and begin to sail along the Nile, arriving at Kom Ombo. Then, after visiting the temple, we will continue sailing towards Edfu, where we will anchor for dinner and overnight stay.',
        es: 'Después del desayuno, visita opcional a los templos de Abu Simbel, muy apreciada y recomendada. Luego, de vuelta al barco, comeremos y comenzaremos a navegar a lo largo del Nilo, llegando a Kom Ombo. Después de visitar el templo, continuaremos navegando hacia Edfu, donde anclaremos para cenar y pernoctar.',
        pt: 'Após o pequeno-almoço, visita opcional aos templos de Abu Simbel, muito apreciada e recomendada. Depois, de volta ao barco, comeremos e começaremos a navegar ao longo do Nilo, chegando a Kom Ombo. Depois de visitar o templo, continuaremos a navegar em direção a Edfu, onde ancoramos para jantar e pernoitar.',
        it: 'Dopo la colazione, visita facoltativa ai templi di Abu Simbel, che viene molto apprezzata e raccomandata. Poi, risaliti sulla barca, mangeremo e inizieremo a navigare lungo il Nilo, arrivando a Kom Ombo. Quindi, dopo aver visitato il tempio, continueremo a navigare verso Edfu, dove ancoreremo per cenare e pernottare.'
      }
    },
    {
      day: 5,
      titleJsonb: {
        ar: 'اليوم 5: رحلة نيلية (إقامة كاملة)',
        en: 'Day 5: Nile Cruise (full board)',
        es: 'Día 5: Crucero por el Nilo (pensión completa)',
        pt: 'Dia 5: Cruzeiro no Nilo (pensão completa)',
        it: 'Giorno 5: Crociera sul Nilo (pensione completa)'
      },
      descriptionJsonb: {
        ar: 'بعد تناول الطعام، نزور معبد إدفو المكرس للإله حورس. تواصل الرحلة النيلية إبحارها نحو الأقصر. عند وصولنا إلى مدينة الأقصر المهيبة نزور اثنين من أكثر المعابد إثارة للإعجاب في البلاد، معبدا الأقصر والكرنك. كانت هذه المعابد مفصولة في العصور القديمة بطريق الكباش الذي يمتد لـ 3 كيلومترات. نتناول الطعام ونقضي الليلة راسين في الأقصر.',
        en: 'After eating, we will visit the Temple of Edfu, dedicated to the god Horus. The cruise will then continue towards Luxor. Upon arriving in the majestic city of Luxor we will visit two of the most spectacular temples in the country, the temples of Luxor and Karnak. These temples were separated in antiquity by the Avenue of the Sphinxes, 3 kilometres long. We will eat and spend the night anchored in Luxor.',
        es: 'Después de comer, visitaremos el Templo de Edfu, dedicado al dios Horus. El crucero proseguirá luego hacia Luxor. Al llegar a la majestuosa ciudad de Luxor visitaremos dos de los más espectaculares templos del país, los templos de Luxor y Karnak. Estos templos estaban separados en la antigüedad por la Avenida de las Esfinges de 3 kilómetros de longitud. Comeremos y pasaremos la noche anclados en Luxor.',
        pt: 'Depois de comer, visitaremos o Templo de Edfu, dedicado ao deus Horus. O cruzeiro prosseguirá depois em direção a Luxor. Chegados à majestosa cidade de Luxor visitaremos dois dos mais espetaculares templos do país, os templos de Luxor e Karnak. Estes templos eram separados na Antiguidade pela Avenida das Esfinges com 3 quilómetros de comprimento. Comeremos e passaremos a noite ancorados em Luxor.',
        it: "Dopo aver mangiato, visiteremo il Tempio di Edfu, dedicato al dio Horus. La crociera proseguirà poi verso Luxor. Giunti nella maestosa città di Luxor visiteremo due tra i più spettacolari templi del paese, i templi di Luxor e Karnak. Questi templi erano separati nell'antichità dal Viale delle Sfingi lungo 3 chilometri. Mangeremo e passeremo la notte all'ancora a Luxor."
      }
    },
    {
      day: 6,
      titleJsonb: {
        ar: 'اليوم 6: الأقصر – القاهرة',
        en: 'Day 6: Luxor – Cairo',
        es: 'Día 6: Luxor – El Cairo',
        pt: 'Dia 6: Luxor – Cairo',
        it: 'Giorno 6: Luxor – Cairo'
      },
      descriptionJsonb: {
        ar: 'الإفطار في الفندق. في الوقت المتفق عليه التوجه إلى المطار للقيام بالرحلة الداخلية إلى القاهرة. مساعدتنا ونقلك إلى الفندق.',
        en: 'Breakfast at the hotel. At the agreed time, transfer to Hurghada airport to take the domestic flight to Cairo. Our assistance and transfer to hotel.',
        es: 'Desayuno en el hotel. A la hora acordada traslado al aeropuerto de Hurghada para tomar el vuelo doméstico a El Cairo. Asistencia por nuestra parte y traslado al hotel.',
        pt: 'Pequeno-almoço no hotel. À hora acordada, transferência para o aeroporto de Hurghada para apanhar o voo doméstico para o Cairo. Assistência da nossa parte e transferência para o hotel.',
        it: "Colazione in albergo. All'orario concordato trasferimento all'aeroporto di Hurghada per prendere il volo interno per Il Cairo. Assistenza da parte nostra e trasferimento in hotel."
      }
    },
    {
      day: 7,
      titleJsonb: {
        ar: 'اليوم 7: القاهرة',
        en: 'Day 7: Cairo',
        es: 'Día 7: El Cairo',
        pt: 'Dia 7: Cairo',
        it: 'Giorno 7: Cairo'
      },
      descriptionJsonb: {
        ar: 'الإفطار ويوم حر. من المقرر جولة اختيارية إلى أبرز المعالم في وسط المدينة. سنرى القلعة، نزور مسجد الألباستر، نستكشف خان الخليلي، نعبر الحي القبطي، نتناول الغداء ونُعجب بروائع المتحف المصري. ثم في المساء نتعشى في مطعم محلي.',
        en: 'Breakfast and free day. An optional scheduled excursion is planned to the most emblematic places in the city centre. We will see the Citadel, visit the Alabaster Mosque, explore Khan el Khalili, cross the Coptic Quarter, have lunch and admire the masterpieces of the Egyptian Museum. Then in the evening we will have dinner at a local restaurant.',
        es: 'Desayuno y día libre. Está prevista una excursión opcional programada a los lugares más emblemáticos del centro de la ciudad. Veremos la Ciudadela, visitaremos la Mezquita de Alabastro, exploraremos el Khan el Khalili, atravesaremos el barrio copto, almorzaremos y admiraremos las obras maestras del Museo Egipcio. Luego por la noche cenaremos en un restaurante local.',
        pt: 'Pequeno-almoço e dia livre. Está prevista uma excursão opcional programada aos lugares mais emblemáticos do centro da cidade. Veremos a Cidadela, visitaremos a Mesquita de Alabastro, exploraremos o Khan el Khalili, atravessaremos o bairro copta, almoçaremos e admiraremos as obras-primas do Museu Egípcio. Depois à noite jantaremos num restaurante local.',
        it: "Colazione e giornata libera. È prevista un'escursione programmata facoltativa ai luoghi più emblematici del centro della città. Vedremo la Cittadella, visiteremo la Moschea di Alabastro, esploreremo il Khan el Khalili, attraverseremo il quartiere copto, pranzeremo e ammireremo i capolavori del Museo Egizio. Poi la sera ceneremo in un ristorante locale."
      }
    },
    {
      day: 8,
      titleJsonb: {
        ar: 'اليوم 8: القاهرة – مدينة المنشأ',
        en: 'Day 8: Cairo – City of Origin',
        es: 'Día 8: El Cairo – Ciudad de Origen',
        pt: 'Dia 8: Cairo – Cidade de Origem',
        it: "Giorno 8: Cairo – Città d'Origine"
      },
      descriptionJsonb: {
        ar: 'بعد الإفطار نسجل المغادرة من الغرف، ثم نأخذك إلى المطار ونساعدك في أخذ رحلتك الجوية الدولية.',
        en: 'After breakfast we will check out of the rooms, take you to the airport and assist you in taking your international flight.',
        es: 'Después del desayuno haremos el check out de las habitaciones, te llevaremos al aeropuerto y te daremos asistencia para tomar tu vuelo internacional.',
        pt: 'Após o pequeno-almoço faremos o check out dos quartos, levá-lo-emos ao aeroporto e daremos assistência para apanhar o voo internacional.',
        it: "Dopo la colazione faremo il check out delle camere, vi porteremo all'aeroporto e vi daremo assistenza per prendere il volo internazionale."
      }
    }
  ]
};

// 1. Check if classic-program exists in array, if so update, else push
let classicIdx = programs.findIndex(p => p.slug === 'classic-program');
if (classicIdx >= 0) {
  programs[classicIdx] = { ...programs[classicIdx], ...classicProgramData };
} else {
  programs.push(classicProgramData);
}

// 2. Also set basePriceUsd = 0 for all Egypt tours
programs.forEach(p => {
  if (p.country === 'Egypt' || (p.slug && p.slug.includes('egypt')) || (p.slug && p.slug.includes('cairo')) || (p.slug && p.slug.includes('egito'))) {
    p.basePriceUsd = 0;
  }
});

fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
console.log('Successfully updated backend JSON dataset with Classic Program and $0 Egypt prices!');
