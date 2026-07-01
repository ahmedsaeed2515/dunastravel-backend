import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateCompanyDto,
  UpdateCompanyDto,
  CompanyQueryFilters,
  BulkUpdateCompaniesDto,
} from './dto/company.dto';
import { Prisma, CompanyStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { sanitizeCsvField } from '../../common/utils';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  private generateReferenceCode(companyType: string): string {
    const prefix =
      companyType === 'AGENCY'
        ? 'AGN'
        : companyType === 'CORPORATE'
          ? 'COR'
          : 'AFF';
    const year = new Date().getFullYear();
    const random = randomBytes(2).toString('hex').toUpperCase();
    return `${prefix}-${year}-${random}`;
  }

  async create(data: CreateCompanyDto) {
    const referenceCode = this.generateReferenceCode(
      data.companyType || 'AGENCY',
    );

    return this.prisma.company.create({
      data: {
        ...data,
        referenceCode,
        commissionRate: data.commissionRate || 0,
        address: data.address
          ? (data.address as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        primaryContact: data.primaryContact
          ? (data.primaryContact as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        contractStartDate: data.contractStartDate
          ? new Date(data.contractStartDate)
          : null,
        contractEndDate: data.contractEndDate
          ? new Date(data.contractEndDate)
          : null,
      },
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
        include: {
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
          include: {
            payments: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException(`Company with ID ${id} not found`);
    }

    return company;
  }

  async update(id: string, data: UpdateCompanyDto) {
    await this.findOne(id); // Verify existence

    return this.prisma.company.update({
      where: { id },
      data: {
        ...data,
        address:
          data.address !== undefined
            ? (data.address as Prisma.InputJsonValue)
            : undefined,
        primaryContact:
          data.primaryContact !== undefined
            ? (data.primaryContact as Prisma.InputJsonValue)
            : undefined,
        contractStartDate: data.contractStartDate
          ? new Date(data.contractStartDate)
          : undefined,
        contractEndDate: data.contractEndDate
          ? new Date(data.contractEndDate)
          : undefined,
      },
    });
  }

  async softDelete(id: string) {
    await this.findOne(id);
    return this.prisma.company.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: CompanyStatus.INACTIVE,
      },
    });
  }

  async bulkUpdate(data: BulkUpdateCompaniesDto) {
    const { companyIds, status, tags, segments } = data;

    if (!companyIds || companyIds.length === 0) {
      throw new BadRequestException('No company IDs provided');
    }

    const updateData: Prisma.CompanyUpdateManyMutationInput = {};

    if (status !== undefined) updateData.status = status;
    if (tags !== undefined) updateData.tags = { push: tags };
    if (segments !== undefined) updateData.segments = { push: segments };

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No update fields provided');
    }

    const result = await this.prisma.company.updateMany({
      where: { id: { in: companyIds }, deletedAt: null },
      data: updateData,
    });

    return { count: result.count };
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

  async exportCsv(filters: CompanyQueryFilters) {
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

    const rows = result.data.map((c: any) => [
      sanitizeCsvField(c.referenceCode),
      `"${sanitizeCsvField(c.name)}"`,
      sanitizeCsvField(c.companyType),
      sanitizeCsvField(c.status),
      sanitizeCsvField(c.email),
      sanitizeCsvField(c.phone),
      sanitizeCsvField(`${c.commissionRate}%`),
      sanitizeCsvField(c.currentBalance),
      sanitizeCsvField(c.paymentTerms),
      `"${sanitizeCsvField(c.tags.join(', '))}"`,
      `"${sanitizeCsvField(c.segments.join(', '))}"`,
      sanitizeCsvField(c._count.users),
      sanitizeCsvField(c._count.bookings),
      sanitizeCsvField(c.createdAt.toISOString()),
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}
