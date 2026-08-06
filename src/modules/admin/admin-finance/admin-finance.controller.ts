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

@Controller('admin/finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminFinanceController {
  constructor(private readonly adminFinanceService: AdminFinanceService) {}

  @Get('payments')
  async listPayments(@Query() query: AdminFinanceQueryDto) {
    return this.adminFinanceService.listPayments(query);
  }

  @Get('payments/:id')
  async getPaymentDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminFinanceService.getPaymentDetail(id);
  }

  @Post('refunds')
  @Roles(UserRole.SUPER_ADMIN)
  async processRefund(
    @Body() dto: AdminRefundDto,
    @Req() req: Request & { user: { id: string; role: string } },
  ) {
    return this.adminFinanceService.processRefund(dto, req.user);
  }
}
