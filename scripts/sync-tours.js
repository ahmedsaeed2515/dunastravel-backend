require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const dryRun = process.argv.includes('--dry-run');
console.log(`=== DUNAS TRAVEL TOUR SYNCHRONIZATION ===`);
console.log(`Mode: ${dryRun ? 'DRY-RUN (No DB modifications)' : 'REAL-RUN (Updating Database)'}`);

const locales = ['en', 'ar', 'es', 'pt', 'it'];
const localeData = {};
locales.forEach(loc => {
  const file = path.join(__dirname, `../../frontend/src/i18n/locales/${loc}.json`);
  if (!fs.existsSync(file)) {
    console.error(`ERROR: Locale file missing at ${file}`);
    process.exit(1);
  }
  localeData[loc] = JSON.parse(fs.readFileSync(file, 'utf8'));
});

// Helper to look up key in dictionary with various prefix variations
function lookupKeyInDict(dict, key) {
  if (!key || typeof key !== 'string') return null;
  if (dict[key]) return dict[key];
  if (dict[`data.${key}`]) return dict[`data.${key}`];
  const cleanKey = key.replace(/^data\./, '');
  if (dict[cleanKey]) return dict[cleanKey];
  if (dict[`data.${cleanKey}`]) return dict[`data.${cleanKey}`];
  return null;
}

// Fallback map for titles if key resolution fails
const titleFallbacks = {
  'stars-of-the-middle-east-16-days': {
    en: 'Stars of the Middle East 16 Days',
    es: 'Estrellas del Medio Oriente 16 Días',
    ar: 'نجوم الشرق الأوسط 16 يوم',
    pt: 'Estrelas do Médio Oriente 16 Dias',
    it: 'Stelle del Medio Oriente 16 Giorni'
  },
  'treasures-of-egypt-and-tunisia-16-days': {
    en: 'Treasures of Egypt & Tunisia 16 Days',
    es: 'Tesoros de Egipto y Túnez 16 Días',
    ar: 'كنوز مصر وتونس 16 يوم',
    pt: 'Tesouros do Egito e Tunísia 16 Dias',
    it: 'Tesori d\'Egitto e Tunisia 16 Giorni'
  },
  'egypt-and-dubai-13-days': {
    en: 'Egypt & Dubai 13 Days',
    es: 'Egipto y Dubái 13 Días',
    ar: 'مصر ودبي 13 يوم',
    pt: 'Egito e Dubai 13 Dias',
    it: 'Egitto e Dubai 13 Dias'
  },
  'spices-of-egypt-and-morocco': {
    en: 'Spices of Egypt & Morocco 14 Days',
    es: 'Especias de Egipto y Marruecos 14 Días',
    ar: 'توابل مصر والمغرب 14 يوم',
    pt: 'Especiarias do Egito e Marrocos 14 Dias',
    it: 'Spezie d\'Egitto e Marocco 14 Giorni'
  },
  'jewels-of-egypt-and-jordan-11-days': {
    en: 'Jewels of Egypt & Jordan 11 Days',
    es: 'Joyas de Egipto y Jordania 11 Días',
    ar: 'جواهر مصر والأردن 11 يوم',
    pt: 'Jóias do Egito e Jordânia 11 Dias',
    it: 'Gioielli d\'Egitto e Giordania 11 Giorni'
  },
  'tunisia-8-days-desert-sea': {
    en: 'Tunisia 8 Days Desert & Sea',
    es: 'Túnez 8 Días Desierto y Mar',
    ar: 'تونس 8 أيام الصحراء والبحر',
    pt: 'Tunísia 8 Dias Deserto e Mar',
    it: 'Tunisia 8 Giorni Deserto e Mare'
  },
  'complete-egypt-8d': {
    en: 'Complete Egypt Tour 8 Days',
    es: 'Tour Completo de Egipto 8 Días',
    ar: 'جولة مصر الكاملة 8 أيام',
    pt: 'Tour Completo do Egito 8 Dias',
    it: 'Tour Completo dell\'Egitto 8 Giorni'
  },
  'turquia-legendaria-11d': {
    en: 'Legendary Turkey in High Speed Train 11 Days',
    es: 'Turquía Legendaria en Tren de Alta Velocidad 11 Días',
    ar: 'تركيا الأسطورية بالقطار السريع 11 يوماً',
    pt: 'Turquia Lendária em Trem de Alta Velocidade 11 Dias',
    it: 'Turchia Leggendaria in Treno ad Alta Velocità 11 Giorni'
  }
};

function resolveStringField(slug, fieldName, rawVal) {
  const resolved = {};
  let unresolvedCount = 0;

  locales.forEach(loc => {
    const dict = localeData[loc];
    let val = lookupKeyInDict(dict, rawVal);

    if (!val && dict[`${slug}.${fieldName}`]) {
      val = dict[`${slug}.${fieldName}`];
    }

    if (!val && titleFallbacks[slug] && fieldName === 'title') {
      val = titleFallbacks[slug][loc];
    }

    if (!val) {
      if (typeof rawVal === 'string' && !rawVal.includes('.title') && !rawVal.includes('_title') && !rawVal.includes('.overview') && !rawVal.includes('.duration') && !rawVal.includes('_desc')) {
        val = rawVal;
      } else if (titleFallbacks[slug] && titleFallbacks[slug][loc]) {
        val = titleFallbacks[slug][loc];
      } else {
        val = rawVal || slug;
        unresolvedCount++;
      }
    }

    resolved[loc] = val;
  });

  return { resolved, unresolvedCount };
}

function resolveArrayField(slug, fieldName, rawArr) {
  if (!rawArr || !Array.isArray(rawArr)) return null;
  const resolved = {};

  locales.forEach(loc => {
    const dict = localeData[loc];
    const items = rawArr.map(item => {
      if (typeof item !== 'string') return item;
      const found = lookupKeyInDict(dict, item);
      return found || item;
    });
    resolved[loc] = items;
  });

  return resolved;
}

// 1. Load programs.json
const programsFile = path.join(__dirname, '../../frontend/src/data/programs.json');
const programs = JSON.parse(fs.readFileSync(programsFile, 'utf8')).programs || [];

// 2. Load turkeyTours.js
const turkeyFile = path.join(__dirname, '../../frontend/src/data/turkeyTours.js');
let turkeyTours = [];
if (fs.existsSync(turkeyFile)) {
  const turkeyText = fs.readFileSync(turkeyFile, 'utf8');
  const turkeyClean = turkeyText.replace(/export\s+const\s+turkeyTours\s*=\s*/, '').replace(/;\s*$/, '');
  try {
    turkeyTours = JSON.parse(turkeyClean);
  } catch (e) {
    console.warn('Warning: Failed to parse turkeyTours.js:', e.message);
  }
}

// Map all frontend tours by slug
const tourMap = new Map();

programs.forEach(p => tourMap.set(p.slug, { ...p, sourceFile: 'programs.json' }));
turkeyTours.forEach(t => {
  if (!tourMap.has(t.slug)) {
    tourMap.set(t.slug, { ...t, sourceFile: 'turkeyTours.js' });
  }
});

const allDiscoveredTours = Array.from(tourMap.values());

async function sync() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const stats = {
      discovered: allDiscoveredTours.length,
      matched: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      translationsResolved: 0,
      unresolvedKeys: 0,
      imagesCreated: 0,
      itinerariesCreated: 0
    };

    const existingRes = await pool.query('SELECT id, slug FROM tours;');
    const existingMap = new Map();
    existingRes.rows.forEach(r => existingMap.set(r.slug, r.id));

    console.log(`Discovered ${allDiscoveredTours.length} frontend tours across sources.`);
    console.log(`Found ${existingRes.rows.length} existing tours in DB.`);

    for (const prog of allDiscoveredTours) {
      const slug = prog.slug;
      const titleRes = resolveStringField(slug, 'title', prog.title);
      const overviewRes = resolveStringField(slug, 'overview', prog.overview || prog.description || '');
      const durationRes = resolveStringField(slug, 'duration', prog.duration || '8 Days / 7 Nights');

      const titleJsonb = titleRes.resolved;
      const overviewJsonb = overviewRes.resolved;
      const durationJsonb = durationRes.resolved;

      stats.unresolvedKeys += titleRes.unresolvedCount + overviewRes.unresolvedCount + durationRes.unresolvedCount;
      stats.translationsResolved += (locales.length * 3) - (titleRes.unresolvedCount + overviewRes.unresolvedCount + durationRes.unresolvedCount);

      const includedServicesJsonb = resolveArrayField(slug, 'included', prog.included || prog.includedServices);
      const excludedServicesJsonb = resolveArrayField(slug, 'excluded', prog.excluded || prog.excludedServices);
      const cancellationPolicyJsonb = resolveStringField(slug, 'cancellationPolicy', prog.cancellationPolicy || 'Standard 30-day free cancellation').resolved;

      const category = prog.destination === 'multi-country' ? 'Multi-Country' : (prog.market || prog.destination || 'Cultural');
      const country = prog.destination === 'egypt' ? 'Egypt' : (prog.destination === 'multi-country' ? 'Middle East' : (prog.destination === 'turkey' ? 'Turkey' : (prog.destination || 'Egypt')));
      const basePrice = prog.price && prog.price > 0 ? prog.price : 1290.00;
      const isFeatured = (prog.rating && prog.rating >= 4.8) || prog.isFeatured || false;
      const images = prog.images && prog.images.length > 0 ? prog.images : ['https://images.unsplash.com/photo-1539650116574-8efeb43e2750?auto=format&fit=crop&w=1200&q=80'];

      const isExisting = existingMap.has(slug);
      let tourId = isExisting ? existingMap.get(slug) : null;

      if (isExisting) {
        stats.matched++;
      }

      if (dryRun) {
        if (isExisting) {
          stats.updated++;
          console.log(`[DRY-RUN] Would UPDATE tour: ${slug} (${titleJsonb.en})`);
        } else {
          stats.created++;
          console.log(`[DRY-RUN] Would CREATE tour: ${slug} (${titleJsonb.en})`);
        }
        continue;
      }

      if (isExisting) {
        await pool.query(`
          UPDATE tours
          SET 
            title_jsonb = $1,
            overview_jsonb = $2,
            duration_jsonb = $3,
            included_services_jsonb = $4,
            excluded_services_jsonb = $5,
            cancellation_policy_jsonb = $6,
            category = $7,
            country = $8,
            base_price_usd = $9,
            is_featured = $10,
            status = 'PUBLISHED',
            is_active = true,
            updated_at = NOW()
          WHERE id = $11;
        `, [
          JSON.stringify(titleJsonb),
          JSON.stringify(overviewJsonb),
          JSON.stringify(durationJsonb),
          includedServicesJsonb ? JSON.stringify(includedServicesJsonb) : null,
          excludedServicesJsonb ? JSON.stringify(excludedServicesJsonb) : null,
          JSON.stringify(cancellationPolicyJsonb),
          category,
          country,
          basePrice,
          isFeatured,
          tourId
        ]);
        stats.updated++;
        console.log(`UPDATED tour in DB: ${slug} (${titleJsonb.en})`);
      } else {
        const insertRes = await pool.query(`
          INSERT INTO tours (
            id, slug, title_jsonb, overview_jsonb, duration_jsonb, included_services_jsonb, excluded_services_jsonb, cancellation_policy_jsonb, category, country, base_price_usd, is_featured, status, is_active, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'PUBLISHED', true, NOW(), NOW()
          ) RETURNING id;
        `, [
          slug,
          JSON.stringify(titleJsonb),
          JSON.stringify(overviewJsonb),
          JSON.stringify(durationJsonb),
          includedServicesJsonb ? JSON.stringify(includedServicesJsonb) : null,
          excludedServicesJsonb ? JSON.stringify(excludedServicesJsonb) : null,
          JSON.stringify(cancellationPolicyJsonb),
          category,
          country,
          basePrice,
          isFeatured
        ]);
        tourId = insertRes.rows[0].id;
        stats.created++;
        console.log(`CREATED tour in DB: ${slug} (${titleJsonb.en})`);
      }

      // Sync Images if empty in DB
      const imgCheck = await pool.query('SELECT count(*) FROM tour_images WHERE tour_id = $1;', [tourId]);
      if (parseInt(imgCheck.rows[0].count, 10) === 0) {
        for (let i = 0; i < images.length; i++) {
          await pool.query(`
            INSERT INTO tour_images (id, tour_id, image_url, is_hero, sort_order, created_at)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW());
          `, [tourId, images[i], i === 0, i]);
          stats.imagesCreated++;
        }
      }

      // Sync Itinerary if empty in DB
      const itinCheck = await pool.query('SELECT count(*) FROM tour_itineraries WHERE tour_id = $1;', [tourId]);
      if (parseInt(itinCheck.rows[0].count, 10) === 0 && (prog.highlights || prog.itinerary)) {
        const itinList = prog.itinerary || prog.highlights;
        for (let idx = 0; idx < itinList.length; idx++) {
          const dayNum = idx + 1;
          const rawItem = itinList[idx];
          let descObj;
          let dayTitle;

          if (typeof rawItem === 'object' && rawItem.description) {
            descObj = resolveStringField(slug, `day${dayNum}_desc`, rawItem.description).resolved;
            dayTitle = rawItem.title ? resolveStringField(slug, `day${dayNum}_title`, rawItem.title).resolved.en : `Day ${dayNum}`;
          } else {
            descObj = resolveStringField(slug, `highlight.${dayNum}`, rawItem).resolved;
            dayTitle = `Day ${dayNum}`;
          }

          await pool.query(`
            INSERT INTO tour_itineraries (id, tour_id, day_label, description_jsonb, sort_order, created_at)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW());
          `, [tourId, dayTitle.substring(0, 50), JSON.stringify(descObj), idx]);
          stats.itinerariesCreated++;
        }
      }
    }

    console.log(`\n=== SYNCHRONIZATION COMPLETE ===`);
    console.log(`Discovered: ${stats.discovered}`);
    console.log(`Matched: ${stats.matched}`);
    console.log(`Created: ${stats.created}`);
    console.log(`Updated: ${stats.updated}`);
    console.log(`Skipped: ${stats.skipped}`);
    console.log(`Failed: ${stats.failed}`);
    console.log(`Translations Resolved: ${stats.translationsResolved}`);
    console.log(`Unresolved Keys: ${stats.unresolvedKeys}`);
    console.log(`Images Created: ${stats.imagesCreated}`);
    console.log(`Itineraries Created: ${stats.itinerariesCreated}`);

    if (stats.failed > 0) {
      process.exit(1);
    }

  } catch (err) {
    console.error('Synchronization Error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

sync();
