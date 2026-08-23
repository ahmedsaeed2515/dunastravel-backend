import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { User, UserRole, Prisma, MediaEntityType } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ListCustomersQueryDto,
  UpdateCustomerCrmDto,
  BulkUpdateCustomersDto,
  AddCustomerNoteDto,
  AddCustomerDocumentDto,
} from './dto/customer-crm.dto';
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
  createdAt: Date;
  updatedAt: Date;
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

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly prisma: PrismaService) {}

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
        name: data.name
          ? sanitizePlainText(data.name).slice(0, 255)
          : undefined,
        email: data.email?.trim().toLowerCase(),
        phone: data.phone
          ? sanitizePlainText(data.phone).slice(0, 50)
          : undefined,
        passwordHash: data.passwordHash,
        role: data.role,
        ...(data.passwordHash || data.role
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
  }): Promise<{ users: UserListItem[]; total: number }> {
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
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total };
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

  async softDelete(id: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
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
}
