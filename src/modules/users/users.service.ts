import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { User, UserRole, Prisma, MediaEntityType } from '@prisma/client';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ListCustomersQueryDto,
  UpdateCustomerCrmDto,
  BulkUpdateCustomersDto,
  AddCustomerNoteDto,
  AddCustomerDocumentDto,
  CreateCustomerCrmDto,
} from './dto/customer-crm.dto';
import {
  SuspendUserDto,
  AddUserMonitoringNoteDto,
  ListActivityStreamQueryDto,
} from './dto/user-monitoring.dto';
import { UpdateProfileDto } from '../auth/dto/update-profile.dto';
import { sanitizePlainText } from '../../common/utils/content-sanitizer.util';
import { sanitizeCsvField } from '../../common/utils/sanitize.util';
import {
  decryptSensitiveJson,
  decryptSensitiveField,
  encryptSensitiveJson,
  encryptSensitiveField,
} from '../../common/security/field-encryption.util';

export type SafeUser = Omit<
  User,
  | 'passwordHash'
  | 'refreshToken'
  | 'deletedAt'
  | 'resetToken'
  | 'resetTokenExp'
  | 'verifyToken'
  | 'verifyTokenExp'
  | 'verifyAttempts'
  | 'verifySentAt'
>;

export type SessionUser = SafeUser;

export interface UserListItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  isVerified: boolean;
  status: string;
  companyId: string | null;
  suspendedAt: Date | null;
  suspendReason?: string | null;
  customerNumber?: string | null;
  isVip?: boolean;
  preferredCurrency?: string | null;
  preferredLanguage?: string | null;
  createdAt: Date;
  updatedAt: Date;
  bookingsCount?: number;
  reviewsCount?: number;
  inquiriesCount?: number;
}

export interface CreateUserData {
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
  role?: UserRole; // allowed overriding role
  isVerified?: boolean;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  phone?: string;
  passwordHash?: string;
  role?: UserRole;
}

import { Inject } from '@nestjs/common';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        email: { equals: email.trim(), mode: 'insensitive' },
        deletedAt: null,
      },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async hasActiveCompanyMembership(user: User): Promise<boolean> {
    if (
      user.role !== UserRole.AGENT &&
      user.role !== UserRole.COMPANY
    ) {
      return true;
    }
    if (!user.companyId) return false;
    const company = await this.prisma.company.findFirst({
      where: {
        id: user.companyId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: { id: true },
    });
    return Boolean(company);
  }

  async create(data: CreateUserData): Promise<User> {
    const existing = await this.findByEmail(data.email);
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    return this.prisma.$transaction(async (tx) => {
      const customerNumber = this.generateCustomerNumber();

      const user = await tx.user.create({
        data: {
          name: sanitizePlainText(data.name).slice(0, 255),
          email: data.email.trim().toLowerCase(),
          phone: data.phone
            ? sanitizePlainText(data.phone).slice(0, 50)
            : undefined,
          passwordHash: data.passwordHash,
          role: data.role || UserRole.USER,
          isVerified: data.isVerified ?? true,
          customerNumber,
        },
      });

      await tx.customerActivityLog.create({
        data: {
          customerId: user.id,
          action: 'CUSTOMER_CREATED',
          details: { source: 'ADMIN_CREATION', role: user.role },
        },
      });

      return user;
    });
  }

  async update(
    id: string,
    data: UpdateUserData,
    actorRole?: string,
  ): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');

    if (
      data.role &&
      data.role === UserRole.SUPER_ADMIN &&
      actorRole !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        'Only SUPER_ADMIN can grant the SUPER_ADMIN role',
      );
    }

    if (
      user.role === UserRole.SUPER_ADMIN &&
      actorRole &&
      actorRole !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        'Only SUPER_ADMIN can modify another SUPER_ADMIN account',
      );
    }

    if (
      user.role === UserRole.SUPER_ADMIN &&
      data.role &&
      data.role !== UserRole.SUPER_ADMIN
    ) {
      const superAdminCount = await this.prisma.user.count({
        where: {
          role: UserRole.SUPER_ADMIN,
          deletedAt: null,
          id: { not: id },
        },
      });
      if (superAdminCount === 0) {
        throw new BadRequestException(
          'Cannot demote the last SUPER_ADMIN. Promote another user first.',
        );
      }
    }

    if (data.email && data.email !== user.email) {
      const existing = await this.findByEmail(data.email);
      if (existing) throw new ConflictException('Email already in use');
    }

    const roleIsChanging = Boolean(data.role && data.role !== user.role);

    return this.prisma.user.update({
      where: { id },
      data: {
        name: data.name
          ? sanitizePlainText(data.name).slice(0, 255)
          : undefined,
        email: data.email?.trim().toLowerCase(),
        phone: data.phone
          ? sanitizePlainText(data.phone).slice(0, 50)
          : undefined,
        passwordHash: data.passwordHash,
        role: data.role,
        ...(data.passwordHash || roleIsChanging
          ? {
              refreshToken: null,
              sessionVersion: { increment: 1 },
            }
          : {}),
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
        ...(dto.nationality && {
          nationality: sanitizePlainText(dto.nationality).slice(0, 100),
        }),
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
    status?: string;
    isVerified?: boolean;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{ users: UserListItem[]; total: number }> {
    const { page, limit, search, role, status, isVerified, dateFrom, dateTo } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(role && { role }),
      ...(status && { status }),
      ...(isVerified !== undefined && { isVerified }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { customerNumber: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isVerified: true,
          status: true,
          companyId: true,
          suspendedAt: true,
          suspendReason: true,
          customerNumber: true,
          isVip: true,
          preferredCurrency: true,
          preferredLanguage: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              bookings: true,
              reviews: true,
              tourFavorites: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const formattedUsers: UserListItem[] = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      isVerified: u.isVerified,
      status: u.status,
      companyId: u.companyId,
      suspendedAt: u.suspendedAt,
      suspendReason: u.suspendReason,
      customerNumber: u.customerNumber,
      isVip: u.isVip,
      preferredCurrency: u.preferredCurrency,
      preferredLanguage: u.preferredLanguage,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      bookingsCount: u._count.bookings,
      reviewsCount: u._count.reviews,
    }));

    return { users: formattedUsers, total };
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

  async revokeSessions(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: {
        refreshToken: null,
        sessionVersion: { increment: 1 },
      },
    });
  }

  async countActiveSuperAdmins(): Promise<number> {
    return this.prisma.user.count({
      where: {
        role: UserRole.SUPER_ADMIN,
        deletedAt: null,
        suspendedAt: null,
        status: 'ACTIVE',
      },
    });
  }

  async softDelete(id: string, actorRole?: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'SUPER_ADMIN accounts cannot be deleted. Demote the user first.',
      );
    }

    if (actorRole && actorRole !== UserRole.SUPER_ADMIN && user.role === UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only SUPER_ADMIN can delete administrator accounts',
      );
    }

    const activeBookings = await this.prisma.booking.count({
      where: {
        userId: id,
        status: { in: ['CONFIRMED', 'PENDING'] },
        arrivalDate: { gte: new Date() },
      },
    });
    if (activeBookings > 0) {
      throw new BadRequestException(
        `Cannot delete user with ${activeBookings} active or upcoming bookings.`,
      );
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'INACTIVE',
        refreshToken: null,
        sessionVersion: { increment: 1 },
      },
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
      emailVerifiedAt: user.emailVerifiedAt,
      customerNumber: user.customerNumber,
      isVip: user.isVip,
      tags: user.tags,
      segments: user.segments,
      status: user.status,
      passportNumber: decryptSensitiveField(user.passportNumber) ?? null,
      nationality: user.nationality,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      emergencyContact: decryptSensitiveJson(user.emergencyContact),
      address: decryptSensitiveJson(user.address),
      preferredLanguage: user.preferredLanguage,
      preferredCurrency: user.preferredCurrency,
      preferredDestination: user.preferredDestination,
      preferredTravelType: user.preferredTravelType,
      familyMembers: decryptSensitiveJson(user.familyMembers),
      travelCompanions: decryptSensitiveJson(user.travelCompanions),
      marketingConsent: user.marketingConsent,
      phoneVerified: user.phoneVerified,
      customerSource: user.customerSource,
      referralSource: user.referralSource,
      companyId: user.companyId,
      futureWalletId: user.futureWalletId,
      futureCommissionPlan: user.futureCommissionPlan,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      suspendedAt: user.suspendedAt,
      suspendReason: user.suspendReason,
      sessionVersion: user.sessionVersion,
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
          status: { in: ['CONFIRMED', 'PAID', 'COMPLETED', 'PARTIALLY_PAID'] },
        },
        select: { totalAmountUsd: true, status: true },
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

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      role: { in: ['USER', 'GUEST'] },
    };

    if (status) where.status = status;
    if (isVip !== undefined) where.isVip = isVip;
    if (tag) where.tags = { has: tag };
    if (segment) where.segments = { has: segment };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
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
              payments: { select: { amount: true, isRefund: true, status: true } },
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
          if (p.status === 'CAPTURED') {
            if (!p.isRefund) {
              totalPaid += Number(p.amount);
            } else {
              totalPaid -= Number(p.amount);
            }
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

  async createCustomerCrm(dto: CreateCustomerCrmDto, adminUserId: string) {
    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase().trim() },
    });
    if (existing) {
      throw new ConflictException('A customer with this email already exists');
    }

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const customerNumber = `CUST-2026-${randomSuffix}`;
    const dummyHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 12);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: sanitizePlainText(dto.name),
          email: dto.email.toLowerCase().trim(),
          phone: dto.phone ? sanitizePlainText(dto.phone) : null,
          role: UserRole.USER,
          passwordHash: dummyHash,
          isVerified: true,
          customerNumber,
          nationality: dto.nationality ? sanitizePlainText(dto.nationality) : null,
          isVip: dto.isVip ?? false,
          preferredLanguage: dto.preferredLanguage || 'en',
          preferredCurrency: dto.preferredCurrency || 'USD',
          preferredDestination: dto.preferredDestination ? sanitizePlainText(dto.preferredDestination) : null,
          preferredTravelType: dto.preferredTravelType ? sanitizePlainText(dto.preferredTravelType) : null,
          customerSource: dto.customerSource || 'ADMIN',
          passportNumber: dto.passportNumber ? encryptSensitiveField(dto.passportNumber) : null,
          tags: dto.tags || [],
          segments: dto.segments || [],
          status: 'ACTIVE',
        },
      });

      if (dto.initialNote && dto.initialNote.trim()) {
        await tx.customerNote.create({
          data: {
            customerId: user.id,
            userId: adminUserId,
            noteType: 'SALES',
            content: sanitizePlainText(dto.initialNote),
            isPinned: false,
          },
        });
      }

      await tx.customerActivityLog.create({
        data: {
          customerId: user.id,
          userId: adminUserId,
          action: 'CUSTOMER_CREATED_IN_CRM',
          details: {
            customerNumber,
            isVip: user.isVip,
            customerSource: user.customerSource,
          },
        },
      });

      return {
        id: user.id,
        customerNumber: user.customerNumber,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isVip: user.isVip,
        status: user.status,
        tags: user.tags,
        segments: user.segments,
        nationality: user.nationality,
        bookingsCount: 0,
        notesCount: dto.initialNote ? 1 : 0,
        documentsCount: 0,
        totalSpent: 0,
        outstandingBalance: 0,
        createdAt: user.createdAt,
      };
    });
  }

  async getCustomerCrmDetail(id: string, adminUserId: string) {
    this.logger.log(
      `getCustomerCrmDetail invoked by admin ${adminUserId} for customer ${id}`,
    );

    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null, role: UserRole.USER },
      include: {
        bookings: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          include: {
            tour: { select: { slug: true, titleJsonb: true } },
            payments: {
              select: {
                id: true,
                amount: true,
                currency: true,
                method: true,
                status: true,
                isRefund: true,
                createdAt: true,
                updatedAt: true,
              },
            },
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                issuedAt: true,
                status: true,
                subtotal: true,
                tax: true,
                total: true,
                currency: true,
                dueDate: true,
              },
            },
            passengers: {
              select: {
                id: true,
                passengerType: true,
                fullName: true,
                dateOfBirth: true,
                nationality: true,
                passportExpiry: true,
                passportNumber: true,
              },
            },
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

    if (!user) throw new NotFoundException('Customer not found');

    // Auto-generate customerNumber if missing
    let customerNumber = user.customerNumber;
    if (!customerNumber) {
      customerNumber = this.generateCustomerNumber();
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
        if (p.status === 'CAPTURED') {
          if (!p.isRefund) {
            totalPaid += Number(p.amount);
          } else {
            totalPaid -= Number(p.amount);
          }
        }
      });

      const titleObj = (b.tour.titleJsonb as Record<string, string>) || {};
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
        id: b.id,
        referenceCode: b.referenceCode,
        status: b.status,
        bookingType: b.bookingType,
        adults: b.adults,
        children: b.children,
        infants: b.infants,
        arrivalDate: b.arrivalDate,
        departureDate: b.departureDate,
        totalAmountUsd: b.totalAmountUsd.toString(),
        currency: 'USD',
        createdAt: b.createdAt,
        tourNameEn:
          (b.tour.titleJsonb as Record<string, string> | null)?.['en'] ||
          b.tour.slug,
        payments: b.payments.map((p) => ({
          ...p,
          amount: p.amount.toString(),
        })),
        invoice: b.invoice
          ? {
              ...b.invoice,
              subtotal: b.invoice.subtotal.toString(),
              tax: b.invoice.tax.toString(),
              total: b.invoice.total.toString(),
            }
          : null,
        passengers: b.passengers.map((passenger) => ({
          ...passenger,
          passportNumber: decryptSensitiveField(passenger.passportNumber),
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
        details: this.redactActivityDetails(l.details),
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
      where: { id, deletedAt: null, role: UserRole.USER },
    });
    if (!user) throw new NotFoundException('Customer not found');

    if (
      dto.dateOfBirth &&
      new Date(`${dto.dateOfBirth}T00:00:00.000Z`) > new Date()
    ) {
      throw new BadRequestException('Date of birth cannot be in the future');
    }

    const tags = this.sanitizeStringArray(dto.tags);
    const segments = this.sanitizeStringArray(dto.segments);
    const changedFields = Object.keys(dto);
    const deactivatesCustomer =
      dto.status !== undefined && dto.status !== 'ACTIVE';

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id },
        data: {
          ...(dto.customerNumber && {
            customerNumber: dto.customerNumber.toUpperCase(),
          }),
          ...(dto.isVip !== undefined && { isVip: dto.isVip }),
          ...(tags && { tags }),
          ...(segments && { segments }),
          ...(dto.status && { status: dto.status }),
          ...(dto.passportNumber !== undefined && {
            passportNumber: encryptSensitiveField(
              dto.passportNumber.toUpperCase(),
            ),
          }),
          ...(dto.nationality !== undefined && {
            nationality: sanitizePlainText(dto.nationality).slice(0, 100),
          }),
          ...(dto.gender !== undefined && { gender: dto.gender }),
          ...(dto.dateOfBirth && { dateOfBirth: new Date(dto.dateOfBirth) }),
          ...(dto.emergencyContact && {
            emergencyContact: encryptSensitiveJson(
              this.sanitizeEmergencyContact(dto.emergencyContact),
            ) as Prisma.InputJsonValue,
          }),
          ...(dto.address && {
            address: encryptSensitiveJson(
              this.sanitizeAddress(dto.address),
            ) as Prisma.InputJsonValue,
          }),
          ...(dto.preferredLanguage && {
            preferredLanguage: dto.preferredLanguage,
          }),
          ...(dto.preferredCurrency && {
            preferredCurrency: dto.preferredCurrency,
          }),
          ...(dto.preferredDestination && {
            preferredDestination: sanitizePlainText(
              dto.preferredDestination,
            ).slice(0, 100),
          }),
          ...(dto.preferredTravelType && {
            preferredTravelType: sanitizePlainText(
              dto.preferredTravelType,
            ).slice(0, 100),
          }),
          ...(dto.familyMembers && {
            familyMembers: encryptSensitiveJson(
              dto.familyMembers.map((person) =>
                this.sanitizeRelatedPerson(person),
              ),
            ) as Prisma.InputJsonValue,
          }),
          ...(dto.travelCompanions && {
            travelCompanions: encryptSensitiveJson(
              dto.travelCompanions.map((person) =>
                this.sanitizeRelatedPerson(person),
              ),
            ) as Prisma.InputJsonValue,
          }),
          ...(dto.marketingConsent !== undefined && {
            marketingConsent: dto.marketingConsent,
          }),
          ...(dto.customerSource && { customerSource: dto.customerSource }),
          ...(dto.referralSource && {
            referralSource: sanitizePlainText(dto.referralSource).slice(0, 100),
          }),
          ...(deactivatesCustomer && {
            refreshToken: null,
            sessionVersion: { increment: 1 },
          }),
        },
      });

      await tx.customerActivityLog.create({
        data: {
          customerId: id,
          userId: adminUserId,
          action: 'PROFILE_UPDATED',
          details: { changedFields },
        },
      });
      return result;
    });

    return this.toSafeUser(updated);
  }

  async bulkUpdateCustomers(dto: BulkUpdateCustomersDto, adminUserId: string) {
    const data: Prisma.UserUpdateInput = {};
    const tags = this.sanitizeStringArray(dto.tags);
    const segments = this.sanitizeStringArray(dto.segments);
    if (tags) data.tags = tags;
    if (segments) data.segments = segments;
    if (dto.isVip !== undefined) data.isVip = dto.isVip;
    if (dto.status) data.status = dto.status;
    if (dto.status && dto.status !== 'ACTIVE') {
      data.refreshToken = null;
      data.sessionVersion = { increment: 1 };
    }

    if (Object.keys(data).length === 0) return { count: 0 };

    const count = await this.prisma.$transaction(async (tx) => {
      const result = await tx.user.updateMany({
        where: {
          id: { in: dto.userIds },
          deletedAt: null,
          role: UserRole.USER,
        },
        data,
      });

      const users = await tx.user.findMany({
        where: {
          id: { in: dto.userIds },
          deletedAt: null,
          role: UserRole.USER,
        },
        select: { id: true },
      });

      if (users.length > 0) {
        await tx.customerActivityLog.createMany({
          data: users.map((u) => ({
            customerId: u.id,
            userId: adminUserId,
            action: 'BULK_UPDATE',
            details: {
              changedFields: Object.keys(dto).filter(
                (key) => key !== 'userIds',
              ),
            },
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
      where: { id, deletedAt: null, role: UserRole.USER },
    });
    if (!user) throw new NotFoundException('Customer not found');

    const content = sanitizePlainText(dto.content).slice(0, 5000);
    if (!content) {
      throw new BadRequestException('Note content cannot be empty');
    }

    const note = await this.prisma.customerNote.create({
      data: {
        customerId: id,
        userId: adminUserId,
        content,
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
      where: { id, deletedAt: null, role: UserRole.USER },
    });
    if (!user) throw new NotFoundException('Customer not found');

    const title = sanitizePlainText(dto.title).slice(0, 255);
    if (!title) {
      throw new BadRequestException('Document title cannot be empty');
    }

    const doc = await this.prisma.$transaction(
      async (tx) => {
        const asset = await tx.mediaAsset.findFirst({
          where: {
            id: dto.mediaAssetId,
            deletedAt: null,
            entityType: MediaEntityType.GENERAL,
            uploadedBy: adminUserId,
          },
          select: { id: true },
        });
        if (!asset) {
          throw new BadRequestException('Invalid customer document asset');
        }

        const [existingDocument, existingBookingAttachment] =
          await Promise.all([
            tx.customerDocument.findFirst({
              where: { mediaAssetId: dto.mediaAssetId },
              select: { id: true },
            }),
            tx.bookingAttachment.findFirst({
              where: { mediaAssetId: dto.mediaAssetId },
              select: { id: true },
            }),
          ]);
        if (existingDocument || existingBookingAttachment) {
          throw new ConflictException('Document asset is already attached');
        }

        const created = await tx.customerDocument.create({
          data: {
            customerId: id,
            mediaAssetId: dto.mediaAssetId,
            documentType: dto.documentType || 'OTHER',
            title,
            uploadedBy: adminUserId,
          },
        });

        await tx.customerActivityLog.create({
          data: {
            customerId: id,
            userId: adminUserId,
            action: 'DOCUMENT_UPLOADED',
            details: {
              documentId: created.id,
              documentType: created.documentType,
            },
          },
        });
        return created;
      },
      { isolationLevel: 'Serializable' },
    );

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
    if (isVip !== undefined) where.isVip = isVip;
    if (tag) where.tags = { has: tag };
    if (segment) where.segments = { has: segment };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
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
              payments: { select: { amount: true, isRefund: true, status: true } },
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
            if (p.status === 'CAPTURED') {
              if (!p.isRefund) {
                totalPaid += Number(p.amount);
              } else {
                totalPaid -= Number(p.amount);
              }
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
      ...rows.map((row) =>
        row
          .map((cell) => {
            const safeCell = sanitizeCsvField(cell)
              .replace(/\r?\n/g, ' ')
              .replace(/"/g, '""');
            return `"${safeCell}"`;
          })
          .join(','),
      ),
    ].join('\n');
  }

  private generateCustomerNumber(): string {
    return `CUST-${new Date().getUTCFullYear()}-${crypto
      .randomBytes(5)
      .toString('hex')
      .toUpperCase()}`;
  }

  private sanitizeStringArray(values?: string[]): string[] | undefined {
    if (!values) return undefined;
    return [
      ...new Set(
        values
          .map((value) => sanitizePlainText(value).slice(0, 50))
          .filter(Boolean),
      ),
    ];
  }

  private sanitizeAddress(
    address: UpdateCustomerCrmDto['address'],
  ): Record<string, string> {
    if (!address) return {};
    return Object.fromEntries(
      Object.entries(address)
        .filter((entry): entry is [string, string] =>
          typeof entry[1] === 'string',
        )
        .map(([key, value]) => [key, sanitizePlainText(value)]),
    );
  }

  private sanitizeEmergencyContact(
    contact: NonNullable<UpdateCustomerCrmDto['emergencyContact']>,
  ): Record<string, string> {
    return {
      name: sanitizePlainText(contact.name).slice(0, 255),
      ...(contact.relationship && {
        relationship: sanitizePlainText(contact.relationship).slice(0, 100),
      }),
      phone: contact.phone,
    };
  }

  private sanitizeRelatedPerson(
    person: NonNullable<UpdateCustomerCrmDto['familyMembers']>[number],
  ): Record<string, string | number> {
    return {
      name: sanitizePlainText(person.name).slice(0, 255),
      ...(person.relationship && {
        relationship: sanitizePlainText(person.relationship).slice(0, 100),
      }),
      ...(person.age !== undefined && { age: person.age }),
      ...(person.phone && { phone: person.phone }),
    };
  }

  private redactActivityDetails(value: unknown, depth = 0): unknown {
    if (depth > 5 || value === null || value === undefined) return null;
    if (Array.isArray(value)) {
      return value.slice(0, 100).map((item) =>
        this.redactActivityDetails(item, depth + 1),
      );
    }
    if (typeof value !== 'object') {
      return typeof value === 'string' ? value.slice(0, 1000) : value;
    }

    const sensitiveKey = /passport|password|token|secret|credential/i;
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 100)
        .map(([key, item]) => [
          key,
          sensitiveKey.test(key)
            ? '[REDACTED]'
            : this.redactActivityDetails(item, depth + 1),
        ]),
    );
  }

  // ─── USER MONITORING & ACTIVITY HUB ─────────────────────────────

  async getMonitoringOverview() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      vipUsers,
      newToday,
      newSevenDays,
      newThirtyDays,
      roleCounts,
      recentAuditsCount,
      recentLoginsCount,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { deletedAt: null, status: 'SUSPENDED' } }),
      this.prisma.user.count({ where: { deletedAt: null, isVip: true } }),
      this.prisma.user.count({ where: { deletedAt: null, createdAt: { gte: todayStart } } }),
      this.prisma.user.count({ where: { deletedAt: null, createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.user.count({ where: { deletedAt: null, createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.user.groupBy({
        by: ['role'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.auditLog.count({
        where: { createdAt: { gte: twentyFourHoursAgo } },
      }),
      this.prisma.auditLog.count({
        where: {
          createdAt: { gte: twentyFourHoursAgo },
          action: { contains: 'LOGIN', mode: 'insensitive' },
        },
      }),
    ]);

    const rolesDistribution = roleCounts.reduce((acc, curr) => {
      acc[curr.role] = curr._count._all;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalUsers,
      activeUsers,
      suspendedUsers,
      vipUsers,
      newUsers: {
        today: newToday,
        last7Days: newSevenDays,
        last30Days: newThirtyDays,
      },
      rolesDistribution,
      activityMetrics: {
        past24HoursEvents: recentAuditsCount,
        past24HoursLogins: recentLoginsCount,
      },
    };
  }

  async getUserMonitoringDetail(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: {
        company: {
          select: { id: true, name: true, referenceCode: true, companyType: true },
        },
        bookings: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            referenceCode: true,
            status: true,
            totalAmountUsd: true,
            tourId: true,
            arrivalDate: true,
            departureDate: true,
            createdAt: true,
            tour: {
              select: { slug: true, titleJsonb: true },
            },
          },
        },
        reviews: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            tourId: true,
            rating: true,
            comment: true,
            status: true,
            createdAt: true,
          },
        },
        tourFavorites: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            tour: {
              select: { id: true, slug: true, titleJsonb: true, basePriceUsd: true },
            },
          },
        },
        customerNotes: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        _count: {
          select: {
            bookings: true,
            reviews: true,
            tourFavorites: true,
            customerNotes: true,
            customerDocuments: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const inquiries = await this.prisma.tailorMadeInquiry.findMany({
      where: {
        OR: [
          { email: user.email },
          ...(user.phone ? [{ phone: user.phone }] : []),
        ],
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        referenceCode: true,
        destinations: true,
        status: true,
        budgetAmount: true,
        budgetCurrency: true,
        createdAt: true,
      },
    });

    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        OR: [
          { actorId: user.id },
          { entityId: user.id },
        ],
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
    });

    const customerActivityLogs = await this.prisma.customerActivityLog.findMany({
      where: { customerId: user.id },
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    const analyticsEvents = await this.prisma.analyticsEvent.findMany({
      where: { userId: user.id },
      take: 30,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        eventName: true,
        pathname: true,
        tourSlug: true,
        deviceCategory: true,
        properties: true,
        createdAt: true,
      },
    });

    const rawTimeline: Array<{
      id: string;
      type: 'AUTH' | 'BOOKING' | 'INQUIRY' | 'REVIEW' | 'FAVORITE' | 'ADMIN_ACTION' | 'NAVIGATION';
      action: string;
      title: string;
      description?: string;
      timestamp: Date;
      ipAddress?: string | null;
      userAgent?: string | null;
      metadata?: any;
      status?: string;
    }> = [];

    for (const log of auditLogs) {
      rawTimeline.push({
        id: `audit-${log.id}`,
        type: log.action.includes('LOGIN') ? 'AUTH' : 'ADMIN_ACTION',
        action: log.action,
        title: log.action.replace(/_/g, ' '),
        description: log.entityType ? `Target: ${log.entityType} ${log.entityId || ''}` : undefined,
        timestamp: log.createdAt,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        metadata: log.metadata,
        status: log.action.includes('FAILED') ? 'FAILED' : 'SUCCESS',
      });
    }

    for (const log of customerActivityLogs) {
      rawTimeline.push({
        id: `cust-act-${log.id}`,
        type: 'ADMIN_ACTION',
        action: log.action,
        title: log.action,
        description: log.user?.name ? `By staff: ${log.user.name}` : undefined,
        timestamp: log.createdAt,
        metadata: log.details,
      });
    }

    for (const b of user.bookings) {
      const tourTitleObj = b.tour?.titleJsonb as any;
      const tourTitle = tourTitleObj?.en || tourTitleObj?.ar || tourTitleObj?.es || 'Tour booking';
      rawTimeline.push({
        id: `booking-${b.id}`,
        type: 'BOOKING',
        action: 'BOOKING_CREATED',
        title: `Booking #${b.referenceCode || b.id.slice(0, 8)}`,
        description: `${tourTitle} — $${b.totalAmountUsd}`,
        timestamp: b.createdAt,
        status: b.status,
        metadata: { bookingId: b.id, tourId: b.tourId, status: b.status, totalPrice: Number(b.totalAmountUsd) },
      });
    }

    for (const inq of inquiries) {
      const dest = Array.isArray(inq.destinations) ? inq.destinations.join(', ') : 'Tailor-Made Tour';
      rawTimeline.push({
        id: `inquiry-${inq.id}`,
        type: 'INQUIRY',
        action: 'INQUIRY_SUBMITTED',
        title: `Inquiry #${inq.referenceCode || inq.id.slice(0, 8)}: ${dest}`,
        description: `Status: ${inq.status}, Budget: ${inq.budgetAmount || 0} ${inq.budgetCurrency || 'USD'}`,
        timestamp: inq.createdAt,
        status: inq.status,
        metadata: { inquiryId: inq.id, status: inq.status },
      });
    }

    for (const rev of user.reviews) {
      rawTimeline.push({
        id: `review-${rev.id}`,
        type: 'REVIEW',
        action: 'REVIEW_POSTED',
        title: `Review rating: ${rev.rating}★`,
        description: rev.comment ? (rev.comment.slice(0, 120) + (rev.comment.length > 120 ? '...' : '')) : undefined,
        timestamp: rev.createdAt,
        status: rev.status,
        metadata: { tourId: rev.tourId, rating: rev.rating },
      });
    }

    for (const fav of user.tourFavorites) {
      const tourTitleObj = fav.tour?.titleJsonb as any;
      const tourTitle = tourTitleObj?.en || tourTitleObj?.ar || tourTitleObj?.es || 'Tour';
      rawTimeline.push({
        id: `fav-${fav.id}`,
        type: 'FAVORITE',
        action: 'FAVORITE_SAVED',
        title: `Favorited Tour: ${tourTitle}`,
        timestamp: fav.createdAt,
      });
    }

    for (const ev of analyticsEvents) {
      rawTimeline.push({
        id: `analytics-${ev.id}`,
        type: 'NAVIGATION',
        action: ev.eventName,
        title: `Page event: ${ev.eventName}`,
        description: ev.pathname || (ev.tourSlug ? `Tour: ${ev.tourSlug}` : undefined),
        timestamp: ev.createdAt,
        metadata: ev.properties,
      });
    }

    rawTimeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const completedBookings = user.bookings.filter((b) => b.status === 'CONFIRMED' || b.status === 'COMPLETED').length;
    const totalSpent = user.bookings
      .filter((b) => b.status !== 'CANCELLED')
      .reduce((sum, b) => sum + Number(b.totalAmountUsd || 0), 0);

    const lastActiveTimestamp = rawTimeline.length > 0 ? rawTimeline[0].timestamp : user.updatedAt;
    const lastLoginLog = auditLogs.find((l) => l.action.includes('LOGIN'));

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        isVerified: user.isVerified,
        phoneVerified: user.phoneVerified,
        isVip: user.isVip,
        customerNumber: user.customerNumber,
        nationality: user.nationality,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth,
        preferredCurrency: user.preferredCurrency,
        preferredLanguage: user.preferredLanguage,
        preferredDestination: user.preferredDestination,
        preferredTravelType: user.preferredTravelType,
        referralSource: user.referralSource,
        tags: user.tags,
        segments: user.segments,
        address: user.address,
        emergencyContact: user.emergencyContact,
        familyMembers: user.familyMembers,
        travelCompanions: user.travelCompanions,
        suspendedAt: user.suspendedAt,
        suspendReason: user.suspendReason,
        sessionVersion: user.sessionVersion,
        company: user.company,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginIp: lastLoginLog?.ipAddress || null,
        lastLoginAt: lastLoginLog?.createdAt || null,
        lastActiveAt: lastActiveTimestamp,
      },
      metrics: {
        totalBookings: user._count.bookings,
        completedBookings,
        totalSpent,
        totalInquiries: inquiries.length,
        totalReviews: user._count.reviews,
        totalFavorites: user._count.tourFavorites,
        notesCount: user._count.customerNotes,
        documentsCount: user._count.customerDocuments,
      },
      activityTimeline: rawTimeline.slice(0, 100),
      bookings: user.bookings.map((b) => ({
        id: b.id,
        bookingReference: b.referenceCode,
        status: b.status,
        totalPrice: Number(b.totalAmountUsd),
        currency: 'USD',
        tourId: b.tourId,
        tourTitle: (b.tour?.titleJsonb as any)?.en || (b.tour?.titleJsonb as any)?.ar || 'Tour booking',
        startDate: b.arrivalDate ? b.arrivalDate.toISOString() : undefined,
        endDate: b.departureDate ? b.departureDate.toISOString() : undefined,
        createdAt: b.createdAt.toISOString(),
      })),
      inquiries,
      reviews: user.reviews,
      notes: user.customerNotes,
    };
  }

  async getLiveActivityStream(query: ListActivityStreamQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const whereAudit: Prisma.AuditLogWhereInput = {};
    if (query.userId) {
      whereAudit.OR = [{ actorId: query.userId }, { entityId: query.userId }];
    }
    if (query.search) {
      whereAudit.action = { contains: query.search, mode: 'insensitive' };
    }

    const [auditLogs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: whereAudit,
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where: whereAudit }),
    ]);

    const actorIds = [...new Set(auditLogs.map(l => l.actorId).filter((id): id is string => Boolean(id)))];
    const actors = actorIds.length > 0 ? await this.prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, name: true, email: true, role: true },
    }) : [];
    const actorMap = new Map(actors.map(a => [a.id, a]));

    const items = auditLogs.map(l => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      actorId: l.actorId,
      actorRole: l.actorRole,
      actor: l.actorId ? actorMap.get(l.actorId) || null : null,
      ipAddress: l.ipAddress,
      userAgent: l.userAgent,
      metadata: l.metadata,
      createdAt: l.createdAt,
    }));

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async suspendUser(id: string, reason: string, actorId: string, actorRole: string, ip?: string) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        status: 'SUSPENDED',
        suspendedAt: new Date(),
        suspendReason: sanitizePlainText(reason).slice(0, 500),
        sessionVersion: { increment: 1 },
        refreshToken: null,
      },
    });

    await Promise.all([
      this.prisma.customerActivityLog.create({
        data: {
          customerId: id,
          userId: actorId,
          action: 'ACCOUNT_SUSPENDED',
          details: { reason, suspendedBy: actorId },
        },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId,
          actorRole,
          action: 'USER_SUSPENDED',
          entityType: 'User',
          entityId: id,
          metadata: { reason },
          ipAddress: ip || null,
        },
      }),
    ]);

    return this.toSafeUser(updated);
  }

  async activateUser(id: string, actorId: string, actorRole: string, ip?: string) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        suspendedAt: null,
        suspendReason: null,
      },
    });

    await Promise.all([
      this.prisma.customerActivityLog.create({
        data: {
          customerId: id,
          userId: actorId,
          action: 'ACCOUNT_ACTIVATED',
          details: { activatedBy: actorId },
        },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId,
          actorRole,
          action: 'USER_ACTIVATED',
          entityType: 'User',
          entityId: id,
          metadata: { previousStatus: user.status },
          ipAddress: ip || null,
        },
      }),
    ]);

    return this.toSafeUser(updated);
  }

  async revokeSessionsAdmin(id: string, actorId: string, ip?: string) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id },
      data: {
        sessionVersion: { increment: 1 },
        refreshToken: null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'USER_SESSIONS_REVOKED',
        entityType: 'User',
        entityId: id,
        ipAddress: ip || null,
      },
    });

    return { success: true };
  }

  async addUserMonitoringNote(id: string, dto: AddUserMonitoringNoteDto, actorId: string) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');

    const note = await this.prisma.customerNote.create({
      data: {
        customerId: id,
        userId: actorId,
        noteType: dto.noteType || 'MONITORING',
        content: sanitizePlainText(dto.content).slice(0, 2000),
        isPinned: dto.isPinned || false,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return note;
  }
}
