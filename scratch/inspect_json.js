const fs = require('fs');

const data = JSON.parse(fs.readFileSync('d:/eslam m h/programming/my projects/Dunas travel-all/dunastravel-backend/prisma/data/ahmed-tours.normalized.json', 'utf8'));
const programs = Array.isArray(data) ? data : data.programs;

console.log('Total programs in JSON:', programs.length);
if (programs.length > 0) {
  console.log('Sample program keys:', Object.keys(programs[0]));
  console.log('Sample program 0:', JSON.stringify(programs[0], null, 2).substring(0, 500));
}

const classic = programs.find(p => p.slug === 'classic-program' || p.slug === 'classic-egypt-program' || p.id === 'classic-program');
console.log('Found classic program:', classic ? classic.slug : 'NONE');
