import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateWalletTransactionDto,
  WalletQueryFilters,
  WalletTransactionQueryFilters,
} from './dto/wallet.dto';
import {
  WalletOwnerType,
  WalletTransactionType,
  WalletTransactionStatus,
} from '@prisma/client';

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateWallet(ownerType: WalletOwnerType, ownerId: string) {
    return this.prisma.wallet.upsert({
      where: {
        ownerType_ownerId: {
          ownerType,
          ownerId,
        },
      },
      update: {},
      create: {
        ownerType,
        ownerId,
        balance: 0,
      },
    });
  }

  async addTransaction(data: CreateWalletTransactionDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Ensure Wallet exists
      const wallet = await tx.wallet.upsert({
        where: {
          ownerType_ownerId: {
            ownerType: data.ownerType,
            ownerId: data.ownerId,
          },
        },
        update: {},
        create: {
          ownerType: data.ownerType,
          ownerId: data.ownerId,
          balance: 0,
        },
      });

      // 2. Determine multiplier based on DEBIT vs CREDIT
      const multiplier = data.type === WalletTransactionType.CREDIT ? 1 : -1;
      const balanceDelta = Number(data.amount) * multiplier;

      // 3. Prevent overdrafts on Debits (optional, but good for enterprise logic)
      if (
        data.type === WalletTransactionType.DEBIT &&
        Number(wallet.balance) + balanceDelta < 0
      ) {
        throw new BadRequestException(
          'Insufficient wallet balance for this debit transaction.',
        );
      }

      // 4. Create Transaction
      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount: data.amount,
          type: data.type,
          referenceType: data.referenceType,
          referenceId: data.referenceId,
          description: data.description,
          status: data.status || WalletTransactionStatus.COMPLETED,
        },
      });

      // 5. Update Wallet Balance if COMPLETED
      if (transaction.status === WalletTransactionStatus.COMPLETED) {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: balanceDelta } },
        });

        // 6. Sync with Company.currentBalance if owner is a COMPANY
        if (data.ownerType === WalletOwnerType.COMPANY) {
          await tx.company.update({
            where: { id: data.ownerId },
            data: { currentBalance: { increment: balanceDelta } },
          });
        }
      }

      return transaction;
    });
  }

  async getWalletTransactions(
    walletId: string,
    filters: WalletTransactionQueryFilters,
  ) {
    const { referenceType } = filters;
    const where: any = { walletId };
    if (referenceType) {
      where.referenceType = referenceType;
    }

    return this.prisma.walletTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMetrics() {
    const totalCompanyWallets = await this.prisma.wallet.count({
      where: { ownerType: 'COMPANY' },
    });

    const balanceAgg = await this.prisma.wallet.aggregate({
      where: { ownerType: 'COMPANY' },
      _sum: { balance: true },
    });

    return {
      totalCompanyWallets,
      totalLiabilitiesUsd: Number(balanceAgg._sum.balance || 0),
    };
  }
}
