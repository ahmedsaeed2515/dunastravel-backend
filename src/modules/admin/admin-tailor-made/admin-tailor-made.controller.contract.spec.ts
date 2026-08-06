import { Test, TestingModule } from '@nestjs/testing';
import { AdminTailorMadeController } from './admin-tailor-made.controller';
import { AdminTailorMadeService } from './admin-tailor-made.service';
import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

describe('AdminTailorMadeController Contract Tests', () => {
  let controller: AdminTailorMadeController;
  let service: jest.Mocked<AdminTailorMadeService>;

  const mockInquiry = {
    id: 'inq-100',
    referenceCode: 'TMI-2026-0001',
    fullName: 'Jane Doe',
    email: 'jane@example.com',
    phone: '+1234567890',
    status: 'APPROVED',
    quotedAmountUsd: '2500.00',
  };
  const adminUser = {
    id: '029b99aa-0409-46dc-888e-3ed5f8f0d20a',
    email: 'admin@example.com',
    name: 'Admin',
    role: UserRole.ADMIN,
  };

  beforeEach(async () => {
    const mockService = {
      findAll: jest
        .fn()
        .mockResolvedValue({ data: [mockInquiry], meta: { total: 1 } }),
      findOne: jest.fn().mockResolvedValue(mockInquiry),
      updateStatus: jest
        .fn()
        .mockResolvedValue({ ...mockInquiry, status: 'IN_PROGRESS' }),
      assignInquiry: jest
        .fn()
        .mockResolvedValue({ ...mockInquiry, assigneeId: 'agent-1' }),
      createQuote: jest.fn().mockResolvedValue({
        ...mockInquiry,
        status: 'QUOTED',
        quotedAmountUsd: '3000.00',
      }),
      convertToBooking: jest.fn().mockResolvedValue({
        inquiry: { ...mockInquiry, status: 'CONVERTED_TO_BOOKING' },
        booking: { id: 'bkg-999', referenceCode: 'TMB-12345' },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminTailorMadeController],
      providers: [
        {
          provide: AdminTailorMadeService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<AdminTailorMadeController>(
      AdminTailorMadeController,
    );
    service = module.get(AdminTailorMadeService);
  });

  it('POST /api/admin/tailor-made-inquiries/:id/convert-to-booking converts approved inquiry to linked booking', async () => {
    const res = await controller.convertToBooking('inq-100', adminUser);
    expect(res).toBeDefined();
    expect(service.convertToBooking).toHaveBeenCalledWith(
      'inq-100',
      adminUser,
    );
  });

  it('POST /api/admin/tailor-made-inquiries/:id/convert-to-booking rejects non-approved status', async () => {
    service.convertToBooking.mockRejectedValueOnce(
      new BadRequestException('Inquiry must be APPROVED before conversion'),
    );

    await expect(
      controller.convertToBooking('inq-100', adminUser),
    ).rejects.toThrow(BadRequestException);
  });
});
