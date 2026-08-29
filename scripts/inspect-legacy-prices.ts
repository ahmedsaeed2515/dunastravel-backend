import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const LEGACY_DIR = 'D:/@@project/LUXURY-PROJECT/DUNASTRAVEL-private-main/src/data';

const nativeImport = new Function('specifier', 'return import(specifier);') as (
  specifier: string,
) => Promise<any>;

async function inspectLegacyPrices() {
  console.log('====================================================');
  console.log('🔍 EXTRACTING ORIGINAL PRICES FROM LEGACY FILES');
  console.log('====================================================\n');

  // 1. Turkey Tours
  const turkeyMod = await nativeImport(pathToFileURL(path.join(LEGACY_DIR, 'turkeyTours.js')).href);
  const turkeyList: any[] = turkeyMod.turkeyTours || [];
  console.log(`--- TURKEY TOURS (${turkeyList.length} tours) ---`);
  turkeyList.forEach(t => {
    console.log(` - [${t.id || t.slug}] Price: $${t.price} | Title: ${t.title || t.name}`);
  });

  // 2. Jordan Tours
  const jordanMod = await nativeImport(pathToFileURL(path.join(LEGACY_DIR, 'jordanTours.js')).href);
  const jordanList: any[] = jordanMod.jordanTours || jordanMod.default || [];
  console.log(`\n--- JORDAN TOURS (${jordanList.length} tours) ---`);
  jordanList.forEach(t => {
    console.log(` - [${t.id || t.slug}] Price: $${t.price} | Title: ${t.title || t.name}`);
  });

  // 3. Dubai Tours
  const dubaiMod = await nativeImport(pathToFileURL(path.join(LEGACY_DIR, 'dubaiTours.js')).href);
  const dubaiList: any[] = dubaiMod.dubaiTours || [];
  console.log(`\n--- DUBAI TOURS (${dubaiList.length} tours) ---`);
  dubaiList.forEach(t => {
    console.log(` - [${t.id || t.slug}] Price: $${t.price} | Title: ${t.title || t.name}`);
  });

  // 4. Base Tours (tours.js)
  const toursMod = await nativeImport(pathToFileURL(path.join(LEGACY_DIR, 'tours.js')).href);
  const toursList: any[] = toursMod.tours || toursMod.default || [];
  console.log(`\n--- BASE TOURS (${toursList.length} tours) ---`);
  toursList.forEach(t => {
    console.log(` - [${t.id || t.slug}] Destination: ${t.destination || 'Egypt'} | Price: $${t.price} | Title: ${t.title || t.name}`);
  });

  // 5. Multi-Country Tours (multiCountryTours.js)
  const multiMod = await nativeImport(pathToFileURL(path.join(LEGACY_DIR, 'multiCountryTours.js')).href);
  const multiList: any[] = multiMod.multiCountryTours || multiMod.default || [];
  console.log(`\n--- MULTI-COUNTRY TOURS (${multiList.length} tours) ---`);
  multiList.forEach(t => {
    console.log(` - [${t.id || t.slug}] Price: $${t.price} | Title: ${t.title || t.name}`);
  });

  // 6. Morocco Tours
  if (fs.existsSync(path.join(LEGACY_DIR, 'moroccoTours.js'))) {
    const morMod = await nativeImport(pathToFileURL(path.join(LEGACY_DIR, 'moroccoTours.js')).href);
    const morList: any[] = morMod.moroccoTours || morMod.default || [];
    console.log(`\n--- MOROCCO TOURS (${morList.length} tours) ---`);
    morList.forEach(t => {
      console.log(` - [${t.id || t.slug}] Price: $${t.price} | Title: ${t.title || t.name}`);
    });
  }

  // 7. Tunisia Tours
  if (fs.existsSync(path.join(LEGACY_DIR, 'tunisiaTours.js'))) {
    const tunMod = await nativeImport(pathToFileURL(path.join(LEGACY_DIR, 'tunisiaTours.js')).href);
    const tunList: any[] = tunMod.tunisiaTours || tunMod.default || [];
    console.log(`\n--- TUNISIA TOURS (${tunList.length} tours) ---`);
    tunList.forEach(t => {
      console.log(` - [${t.id || t.slug}] Price: $${t.price} | Title: ${t.title || t.name}`);
    });
  }
}

inspectLegacyPrices().catch(console.error);
