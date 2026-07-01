import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WalletsService } from './wallets.service';
import {
  CreateWalletTransactionDto,
  WalletTransactionQueryFilters,
} from './dto/wallet.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Admin - Finance & Wallets')
@Controller('admin/finance/wallets')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get('metrics')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get global wallet and liability metrics' })
  async getMetrics() {
    return this.walletsService.getMetrics();
  }

  @Get(':ownerType/:ownerId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get or initialize a wallet for a User or Company' })
  async getWallet(
    @Param('ownerType') ownerType: 'USER' | 'COMPANY',
    @Param('ownerId') ownerId: string,
  ) {
    return this.walletsService.getOrCreateWallet(ownerType, ownerId);
  }

  @Get(':walletId/transactions')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get transactions for a specific wallet' })
  async getTransactions(
    @Param('walletId') walletId: string,
    @Query() filters: WalletTransactionQueryFilters,
  ) {
    return this.walletsService.getWalletTransactions(walletId, filters);
  }

  @Post('transactions/manual')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Manually add a transaction to a wallet (Credit/Debit)',
  })
  async addManualTransaction(@Body() dto: CreateWalletTransactionDto) {
    // For manual transactions, force referenceType to MANUAL
    dto.referenceType = 'MANUAL';
    return this.walletsService.addTransaction(dto);
  }
}
