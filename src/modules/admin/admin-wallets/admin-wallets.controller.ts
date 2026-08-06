import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminWalletsService } from './admin-wallets.service';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ManualWalletTransactionDto } from './dto/manual-wallet-transaction.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

interface AdminUser {
  id: string;
  email?: string;
  role?: string;
}

@ApiTags('admin-wallets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin/wallets')
export class AdminWalletsController {
  constructor(private readonly service: AdminWalletsService) {}

  @Get()
  @ApiOperation({ summary: 'List all wallets' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.service.findAll(Number(page), Number(limit));
  }

  @Get(':id/transactions')
  @ApiOperation({ summary: 'Get transactions for a wallet' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getTransactions(
    @Param('id') id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.service.getTransactions(id, Number(page), Number(limit));
  }

  @Post(':id/transactions')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Add a manual transaction to a wallet (SUPER_ADMIN only)',
  })
  async addTransaction(
    @Param('id') id: string,
    @Body() dto: ManualWalletTransactionDto,
    @CurrentUser() user?: AdminUser,
  ) {
    return this.service.addManualTransaction(
      id,
      dto,
      user?.id || 'system-admin',
    );
  }

  @Post('reconcile-ledger')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Reconcile wallet ledger entries against current balance' })
  async reconcileLedger(@CurrentUser() user?: AdminUser) {
    return this.service.reconcileLedger(user?.id || 'system-admin');
  }
}

