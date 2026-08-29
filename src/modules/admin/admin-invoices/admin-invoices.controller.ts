import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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
import { UserRole } from '@prisma/client';
import { AdminInvoicesQueryDto } from './dto/admin-invoices-query.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../common/types';
import { RefundPaymentDto } from '../../payments/dto/refund-payment.dto';

@ApiTags('admin-invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/invoices')
export class AdminInvoicesController {
  constructor(private readonly service: AdminInvoicesService) {}

  @Get()
  @ApiOperation({ summary: 'List all invoices' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  async findAll(@Query() query: AdminInvoicesQueryDto) {
    return this.service.findAll(query.page, query.limit, query.status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single invoice' })
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post(':id/void')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Void an invoice' })
  async voidInvoice(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.voidInvoice(id, actor);
  }

  @Post(':id/refund')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Refund an invoice' })
  async refundInvoice(
    @Param('id') id: string,
    @Body() dto: RefundPaymentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.refundInvoice(id, dto, actor);
  }
}
