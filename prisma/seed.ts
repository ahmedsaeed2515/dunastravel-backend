import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'fs';
import * as path from 'path';
import { seedMediaAssets } from './seeds/media.seed';
import * as bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required for an explicitly authorized development seed.');
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ['info', 'warn', 'error'],
});

// ─── Type Definitions ─────────────────────────────────────────

interface RawProgram {
  slug?: string;
  id?: string | number;
  title?: string | Record<string, string>;
  name?: string | Record<string, string>;
  category?: string;
  type?: string;
  price?: string | number;
  basePriceUsd?: string | number;
  basePrice?: string | number;
  duration?: string | Record<string, string>;
  overview?: string | Record<string, string>;
  description?: string | Record<string, string>;
  images?: string[];
  gallery?: string[];
  heroImage?: string;
  image?: string;
  itinerary?: RawItineraryDay[];
  days?: RawItineraryDay[];
}

interface RawItineraryDay {
  day?: string | number;
  dayLabel?: string;
  title?: string | Record<string, string>;
  description?: string | Record<string, string>;
  meals?: string | Record<string, string>;
}

// ─── Helpers ──────────────────────────────────────────────────

function toMultilingual(
  value: string | Record<string, string> | undefined,
  fallback = '',
): Record<string, string> {
  if (!value) return { en: fallback, es: fallback, ar: fallback };
  if (typeof value === 'string') {
    return { en: value, es: value, ar: value };
  }
  return value;
}

function toSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractSlug(program: RawProgram): string {
  if (program.slug) return program.slug;

  const titleSource =
    typeof program.title === 'string'
      ? program.title
      : typeof program.title === 'object'
        ? (program.title['en'] ?? Object.values(program.title)[0])
        : typeof program.name === 'string'
          ? program.name
          : typeof program.name === 'object'
            ? (program.name['en'] ?? Object.values(program.name)[0])
            : String(program.id ?? 'tour');

  return toSlug(titleSource);
}

function extractPrice(program: RawProgram): number {
  const raw = program.basePriceUsd ?? program.price ?? program.basePrice ?? 999;

  const parsed = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
  return isNaN(parsed) ? 999 : parsed;
}

function extractImages(program: RawProgram): string[] {
  if (Array.isArray(program.images) && program.images.length > 0) {
    return program.images;
  }
  if (Array.isArray(program.gallery) && program.gallery.length > 0) {
    return program.gallery;
  }
  const single = program.heroImage ?? program.image;
  return single ? [single] : [];
}

function extractItinerary(program: RawProgram): RawItineraryDay[] {
  if (Array.isArray(program.itinerary)) return program.itinerary;
  if (Array.isArray(program.days)) return program.days;
  return [];
}

// ─── Seeder Functions ─────────────────────────────────────────

async function seedFromJson(programs: RawProgram[]): Promise<void> {
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const program of programs) {
    const slug = extractSlug(program);

    if (!slug) {
      console.warn('  ⚠  Skipping program with no identifiable slug');
      failed++;
      continue;
    }

    const existing = await prisma.tour.findUnique({ where: { slug } });
    if (existing) {
      console.log(`  ↩  Already exists: ${slug}`);
      skipped++;
      continue;
    }

    try {
      const titleSource = program.title ?? program.name;
      const titleJsonb = toMultilingual(
        titleSource as string | Record<string, string>,
        slug,
      );

      const tour = await prisma.tour.create({
        data: {
          slug,
          titleJsonb,
          category: program.category ?? program.type ?? 'general',
          basePriceUsd: extractPrice(program),
          durationJsonb: toMultilingual(
            program.duration as string | Record<string, string>,
          ),
          overviewJsonb: toMultilingual(
            (program.overview ?? program.description) as
              string | Record<string, string>,
          ),
          isActive: true,
        },
      });

      // Seed itinerary days
      const itinerary = extractItinerary(program);
      for (let i = 0; i < itinerary.length; i++) {
        const day = itinerary[i];
        await prisma.tourItinerary.create({
          data: {
            tourId: tour.id,
            dayLabel:
              day.dayLabel ??
              (day.day !== undefined ? `Day ${day.day}` : `Day ${i + 1}`),
            descriptionJsonb: toMultilingual(
              (day.description ?? day.title) as string | Record<string, string>,
            ),
            mealsJsonb: day.meals
              ? toMultilingual(day.meals as string | Record<string, string>)
              : undefined,
            sortOrder: i,
          },
        });
      }

      // Seed images
      const images = extractImages(program);
      for (let i = 0; i < images.length; i++) {
        await prisma.tourImage.create({
          data: {
            tourId: tour.id,
            imageUrl: images[i],
            isHero: i === 0,
            sortOrder: i,
          },
        });
      }

      console.log(
        `  ✅ Seeded: ${slug} | $${extractPrice(program)} | ${itinerary.length} days | ${images.length} images`,
      );
      created++;
    } catch (error) {
      console.error(`  ❌ Failed to seed: ${slug}`, error);
      failed++;
    }
  }

  console.log(`\n📊 Seed Summary:`);
  console.log(`   Created : ${created}`);
  console.log(`   Skipped : ${skipped}`);
  console.log(`   Failed  : ${failed}`);
}

async function seedFallbackTours(): Promise<void> {
  console.log('📌 Seeding fallback sample tours...');

  const fallbackTours = [
    {
      slug: 'mrc-01-spices-of-morocco',
      titleJsonb: {
        ar: 'توابل المغرب',
        en: 'Spices of Morocco',
        es: 'Especias de Marruecos',
        it: 'Spezie del Marocco',
        pt: 'Especiarias de Marrocos',
      },
      category: 'Morocco',
      country: 'Morocco',
      city: 'Marrakech',
      basePriceUsd: 799,
      durationJsonb: {
        ar: '05 أيام / 04 ليالٍ',
        en: '05 Days / 04 Nights',
        es: '05 Días / 04 Noches',
        it: '05 Giorni / 04 Notti',
        pt: '05 Dias / 04 Noites',
      },
      minPaxJsonb: {
        ar: 'فردان',
        en: '2 Pax',
        es: '2 Pax',
        it: '2 Pax',
        pt: '2 Pax',
      },
      overviewJsonb: {
        ar: 'رحلة 5 أيام لاكتشاف كنوز المغرب: من طنجة إلى مراكش مروراً بفاس والرباط والدار البيضاء. استمتع بالمدن الإمبراطورية والأسواق التقليدية والهندسة المعمارية المغربية الأصيلة.',
        en: 'A 5-day journey to discover the treasures of Morocco: from Tangier to Marrakech via Fez, Rabat and Casablanca. Enjoy imperial cities, traditional souks and authentic Moroccan architecture.',
        es: 'Un viaje de 5 días para descubrir los tesoros de Marruecos: desde Tánger hasta Marrakech pasando por Fez, Rabat y Casablanca. Disfrute de ciudades imperiales, zocos tradicionales y auténtica arquitectura marroquí.',
        it: 'Un viaggio di 5 giorni alla scoperta dei tesori del Marocco: da Tangeri a Marrakech passando per Fez, Rabat e Casablanca. Godetevi città imperiali, souk tradizionali e autentica architettura marocchina.',
        pt: 'Uma viagem de 5 dias para descobrir os tesouros de Marrocos: de Tânger a Marraquexe passando por Fez, Rabat e Casablanca. Desfrute de cidades imperiais, souks tradicionais e autêntica arquitetura marroquina.',
      },
      includedServicesJsonb: {
        ar: [
          'النقل: كوستا ديل سول / طريفة / كوستا ديل سول',
          'تذاكر العبارة: طريفة / طنجة / طريفة',
          'النقل داخل المغرب',
          'مرشد مرافق طوال الجولة في المغرب',
          'إقامة 4 ليالٍ في الفندق بنظام الإقامة الكاملة جزئياً (3 وجبات عشاء + 1 وجبة غداء)',
          'الزيارات المذكورة في البرنامج',
        ],
        en: [
          'Transfers Costa del Sol / Tarifa / Costa del Sol',
          'Ferry tickets Tarifa / Tangier / Tarifa',
          'Transportation in Morocco',
          'Escort guide throughout the tour in Morocco',
          '4 nights hotel on half-board basis (3 dinners + 1 lunch)',
          'Visits mentioned in the program',
        ],
        es: [
          'Traslados Costa del Sol / Tarifa / Costa del Sol',
          'Billetes de ferry Tarifa / Tánger / Tarifa',
          'Transporte en Marruecos',
          'Guía acompañante en el tour en Marruecos',
          '4 noches de hotel en régimen de media pensión (3 cenas + 1 almuerzo)',
          'Visitas mencionadas en el programa',
        ],
        it: [
          'Trasferimenti Costa del Sol / Tarifa / Costa del Sol',
          'Biglietti del traghetto Tarifa / Tangeri / Tarifa',
          'Trasporto in Marocco',
          'Guida accompagnatrice nel tour in Marocco',
          '4 notti in hotel in regime di mezza pensione (3 cene + 1 pranzo)',
          'Visite menzionate nel programma',
        ],
        pt: [
          'Translados Costa del Sol / Tarifa / Costa del Sol',
          'Bilhetes de ferry Tarifa / Tânger / Tarifa',
          'Transporte em Marrocos',
          'Guia acompanhante no tour em Marrocos',
          '4 noites de hotel em regime de meia-pensão (3 jantares + 1 almoço)',
          'Visitas mencionadas no programa',
        ],
      },
      excludedServicesJsonb: {
        ar: ['تأشيرة دخول المغرب', 'إكراميات السفر والمساعدة'],
        en: ['Entry visa to Morocco', 'Travel tips and assistance'],
        es: ['Visado de entrada a Marruecos', 'Propinas de viaje y asistencia'],
        it: ['Visto d\'ingresso in Marocco', 'Mance di viaggio e assistenza'],
        pt: ['Visto de entrada em Marrocos', 'Gorjetas de viagem e assistência'],
      },
      itineraries: [
        {
          dayLabel: 'Day 1',
          descriptionJsonb: {
            ar: 'النقل من نقاط التجمع المختلفة في كوستا ديل سول نحو طريفة. ركوب العبارة من طريفة نحو طنجة. عند الوصول، يكون في الاستقبال مرشدنا المغربي الذي سيرافق الرحلة طوال الجولة. التحرك نحو مدينة مكناس الإمبراطورية، لإجراء جولة بانورامية للمدينة ولأسوار باب المنصور. المتابعة نحو فاس. الوصول في أواخر فترة بعد الظهر. العشاء والإقامة في الفندق.\n\nملاحظة هامة: تخضع مدينة مكناس حالياً لأعمال تجديد، مما يجعل زيارتها أمراً مستحيلاً نظراً للعدد الكبير من الأعمال الهامة التي يتم تنفيذها.',
            en: 'Transfer from the different pick-up points in Costa del Sol towards Tarifa. Boarding the ferry from Tarifa towards Tangier. Upon arrival, our Moroccan guide awaits, who will accompany the group throughout the tour. Departure to the imperial city of Meknes, for a panoramic tour of the city and the walls of Bab el Mansour. Continuation to Fez. Arrival in the late afternoon. Dinner and accommodation at the hotel.\n\nIMPORTANT NOTE: Currently, the city of Meknes is undergoing remodeling, which makes it impossible to visit due to the large number of major works being carried out.',
            es: 'Traslado desde los diferentes puntos de recogida de Costa del Sol hacia Tarifa. Embarque en ferry desde Tarifa hacia Tánger. A la llegada, espera nuestro guía marroquí que acompaña durante todo el recorrido. Salida hacia la ciudad imperial de Meknes, para hacer una visita panorámica de la ciudad y de las murallas de Bab el Mansour. Continuación hacia Fez. Llegada al final de la tarde. Cena y alojamiento en el hotel.\n\nNOTA IMPORTANTE: Actualmente la ciudad de Meknes se encuentra en remodelación, lo que hace que sea imposible poder visitarla debido a la gran cantidad de obras importantes que se están realizando.',
            it: 'Trasferimento dai diversi punti di raccolta della Costa del Sol verso Tarifa. Imbarco sul traghetto da Tarifa verso Tangeri. All\'arrivo, accoglienza da parte della nostra guida marocchina che accompagnerà il gruppo per tutto il viaggio. Partenza verso la città imperiale di Meknes, per una visita panoramica della città e delle mura di Bab el Mansour. Proseguimento verso Fez. Arrivo nel tardo pomeriggio. Cena e pernottamento in hotel.\n\nNOTA IMPORTANTE: Attualmente la città di Meknes è in fase di ristrutturazione, il che rende impossibile visitarla a causa del gran numero di importanti lavori in corso.',
            pt: 'Translado dos diferentes pontos de recolha da Costa del Sol em direção a Tarifa. Embarque em ferry de Tarifa em direção a Tânger. À chegada, espera-nos o nosso guia marroquino que acompanhará durante todo o percurso. Saída em direção à cidade imperial de Meknes, para fazer uma visita panorâmica da cidade e das muralhas de Bab el Mansour. Continuação em direção a Fez. Chegada ao final da tarde. Jantar e alojamento no hotel.\n\nNOTA IMPORTANTE: Atualmente a cidade de Meknes encontra-se em remodelação, o que torna impossível visitá-la devido à grande quantidade de obras importantes que estão a ser realizadas.',
          },
          mealsJsonb: { ar: 'عشاء', en: 'Dinner', es: 'Cena', it: 'Cena', pt: 'Jantar' },
          sortOrder: 0,
        },
        {
          dayLabel: 'Day 2',
          descriptionJsonb: {
            ar: 'الإفطار. زيارة كاملة للمدينة التي تعتبر العاصمة الدينية للبلاد. تأسست في القرن الثامن على يد إدريس الثاني، وتعتبر واحدة من العواصم الإمبراطورية الأربع للمغرب. خلال هذه الزيارة، يتم إجراء جولة في الأماكن الأكثر تميزاً مثل التصميم الخارجي للقصر الملكي، الحي اليهودي، والقلعة التي تتمتع بأفضل إطلالة على فاس البالي. العشاء والإقامة في الفندق.',
            en: 'Breakfast. Full visit of the city considered the religious capital of the country. Founded in the 8th century by Idriss II, it is considered one of the 4 imperial capitals of Morocco. During this visit, a tour is made of the most emblematic places such as the exterior of the Royal Palace, the Jewish quarter, and the fortress. Dinner and accommodation at the hotel.',
            es: 'Desayuno. Visita completa de la ciudad considerada la capital religiosa del país. Fundada en el siglo VIII por Idriss II. Durante esta visita se realiza un recorrido por los lugares más emblemáticos como los exteriores del Palacio Real, el barrio judío y la fortaleza. Cena y alojamiento en el hotel.',
            it: 'Colazione. Visita completa della città considerata la capitale religiosa del paese. Fondata nell\'VIII secolo da Idriss II. Durante questa visita si effettuerà un tour dei luoghi più emblematici come l\'esterno del Palazzo Reale, il quartiere ebraico e la fortezza. Cena e pernottamento in hotel.',
            pt: 'Pequeno-almoço. Visita completa da cidade considerada a capital religiosa do país. Fundada no século VIII por Idriss II. Durante esta visita realiza-se um percurso pelos locais mais emblemáticos como o exterior do Palácio Real, o bairro judeu e a fortaleza. Jantar e alojamento no hotel.',
          },
          mealsJsonb: { ar: 'إفطار + عشاء', en: 'Breakfast + Dinner', es: 'Desayuno + Cena', it: 'Colazione + Cena', pt: 'Pequeno-almoço + Jantar' },
          sortOrder: 1,
        },
        {
          dayLabel: 'Day 3',
          descriptionJsonb: {
            ar: 'الإفطار. المغادرة مبكراً نحو الرباط، عاصمة البلاد، لزيارة الأماكن الأكثر تميزاً في هذه المدينة مثل التصميم الخارجي للقصر الملكي، ضريح محمد الخامس، وصومعة حسان. المتابعة نحو الدار البيضاء لزيارة ساحة الأمم المتحدة، كورنيش عين الذئاب، والتصميم الخارجي لمسجد الحسن الثاني. وقت حر للغداء ثم المتابعة نحو مراكش. الإقامة في الفندق.',
            en: 'Breakfast. Early departure to Rabat, capital of the country, to visit the Royal Palace exterior, Mausoleum of Mohamed V, and Hassan Tower. Continuation to Casablanca to visit United Nations Square, Boulevard de la Corniche, and Hassan II Mosque exterior. Free time for lunch en route and continuation to Marrakech. Accommodation at hotel.',
            es: 'Desayuno. Salida temprano hacia Rabat, capital del país, para visitar los exteriores del palacio real, el Mausoleo de Mohamed V y la torre Hassan. Continuación hacia Casablanca para visitar la plaza de las Naciones Unidas, el Boulevard de la Corniche y los exteriores de la mezquita de Hassan II. Almuerzo libre en ruta y continuación hacia Marrakech. Alojamiento en el hotel.',
            it: 'Colazione. Partenza verso Rabat per visitare l\'esterno del palazzo reale, il Mausoleo di Mohamed V e la torre Hassan. Proseguimento verso Casablanca per visitare la piazza delle Nazioni Unite, il Boulevard de la Corniche e l\'esterno della moschea di Hassan II. Pranzo libero e proseguimento verso Marrakech. Pernottamento in hotel.',
            pt: 'Pequeno-almoço. Saída em direção a Rabat para visitar o exterior do palácio real, o Mausoléu de Mohamed V e a torre Hassan. Continuação em direção a Casablanca para visitar a Praça das Nações Unidas, o Boulevard de la Corniche e o exterior da mesquita de Hassan II. Almoço livre e continuação para Marraquexe. Alojamento no hotel.',
          },
          mealsJsonb: { ar: 'إفطار', en: 'Breakfast', es: 'Desayuno', it: 'Colazione', pt: 'Pequeno-almoço' },
          sortOrder: 2,
        },
        {
          dayLabel: 'Day 4',
          descriptionJsonb: {
            ar: 'الإفطار. زيارة مدينة مراكش: حدائق المنارة، مئذنة الكتبية، وقصر الباهية. الوصول إلى ساحة جامع الفناء والدخول إلى الأسواق والمدينة القديمة. الغداء في فندق بمراكش ثم المغادرة نحو الدار البيضاء. العشاء والإقامة في الفندق.',
            en: 'Breakfast. Visit Marrakech: Menara Gardens, Koutoubia minaret exterior, Bahia Palace, and Jemaa el Fna square. Lunch at hotel in Marrakech and departure to Casablanca. Dinner and accommodation at hotel.',
            es: 'Desayuno. Visita de Marrakech: Jardines de la Menara, minarete de la Koutoubia, Palacio de la Bahía y plaza de Jemaa el Fna. Almuerzo en hotel de Marrakech y posterior salida hacia Casablanca. Cena y alojamiento en el hotel.',
            it: 'Colazione. Visita di Marrakech: Giardini della Menara, minareto della Koutoubia, Palazzo della Bahia e piazza Jemaa el Fna. Pranzo in hotel a Marrakech e partenza verso Casablanca. Cena e pernottamento in hotel.',
            pt: 'Pequeno-almoço. Visita de Marraquexe: Jardins da Menara, minarete da Koutoubia, Palácio da Bahia e praça de Jemaa el Fna. Almoço no hotel em Marraquexe e saída para Casablanca. Jantar e alojamento no hotel.',
          },
          mealsJsonb: { ar: 'إفطار + غداء + عشاء', en: 'Breakfast + Lunch + Dinner', es: 'Desayuno + Almuerzo + Cena', it: 'Colazione + Pranzo + Cena', pt: 'Pequeno-almoço + Almoço + Jantar' },
          sortOrder: 3,
        },
        {
          dayLabel: 'Day 5',
          descriptionJsonb: {
            ar: 'الإفطار. المغادرة نحو طنجة والنقل إلى الميناء للمغادرة بالعبارة نحو طريفة. المتابعة نحو كوستا ديل سول والنقل للمطار للعودة للوطن.',
            en: 'Breakfast. Departure to Tangier and transfer to the port for ferry departure to Tarifa. Continuation to Costa del Sol and airport transfer for return flight.',
            es: 'Desayuno. Salida hacia Tánger y traslado al puerto para salida en ferry hacia Tarifa. Continuación hacia Costa del Sol y traslado al aeropuerto.',
            it: 'Colazione. Partenza verso Tangeri e trasferimento al porto per il traghetto per Tarifa. Proseguimento verso la Costa del Sol e trasferimento in aeroporto.',
            pt: 'Pequeno-almoço. Saída para Tânger e translado para o porto para saída em ferry para Tarifa. Continuação para a Costa del Sol e translado para o aeroporto.',
          },
          mealsJsonb: { ar: 'إفطار', en: 'Breakfast', es: 'Desayuno', it: 'Colazione', pt: 'Pequeno-almoço' },
          sortOrder: 4,
        },
      ],
      images: [
        'https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?auto=format&fit=crop&w=1920&q=80',
        'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1200&q=80',
      ],
    },
    {
      slug: 'cairo-express-4d',
      titleJsonb: {
        pt: 'Cairo Express',
        ar: 'القاهرة اكسبرس',
        en: 'Cairo Express',
        es: 'Cairo Express',
        it: 'Cairo Express',
      },
      category: 'egypt',
      country: 'Egypt',
      city: 'Cairo',
      basePriceUsd: 450,
      durationJsonb: {
        pt: '4 Dias / 3 Noites',
        ar: '4 أيام / 3 ليالٍ',
        en: '4 Days / 3 Nights',
        es: '4 Días / 3 Noches',
        it: '4 Giorni / 3 Notti',
      },
      overviewJsonb: {
        pt: 'Roteiro intenso de quatro dias explorando o coração do Egito Antigo. Visite as Pirâmides de Giza, a Esfinge, Memphis, Sakkara, o Grand Egyptian Museum, a Mesquita de Alabastro e o vibrante Mercado Khan El Khalili. Pacote completo com traslados, hospedagem e visto inclusos.',
        ar: 'برنامج مكثف لمدة أربعة أيام لاستكشاف قلب مصر القديمة. زيارة أهرامات الجيزة، أبو الهول، ممفيس، سقارة، المتحف المصري الكبير، مسجد الألباستر، وسوق خان الخليلي النابض بالحياة. باقة كاملة تشمل التوصيلات، الإقامة، والتأشيرة.',
        en: 'An intense 4-day itinerary exploring the heart of Ancient Egypt. Visit the Pyramids of Giza, the Sphinx, Memphis, Saqqara, the Grand Egyptian Museum, the Alabaster Mosque, and the vibrant Khan El Khalili market. Complete package with transfers, accommodation, and visa included.',
        es: 'Un itinerario intenso de 4 días explorando el corazón del Antiguo Egipto. Visita las Pirámides de Guiza, la Esfinge, Menfis, Saqqara, el Gran Museo Egipcio, la Mezquita de Alabastro y el vibrante Mercado Khan El Khalili.',
        it: 'Un intenso itinerario di 4 giorni alla scoperta del cuore dell\'Antico Egitto. Visita le Piramidi di Giza, la Sfinge, Menfi, Saqqara, il Grand Egyptian Museum, la Moschea di Alabastro e il mercato di Khan El Khalili.',
      },
      includedServicesJsonb: {
        pt: [
          '03 noites de hospedagem no Cairo em hotel de categoria escolhida com café da manhã e taxas',
          'Traslados: Aeroporto / Hotel / Aeroporto em serviço regular.',
          'Assistência no Aeroporto conforme roteiro',
          'Passeio no Cairo às Pirâmides e Esfinge, Memphis e Sakkara, Mastabas e Pirâmide de Teti',
          'Passeio e entrada ao Grand Egyptian Museum, Mesquita, Bairro Copta e Mercado Khan El Khalili',
        ],
        ar: [
          'إقامة لمدة 03 ليالٍ في القاهرة بالفندق المختار مع الإفطار والضرائب',
          'الانتقالات: المطار / الفندق / المطار بشركات خدمة منتظمة',
          'المساعدة بالمطار حسب خطة السير',
          'جولة القاهرة إلى الأهرامات وأبو الهول، ممفيس وسقارة، المصاطب وهرم تيتي',
          'جولة ودخول المتحف المصري الكبير، المسجد، الحي القبطي، وسوق خان الخليلي',
        ],
        en: [
          '03 nights accommodation in Cairo in chosen hotel category with breakfast and taxes',
          'Transfers: Airport / Hotel / Airport in regular service',
          'Airport assistance as per itinerary',
          'Cairo tour to Pyramids & Sphinx, Memphis & Saqqara, Mastabas and Pyramid of Teti',
          'Tour and entry to Grand Egyptian Museum, Mosque, Coptic Quarter and Khan El Khalili Market',
        ],
      },
      excludedServicesJsonb: {
        pt: [
          'Todas as bebidas durante o almoço e jantar nos passeios não estão inclusas',
          'Gorjetas aos maleteiros e carregadores obrigatórias',
          'Visto obrigatório 35$ pp, um representante lhe aguardando no desembarque para lhe entregar o visto e lhe auxiliar na imigração',
        ],
        ar: [
          'جميع المشروبات أثناء وجبتي الغداء والعشاء في الجولات غير شاملة',
          'إكراميات حاملي الحقائب والشيالين إجبارية',
          'التأشيرة الإجبارية 35$ للشخص، ممثل بانتظارك عند الوصول لتسليم التأشيرة والمساعدة في الجوازات',
        ],
        en: [
          'All beverages during lunches and dinners on tours are not included',
          'Mandatory porterage and tips',
          'Mandatory entry visa $35 per person, representative awaiting upon arrival to assist with visa and immigration',
        ],
      },
      itineraries: [
        {
          dayLabel: 'Day 1',
          descriptionJsonb: {
            pt: 'Chegada no Aeroporto Internacional do Cairo. Traslado para o Hotel. Conforme o horário de chegada é possível oferecer algum passeio opcional.',
            ar: 'الوصول إلى مطار القاهرة الدولي والنقل إلى الفندق. حسب وقت الوصول، يمكن تقديم بعض الجولات الاختيارية.',
            en: 'Arrival at Cairo International Airport and transfer to Hotel. Optional tours available depending on arrival time.',
            es: 'Llegada al Aeropuerto Internacional del Cairo y traslado al Hotel.',
            it: 'Arrivo all\'Aeroporto Internazionale del Cairo e trasferimento in Hotel.',
          },
          sortOrder: 0,
        },
        {
          dayLabel: 'Day 2',
          descriptionJsonb: {
            pt: 'Pirâmides, Esfinge, Fábrica de Papiros, Memphis e Sakkara. Café da manhã no hotel e saída para visita às pirâmides de Giza: Quéops, Quefren e Miquerinos. Mirante das Pirâmides, Esfinge, Memphis, Pirâmide de Djoser, almoço em restaurante local, mastabas, Pirâmide de Teti e fábrica de papiros. Retorno ao hotel.',
            ar: 'الأهرامات، أبو الهول، مصنع البردي، ممفيس وسقارة. الإفطار بالفندق والانطلاق لزيارة أهرامات الجيزة: خوفو، خفرع، ومنقرع. البانوراما، زيارة أبو الهول، ممفيس وسقارة، هرم زوسر، الغداء بمطعم محلي، المصاطب، هرم تيتي، ومصنع البردي. العودة للفندق.',
            en: 'Pyramids, Sphinx, Papyrus Factory, Memphis and Saqqara. Breakfast at hotel and departure to visit Giza Pyramids: Khufu, Khafre, and Menkaure. Panoramic view, Sphinx visit, Memphis, Djoser Step Pyramid, local restaurant lunch, Mastabas, Teti Pyramid, and papyrus factory stop.',
            es: 'Pirámides de Guiza, Esfinge, Fábrica de Papiros, Menfis y Saqqara. Almuerzo incluido.',
            it: 'Piramidi di Giza, Sfinge, Fabbrica di Papiri, Menfi e Saqqara. Pranzo incluso.',
          },
          sortOrder: 1,
        },
        {
          dayLabel: 'Day 3',
          descriptionJsonb: {
            pt: 'Novo Museu (GEM), Mesquita de Alabastro, Mercado Khan El Khalili. Café da manhã no hotel e saída para a visita ao Novo Museu, Mesquita de Alabastro e Cidadela de Saladino, passeio a pé pelo Bairro Copta e ao mercado Khan El Khalili. Almoço em restaurante local. Retorno para o hotel.',
            ar: 'المتحف الجديد (GEM)، مسجد الألباستر، سوق خان الخليلي. الإفطار بالفندق والانطلاق لزيارة المتحف الجديد، مسجد الألباستر، قلعة صلاح الدين، جولة سير في الحي القبطي، وسوق خان الخليلي. الغداء بمطعم محلي، ثم العودة للفندق.',
            en: 'Grand Egyptian Museum (GEM), Alabaster Mosque, Khan El Khalili Market. Breakfast at hotel and departure to visit Grand Egyptian Museum, Alabaster Mosque, Citadel of Saladin, walking tour in Coptic Quarter and Khan El Khalili market. Lunch at local restaurant.',
            es: 'Gran Museo Egipcio (GEM), Mezquita de Alabastro, Mercado Khan El Khalili.',
            it: 'Grand Egyptian Museum (GEM), Moschea di Alabastro, Mercato Khan El Khalili.',
          },
          sortOrder: 2,
        },
        {
          dayLabel: 'Day 4',
          descriptionJsonb: {
            pt: 'Cairo / Aeroporto. Café da manhã no hotel e saída ao Aeroporto para voo internacional de retorno ao seu país de origem. Fim de nossos serviços.',
            ar: 'القاهرة / المطار. الإفطار بالفندق ثم الخروج للمطار لاستقلال رحلة الطيران الدولية للعودة للوطن. نهاية خدماتنا.',
            en: 'Cairo / Airport. Breakfast at hotel and transfer to Airport for international departure flight. End of our services.',
            es: 'El Cairo / Aeropuerto. Traslado al aeropuerto para el vuelo de regreso.',
            it: 'Il Cairo / Aeroporto. Trasferimento in aeroporto per il volo di retorno.',
          },
          sortOrder: 3,
        },
      ],
      images: [
        'https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?q=80&w=1200',
        'https://images.unsplash.com/photo-1572252821143-035a0f6700c2?q=80&w=1200',
        'https://images.unsplash.com/photo-1539650116574-75c0c6d73c0e?q=80&w=1200',
      ],
    },
    {
>>>>>>> 39ecdfb (feat(tours): add Morocco MRC-01 Spices of Morocco tour in 5 languages)
      slug: 'passion-of-turkey',
      titleJsonb: {
        en: 'Passion of Turkey',
        es: 'Pasión de Turquía',
        ar: 'عشق تركيا',
        pt: 'Paixão da Turquia',
        it: 'Passione della Turchia',
      },
      category: 'turkey',
      basePriceUsd: 1200,
      durationJsonb: {
        en: '10 Days / 9 Nights',
        es: '10 Días / 9 Noches',
        ar: '10 أيام / 9 ليالي',
      },
      overviewJsonb: {
        en: 'Discover the magic of Turkey — from the minarets of Istanbul to the otherworldly landscapes of Cappadocia.',
        es: 'Descubre la magia de Turquía.',
        ar: 'اكتشف سحر تركيا من مآذن إسطنبول إلى تضاريس كابادوكيا.',
      },
      itineraries: [
        {
          dayLabel: 'Day 1',
          descriptionJsonb: {
            en: 'Arrival in Istanbul. Transfer to hotel. Welcome dinner.',
            ar: 'الوصول إلى إسطنبول. نقل إلى الفندق. عشاء ترحيبي.',
          },
          sortOrder: 0,
        },
        {
          dayLabel: 'Day 2',
          descriptionJsonb: {
            en: 'Full day tour of the Hagia Sophia, Blue Mosque, and Grand Bazaar.',
            ar: 'جولة كاملة في آيا صوفيا والمسجد الأزرق والبازار الكبير.',
          },
          sortOrder: 1,
        },
      ],
      images: [
        'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=1200',
        'https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?w=1200',
      ],
    },
    {
      slug: 'wonders-of-egypt',
      titleJsonb: {
        en: 'Wonders of Egypt',
        es: 'Maravillas de Egipto',
        ar: 'عجائب مصر',
        pt: 'Maravilhas do Egito',
        it: "Meraviglie dell'Egitto",
      },
      category: 'egypt',
      basePriceUsd: 950,
      durationJsonb: {
        en: '8 Days / 7 Nights',
        es: '8 Días / 7 Noches',
        ar: '8 أيام / 7 ليالي',
      },
      overviewJsonb: {
        en: 'Walk in the footsteps of pharaohs. Explore the Great Pyramids, cruise the Nile, and uncover ancient temples.',
        es: 'Camina en los pasos de los faraones.',
        ar: 'اتبع خطى الفراعنة. استكشف الأهرامات العظيمة وابحر في النيل.',
      },
      itineraries: [
        {
          dayLabel: 'Day 1',
          descriptionJsonb: {
            en: 'Arrival in Cairo. Transfer to hotel. Orientation tour.',
            ar: 'الوصول إلى القاهرة. نقل إلى الفندق. جولة تعريفية.',
          },
          sortOrder: 0,
        },
        {
          dayLabel: 'Day 2',
          descriptionJsonb: {
            en: 'Visit the Great Pyramids of Giza and the Sphinx.',
            ar: 'زيارة أهرامات الجيزة العظيمة وأبو الهول.',
          },
          sortOrder: 1,
        },
      ],
      images: [
        'https://images.unsplash.com/photo-1539650116574-75c0c6d73c0e?w=1200',
        'https://images.unsplash.com/photo-1568322445389-f64ac2515020?w=1200',
      ],
    },
    {
      slug: 'jewels-of-jordan',
      titleJsonb: {
        en: 'Jewels of Jordan',
        es: 'Joyas de Jordania',
        ar: 'جواهر الأردن',
        pt: 'Jóias da Jordânia',
        it: 'Gioielli della Giordania',
      },
      category: 'jordan',
      basePriceUsd: 1100,
      durationJsonb: {
        en: '7 Days / 6 Nights',
        ar: '7 أيام / 6 ليالي',
      },
      overviewJsonb: {
        en: 'From the rose-red city of Petra to the vast silence of Wadi Rum — Jordan is a land of timeless wonder.',
        ar: 'من مدينة البتراء الوردية إلى صحراء وادي رم الشاسعة.',
      },
      itineraries: [
        {
          dayLabel: 'Day 1',
          descriptionJsonb: {
            en: 'Arrival in Amman. Transfer to hotel.',
            ar: 'الوصول إلى عمّان. نقل إلى الفندق.',
          },
          sortOrder: 0,
        },
      ],
      images: [
        'https://images.unsplash.com/photo-1548786811-dd4f764bc046?w=1200',
      ],
    },
  ];

  for (const t of fallbackTours) {
    const existing = await prisma.tour.findUnique({
      where: { slug: t.slug },
    });

    if (existing) {
      console.log(`  ↩  Already exists: ${t.slug}`);
      continue;
    }

    const { itineraries, images, ...tourData } = t;

    const tour = await prisma.tour.create({
      data: { ...tourData, isActive: true },
    });

    for (const day of itineraries) {
      await prisma.tourItinerary.create({
        data: { tourId: tour.id, ...day },
      });
    }

    for (let i = 0; i < images.length; i++) {
      await prisma.tourImage.create({
        data: {
          tourId: tour.id,
          imageUrl: images[i],
          isHero: i === 0,
          sortOrder: i,
        },
      });
    }

    console.log(`  ✅ Fallback seeded: ${t.slug}`);
  }
}

async function seedContactSubmissions(): Promise<void> {
  console.log('\n📌 Seeding contact submissions...');
  const submissions = [
    {
      referenceCode: 'CON-A1B2C3',
      status: 'NEW',
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
      subject: 'Group Tour Inquiry',
      message: 'I would like to organize a group tour for 10 people.',
      locale: 'en',
    },
    {
      referenceCode: 'CON-X9Y8Z7',
      status: 'READ',
      firstName: 'Bob',
      lastName: 'Jones',
      email: 'bob@example.com',
      subject: 'Payment Question',
      message: 'Do you accept wire transfers?',
      locale: 'en',
    },
    {
      referenceCode: 'CON-M5N6P7',
      status: 'ARCHIVED',
      firstName: 'Carlos',
      lastName: 'Santana',
      email: 'carlos@example.com',
      subject: 'Información sobre tours',
      message: 'Me gustaría recibir información sobre los tours en español.',
      locale: 'es',
    },
  ];

  for (const sub of submissions) {
    const existing = await prisma.contactSubmission.findUnique({
      where: { referenceCode: sub.referenceCode },
    });

    if (existing) {
      console.log(`  ↩  Already exists: ${sub.referenceCode}`);
      continue;
    }

    try {
      // Need to cast the status string to the enum type generated by Prisma
      await prisma.contactSubmission.create({
        data: {
          ...sub,
          status: sub.status as 'NEW' | 'READ' | 'ARCHIVED',
        },
      });
      console.log(`  ✅ Seeded contact submission: ${sub.referenceCode}`);
    } catch (err) {
      console.error(
        `  ❌ Failed to seed contact submission: ${sub.referenceCode}`,
        err,
      );
    }
  }
}

async function seedSuperAdmin(): Promise<void> {
  console.log('\n📌 Seeding super admin...');
  const email = process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log(
      '  ↩  Super admin bootstrap skipped (one-time credentials are not configured).',
    );
    return;
  }

  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_PRODUCTION_ADMIN_BOOTSTRAP !== 'true'
  ) {
    throw new Error(
      'Refusing production bootstrap without ALLOW_PRODUCTION_ADMIN_BOOTSTRAP=true.',
    );
  }

  if (
    password.length < 16 ||
    /password|admin|dunas|1234|qwerty/i.test(password)
  ) {
    throw new Error(
      'BOOTSTRAP_SUPER_ADMIN_PASSWORD must be at least 16 characters and unpredictable.',
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    console.log('  ↩  Super admin already exists; seed will not modify it.');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      email,
      name: 'Super Admin',
      passwordHash,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      isVerified: true,
    },
  });
  console.log('  ✅ One-time super admin bootstrap completed.');
}

async function seedCmsBlocks(): Promise<void> {
  console.log('\n📌 Seeding default CMS blocks...');
  const blocks = [
    { key: 'homepage-hero', content: { en: 'Welcome to Dunas Travel' } },
    { key: 'footer-info', content: { en: '© 2026 Dunas Travel' } },
    {
      key: 'hotels_catalog',
      content: [
        {
          id: 'htl-eg-01',
          name: 'Four Seasons Hotel Cairo at Nile Plaza',
          destination: 'egypt',
          city: 'Cairo',
          stars: 5,
          rating: 4.9,
          pricePerNight: 350,
          image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
          description: 'إطلالة بانورامية ساحرة على نهر النيل وقلب القاهرة التاريخية مع خدمات كونسيرج فاخرة على مدار الساعة.',
          amenities: ['Spa & Wellness', 'Nile View', 'Fine Dining', 'Infinity Pool']
        },
        {
          id: 'htl-eg-02',
          name: 'Sofitel Legend Old Cataract Aswan',
          destination: 'egypt',
          city: 'Aswan',
          stars: 5,
          rating: 4.95,
          pricePerNight: 420,
          image: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&q=80',
          description: 'قصر تاريخي فخم على ضفاف النيل بأسوان استضاف أشهر ملوك العالم وأجاثا كريستي.',
          amenities: ['Historic Palace', 'Royal Suite', 'Sunset Terrace', 'Luxury Spa']
        },
        {
          id: 'htl-tr-01',
          name: 'Ciragan Palace Kempinski Istanbul',
          destination: 'turkey',
          city: 'Istanbul',
          stars: 5,
          rating: 4.9,
          pricePerNight: 500,
          image: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800&q=80',
          description: 'القصر العثماني الوحيد على مضيق البوسفور الذي يقدم تجربة إقامة ملكية استثنائية.',
          amenities: ['Bosphorus View', 'Ottoman Cuisine', 'Helipad', 'Heated Pool']
        },
        {
          id: 'htl-jo-01',
          name: 'Kempinski Hotel Ishtar Dead Sea',
          destination: 'jordan',
          city: 'Dead Sea',
          stars: 5,
          rating: 4.85,
          pricePerNight: 280,
          image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=800&q=80',
          description: 'ملاذ استرخاء فاخر على شاطئ البحر الميت محاط بحدائق معلقة وبحيرات سباحة خاصة.',
          amenities: ['Private Beach', 'Dead Sea Mud Spa', '9 Pools', 'Fine Dining']
        }
      ]
    },
    {
      key: 'holiday_packages',
      content: [
        {
          id: 'pkg-egypt-classic',
          title: 'برنامج مصر الكلاسيكي الشامل (القاهرة والنيل)',
          slug: 'egypt-classic-package',
          destination: 'Multi-City Egypt',
          duration: '8 أيام / 7 ليالي',
          price: 1850,
          type: 'Classic Holiday',
          popular: true,
          description: 'رحلة كلاسيكية فاخرة تشمل أهرامات الجيزة، المتحف الكبير، وإقامة كروز 5 نجوم بين الأقصر وأسوان.',
          image: 'https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?auto=format&fit=crop&w=800&q=80'
        },
        {
          id: 'pkg-egypt-dubai',
          title: 'باكدج مصر ودبي الفاخر (Multi-Country)',
          slug: 'egypt-dubai-combo',
          destination: 'Multi-Country',
          duration: '10 أيام / 9 ليالي',
          price: 2450,
          type: 'Luxury Combo',
          popular: true,
          description: 'أفضل دمج بين سحر الحضارة الفرعونية وفخامة أبراج وتسوق دبي مع إقامة في فنادق 5 نجوم.',
          image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=80'
        },
        {
          id: 'pkg-honeymoon-redsea',
          title: 'باكدج شهر العسل (القاهرة والجونة)',
          slug: 'honeymoon-red-sea',
          destination: 'Egypt Resorts',
          duration: '7 أيام / 6 ليالي',
          price: 1650,
          type: 'Honeymoon',
          popular: false,
          description: 'عطلة رومانسية هادئة تشمل منتجعات الجونة الفاخرة، يخت خاص في البحر الأحمر، وعشاء فاخر على ضفاف النيل.',
          image: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=800&q=80'
        }
      ]
    },
    {
      key: 'transportation_fleet',
      content: [
        {
          id: 'veh-bus-01',
          name: 'Mercedes-Benz Tourismo VIP Coach',
          category: 'bus',
          seats: 48,
          doors: 2,
          rating: 4.95,
          pricePerDay: 450,
          image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80',
          features: ['تكييف هوائي كامل', 'واي فاي 5G مجاني', 'مقاعد جلدية مريحة', 'شاشات عرض ترفيهية', 'ثلاجة ومشروبات', 'سائق محترف متعدد اللغات']
        },
        {
          id: 'veh-van-01',
          name: 'Mercedes-Benz Sprinter Executive',
          category: 'van',
          seats: 14,
          doors: 2,
          rating: 4.9,
          pricePerDay: 280,
          image: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=800&q=80',
          features: ['مقاعد VIP قابلة للإمالة', 'منافذ شحن USB', 'واي فاي مجاني', 'عازل صوت ممتاز', 'إضاءة محيطية هادئة']
        },
        {
          id: 'veh-sedan-01',
          name: 'Mercedes-Benz S-Class Maybach Edition',
          category: 'luxury_sedan',
          seats: 4,
          doors: 4,
          rating: 5.0,
          pricePerDay: 350,
          image: 'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=800&q=80',
          features: ['خدمة VIP Chauffeur', 'مقاعد مساج وتبريد', 'شامبانيا وضيافة فاخرة', 'نظام صوتي Burmester']
        },
        {
          id: 'veh-suv-01',
          name: 'Toyota Land Cruiser V8 Safari 4x4',
          category: 'suv',
          seats: 6,
          doors: 5,
          rating: 4.85,
          pricePerDay: 220,
          image: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80',
          features: ['دفع رباعي للصحراء والسفاري', 'قفص حماية معزز', 'نظام تبريد صحراوي فائق', 'جهاز ملاحة GPS واتصال بالأقمار الصناعية']
        }
      ]
    }
  ];

  for (const block of blocks) {
    const existing = await prisma.cmsBlock.findUnique({
      where: { key: block.key },
    });

    if (existing) {
      console.log(`  ↩  Already exists: ${block.key}`);
      continue;
    }

    await prisma.cmsBlock.create({
      data: {
        key: block.key,
        content: block.content,
      },
    });
    console.log(`  ✅ Seeded CMS block: ${block.key}`);
  }
}

async function seedMockBookings(): Promise<void> {
  console.log('\n📌 Seeding mock bookings, customers, and finance...');
  const tours = await prisma.tour.findMany();
  if (tours.length === 0) {
    console.log('  ⚠  No tours found to attach bookings to.');
    return;
  }

  // Create mock users (customers)
  const customers = [];
  for (let i = 1; i <= 5; i++) {
    let customer = await prisma.user.findUnique({
      where: { email: `customer${i}@example.com` },
    });
    if (!customer) {
      customer = await prisma.user.create({
        data: {
          email: `customer${i}@example.com`,
          name: `Customer ${i}`,
          passwordHash: 'dummy',
          role: 'USER',
          status: 'ACTIVE',
          customerNumber: `CUST-100${i}`,
        },
      });
    }
    customers.push(customer);
  }

  // Create wallet for first customer
  let wallet = await prisma.wallet.findUnique({
    where: {
      ownerType_ownerId: { ownerType: 'USER', ownerId: customers[0].id },
    },
  });
  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: {
        ownerType: 'USER',
        ownerId: customers[0].id,
        balance: 500.0,
        currency: 'USD',
      },
    });
    await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: 500.0,
        type: 'CREDIT',
        referenceType: 'MANUAL_ADDITION',
        status: 'COMPLETED',
      },
    });
  }

  // Create some bookings
  for (let i = 1; i <= 10; i++) {
    const refCode = `BKG-2026-${i.toString().padStart(3, '0')}`;
    const existing = await prisma.booking.findUnique({
      where: { referenceCode: refCode },
    });
    if (existing) continue;

    const tour = tours[i % tours.length];
    const customer = customers[i % customers.length];

    const booking = await prisma.booking.create({
      data: {
        referenceCode: refCode,
        userId: customer.id,
        tourId: tour.id,
        status: i % 3 === 0 ? 'CONFIRMED' : 'PENDING',
        arrivalDate: new Date(new Date().getTime() + i * 86400000 * 5),
        totalAmountUsd: tour.basePriceUsd,
        paidAmountUsd: i % 3 === 0 ? tour.basePriceUsd : 0,
        adults: 2,
        bookingType: 'BOOKING',
        priority: 'MEDIUM',
        billingInfo: {
          create: {
            fullName: customer.name,
            email: customer.email,
            phone: '+1234567890',
            invoiceType: 'PERSONAL',
          },
        },
        passengers: {
          create: [
            { passengerType: 'ADULT', fullName: customer.name },
            { passengerType: 'ADULT', fullName: `Partner of ${customer.name}` },
          ],
        },
      },
    });

    if (Number(booking.paidAmountUsd) > 0) {
      await prisma.payment.create({
        data: {
          bookingId: booking.id,
          amount: booking.paidAmountUsd,
          currency: 'USD',
          method: 'CREDIT_CARD',
          status: 'CAPTURED',
          transactionId: `txn_${Date.now()}`,
        },
      });
      await prisma.invoice.create({
        data: {
          bookingId: booking.id,
          invoiceNumber: `INV-${refCode}`,
        },
      });
    }

    console.log(`  ✅ Seeded booking: ${refCode}`);
  }
}

async function seedTourLandingPages(): Promise<void> {
  console.log('\n📌 Seeding Tour Landing Pages (Interfaces)...');

  const landingPagesData = [
    {
      slug: 'egypt',
      type: 'DESTINATION',
      titleJsonb: {
        en: 'Egypt',
        es: 'Egipto',
        ar: 'مصر',
        pt: 'Egito',
        it: 'Egitto',
      },
      subtitleJsonb: {
        en: 'Land of the Pharaohs',
        es: 'Tierra de los Faraones',
        ar: 'أرض الفراعنة',
        pt: 'Terra dos Faraós',
        it: 'Terra dei Faraoni',
      },
      descriptionJsonb: {
        en: 'From the timeless Pyramids of Giza to the golden temples of Luxor and the crystal waters of the Red Sea, Egypt offers a journey through history like no other.',
        es: 'Desde las pirámides hasta el mar Rojo, descubre la cuna de la civilización.',
        ar: 'من أهرامات الجيزة إلى معابد الأقصر وشواطئ البحر الأحمر الساحرة.',
        pt: 'Das pirâmides ao Rio Nilo, viva uma experiência inesquecível.',
        it: 'Dalle piramidi al Nilo, un viaggio straordinario.',
      },
      heroImageUrl: '/imgs/egyothero.png',
      status: 'PUBLISHED',
      isActive: true,
      sortOrder: 1,
    },
    {
      slug: 'turkey',
      type: 'DESTINATION',
      titleJsonb: {
        en: 'Turkey',
        es: 'Turquía',
        ar: 'تركيا',
        pt: 'Turquia',
        it: 'Turchia',
      },
      subtitleJsonb: {
        en: 'Where East Meets West',
        es: 'Donde Oriente se encuentra con Occidente',
        ar: 'ملتقى الشرق والغرب',
        pt: 'Onde o Oriente se Encontra com o Ocidente',
        it: "Dove l'Oriente Incontra l'Occidente",
      },
      descriptionJsonb: {
        en: 'Explore Istanbul, the fairy chimneys of Cappadocia, ancient Ephesus, and travertine pools of Pamukkale.',
        es: 'Descubre Estambul, Capadoccia y los tesoros de Turquía.',
        ar: 'استكشف إسطنبول وكابادوكيا ومناظر تركيا الطبيعية التاريخية.',
        pt: 'Conheça Istambul e os balões da Capadócia.',
        it: 'Esplora Istanbul e la Cappadocia.',
      },
      heroImageUrl:
        'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=1200',
      status: 'PUBLISHED',
      isActive: true,
      sortOrder: 2,
    },
    {
      slug: 'jordan',
      type: 'DESTINATION',
      titleJsonb: {
        en: 'Jordan',
        es: 'Jordania',
        ar: 'الأردن',
        pt: 'Jordânia',
        it: 'Giordania',
      },
      subtitleJsonb: {
        en: 'Kingdom of Wonder',
        es: 'Reino de Maravillas',
        ar: 'مملكة العجائب',
        pt: 'Reino das Maravilhas',
        it: 'Regno delle Meraviglie',
      },
      descriptionJsonb: {
        en: 'Walk in the pink-red sandstone canyons of Petra and float on the Dead Sea.',
        es: 'Explora la legendaria ciudad de Petra y el desierto de Wadi Rum.',
        ar: 'زيارة مدينة البتراء الوردية ووادي رم والبحر الميت.',
        pt: 'Descubra Petra e o deserto de Wadi Rum.',
        it: 'Visita la magica città di Petra.',
      },
      heroImageUrl:
        'https://images.unsplash.com/photo-1548786811-dd4f764bc046?w=1200',
      status: 'PUBLISHED',
      isActive: true,
      sortOrder: 3,
    },
    {
      slug: 'morocco',
      type: 'DESTINATION',
      titleJsonb: {
        en: 'Morocco',
        es: 'Marruecos',
        ar: 'المغرب',
        pt: 'Marrocos',
        it: 'Marocco',
      },
      subtitleJsonb: {
        en: 'Land of Colors & Spices',
        es: 'Tierra de Colores y Especias',
        ar: 'أرض الألوان والتوابل',
        pt: 'Terra de Cores e Especiarias',
        it: 'Terra di Colori e Spezie',
      },
      descriptionJsonb: {
        en: 'Discover Marrakech, Fes, Chefchaouen, and the Sahara desert dunes.',
        es: 'Descubre Marrakech, Fez y las dunas del Sahara.',
        ar: 'رحلات عبر مراكش وفاس والصحراء الكبرى.',
        pt: 'Explore as cidades imperiais de Marrocos.',
        it: 'Scopri le città imperiali del Marocco.',
      },
      heroImageUrl:
        'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=1200',
      status: 'PUBLISHED',
      isActive: true,
      sortOrder: 4,
    },
    {
      slug: 'greece',
      type: 'DESTINATION',
      titleJsonb: {
        en: 'Greece',
        es: 'Grecia',
        ar: 'اليونان',
        pt: 'Grécia',
        it: 'Grecia',
      },
      subtitleJsonb: {
        en: 'Cradle of Civilization',
        es: 'Cuna de la Civilización',
        ar: 'مهد الحضارة',
        pt: 'Berço da Civilização',
        it: 'Culla della Civiltà',
      },
      descriptionJsonb: {
        en: 'Experience Athens Acropolis and breathtaking Aegean islands.',
        es: 'Atenas, Santorini y las islas griegas.',
        ar: 'استكشف أثينا وجزر اليونان الساحرة.',
        pt: 'Visite Atenas e as ilhas gregas.',
        it: 'Visita Atene e le isole greche.',
      },
      heroImageUrl:
        'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=1200',
      status: 'PUBLISHED',
      isActive: true,
      sortOrder: 5,
    },
    {
      slug: 'dubai',
      type: 'DESTINATION',
      titleJsonb: {
        en: 'Dubai',
        es: 'Dubái',
        ar: 'دبي',
        pt: 'Dubai',
        it: 'Dubai',
      },
      subtitleJsonb: {
        en: 'City of the Future',
        es: 'Ciudad del Futuro',
        ar: 'مدينة المستقبل',
        pt: 'Cidade do Futuro',
        it: 'Città del Futuro',
      },
      descriptionJsonb: {
        en: 'Ultra-modern architecture, desert safaris, and luxury shopping.',
        es: 'Lujo, arquitectura moderna y safaris en el desierto.',
        ar: 'ناطحات السحاب والسفاري والتسوق الفاخر.',
        pt: 'O luxo e a modernidade de Dubai.',
        it: 'Lusso e modernità a Dubai.',
      },
      heroImageUrl:
        'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200',
      status: 'PUBLISHED',
      isActive: true,
      sortOrder: 6,
    },
    {
      slug: 'tunisia',
      type: 'DESTINATION',
      titleJsonb: {
        en: 'Tunisia',
        es: 'Túnez',
        ar: 'تونس',
        pt: 'Tunísia',
        it: 'Tunisia',
      },
      subtitleJsonb: {
        en: 'Oasis & Mediterranean Charm',
        es: 'Oasis y Encanto Mediterráneo',
        ar: 'سحر الواحات والمتوسط',
        pt: 'Oásis e Charme Mediterrâneo',
        it: 'Oasi e Fascino Mediterraneo',
      },
      descriptionJsonb: {
        en: 'Carthage ruins, Sidi Bou Said, and Sahara oases.',
        es: 'Cartago, Sidi Bou Said y los oasis de Túnez.',
        ar: 'آثار قرطاج وسيدي بوسعيد وواحات الصحراء.',
        pt: 'Conheça as ruínas de Cartago e Sidi Bou Said.',
        it: 'Scopri Cartagine e Sidi Bou Said.',
      },
      heroImageUrl:
        'https://images.unsplash.com/photo-1548786811-dd4f764bc046?w=1200',
      status: 'PUBLISHED',
      isActive: true,
      sortOrder: 7,
    },
    {
      slug: 'multi-country',
      type: 'THEME',
      titleJsonb: {
        en: 'Multi-Country Tours',
        es: 'Tours Multipaís',
        ar: 'رحلات متعددة الدول',
        pt: 'Tours Multi-Países',
        it: 'Tour Multi-Paese',
      },
      subtitleJsonb: {
        en: 'Grand Middle East Expeditions',
        es: 'Grandes Expediciones por Medio Oriente',
        ar: 'رحلات شاملة عبر الشرق الأوسط',
        pt: 'Grandes Expedições pelo Oriente Médio',
        it: 'Grandi Spedizioni in Medio Oriente',
      },
      descriptionJsonb: {
        en: 'Combined travel packages covering Egypt, Jordan, Turkey, Dubai, and Morocco.',
        es: 'Paquetes combinados visitando varios países de Medio Oriente.',
        ar: 'رحلات تجمع بين مصر والأردن وتركيا والإمارات والمغرب.',
        pt: 'Pacotes combinando Egito, Jordânia e Turquia.',
        it: 'Pacchetti combinati in Medio Oriente.',
      },
      heroImageUrl:
        'https://res.cloudinary.com/degbrq3ck/image/upload/v1783030113/Gemini_Generated_Image_cb2enncb2enncb2e_wvyejn.jpg',
      status: 'PUBLISHED',
      isActive: true,
      sortOrder: 8,
    },
    {
      slug: 'religious',
      type: 'THEME',
      titleJsonb: {
        en: 'Religious Tours',
        es: 'Tours Religiosos',
        ar: 'رحلات دينية',
        pt: 'Tours Religiosos',
        it: 'Tour Religiosi',
      },
      subtitleJsonb: {
        en: 'Sacred Footsteps & Pilgrimages',
        es: 'Huellas Sagradas y Peregrinaciones',
        ar: 'مسارات مقدسة ورحلات إيمانية',
        pt: 'Pegadas Sagradas e Peregrinações',
        it: 'Impronte Sacre e Pellegrinaggi',
      },
      descriptionJsonb: {
        en: 'Holy land pilgrimages and spiritual journeys across sacred historical sites.',
        es: 'Peregrinaciones a Tierra Santa y sitios sagrados.',
        ar: 'رحلات إيمانية وزيارة المعالم المقدسة.',
        pt: 'Peregrinações pela Terra Santa.',
        it: 'Pellegrinaggi in Terra Santa.',
      },
      heroImageUrl:
        'https://www.saintjeromechurch.org/wp-content/uploads/2025/03/14714-what-is-ccd-in-catholic-church-religious-education-programs-explained.png',
      status: 'PUBLISHED',
      isActive: true,
      sortOrder: 9,
    },
  ];

  for (const page of landingPagesData) {
    const existing = await prisma.tourLandingPage.findUnique({
      where: { slug: page.slug },
    });
    let landingPageId: string;

    if (existing) {
      console.log(`  ↩  Landing Page exists: ${page.slug}`);
      landingPageId = existing.id;
    } else {
      const created = await prisma.tourLandingPage.create({ data: page });
      console.log(`  ✅ Seeded Landing Page: ${page.slug}`);
      landingPageId = created.id;
    }

    // Connect tours matching category, country or slug
    const matchingTours = await prisma.tour.findMany({
      where: {
        OR: [
          { category: { equals: page.slug, mode: 'insensitive' } },
          { country: { equals: page.slug, mode: 'insensitive' } },
          { slug: { contains: page.slug, mode: 'insensitive' } },
        ],
      },
    });

    let sortIndex = 1;
    for (const tour of matchingTours) {
      await prisma.tourLandingPageTour.upsert({
        where: {
          landingPageId_tourId: {
            landingPageId,
            tourId: tour.id,
          },
        },
        create: {
          landingPageId,
          tourId: tour.id,
          sortOrder: sortIndex++,
          isFeatured: tour.isFeatured,
          isVisible: true,
        },
        update: {},
      });
    }

    if (matchingTours.length > 0) {
      console.log(
        `     └ Attached ${matchingTours.length} tours to '${page.slug}'`,
      );
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n🌱 Starting Dunas Travel database seed...\n');
  const isProduction = process.env.NODE_ENV === 'production';
  const seedDemoData = process.env.SEED_DEMO_DATA === 'true';

  if (isProduction || process.env.ALLOW_DEVELOPMENT_SEED !== 'true') {
    throw new Error('Seeds are development-only. Refusing to run without ALLOW_DEVELOPMENT_SEED=true outside production.');
  }

  // Attempt to read programs.json from the frontend
  const possiblePaths = [
    path.join(__dirname, 'data/ahmed-tours.normalized.json'),
    path.join(process.cwd(), 'prisma/data/ahmed-tours.normalized.json'),
  ];

  let programs: RawProgram[] | null = null;

  for (const jsonPath of possiblePaths) {
    if (fs.existsSync(jsonPath)) {
      console.log(`📂 Found programs.json at: ${jsonPath}`);
      try {
        const raw = fs.readFileSync(jsonPath, 'utf-8');
        const parsed: unknown = JSON.parse(raw);

        if (Array.isArray(parsed)) {
          programs = parsed as RawProgram[];
        } else if (
          parsed !== null &&
          typeof parsed === 'object' &&
          'programs' in parsed &&
          Array.isArray((parsed as Record<string, unknown>)['programs'])
        ) {
          programs = (parsed as { programs: RawProgram[] }).programs;
        } else if (parsed !== null && typeof parsed === 'object') {
          programs = Object.values(parsed) as RawProgram[];
        }

        if (programs && programs.length > 0) {
          console.log(`📦 Found ${programs.length} programs to seed\n`);
          break;
        }
      } catch (error) {
        console.warn(`  ⚠  Failed to parse: ${jsonPath}`, error);
      }
    }
  }

  if (programs && programs.length > 0) {
    await seedFromJson(programs);
  } else {
    if (isProduction) {
      throw new Error(
        'Production catalog seed aborted because programs.json was not found.',
      );
    }
    console.warn('⚠  programs.json not found or empty.');
    console.log('📌 Using fallback sample data instead.\n');
    throw new Error('Development reference catalog is missing or empty; sample fallback tours are forbidden.');
  }

  await seedTourLandingPages();
  if (seedDemoData) {
    await seedContactSubmissions();
  }

  await seedSuperAdmin();
  await seedCmsBlocks();

  await seedMediaAssets(prisma);
  if (seedDemoData) {
    await seedMockBookings();
  }

  console.log('\n✅ Seed complete!\n');
}

main()
  .catch((error: unknown) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
