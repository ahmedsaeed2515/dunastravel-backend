import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { CmsService } from './cms.service';
import { CmsController } from './cms.controller';
import { AdminCmsController } from './admin-cms.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule, CacheModule.register()],
  controllers: [CmsController, AdminCmsController],
  providers: [CmsService],
  exports: [CmsService],
})
export class CmsModule {}
