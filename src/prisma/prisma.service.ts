import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  OnApplicationShutdown,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy, OnApplicationShutdown
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString =
      process.env.DATABASE_URL ||
      'postgresql://postgres:password@127.0.0.1:5432/dunastravel_db';
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    super({
      adapter,
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
      errorFormat: 'colorless',
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('✅ Database connected successfully');
    } catch (error) {
      this.logger.error('❌ Database connection failed', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Database disconnected (onModuleDestroy)');
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(
      `Received signal: ${signal}. Closing database connection...`,
    );
    await this.$disconnect();
    this.logger.log(
      'Database disconnected successfully (onApplicationShutdown)',
    );
  }

  /**
   * Cleans all tables in test environment only.
   * NEVER callable in production.
   * Used by e2e tests to reset state between runs.
   */
  async cleanDatabase(): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error(
        'cleanDatabase() can only be called in the test environment',
      );
    }

    // Order matters — respect foreign key constraints
    await this.$transaction([
      this.passenger.deleteMany(),
      this.billingInfo.deleteMany(),
      this.invoice.deleteMany(),
      this.booking.deleteMany(),
      this.tourImage.deleteMany(),
      this.tourItinerary.deleteMany(),
      this.tailorMadeInquiry.deleteMany(),
      this.tour.deleteMany(),
      this.user.deleteMany(),
    ]);
  }
}
