const fs = require('fs');
const file = 'd:/@@project/LUXURY-PROJECT/dunastravel-backend/src/modules/admin/admin-transportation/dto/admin-transportation.dto.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  '  @IsOptional()\n  @IsBoolean()\n  isActive?: boolean;\n}',
  '  @IsOptional()\n  @IsBoolean()\n  isActive?: boolean;\n\n  @IsOptional()\n  @IsString()\n  heroImage?: string;\n}'
);

content = content.replace(
  '  @IsOptional()\n  @IsBoolean()\n  isActive?: boolean;\n}',
  '  @IsOptional()\n  @IsBoolean()\n  isActive?: boolean;\n\n  @IsOptional()\n  @IsString()\n  heroImage?: string;\n}'
);

fs.writeFileSync(file, content);
console.log('Added heroImage to DTO');
