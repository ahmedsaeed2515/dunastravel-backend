import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateCompanyDto,
  UpdateCompanyDto,
  CompanyQueryFilters,
  BulkUpdateCompaniesDto,
} from './dto/company.dto';
import { Prisma, CompanyStatus, UserRole } from '@prisma/client';
import { randomBytes } from 'crypto';
import { sanitizeCsvField } from '../../common/utils';
import { sanitizePlainText } from '../../common/utils/content-sanitizer.util';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  private assertSuperAdmin(actor: { id: string; role: string }): void {
    if (actor.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Only super administrators can manage companies',
      );
    }
  }

  private generateReferenceCode(companyType: string): string {
    const prefix =
      companyType === 'AGENCY'
        ? 'AGN'
        : companyType === 'CORPORATE'
          ? 'COR'
          : 'AFF';
    const year = new Date().getFullYear();
    const random = randomBytes(5).toString('hex').toUpperCase();
    return `${prefix}-${year}-${random}`;
  }

  async create(
    data: CreateCompanyDto,
    actor: { id: string; role: string },
    reqDetails?: { ipAddress?: string; userAgent?: string },
  ) {
    this.assertSuperAdmin(actor);
    this.assertContractDates(
      data.contractStartDate
        ? new Date(data.contractStartDate)
        : undefined,
      data.contractEndDate ? new Date(data.contractEndDate) : undefined,
    );
    const referenceCode = this.generateReferenceCode(
      data.companyType || 'AGENCY',
    );

    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: sanitizePlainText(data.name).slice(0, 255),
          companyType: data.companyType,
          email: data.email?.trim().toLowerCase(),
          phone: data.phone,
          website: data.website,
          taxId: data.taxId,
          referenceCode,
          commissionRate: data.commissionRate ?? 0,
          paymentTerms: data.paymentTerms,
          tags: this.sanitizeLabels(data.tags) ?? [],
          segments: this.sanitizeLabels(data.segments) ?? [],
          address: data.address
            ? (this.sanitizeRecord(data.address) as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          primaryContact: data.primaryContact
            ? (this.sanitizeRecord(
                data.primaryContact,
              ) as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          contractStartDate: data.contractStartDate
            ? new Date(data.contractStartDate)
            : null,
          contractEndDate: data.contractEndDate
            ? new Date(data.contractEndDate)
            : null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'COMPANY_CREATED',
          entityType: 'Company',
          entityId: company.id,
          metadata: { companyType: company.companyType },
          ipAddress: reqDetails?.ipAddress || null,
          userAgent: reqDetails?.userAgent || null,
        },
      });

      return company;
    });
  }

  async findAll(filters: CompanyQueryFilters) {
    const {
      page = 1,
      limit = 10,
      search,
      companyType,
      status,
      tag,
      segment,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;

    const skip = (page - 1) * limit;

    const where: Prisma.CompanyWhereInput = {
      deletedAt: null,
      ...(companyType && { companyType }),
      ...(status && { status }),
      ...(tag && { tags: { has: tag } }),
      ...(segment && { segments: { has: segment } }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { referenceCode: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, data] = await Promise.all([
      this.prisma.company.count({ where }),
      this.prisma.company.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          referenceCode: true,
          name: true,
          companyType: true,
          status: true,
          email: true,
          phone: true,
          website: true,
          commissionRate: true,
          currentBalance: true,
          paymentTerms: true,
          contractStartDate: true,
          contractEndDate: true,
          tags: true,
          segments: true,
          tier: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { users: true, bookings: true },
          },
        },
      }),
    ]);

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

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id, deletedAt: null },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isVip: true,
            status: true,
          },
        },
        bookings: {
          orderBy: { createdAt: 'desc' },
          take: 100,
          select: {
            id: true,
            referenceCode: true,
            status: true,
            arrivalDate: true,
            departureDate: true,
            adults: true,
            children: true,
            infants: true,
            totalAmountUsd: true,
            paidAmountUsd: true,
            createdAt: true,
            payments: {
              select: {
                id: true,
                amount: true,
                currency: true,
                method: true,
                status: true,
                isRefund: true,
                createdAt: true,
              },
            },
            user: { select: { name: true, email: true } },
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  async update(
    id: string,
    data: UpdateCompanyDto,
    actor: { id: string; role: string },
    reqDetails?: { ipAddress?: string; userAgent?: string },
  ) {
    this.assertSuperAdmin(actor);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.company.findFirst({
        where: { id, deletedAt: null },
        select: { contractStartDate: true, contractEndDate: true },
      });
      if (!existing) throw new NotFoundException('Company not found');

      const contractStartDate = data.contractStartDate
        ? new Date(data.contractStartDate)
        : existing.contractStartDate;
      const contractEndDate = data.contractEndDate
        ? new Date(data.contractEndDate)
        : existing.contractEndDate;
      this.assertContractDates(
        contractStartDate ?? undefined,
        contractEndDate ?? undefined,
      );

      const updated = await tx.company.update({
        where: { id },
        data: {
          ...(data.name !== undefined && {
            name: sanitizePlainText(data.name).slice(0, 255),
          }),
          ...(data.companyType !== undefined && {
            companyType: data.companyType,
          }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.email !== undefined && {
            email: data.email.trim().toLowerCase(),
          }),
          ...(data.phone !== undefined && { phone: data.phone }),
          ...(data.website !== undefined && { website: data.website }),
          ...(data.taxId !== undefined && { taxId: data.taxId }),
          ...(data.commissionRate !== undefined && {
            commissionRate: data.commissionRate,
          }),
          ...(data.paymentTerms !== undefined && {
            paymentTerms: data.paymentTerms,
          }),
          ...(data.tags !== undefined && {
            tags: this.sanitizeLabels(data.tags),
          }),
          ...(data.segments !== undefined && {
            segments: this.sanitizeLabels(data.segments),
          }),
          address:
            data.address !== undefined
              ? (this.sanitizeRecord(data.address) as Prisma.InputJsonValue)
              : undefined,
          primaryContact:
            data.primaryContact !== undefined
              ? (this.sanitizeRecord(
                  data.primaryContact,
                ) as Prisma.InputJsonValue)
              : undefined,
          contractStartDate: data.contractStartDate
            ? new Date(data.contractStartDate)
            : undefined,
          contractEndDate: data.contractEndDate
            ? new Date(data.contractEndDate)
            : undefined,
        },
      });
      if (data.status && data.status !== CompanyStatus.ACTIVE) {
        await tx.user.updateMany({
          where: { companyId: id, deletedAt: null },
          data: {
            refreshToken: null,
            sessionVersion: { increment: 1 },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'COMPANY_UPDATED',
          entityType: 'Company',
          entityId: id,
          metadata: { changedFields: Object.keys(data) },
          ipAddress: reqDetails?.ipAddress || null,
          userAgent: reqDetails?.userAgent || null,
        },
      });

      return updated;
    });
  }

  async softDelete(
    id: string,
    actor: { id: string; role: string },
    reqDetails?: { ipAddress?: string; userAgent?: string },
  ) {
    this.assertSuperAdmin(actor);
    return this.prisma.$transaction(async (tx) => {
      const exists = await tx.company.findFirst({
        where: { id, deletedAt: null },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException('Company not found');
      const company = await tx.company.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: CompanyStatus.INACTIVE,
        },
      });
      await tx.user.updateMany({
        where: { companyId: id, deletedAt: null },
        data: {
          refreshToken: null,
          sessionVersion: { increment: 1 },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'COMPANY_DELETED',
          entityType: 'Company',
          entityId: id,
          ipAddress: reqDetails?.ipAddress || null,
          userAgent: reqDetails?.userAgent || null,
        },
      });

      return company;
    });
  }

  async bulkUpdate(
    data: BulkUpdateCompaniesDto,
    actor: { id: string; role: string },
    reqDetails?: { ipAddress?: string; userAgent?: string },
  ) {
    this.assertSuperAdmin(actor);
    const { companyIds, status, tags, segments } = data;

    if (!companyIds || companyIds.length === 0) {
      throw new BadRequestException('No company IDs provided');
    }

    if (status === undefined && tags === undefined && segments === undefined) {
      throw new BadRequestException('No update fields provided');
    }

    const sanitizedTags = this.sanitizeLabels(tags);
    const sanitizedSegments = this.sanitizeLabels(segments);
    const count = await this.prisma.$transaction(async (tx) => {
      const companies = await tx.company.findMany({
        where: { id: { in: companyIds }, deletedAt: null },
        select: { id: true, tags: true, segments: true },
      });

      for (const company of companies) {
        await tx.company.update({
          where: { id: company.id },
          data: {
            ...(status !== undefined && { status }),
            ...(sanitizedTags !== undefined && {
              tags: [
                ...new Set([...company.tags, ...sanitizedTags]),
              ].slice(0, 20),
            }),
            ...(sanitizedSegments !== undefined && {
              segments: [
                ...new Set([...company.segments, ...sanitizedSegments]),
              ].slice(0, 20),
            }),
          },
        });
      }

      if (status !== undefined && status !== CompanyStatus.ACTIVE) {
        await tx.user.updateMany({
          where: {
            companyId: { in: companies.map((company) => company.id) },
            deletedAt: null,
          },
          data: {
            refreshToken: null,
            sessionVersion: { increment: 1 },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'COMPANIES_BULK_UPDATED',
          entityType: 'Company',
          metadata: {
            requestedCount: data.companyIds.length,
            updatedCount: companies.length,
            changedFields: Object.keys(data).filter(
              (field) => field !== 'companyIds',
            ),
          },
          ipAddress: reqDetails?.ipAddress || null,
          userAgent: reqDetails?.userAgent || null,
        },
      });

      return companies.length;
    });

    return { count };
  }

  async getDashboardMetrics() {
    const [
      totalCompanies,
      activeAgencies,
      activeCorporate,
      totalOutstandingBalanceAgg,
    ] = await Promise.all([
      this.prisma.company.count({ where: { deletedAt: null } }),
      this.prisma.company.count({
        where: { companyType: 'AGENCY', status: 'ACTIVE', deletedAt: null },
      }),
      this.prisma.company.count({
        where: { companyType: 'CORPORATE', status: 'ACTIVE', deletedAt: null },
      }),
      this.prisma.company.aggregate({
        where: { deletedAt: null, currentBalance: { gt: 0 } },
        _sum: { currentBalance: true },
      }),
    ]);

    const topPartners = await this.prisma.company.findMany({
      where: { deletedAt: null },
      orderBy: { currentBalance: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        referenceCode: true,
        companyType: true,
        currentBalance: true,
        _count: { select: { bookings: true } },
      },
    });

    return {
      totalCompanies,
      activeAgencies,
      activeCorporate,
      totalOutstandingBalance:
        totalOutstandingBalanceAgg._sum.currentBalance || 0,
      topPartners,
    };
  }

  async exportCsv(
    filters: CompanyQueryFilters,
    actor: { id: string; role: string },
    reqDetails?: { ipAddress?: string; userAgent?: string },
  ) {
    this.assertSuperAdmin(actor);
    const result = await this.findAll({ ...filters, limit: 10000, page: 1 });

    if (!result.data.length) {
      throw new BadRequestException('No data found to export');
    }

    const headers = [
      'ReferenceCode',
      'Name',
      'Type',
      'Status',
      'Email',
      'Phone',
      'CommissionRate',
      'CurrentBalance',
      'PaymentTerms',
      'Tags',
      'Segments',
      'UsersCount',
      'BookingsCount',
      'RegisteredAt',
    ];

    const rows = result.data.map((company) => [
      company.referenceCode,
      company.name,
      company.companyType,
      company.status,
      company.email,
      company.phone,
      `${company.commissionRate}%`,
      company.currentBalance,
      company.paymentTerms,
      company.tags.join(', '),
      company.segments.join(', '),
      company._count.users,
      company._count.bookings,
      company.createdAt.toISOString(),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        row
          .map((value) => {
            const safe = sanitizeCsvField(value)
              .replace(/\r?\n/g, ' ')
              .replace(/"/g, '""');
            return `"${safe}"`;
          })
          .join(','),
      ),
    ].join('\n');

    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'COMPANIES_CSV_EXPORTED',
        entityType: 'Company',
        metadata: { exportedCount: result.data.length },
        ipAddress: reqDetails?.ipAddress || null,
        userAgent: reqDetails?.userAgent || null,
      },
    });

    return csv;
  }

  private assertContractDates(start?: Date, end?: Date): void {
    if (start && end && end <= start) {
      throw new BadRequestException(
        'Contract end date must be after the start date',
      );
    }
  }

  private sanitizeLabels(values?: string[]): string[] | undefined {
    if (!values) return undefined;
    return [
      ...new Set(
        values
          .map((value) => sanitizePlainText(value).slice(0, 50))
          .filter(Boolean),
      ),
    ].slice(0, 20);
  }

  private sanitizeRecord(value: object): Record<string, string> {
    return Object.fromEntries(
      Object.entries(value)
        .filter((entry): entry is [string, string] =>
          typeof entry[1] === 'string',
        )
        .map(([key, item]) => [
          key,
          sanitizePlainText(item).slice(0, 255),
        ]),
    );
  }
}
