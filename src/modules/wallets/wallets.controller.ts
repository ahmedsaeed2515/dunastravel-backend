import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseEnumPipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import { WalletsService } from './wallets.service';
import {
  ManualWalletTransactionDto,
  WalletTransactionQueryFilters,
} from './dto/wallet.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  WalletOwnerType,
  WalletTransactionStatus,
} from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types';
import { AuditService } from '../audit/audit.service';

@ApiTags('Admin - Finance & Wallets')
@Controller('admin/finance/wallets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class WalletsController {
  constructor(
    private readonly walletsService: WalletsService,
    private readonly auditService: AuditService,
  ) {}

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
    @Param('ownerType', new ParseEnumPipe(WalletOwnerType))
    ownerType: WalletOwnerType,
    @Param('ownerId', ParseUUIDPipe) ownerId: string,
  ) {
    return this.walletsService.getWallet(ownerType, ownerId);
  }

  @Get(':walletId/transactions')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get transactions for a specific wallet' })
  async getTransactions(
    @Param('walletId', ParseUUIDPipe) walletId: string,
    @Query() filters: WalletTransactionQueryFilters,
  ) {
    return this.walletsService.getWalletTransactions(walletId, filters);
  }

  @Post('transactions/manual')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Manually add a transaction to a wallet (Credit/Debit)',
  })
  async addManualTransaction(
    @Body() dto: ManualWalletTransactionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const transaction = await this.walletsService.addTransaction({
      ...dto,
      referenceType: 'MANUAL',
      status: WalletTransactionStatus.COMPLETED,
    });
    await this.auditService.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'MANUAL_WALLET_TRANSACTION_CREATED',
      entityType: 'WalletTransaction',
      entityId: transaction.id,
      metadata: {
        ownerType: dto.ownerType,
        ownerId: dto.ownerId,
        type: dto.type,
        amount: dto.amount,
        referenceId: dto.referenceId,
      },
    });
    return transaction;
  }
}
