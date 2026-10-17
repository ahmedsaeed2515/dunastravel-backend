import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AdminFinanceService } from './admin-finance.service';
import { AdminFinanceQueryDto } from './dto/admin-finance-query.dto';
import { AdminRefundDto } from './dto/admin-refund.dto';
import { JwtAuthGuard, RolesGuard } from '../../../common/guards';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Admin - Finance')
@ApiBearerAuth()
@Controller('admin/finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminFinanceController {
  constructor(private readonly adminFinanceService: AdminFinanceService) {}

  @Get('payments')
  @ApiOperation({
    summary: 'List payments using the canonical paginated envelope',
  })
  @ApiResponse({ status: 200, description: 'Paginated payment collection.' })
  async listPayments(@Query() query: AdminFinanceQueryDto) {
    return this.adminFinanceService.listPayments(query);
  }

  @Get('payments/:id')
  @ApiOperation({ summary: 'Get one payment by UUID' })
  @ApiResponse({ status: 404, description: 'Payment not found.' })
  async getPaymentDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminFinanceService.getPaymentDetail(id);
  }

  @Get('reconciliation')
  @ApiOperation({ summary: 'Get canonical payment reconciliation indicators' })
  async getReconciliationSummary() {
    return this.adminFinanceService.getReconciliationSummary();
  }

  @Post('refunds')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Issue an idempotent full payment refund' })
  @ApiResponse({
    status: 200,
    description: 'Refund processed or idempotent prior result returned.',
  })
  @ApiResponse({ status: 400, description: 'Invalid refund request.' })
  @ApiResponse({
    status: 409,
    description: 'Refund already in progress or idempotency conflict.',
  })
  async processRefund(
    @Body() dto: AdminRefundDto,
    @Req() req: Request & { user: { id: string; role: string } },
  ) {
    return this.adminFinanceService.processRefund(dto, req.user);
  }
}
