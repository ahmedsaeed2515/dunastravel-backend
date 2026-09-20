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
  private lastHealthResult: any = null;
  private lastHealthTime = 0;

  constructor(
    private health: HealthCheckService,
    private db: PrismaHealthIndicator,
    private prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Health check endpoint' })
  async checkHealth() {
    const now = Date.now();
    if (this.lastHealthResult && now - this.lastHealthTime < 5_000) {
      return this.lastHealthResult;
    }
    const res = await this.health.check([
      () => this.db.pingCheck('database', this.prisma, { timeout: 4000 }),
    ]);
    this.lastHealthResult = res;
    this.lastHealthTime = now;
    return res;
  }

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
      const now = Date.now();
      if (this.lastHealthResult && now - this.lastHealthTime < 5_000) {
        return this.lastHealthResult;
      }
      const res = await this.health.check([
        () => this.db.pingCheck('database', this.prisma, { timeout: 4000 }),
      ]);
      this.lastHealthResult = res;
      this.lastHealthTime = now;
      return res;
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        message: 'Readiness check failed',
      });
    }
  }
}
