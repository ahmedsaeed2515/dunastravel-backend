import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { CommissionsService } from './commissions.service';
import {
  CreateCommissionDto,
  CommissionQueryFilters,
  UpdateCommissionStatusDto,
} from './dto/commission.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types';

@ApiTags('Admin - Finance & Commissions')
@Controller('admin/finance/commissions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class CommissionsController {
  constructor(
    private readonly commissionsService: CommissionsService,
    private readonly auditService: AuditService,
  ) {}

  @Get('metrics')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get global commission metrics' })
  async getMetrics() {
    return this.commissionsService.getMetrics();
  }

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List all partner commissions with pagination' })
  async findAll(@Query() filters: CommissionQueryFilters) {
    return this.commissionsService.findAll(filters);
  }

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Manually create a commission record for a booking',
  })
  async createCommission(
    @Body() dto: CreateCommissionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const commission = await this.commissionsService.createCommission(dto);
    await this.auditService.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'COMMISSION_MANUALLY_CREATED',
      entityType: 'Commission',
      entityId: commission.id,
      metadata: {
        bookingId: dto.bookingId,
        companyId: dto.companyId,
      },
    });
    return commission;
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update commission status (e.g. APPROVE)' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommissionStatusDto,
    @Req() req: Request & { user: { id: string; role: string } },
  ) {
    const updated = await this.commissionsService.updateCommissionStatus(
      id,
      dto,
    );

    await this.auditService.log({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: `COMMISSION_STATUS_CHANGED_TO_${dto.status}`,
      entityType: 'Commission',
      entityId: id,
      ipAddress: req.ip,
    });

    return updated;
  }
}
