import { Module } from '@nestjs/common';
import { BlogsService } from './blogs.service';
import { BlogsController } from './blogs.controller';
import { AdminBlogsController } from './admin-blogs.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { DunasCacheModule } from '../../common/cache/dunas-cache.module';

@Module({
  imports: [PrismaModule, DunasCacheModule],
  controllers: [BlogsController, AdminBlogsController],
  providers: [BlogsService],
  exports: [BlogsService],
})
export class BlogsModule {}
