import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { paginate, getPaginationParams } from '../../../common/utils';
import {
  WalletTransactionType,
  WalletTransactionStatus,
  Prisma,
} from '@prisma/client';
import { ManualWalletTransactionDto } from './dto/manual-wallet-transaction.dto';

@Injectable()
export class AdminWalletsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(pageVal: number = 1, limitVal: number = 10) {
    const { skip, take, page, limit } = getPaginationParams(pageVal, limitVal);

    const [total, records] = await this.prisma.$transaction([
      this.prisma.wallet.count(),
      this.prisma.wallet.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const formattedRecords = records.map((w) => ({
      ...w,
      balanceUsd: w.balance.toString(),
    }));

    return paginate(formattedRecords, total, page, limit);
  }

  async getTransactions(
    walletId: string,
    pageVal: number = 1,
    limitVal: number = 10,
  ) {
    const { skip, take, page, limit } = getPaginationParams(pageVal, limitVal);

    const [total, records] = await this.prisma.$transaction([
      this.prisma.walletTransaction.count({ where: { walletId } }),
      this.prisma.walletTransaction.findMany({
        where: { walletId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const formattedRecords = records.map((t) => ({
      ...t,
      amountUsd: t.amount.toString(),
    }));

    return paginate(formattedRecords, total, page, limit);
  }

  async addManualTransaction(
    walletId: string,
    dto: ManualWalletTransactionDto,
    adminUserId: string = 'system-admin',
  ) {
    if (dto.amount <= 0) {
      throw new BadRequestException(
        'Transaction amount must be greater than zero',
      );
    }

    const amountDecimal = new Prisma.Decimal(dto.amount);

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { id: walletId },
      });
      if (!wallet) throw new NotFoundException('Wallet not found');

      if (dto.referenceId) {
        const existingTx = await tx.walletTransaction.findFirst({
          where: {
            walletId,
            referenceId: dto.referenceId,
            referenceType: 'MANUAL_ADJUSTMENT',
          },
        });
        if (existingTx) {
          if (
            existingTx.amount.toNumber() !== dto.amount ||
            existingTx.type !== dto.type
          ) {
            throw new UnprocessableEntityException(
              'Idempotency referenceId reused with different parameters',
            );
          }
          return {
            ...existingTx,
            amountUsd: existingTx.amount.toString(),
            balanceUsd: wallet.balance.toString(),
          };
        }
      }

      const beforeBalance = wallet.balance;

      if (dto.type === WalletTransactionType.DEBIT) {
        if (beforeBalance.lt(amountDecimal)) {
          throw new BadRequestException(
            'Insufficient wallet balance for debit transaction',
          );
        }

        const updateCount = await tx.wallet.updateMany({
          where: { id: walletId, balance: { gte: amountDecimal } },
          data: { balance: { decrement: amountDecimal } },
        });

        if (updateCount.count === 0) {
          throw new BadRequestException(
            'Insufficient wallet balance for debit transaction',
          );
        }
      } else {
        await tx.wallet.update({
          where: { id: walletId },
          data: { balance: { increment: amountDecimal } },
        });
      }

      const refId = dto.referenceId || `MAN-${Date.now()}`;
      const transaction = await tx.walletTransaction.create({
        data: {
          walletId,
          amount: amountDecimal,
          type: dto.type,
          status: WalletTransactionStatus.COMPLETED,
          referenceType: 'MANUAL_ADJUSTMENT',
          referenceId: refId,
          description: dto.reason,
        },
      });

      const applyChange =
        dto.type === WalletTransactionType.CREDIT
          ? amountDecimal
          : amountDecimal.negated();

      if (wallet.ownerType === 'COMPANY') {
        await tx.company.update({
          where: { id: wallet.ownerId },
          data: { currentBalance: { increment: applyChange } },
        });
      }

      const updatedWallet = await tx.wallet.findUnique({
        where: { id: walletId },
      });
      const afterBalance =
        updatedWallet?.balance ?? beforeBalance.add(applyChange);

      await tx.auditLog.create({
        data: {
          actorId: adminUserId,
          action: 'WALLET_MANUAL_ADJUSTMENT',
          entityType: 'Wallet',
          entityId: walletId,
          metadata: {
            amount: dto.amount,
            type: dto.type,
            reason: dto.reason,
            referenceId: refId,
            beforeBalance: beforeBalance.toString(),
            afterBalance: afterBalance.toString(),
          },
        },
      });

      return {
        ...transaction,
        amountUsd: transaction.amount.toString(),
        balanceUsd: afterBalance.toString(),
      };
    });
  }
}
