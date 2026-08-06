import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
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
  CompanyStatus,
  Prisma,
} from '@prisma/client';
import { sanitizePlainText } from '../../common/utils/content-sanitizer.util';

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getWallet(ownerType: WalletOwnerType, ownerId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { ownerType_ownerId: { ownerType, ownerId } },
    });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }
    return wallet;
  }

  async getOrCreateWallet(ownerType: WalletOwnerType, ownerId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertActiveOwner(tx, ownerType, ownerId);
      return tx.wallet.upsert({
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
    });
  }

  async addTransaction(data: CreateWalletTransactionDto) {
    const amount = new Prisma.Decimal(data.amount);
    if (
      !amount.isFinite() ||
      amount.lte(0) ||
      amount.decimalPlaces() > 2 ||
      amount.gt(99_999_999.99)
    ) {
      throw new BadRequestException('Invalid wallet transaction amount');
    }

    const status = data.status ?? WalletTransactionStatus.COMPLETED;
    let lastError: unknown;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            await this.assertActiveOwner(
              tx,
              data.ownerType,
              data.ownerId,
            );

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

            const existing = await tx.walletTransaction.findFirst({
              where: {
                walletId: wallet.id,
                referenceType: data.referenceType,
                referenceId: data.referenceId,
              },
            });
            if (existing) {
              this.assertMatchingIdempotentTransaction(
                existing.amount,
                existing.type,
                amount,
                data.type,
              );
              return existing;
            }

            const transaction = await tx.walletTransaction.create({
              data: {
                walletId: wallet.id,
                amount,
                type: data.type,
                referenceType: data.referenceType,
                referenceId: data.referenceId,
                description: data.description
                  ? sanitizePlainText(data.description).slice(0, 255)
                  : undefined,
                status,
              },
            });

            if (status !== WalletTransactionStatus.COMPLETED) {
              return transaction;
            }

            const permitsNegativeBalance =
              data.referenceType === 'COMMISSION_REVERSAL';
            const updated =
              data.type === WalletTransactionType.CREDIT
                ? await tx.wallet.updateMany({
                    where: { id: wallet.id, status: 'ACTIVE' },
                    data: { balance: { increment: amount } },
                  })
                : permitsNegativeBalance
                  ? await tx.wallet.updateMany({
                      where: { id: wallet.id, status: 'ACTIVE' },
                      data: { balance: { decrement: amount } },
                    })
                : await tx.wallet.updateMany({
                    where: {
                      id: wallet.id,
                      status: 'ACTIVE',
                      balance: { gte: amount },
                    },
                    data: { balance: { decrement: amount } },
                  });

            if (updated.count !== 1) {
              throw new BadRequestException(
                data.type === WalletTransactionType.DEBIT
                  ? 'Insufficient or inactive wallet'
                  : 'Wallet is inactive',
              );
            }

            const updatedWallet = await tx.wallet.findUniqueOrThrow({
              where: { id: wallet.id },
              select: { balance: true },
            });

            if (data.ownerType === WalletOwnerType.COMPANY) {
              await tx.company.update({
                where: { id: data.ownerId },
                data: { currentBalance: updatedWallet.balance },
              });
            }

            return transaction;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error: unknown) {
        lastError = error;
        const code = (error as { code?: string }).code;
        if (code === 'P2034' && attempt < 3) {
          continue;
        }
        if (code === 'P2002') {
          const existing = await this.prisma.walletTransaction.findFirst({
            where: {
              wallet: {
                ownerType: data.ownerType,
                ownerId: data.ownerId,
              },
              referenceType: data.referenceType,
              referenceId: data.referenceId,
            },
          });
          if (existing) {
            this.assertMatchingIdempotentTransaction(
              existing.amount,
              existing.type,
              amount,
              data.type,
            );
            return existing;
          }
          if (attempt < 3) {
            continue;
          }
        }
        throw error;
      }
    }

    throw lastError;
  }

  private async assertActiveOwner(
    tx: Prisma.TransactionClient,
    ownerType: WalletOwnerType,
    ownerId: string,
  ) {
    const exists =
      ownerType === WalletOwnerType.COMPANY
        ? await tx.company.findFirst({
            where: {
              id: ownerId,
              deletedAt: null,
              status: CompanyStatus.ACTIVE,
            },
            select: { id: true },
          })
        : await tx.user.findFirst({
            where: {
              id: ownerId,
              deletedAt: null,
              status: 'ACTIVE',
              suspendedAt: null,
            },
            select: { id: true },
          });

    if (!exists) {
      throw new NotFoundException('Active wallet owner not found');
    }
  }

  private assertMatchingIdempotentTransaction(
    existingAmount: Prisma.Decimal,
    existingType: WalletTransactionType,
    requestedAmount: Prisma.Decimal,
    requestedType: WalletTransactionType,
  ) {
    if (
      !existingAmount.equals(requestedAmount) ||
      existingType !== requestedType
    ) {
      throw new ConflictException(
        'The transaction reference is already used with different terms',
      );
    }
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
