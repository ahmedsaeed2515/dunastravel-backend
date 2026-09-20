import { Global, Module } from '@nestjs/common';
import { CacheStampedeService } from './cache-stampede.service';
import { CacheService } from './cache.service';

@Global()
@Module({
  providers: [CacheStampedeService, CacheService],
  exports: [CacheStampedeService, CacheService],
})
export class DunasCacheModule {}
