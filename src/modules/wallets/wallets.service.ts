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
  ListWalletsQueryDto,
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
    const [totalCompanyWallets, totalUserWallets, balanceAgg, totalTxCount] = await Promise.all([
      this.prisma.wallet.count({ where: { ownerType: 'COMPANY' } }),
      this.prisma.wallet.count({ where: { ownerType: 'USER' } }),
      this.prisma.wallet.aggregate({ _sum: { balance: true } }),
      this.prisma.walletTransaction.count(),
    ]);

    return {
      totalCompanyWallets,
      totalUserWallets,
      totalWallets: totalCompanyWallets + totalUserWallets,
      totalLiabilitiesUsd: Number(balanceAgg._sum.balance || 0),
      totalTransactions: totalTxCount,
    };
  }

  async listWallets(query: ListWalletsQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.ownerType) {
      where.ownerType = query.ownerType;
    }
    if (query.status) {
      where.status = query.status;
    }

    const [total, wallets] = await Promise.all([
      this.prisma.wallet.count({ where }),
      this.prisma.wallet.findMany({
        where,
        skip,
        take: limit,
        orderBy: query.sortBy === 'balance'
          ? { balance: query.sortOrder === 'asc' ? 'asc' : 'desc' }
          : { updatedAt: 'desc' },
        include: {
          _count: {
            select: { transactions: true },
          },
        },
      }),
    ]);

    // Populate owner details (Company or User)
    const companyIds = wallets.filter((w) => w.ownerType === WalletOwnerType.COMPANY).map((w) => w.ownerId);
    const userIds = wallets.filter((w) => w.ownerType === WalletOwnerType.USER).map((w) => w.ownerId);

    const [companies, users] = await Promise.all([
      companyIds.length > 0
        ? this.prisma.company.findMany({
            where: { id: { in: companyIds } },
            select: {
              id: true,
              name: true,
              referenceCode: true,
              companyType: true,
              email: true,
              phone: true,
              commissionRate: true,
              status: true,
            },
          })
        : [],
      userIds.length > 0
        ? this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              role: true,
              status: true,
              company: { select: { id: true, name: true, referenceCode: true } },
            },
          })
        : [],
    ]);

    const companyMap = new Map(companies.map((c) => [c.id, c]));
    const userMap = new Map(users.map((u) => [u.id, u]));

    let data = wallets.map((w) => {
      const company = w.ownerType === WalletOwnerType.COMPANY ? companyMap.get(w.ownerId) : null;
      const user = w.ownerType === WalletOwnerType.USER ? userMap.get(w.ownerId) : null;

      return {
        id: w.id,
        ownerType: w.ownerType,
        ownerId: w.ownerId,
        currency: w.currency,
        balance: Number(w.balance),
        status: w.status,
        transactionsCount: w._count.transactions,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
        owner: company
          ? {
              id: company.id,
              name: company.name,
              referenceCode: company.referenceCode,
              type: company.companyType,
              email: company.email,
              phone: company.phone,
              commissionRate: Number(company.commissionRate),
              status: company.status,
            }
          : user
          ? {
              id: user.id,
              name: user.name,
              email: user.email,
              phone: user.phone,
              role: user.role,
              status: user.status,
              company: user.company,
            }
          : null,
      };
    });

    // Optional in-memory search filter if search term is provided
    if (query.search && query.search.trim()) {
      const s = query.search.trim().toLowerCase();
      data = data.filter((item) => {
        const ownerName = item.owner?.name?.toLowerCase() || '';
        const ownerRef = (item.owner as any)?.referenceCode?.toLowerCase() || '';
        const ownerEmail = item.owner?.email?.toLowerCase() || '';
        return ownerName.includes(s) || ownerRef.includes(s) || ownerEmail.includes(s) || item.id.includes(s);
      });
    }

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async reconcileWallets() {
    this.logger.log('Starting full wallet ledger reconciliation...');
    const wallets = await this.prisma.wallet.findMany();
    let driftCount = 0;

    for (const w of wallets) {
      const txs = await this.prisma.walletTransaction.findMany({
        where: {
          walletId: w.id,
          status: WalletTransactionStatus.COMPLETED,
        },
      });

      let calculated = new Prisma.Decimal(0);
      for (const t of txs) {
        if (t.type === WalletTransactionType.CREDIT) {
          calculated = calculated.add(t.amount);
        } else if (t.type === WalletTransactionType.DEBIT) {
          calculated = calculated.sub(t.amount);
        }
      }

      if (!calculated.equals(w.balance)) {
        driftCount++;
        this.logger.warn(`Discrepancy found on wallet ${w.id} (DB: ${w.balance}, Calc: ${calculated}). Reconciling...`);
        await this.prisma.wallet.update({
          where: { id: w.id },
          data: { balance: calculated },
        });
        if (w.ownerType === WalletOwnerType.COMPANY) {
          await this.prisma.company.update({
            where: { id: w.ownerId },
            data: { currentBalance: calculated },
          }).catch(() => {});
        }
      }
    }

    this.logger.log(`Reconciliation completed. Checked ${wallets.length} wallets. Fixed ${driftCount} discrepancies.`);
    return {
      success: true,
      totalWalletsChecked: wallets.length,
      driftCount,
      message: driftCount === 0 ? 'All wallet ledgers are perfectly balanced.' : `Reconciled and corrected ${driftCount} wallet balances.`,
    };
  }
}

