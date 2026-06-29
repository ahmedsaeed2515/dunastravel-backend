import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  MediaAdminController,
  MediaPublicController,
} from './media.controller';
import { MediaService } from './media.service';
import { CloudinaryStorageProvider } from './providers/cloudinary.storage-provider';
import { STORAGE_PROVIDER } from '../../common/storage/storage-provider.token';
import storageConfig from './config/storage.config';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [ConfigModule.forFeature(storageConfig), PrismaModule],
  controllers: [MediaAdminController, MediaPublicController],
  providers: [
    MediaService,
    {
      provide: STORAGE_PROVIDER,
      useClass: CloudinaryStorageProvider,
    },
  ],
  exports: [STORAGE_PROVIDER], // Export the token so other modules can use it
})
export class MediaModule {}
