import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';

/**
 * The application must not pretend that an ephemeral local dump is a durable
 * backup. Production backups belong to the managed PostgreSQL platform (PITR,
 * encrypted snapshots and tested restores). This job only raises a persistent
 * operational warning until that external control is explicitly confirmed.
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(private readonly configService: ConfigService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  verifyManagedBackups(): void {
    const confirmed = this.configService.get<string>(
      'MANAGED_BACKUPS_CONFIRMED',
    );
    if (confirmed !== 'true') {
      this.logger.error(
        'SECURITY ACTION REQUIRED: managed encrypted PostgreSQL backups, PITR, retention and a tested restore are not confirmed.',
      );
      return;
    }

    this.logger.log(
      'Managed backup control is declared; verify restore evidence in the operational runbook.',
    );
  }
}
