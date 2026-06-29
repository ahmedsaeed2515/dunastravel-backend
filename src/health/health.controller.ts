import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe for basic process health' })
  checkLive() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe checking database connectivity' })
  async checkReady() {
    try {
      // 2-second timeout enforced at query level if possible, or application level
      await Promise.race([
        this.prisma.$queryRawUnsafe('SELECT 1'),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Database query timeout')), 2000),
        ),
      ]);
      return {
        status: 'ok',
        db: 'reachable',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new ServiceUnavailableException({
        status: 'degraded',
        db: 'unreachable',
        error: errMessage,
      });
    }
  }

  @Get()
  @ApiOperation({
    summary: 'Legacy health endpoint, delegates to readiness probe',
  })
  async check() {
    return this.checkReady();
  }
}
