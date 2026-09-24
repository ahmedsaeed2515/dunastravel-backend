import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { CacheStampedeService } from './cache-stampede.service';
import { CacheService } from './cache.service';

@Global()
@Module({
  imports: [CacheModule.register()],
  providers: [CacheStampedeService, CacheService],
  exports: [CacheStampedeService, CacheService],
})
export class DunasCacheModule {}
