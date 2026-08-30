import { Test, TestingModule } from '@nestjs/testing';
import { AgenciesService } from './agencies.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyStatus, CompanyType, Prisma } from '@prisma/client';

describe('AgenciesService', () => {
  let service: AgenciesService;
  let prisma: PrismaService;

  const mockPrisma: any = {
    company: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((cb: any) => cb(mockPrisma)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgenciesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AgenciesService>(AgenciesService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('verifyPartnerCode', () => {
    it('returns valid true when an active contracted partner code matches', async () => {
      mockPrisma.company.findFirst.mockResolvedValue({
        id: 'comp-1',
        referenceCode: 'AGN-2026-90259175',
        name: 'Al-Ahram Luxury Travel',
        companyType: CompanyType.AGENCY,
        status: CompanyStatus.ACTIVE,
        tier: 'PLATINUM',
        commissionRate: new Prisma.Decimal(15.0),
        email: 'b2b@alahramtravel.com',
        phone: '+20 2 2738 9000',
        website: 'https://alahramtravel.com',
        address: { street: '22 El-Gezira St', city: 'Cairo', country: 'Egypt' },
        taxId: '90259175',
        paymentTerms: 'NET_30',
        primaryContact: { name: 'Karim Mansour' },
      });

      const result = await service.verifyPartnerCode('90259175');

      expect(result.valid).toBe(true);
      expect(result.company?.name).toBe('Al-Ahram Luxury Travel');
      expect(result.company?.tier).toBe('PLATINUM');
      expect(result.company?.commissionRate).toBe(15);
      expect(result.company?.address).toContain('Cairo');
    });

    it('returns valid false when the code does not exist in registry', async () => {
      mockPrisma.company.findFirst.mockResolvedValue(null);

      const result = await service.verifyPartnerCode('00000000');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('NOT_FOUND');
    });

    it('returns valid false with reason INACTIVE when partner account is suspended', async () => {
      mockPrisma.company.findFirst.mockResolvedValue({
        id: 'comp-2',
        referenceCode: 'AGN-2026-88888888',
        name: 'Suspended Agency',
        companyType: CompanyType.AGENCY,
        status: CompanyStatus.INACTIVE,
        tier: 'STANDARD',
        commissionRate: new Prisma.Decimal(10.0),
        taxId: '88888888',
      });

      const result = await service.verifyPartnerCode('88888888');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('INACTIVE');
      expect(result.companyName).toBe('Suspended Agency');
    });
  });
});
