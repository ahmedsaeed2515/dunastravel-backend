import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyType, CompanyStatus, Prisma } from '@prisma/client';
import { generateReferenceCode } from '../../common/utils/identifiers.util';
import { sanitizePlainText } from '../../common/utils/content-sanitizer.util';

export interface RegisterAgencyInput {
  name: string;
  email: string;
  phone?: string;
  taxId: string;
  address?: string;
  website?: string;
}

@Injectable()
export class AgenciesService {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureContractedDemoPartners();
  }

  /**
   * Ensure standard contracted B2B partners (e.g. 90259175) are available in the registry
   */
  async ensureContractedDemoPartners() {
    try {
      const demoIata = '90259175';
      const existing = await this.prisma.company.findFirst({
        where: {
          deletedAt: null,
          OR: [
            { taxId: demoIata },
            { referenceCode: `AGN-2026-${demoIata}` },
          ],
        },
      });

      if (!existing) {
        await this.prisma.company.create({
          data: {
            referenceCode: `AGN-2026-${demoIata}`,
            name: 'Al-Ahram Luxury Travel & Expeditions',
            companyType: CompanyType.AGENCY,
            status: CompanyStatus.ACTIVE,
            email: 'b2b@alahramtravel.com',
            phone: '+20 2 2738 9000',
            website: 'https://alahramtravel.com',
            taxId: demoIata,
            tier: 'PLATINUM',
            commissionRate: new Prisma.Decimal(15.0),
            paymentTerms: 'NET_30',
            address: {
              street: '22 El-Gezira St, Zamalek',
              city: 'Cairo',
              country: 'Egypt',
            },
            primaryContact: {
              name: 'Karim Mansour',
              role: 'Head of Global Partnerships',
              email: 'k.mansour@alahramtravel.com',
              phone: '+20 100 223 9988',
            },
            tags: ['Luxury', 'VIP Operator', 'IATA-Certified'],
          },
        });
      }
    } catch {
      // Non-blocking on startup if table is being migrated
    }
  }

  /**
   * Instant real-time verification for 8-digit IATA / TRUE / CLIA / Partner Code
   */
  async verifyPartnerCode(code: string) {
    if (!code || typeof code !== 'string') {
      return {
        valid: false,
        reason: 'INVALID_FORMAT',
        message: 'يرجى إدخال رقم اعتماد صحيح مكون من 8 أرقام',
      };
    }

    const cleanCode = code.trim().toUpperCase();

    const company = await this.prisma.company.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { taxId: { equals: cleanCode, mode: 'insensitive' } },
          { referenceCode: { equals: cleanCode, mode: 'insensitive' } },
          { referenceCode: { endsWith: cleanCode, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        referenceCode: true,
        name: true,
        companyType: true,
        status: true,
        tier: true,
        commissionRate: true,
        email: true,
        phone: true,
        website: true,
        address: true,
        taxId: true,
        paymentTerms: true,
        primaryContact: true,
      },
    });

    if (!company) {
      return {
        valid: false,
        code: cleanCode,
        reason: 'NOT_FOUND',
        message: 'رقم الاعتماد غير مسجل في قاعدة بيانات الشركاء المتعاقدين مع دوناس ترافيل',
      };
    }

    if (company.status !== CompanyStatus.ACTIVE) {
      return {
        valid: false,
        code: cleanCode,
        reason: 'INACTIVE',
        companyName: company.name,
        message: 'عقد الشريك غير مفعل أو قيد المراجعة، يرجى التواصل مع إدارة التعاقدات لتجديد الاعتماد',
      };
    }

    let formattedAddress = '';
    if (typeof company.address === 'object' && company.address !== null) {
      const addr = company.address as Record<string, unknown>;
      formattedAddress = [addr.street, addr.city, addr.country]
        .filter(Boolean)
        .join(', ');
    } else if (typeof company.address === 'string') {
      formattedAddress = company.address;
    }

    return {
      valid: true,
      code: cleanCode,
      message: 'تم التحقق من بيانات الشريك المتعاقد بنجاح',
      company: {
        id: company.id,
        name: company.name,
        referenceCode: company.referenceCode,
        iataNumber: company.taxId || cleanCode,
        companyType: company.companyType,
        tier: company.tier || 'STANDARD',
        status: company.status,
        commissionRate: Number(company.commissionRate),
        email: company.email,
        phone: company.phone,
        website: company.website,
        address: formattedAddress,
        paymentTerms: company.paymentTerms || 'STANDARD',
      },
    };
  }

  async registerAgency(dto: RegisterAgencyInput) {
    const email = dto.email.trim().toLowerCase();
    const taxId = dto.taxId.trim().toUpperCase();
    const acceptedResponse = {
      accepted: true,
      message: 'Agency registration has been submitted for review',
    };

    for (let attempt = 0; attempt < 3; attempt++) {
      const existing = await this.prisma.company.findFirst({
        where: {
          deletedAt: null,
          OR: [
            { email: { equals: email, mode: 'insensitive' } },
            { taxId: { equals: taxId, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
      if (existing) return acceptedResponse;

      try {
        await this.prisma.$transaction(
          async (tx) => {
            const company = await tx.company.create({
              data: {
                referenceCode: generateReferenceCode('AGY'),
                name: sanitizePlainText(dto.name).slice(0, 200),
                email,
                phone: dto.phone?.trim() || null,
                taxId,
                address: dto.address
                  ? sanitizePlainText(dto.address).slice(0, 500)
                  : undefined,
                companyType: CompanyType.AGENCY,
                status: CompanyStatus.INACTIVE,
                website: dto.website || null,
              },
              select: { id: true },
            });
            await tx.auditLog.create({
              data: {
                action: 'AGENCY_REGISTRATION_SUBMITTED',
                entityType: 'Company',
                entityId: company.id,
                metadata: { source: 'PUBLIC_REGISTRATION' },
              },
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        return acceptedResponse;
      } catch (error: unknown) {
        const code = (error as { code?: string }).code;
        if (code !== 'P2002' && code !== 'P2034') throw error;
      }
    }

    const registered = await this.prisma.company.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { email: { equals: email, mode: 'insensitive' } },
          { taxId: { equals: taxId, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    if (registered) return acceptedResponse;
    throw new ServiceUnavailableException(
      'Agency registration is temporarily unavailable',
    );
  }
}
