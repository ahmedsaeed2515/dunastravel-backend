const fs = require('fs');
const file = 'd:/@@project/LUXURY-PROJECT/dunastravel-backend/src/modules/admin/admin-transportation/admin-transportation.service.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'isActive: dto.isActive ?? true,\n      },\n    });',
  'isActive: dto.isActive ?? true,\n        heroImage: dto.heroImage ?? null,\n      },\n    });'
);

content = content.replace(
  'const service = await this.prisma.transportationService.update({\n      where: { id },\n      data: {\n        ...(dto.name && { name: sanitizePlainText(dto.name).slice(0, 255) }),\n        ...(dto.serviceType && { serviceType: sanitizePlainText(dto.serviceType).slice(0, 50) }),\n        ...(dto.basePriceUsd !== undefined && { basePriceUsd: dto.basePriceUsd }),\n        ...(dto.isActive !== undefined && { isActive: dto.isActive }),\n      },\n    });',
  'const service = await this.prisma.transportationService.update({\n      where: { id },\n      data: {\n        ...(dto.name && { name: sanitizePlainText(dto.name).slice(0, 255) }),\n        ...(dto.serviceType && { serviceType: sanitizePlainText(dto.serviceType).slice(0, 50) }),\n        ...(dto.basePriceUsd !== undefined && { basePriceUsd: dto.basePriceUsd }),\n        ...(dto.isActive !== undefined && { isActive: dto.isActive }),\n        ...(dto.heroImage !== undefined && { heroImage: dto.heroImage }),\n      },\n    });'
);

fs.writeFileSync(file, content);
console.log('Fixed admin-transportation.service.ts');
