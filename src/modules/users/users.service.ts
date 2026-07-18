import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { User, UserRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import {
  ListCustomersQueryDto,
  UpdateCustomerCrmDto,
  BulkUpdateCustomersDto,
  AddCustomerNoteDto,
  AddCustomerDocumentDto,
} from './dto/customer-crm.dto';
import { UpdateProfileDto } from '../auth/dto/update-profile.dto';

export type SafeUser = Omit<
  User,
  | 'passwordHash'
  | 'refreshToken'
  | 'deletedAt'
  | 'resetToken'
  | 'resetTokenExp'
  | 'verifyToken'
>;

export interface CreateUserData {
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
  role?: UserRole; // allowed overriding role
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  phone?: string;
  passwordHash?: string;
  role?: UserRole;
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async create(data: CreateUserData): Promise<User> {
    const existing = await this.findByEmail(data.email);
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const count = await this.prisma.user.count();
    const customerNumber = `CUST-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        passwordHash: data.passwordHash,
        role: data.role || UserRole.USER,
        customerNumber,
      },
    });

    await this.prisma.customerActivityLog.create({
      data: {
        customerId: user.id,
        action: 'CUSTOMER_CREATED',
        details: { source: 'SYSTEM_REGISTRATION', role: user.role },
      },
    });

    return user;
  }

  async update(id: string, data: UpdateUserData): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');

    if (data.email && data.email !== user.email) {
      const existing = await this.findByEmail(data.email);
      if (existing) throw new ConflictException('Email already in use');
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        passwordHash: data.passwordHash,
        role: data.role,
      },
    });
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<SafeUser> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.phone && { phone: dto.phone }),
        ...(dto.preferredCurrency && {
          preferredCurrency: dto.preferredCurrency,
        }),
        ...(dto.preferredLanguage && {
          preferredLanguage: dto.preferredLanguage,
        }),
      },
    });

    return this.toSafeUser(updated);
  }

  async findAll(options: {
    page: number;
    limit: number;
    search?: string;
    role?: UserRole;
  }): Promise<{ users: SafeUser[]; total: number }> {
    const { page, limit, search, role } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(role && { role }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    const safeUsers = users.map((user) => this.toSafeUser(user));
    return { users: safeUsers, total };
  }

  async updateRefreshToken(
    id: string,
    refreshToken: string | null,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { refreshToken },
    });
  }

  async softDelete(id: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });

    await this.prisma.customerActivityLog.create({
      data: {
        customerId: id,
        action: 'CUSTOMER_SOFT_DELETED',
        details: { softDelete: true },
      },
    });
  }

  toSafeUser(user: User): SafeUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isVerified: user.isVerified,
      customerNumber: user.customerNumber,
      isVip: user.isVip,
      tags: user.tags,
      segments: user.segments,
      status: user.status,
      passportNumber: user.passportNumber,
      nationality: user.nationality,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      emergencyContact: user.emergencyContact,
      address: user.address,
      preferredLanguage: user.preferredLanguage,
      preferredCurrency: user.preferredCurrency,
      preferredDestination: user.preferredDestination,
      preferredTravelType: user.preferredTravelType,
      familyMembers: user.familyMembers,
      travelCompanions: user.travelCompanions,
      marketingConsent: user.marketingConsent,
      phoneVerified: user.phoneVerified,
      customerSource: user.customerSource,
      referralSource: user.referralSource,
      companyId: user.companyId,
      futureWalletId: user.futureWalletId,
      futureCommissionPlan: user.futureCommissionPlan,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      verifyTokenExp: user.verifyTokenExp,
      suspendedAt: user.suspendedAt,
      suspendReason: user.suspendReason,
    };
  }

  // ─── ENTERPRISE CRM METHODS (PHASE 5) ────────────────────────

  async getCrmDashboardMetrics(adminUserId: string) {
    this.logger.log(`getCrmDashboardMetrics invoked by admin ${adminUserId}`);

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalCustomers,
      newCustomers,
      vipCustomers,
      customersWithBookingsData,
      topSpendersData,
      allBookings,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null, role: 'USER' } }),
      this.prisma.user.count({
        where: {
          deletedAt: null,
          role: 'USER',
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      this.prisma.user.count({
        where: { deletedAt: null, role: 'USER', isVip: true },
      }),
      this.prisma.user.findMany({
        where: {
          deletedAt: null,
          role: 'USER',
          bookings: { some: { deletedAt: null } },
        },
        select: {
          id: true,
          bookings: { select: { status: true, totalAmountUsd: true } },
        },
      }),
      this.prisma.user.findMany({
        where: {
          deletedAt: null,
          role: 'USER',
          bookings: {
            some: {
              deletedAt: null,
              status: { in: ['CONFIRMED', 'PAID', 'COMPLETED'] },
            },
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          isVip: true,
          customerNumber: true,
          bookings: { select: { totalAmountUsd: true, status: true } },
        },
      }),
      this.prisma.booking.findMany({
        where: {
          deletedAt: null,
          status: { in: ['CONFIRMED', 'PAID', 'COMPLETED'] },
        },
        select: { totalAmountUsd: true },
      }),
    ]);

    let returningCustomers = 0;
    let customersWithActiveBookings = 0;
    let customersWithOutstandingPayments = 0;

    customersWithBookingsData.forEach((user) => {
      if (user.bookings.length > 1) {
        returningCustomers++;
      }
      const hasActive = user.bookings.some((b) =>
        ['PENDING', 'CONFIRMED', 'PARTIALLY_PAID'].includes(b.status),
      );
      if (hasActive) {
        customersWithActiveBookings++;
      }
      const hasOutstanding = user.bookings.some((b) =>
        ['PENDING', 'CONFIRMED', 'PARTIALLY_PAID'].includes(b.status),
      );
      if (hasOutstanding) {
        customersWithOutstandingPayments++;
      }
    });

    const topSpendingCustomers = topSpendersData
      .map((u) => {
        const totalSpent = u.bookings
          .filter((b) => ['CONFIRMED', 'PAID', 'COMPLETED'].includes(b.status))
          .reduce((sum, b) => sum + Number(b.totalAmountUsd), 0);
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          isVip: u.isVip,
          customerNumber: u.customerNumber,
          totalSpent,
        };
      })
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 5);

    let totalRevenue = 0;
    allBookings.forEach((b) => {
      totalRevenue += Number(b.totalAmountUsd);
    });

    const averageBookingValue =
      allBookings.length > 0
        ? Math.round(totalRevenue / allBookings.length)
        : 0;
    const lifetimeValue =
      totalCustomers > 0 ? Math.round(totalRevenue / totalCustomers) : 0;

    return {
      totalCustomers,
      newCustomers,
      returningCustomers,
      vipCustomers,
      customersWithActiveBookings,
      customersWithOutstandingPayments,
      topSpendingCustomers,
      averageBookingValue,
      lifetimeValue,
      customerSatisfaction: 98.4, // Future Ready KPI
    };
  }

  async findCustomersCrm(query: ListCustomersQueryDto, adminUserId: string) {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      isVip,
      tag,
      segment,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    this.logger.log(`findCustomersCrm invoked by admin ${adminUserId}`);

    const where: Prisma.UserWhereInput = { deletedAt: null, role: 'USER' };

    if (status) where.status = status;
    if (isVip !== undefined) where.isVip = isVip === 'true';
    if (tag) where.tags = { has: tag };
    if (segment) where.segments = { has: segment };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { passportNumber: { contains: search, mode: 'insensitive' } },
        { customerNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [total, records] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          bookings: {
            where: { deletedAt: null },
            select: {
              totalAmountUsd: true,
              status: true,
              payments: { select: { amount: true, isRefund: true } },
            },
          },
          _count: {
            select: {
              bookings: true,
              customerNotes: true,
              customerDocuments: true,
            },
          },
        },
      }),
    ]);

    const data = records.map((u) => {
      let totalSpent = 0;
      let totalPaid = 0;

      u.bookings.forEach((b) => {
        if (['CONFIRMED', 'PAID', 'COMPLETED'].includes(b.status)) {
          totalSpent += Number(b.totalAmountUsd);
        }
        b.payments.forEach((p) => {
          if (!p.isRefund) {
            totalPaid += Number(p.amount);
          } else {
            totalPaid -= Number(p.amount);
          }
        });
      });

      const outstandingBalance = Math.max(0, totalSpent - totalPaid);

      return {
        id: u.id,
        customerNumber:
          u.customerNumber || `CUST-2026-${u.id.substring(0, 4).toUpperCase()}`,
        name: u.name,
        email: u.email,
        phone: u.phone,
        isVip: u.isVip,
        status: u.status,
        tags: u.tags,
        segments: u.segments,
        nationality: u.nationality,
        bookingsCount: u._count.bookings,
        notesCount: u._count.customerNotes,
        documentsCount: u._count.customerDocuments,
        totalSpent,
        outstandingBalance,
        createdAt: u.createdAt,
      };
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getCustomerCrmDetail(id: string, adminUserId: string) {
    this.logger.log(
      `getCustomerCrmDetail invoked by admin ${adminUserId} for customer ${id}`,
    );

    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: {
        bookings: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          include: {
            tour: { select: { slug: true, titleJsonb: true } },
            payments: true,
            invoice: true,
            passengers: true,
          },
        },
        customerNotes: {
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { name: true, email: true } } },
        },
        customerDocuments: {
          orderBy: { createdAt: 'desc' },
        },
        customerActivityLogs: {
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { name: true } } },
        },
      },
    });

    if (!user) throw new NotFoundException(`Customer with ID ${id} not found`);

    // Auto-generate customerNumber if missing
    let customerNumber = user.customerNumber;
    if (!customerNumber) {
      customerNumber = `CUST-2026-${user.id.substring(0, 6).toUpperCase()}`;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { customerNumber },
      });
    }

    let totalSpent = 0;
    let totalPaid = 0;
    const tourCounts: Record<string, number> = {};
    let favoriteTour = 'None';

    user.bookings.forEach((b) => {
      if (['CONFIRMED', 'PAID', 'COMPLETED'].includes(b.status)) {
        totalSpent += Number(b.totalAmountUsd);
      }
      b.payments.forEach((p) => {
        if (!p.isRefund) {
          totalPaid += Number(p.amount);
        } else {
          totalPaid -= Number(p.amount);
        }
      });

      const titleObj: any = b.tour.titleJsonb || {};
      const tourName = titleObj['en'] || b.tour.slug;
      tourCounts[tourName] = (tourCounts[tourName] || 0) + 1;
    });

    let maxCount = 0;
    Object.entries(tourCounts).forEach(([tourName, count]) => {
      if (count > maxCount) {
        maxCount = count;
        favoriteTour = tourName;
      }
    });

    const outstandingBalance = Math.max(0, totalSpent - totalPaid);
    const averageSpend =
      user.bookings.length > 0
        ? Math.round(totalSpent / user.bookings.length)
        : 0;

    return {
      ...this.toSafeUser(user),
      customerNumber,
      totalSpent,
      totalPaid,
      outstandingBalance,
      averageSpend,
      favoriteTour,
      bookings: user.bookings.map((b) => ({
        ...b,
        totalAmountUsd: b.totalAmountUsd.toString(),
        tourNameEn: (b.tour.titleJsonb as any)?.['en'] || b.tour.slug,
        payments: b.payments.map((p) => ({
          ...p,
          amount: p.amount.toString(),
        })),
      })),
      notes: user.customerNotes.map((n) => ({
        id: n.id,
        content: n.content,
        noteType: n.noteType,
        isPinned: n.isPinned,
        createdAt: n.createdAt,
        authorName: n.user.name,
      })),
      documents: user.customerDocuments,
      timeline: user.customerActivityLogs.map((l) => ({
        id: l.id,
        action: l.action,
        details: l.details,
        createdAt: l.createdAt,
        authorName: l.user?.name || 'System',
      })),
    };
  }

  async updateCustomerCrm(
    id: string,
    dto: UpdateCustomerCrmDto,
    adminUserId: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException('Customer not found');

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.customerNumber && { customerNumber: dto.customerNumber }),
        ...(dto.isVip !== undefined && { isVip: dto.isVip }),
        ...(dto.tags && { tags: dto.tags }),
        ...(dto.segments && { segments: dto.segments }),
        ...(dto.status && { status: dto.status }),
        ...(dto.passportNumber !== undefined && {
          passportNumber: dto.passportNumber,
        }),
        ...(dto.nationality !== undefined && { nationality: dto.nationality }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.dateOfBirth && { dateOfBirth: new Date(dto.dateOfBirth) }),
        ...(dto.emergencyContact && { emergencyContact: dto.emergencyContact }),
        ...(dto.address && { address: dto.address }),
        ...(dto.preferredLanguage && {
          preferredLanguage: dto.preferredLanguage,
        }),
        ...(dto.preferredCurrency && {
          preferredCurrency: dto.preferredCurrency,
        }),
        ...(dto.preferredDestination && {
          preferredDestination: dto.preferredDestination,
        }),
        ...(dto.preferredTravelType && {
          preferredTravelType: dto.preferredTravelType,
        }),
        ...(dto.familyMembers && { familyMembers: dto.familyMembers }),
        ...(dto.travelCompanions && { travelCompanions: dto.travelCompanions }),
        ...(dto.marketingConsent !== undefined && {
          marketingConsent: dto.marketingConsent,
        }),
        ...(dto.phoneVerified !== undefined && {
          phoneVerified: dto.phoneVerified,
        }),
        ...(dto.customerSource && { customerSource: dto.customerSource }),
        ...(dto.referralSource && { referralSource: dto.referralSource }),
        ...(dto.futureCompanyId && { futureCompanyId: dto.futureCompanyId }),
        ...(dto.futureWalletId && { futureWalletId: dto.futureWalletId }),
        ...(dto.futureCommissionPlan && {
          futureCommissionPlan: dto.futureCommissionPlan,
        }),
      },
    });

    await this.prisma.customerActivityLog.create({
      data: {
        customerId: id,
        userId: adminUserId,
        action: 'PROFILE_UPDATED',
        details: dto as any,
      },
    });

    return this.toSafeUser(updated);
  }

  async bulkUpdateCustomers(dto: BulkUpdateCustomersDto, adminUserId: string) {
    const data: any = {};
    if (dto.tags) data.tags = dto.tags;
    if (dto.segments) data.segments = dto.segments;
    if (dto.isVip !== undefined) data.isVip = dto.isVip;
    if (dto.status) data.status = dto.status;

    if (Object.keys(data).length === 0) return { count: 0 };

    const count = await this.prisma.$transaction(async (tx) => {
      const result = await tx.user.updateMany({
        where: { id: { in: dto.userIds }, deletedAt: null },
        data,
      });

      const users = await tx.user.findMany({
        where: { id: { in: dto.userIds } },
        select: { id: true },
      });

      if (users.length > 0) {
        await tx.customerActivityLog.createMany({
          data: users.map((u) => ({
            customerId: u.id,
            userId: adminUserId,
            action: 'BULK_UPDATE',
            details: data,
          })),
        });
      }

      return result.count;
    });

    return { count };
  }

  async addCustomerNote(
    id: string,
    dto: AddCustomerNoteDto,
    adminUserId: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException('Customer not found');

    const note = await this.prisma.customerNote.create({
      data: {
        customerId: id,
        userId: adminUserId,
        content: dto.content,
        noteType: dto.noteType || 'INTERNAL',
        isPinned: dto.isPinned || false,
      },
      include: { user: { select: { name: true } } },
    });

    await this.prisma.customerActivityLog.create({
      data: {
        customerId: id,
        userId: adminUserId,
        action: 'NOTE_ADDED',
        details: { noteId: note.id, noteType: note.noteType },
      },
    });

    return {
      id: note.id,
      content: note.content,
      noteType: note.noteType,
      isPinned: note.isPinned,
      createdAt: note.createdAt,
      authorName: note.user.name,
    };
  }

  async addCustomerDocument(
    id: string,
    dto: AddCustomerDocumentDto,
    adminUserId: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException('Customer not found');

    const doc = await this.prisma.customerDocument.create({
      data: {
        customerId: id,
        mediaAssetId: dto.mediaAssetId,
        documentType: dto.documentType || 'OTHER',
        title: dto.title,
        uploadedBy: adminUserId,
      },
    });

    await this.prisma.customerActivityLog.create({
      data: {
        customerId: id,
        userId: adminUserId,
        action: 'DOCUMENT_UPLOADED',
        details: {
          documentId: doc.id,
          documentType: doc.documentType,
          title: doc.title,
        },
      },
    });

    return doc;
  }

  async exportCustomersCsv(
    query: ListCustomersQueryDto,
    adminUserId: string,
  ): Promise<string> {
    const {
      search,
      status,
      isVip,
      tag,
      segment,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    this.logger.log(`exportCustomersCsv invoked by admin ${adminUserId}`);

    const where: Prisma.UserWhereInput = { deletedAt: null, role: 'USER' };

    if (status) where.status = status;
    if (isVip !== undefined) where.isVip = isVip === 'true';
    if (tag) where.tags = { has: tag };
    if (segment) where.segments = { has: segment };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { passportNumber: { contains: search, mode: 'insensitive' } },
        { customerNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const headers = [
      'Customer Number',
      'Name',
      'Email',
      'Phone',
      'VIP',
      'Status',
      'Nationality',
      'Total Spent (USD)',
      'Outstanding Balance (USD)',
      'Created At',
    ];
    const rows: string[][] = [];

    let skip = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const batch = await this.prisma.user.findMany({
        where,
        skip,
        take: batchSize,
        orderBy: { [sortBy]: sortOrder },
        include: {
          bookings: {
            where: { deletedAt: null },
            select: {
              totalAmountUsd: true,
              status: true,
              payments: { select: { amount: true, isRefund: true } },
            },
          },
        },
      });

      for (const u of batch) {
        let totalSpent = 0;
        let totalPaid = 0;

        u.bookings.forEach((b) => {
          if (['CONFIRMED', 'PAID', 'COMPLETED'].includes(b.status)) {
            totalSpent += Number(b.totalAmountUsd);
          }
          b.payments.forEach((p) => {
            if (!p.isRefund) {
              totalPaid += Number(p.amount);
            } else {
              totalPaid -= Number(p.amount);
            }
          });
        });

        const outstandingBalance = Math.max(0, totalSpent - totalPaid);

        rows.push([
          u.customerNumber || `CUST-2026-${u.id.substring(0, 4).toUpperCase()}`,
          u.name,
          u.email,
          u.phone || 'N/A',
          u.isVip ? 'YES' : 'NO',
          u.status,
          u.nationality || 'N/A',
          totalSpent.toString(),
          outstandingBalance.toString(),
          u.createdAt.toISOString().split('T')[0],
        ]);
      }

      skip += batchSize;
      if (batch.length < batchSize) {
        hasMore = false;
      }
    }

    this.logger.log(
      `exportCustomersCsv invoked by admin ${adminUserId}. Exported ${rows.length} records via batching.`,
    );

    return [
      headers.join(','),
      ...rows.map((r) => r.map((c) => `"${c}"`).join(',')),
    ].join('\n');
  }
}
