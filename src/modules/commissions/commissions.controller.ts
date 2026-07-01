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
} from '@nestjs/common';
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
import { CommissionStatus } from '@prisma/client';

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
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Manually create a commission record for a booking',
  })
  async createCommission(@Body() dto: CreateCommissionDto) {
    return this.commissionsService.createCommission(dto);
  }

  @Patch(':id/status')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update commission status (e.g. APPROVE)' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCommissionStatusDto,
    @Req() req: any,
  ) {
    const updated = await this.commissionsService.updateCommissionStatus(
      id,
      dto,
    );

    void this.auditService.log({
      actorId: req.user?.id,
      actorRole: req.user?.role,
      action: `COMMISSION_STATUS_CHANGED_TO_${dto.status}`,
      entityType: 'Commission',
      entityId: id,
      ipAddress: req.ip,
    });

    // If it was just approved, process the wallet credit asynchronously
    if (dto.status === CommissionStatus.APPROVED) {
      this.commissionsService.processCommissionApproval(id).catch((err) => {
        console.error('Failed to process wallet credit for commission', err);
      });
    }

    return updated;
  }
}
