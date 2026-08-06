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
