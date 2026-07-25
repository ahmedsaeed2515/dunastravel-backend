import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { DatabaseBackupService } from './database-backup.service';

/**
 * PrismaModule is registered as @Global() so PrismaService
 * is available in every module without explicit import.
 * Only imported once in AppModule.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [PrismaService, DatabaseBackupService],
  exports: [PrismaService, DatabaseBackupService],
})
export class PrismaModule {}
