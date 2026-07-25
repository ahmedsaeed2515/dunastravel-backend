import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AdminInvoicesService } from './admin-invoices.service';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@ApiTags('admin-invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin/invoices')
export class AdminInvoicesController {
  constructor(private readonly service: AdminInvoicesService) {}

  @Get()
  @ApiOperation({ summary: 'List all invoices' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status?: string,
  ) {
    return this.service.findAll(Number(page), Number(limit), status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single invoice' })
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post(':id/void')
  @ApiOperation({ summary: 'Void an invoice' })
  async voidInvoice(@Param('id') id: string) {
    return this.service.voidInvoice(id);
  }

  @Post(':id/refund')
  @ApiOperation({ summary: 'Refund an invoice' })
  async refundInvoice(@Param('id') id: string) {
    return this.service.refundInvoice(id);
  }
}
