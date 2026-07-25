import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyType, CompanyStatus } from '@prisma/client';

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
    const existing = await this.prisma.company.findFirst({
      where: {
        OR: [{ email: dto.email }, { taxId: dto.taxId }],
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Agency with this email or tax ID already exists',
      );
    }

    return this.prisma.company.create({
      data: {
        referenceCode: `AGY-${Date.now()}`,
        name: dto.name,
        email: dto.email,
        phone: dto.phone || null,
        taxId: dto.taxId,
        address: dto.address || undefined,
        companyType: CompanyType.AGENCY,
        status: CompanyStatus.INACTIVE, // Pending approval from admin
        website: dto.website || null,
      },
    });
  }
}
