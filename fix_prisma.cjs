const fs = require('fs');
const file = 'd:/@@project/LUXURY-PROJECT/dunastravel-backend/prisma/schema.prisma';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  '    basePriceUsd Decimal                 @default(0.00) @map("base_price_usd") @db.Decimal(10, 2)\n    createdAt',
  '    basePriceUsd Decimal                 @default(0.00) @map("base_price_usd") @db.Decimal(10, 2)\n    heroImage    String?                 @map("hero_image") @db.Text\n    createdAt'
);

fs.writeFileSync(file, content);
console.log('Added heroImage to TransportationService in schema.prisma');
