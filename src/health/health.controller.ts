import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
@Public()
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: PrismaHealthIndicator,
    private prisma: PrismaService,
  ) {}

  @Get('liveness')
  @ApiOperation({ summary: 'Liveness probe for basic process health' })
  checkLive() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('readiness')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe checking database connectivity' })
  async checkReady() {
    try {
      return await this.health.check([
        () => this.db.pingCheck('database', this.prisma),
      ]);
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        message: 'Readiness check failed',
      });
    }
  }
}
