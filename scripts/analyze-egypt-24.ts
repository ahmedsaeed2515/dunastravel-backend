import fs from 'fs';
import path from 'path';

const baseDir = 'D:/@@project/LUXURY-PROJECT/DUNASTRAVEL-private-main';

async function analyze() {
  console.log('====================================================');
  console.log('🇪🇬 DETAILED FORENSIC AUDIT OF EGYPT TOURS & PACKAGES');
  console.log('====================================================\n');

  // 1. Inspect tours.js
  const toursJsPath = path.join(baseDir, 'src/data/tours.js');
  const toursContent = fs.readFileSync(toursJsPath, 'utf8');
  
  // Extract tours by regex matching object blocks
  const toursMatches = toursContent.match(/id:\s*['"]([^'"]+)['"]/g) || [];
  const toursIds = toursMatches.map(m => m.replace(/id:\s*['"]/, '').replace(/['"]/, ''));
  console.log(`1. Tours in src/data/tours.js (${toursIds.length} tours):`);
  toursIds.forEach((id, i) => console.log(`   [${i+1}] ${id}`));

  // 2. Inspect multiCountryTours.js
  const mctPath = path.join(baseDir, 'src/data/multiCountryTours.js');
  let mctIds: string[] = [];
  if (fs.existsSync(mctPath)) {
    const mctContent = fs.readFileSync(mctPath, 'utf8');
    const mctMatches = mctContent.match(/id:\s*['"]([^'"]+)['"]/g) || [];
    mctIds = mctMatches.map(m => m.replace(/id:\s*['"]/, '').replace(/['"]/, ''));
    console.log(`\n2. Multi-Country Tours in src/data/multiCountryTours.js (${mctIds.length} tours):`);
    mctIds.forEach((id, i) => console.log(`   [${i+1}] ${id}`));
  }

  // 3. Inspect programs in src/pages/programs/
  const programsDir = path.join(baseDir, 'src/pages/programs');
  console.log(`\n3. Program Pages in src/pages/programs/:`);
  if (fs.existsSync(programsDir)) {
    fs.readdirSync(programsDir).forEach(f => {
      console.log(`   - ${f}`);
    });
  }

  // 4. Inspect Egipto.jsx
  const egiptoPath = path.join(baseDir, 'src/pages/destinations/Egipto.jsx');
  if (fs.existsSync(egiptoPath)) {
    console.log(`\n4. Inspecting Egipto.jsx structure & package sections:`);
    const egContent = fs.readFileSync(egiptoPath, 'utf8');
    
    // Look for experiences / cards / links
    const links = egContent.match(/to=\{['"][^'"]+['"]\}/g) || [];
    console.log('   Links inside Egipto.jsx:', links);

    const images = egContent.match(/src=\{['"][^'"]+['"]\}/g) || egContent.match(/['"]\/imgs\/[^'"]+['"]/g) || [];
    console.log('   Images mentioned in Egipto.jsx:', images.slice(0, 10));
  }
}

analyze().catch(console.error);
