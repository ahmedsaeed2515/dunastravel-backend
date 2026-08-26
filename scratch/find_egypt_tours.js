const fs = require('fs');

const data = JSON.parse(fs.readFileSync('d:/eslam m h/programming/my projects/Dunas travel-all/dunastravel-backend/prisma/data/ahmed-tours.normalized.json', 'utf8'));
const programs = Array.isArray(data) ? data : data.programs;

console.log('Searching for Egypt or Classic programs:');
programs.forEach((p, idx) => {
  if (p.country === 'Egypt' || (p.slug && p.slug.includes('egypt')) || (p.slug && p.slug.includes('classic'))) {
    console.log(`[${idx}] ${p.slug} | ${p.sourceId} | Title(en): ${p.titleJsonb?.en || p.titleJsonb?.pt || 'N/A'}`);
  }
});
