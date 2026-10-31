import { Test, TestingModule } from '@nestjs/testing';
import { InquiriesService } from './inquiries.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  UnprocessableEntityException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { TailorMadeInquiryStatus } from '@prisma/client';
import { INQUIRY_EVENTS } from './events';

describe('InquiriesService', () => {
  let service: InquiriesService;
  let prisma: any;
  let eventEmitter: any;

  beforeEach(async () => {
    prisma = {
      tailorMadeInquiry: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      company: {
        findFirst: jest.fn(),
      },
    };

    eventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InquiriesService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<InquiriesService>(InquiriesService);
  });

  describe('create', () => {
    const validDto = {
      fullName: 'Ahmed Hassan',
      email: 'ahmed@example.com',
      phone: '+20 100 123 4567',
      preferredLanguage: 'ar',
      destinations: ['Cairo', 'Aswan'],
      startDate: '2028-05-01',
      endDate: '2028-05-10',
      adults: 2,
      children: 1,
      budgetAmount: 4000,
      budgetCurrency: 'USD',
      notes: 'Luxury Nile cruise request',
    };

    it('should throw UnprocessableEntityException if startDate is in the past', async () => {
      await expect(
        service.create({
          ...validDto,
          startDate: '2020-01-01',
          endDate: '2020-01-05',
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw UnprocessableEntityException if travel duration exceeds 365 days', async () => {
      await expect(
        service.create({
          ...validDto,
          startDate: '2028-01-01',
          endDate: '2029-02-01',
        }),
      ).rejects.toThrow('Travel duration exceeds the allowed maximum');
    });

    it('should create inquiry, match partnerCode to company, and emit INQUIRY_EVENTS.CREATED', async () => {
      prisma.tailorMadeInquiry.findUnique.mockResolvedValue(null); // No reference code collision
      prisma.company.findFirst.mockResolvedValue({
        id: 'comp-uuid-99',
        taxId: 'TAX-9988',
        referenceCode: 'DNAS-PARTNER',
      });

      const createdRecord = {
        id: 'inq-id-1',
        referenceCode: 'INQ-987654',
        fullName: 'Ahmed Hassan',
        email: 'ahmed@example.com',
        phone: '+20 100 123 4567',
        preferredLanguage: 'ar',
        destinations: ['Cairo', 'Aswan'],
        startDate: new Date('2028-05-01'),
        endDate: new Date('2028-05-10'),
        adults: 2,
        children: 1,
        budgetAmount: '4000',
        budgetCurrency: 'USD',
        notes: 'Luxury Nile cruise request',
        partnerCode: 'TAX-9988',
        companyId: 'comp-uuid-99',
        status: TailorMadeInquiryStatus.NEWLY_RECEIVED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.tailorMadeInquiry.create.mockResolvedValue(createdRecord);

      const result = await service.create({
        ...validDto,
        partnerCode: 'DNAS-PARTNER',
      });

      expect(result.referenceCode).toBe('INQ-987654');
      expect(result.status).toBe(TailorMadeInquiryStatus.NEWLY_RECEIVED);
      expect(prisma.tailorMadeInquiry.create).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        INQUIRY_EVENTS.CREATED,
        expect.objectContaining({
          referenceCode: 'INQ-987654',
          email: 'ahmed@example.com',
        }),
      );
    });
  });

  describe('updateStatus', () => {
    it('should reject CONVERTED_TO_BOOKING via updateStatus', async () => {
      await expect(
        service.updateStatus(
          'INQ-123',
          TailorMadeInquiryStatus.CONVERTED_TO_BOOKING,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if inquiry does not exist', async () => {
      prisma.tailorMadeInquiry.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus(
          'INQ-NOTFOUND',
          TailorMadeInquiryStatus.IN_PROGRESS,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw UnprocessableEntityException on CLOSED inquiry', async () => {
      prisma.tailorMadeInquiry.findUnique.mockResolvedValue({
        referenceCode: 'INQ-123',
        status: TailorMadeInquiryStatus.CLOSED,
      });

      await expect(
        service.updateStatus('INQ-123', TailorMadeInquiryStatus.IN_PROGRESS),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw UnprocessableEntityException on backward transition from IN_PROGRESS to NEWLY_RECEIVED', async () => {
      prisma.tailorMadeInquiry.findUnique.mockResolvedValue({
        referenceCode: 'INQ-123',
        status: TailorMadeInquiryStatus.IN_PROGRESS,
      });

      await expect(
        service.updateStatus('INQ-123', TailorMadeInquiryStatus.NEWLY_RECEIVED),
      ).rejects.toThrow(
        'Cannot move an in-progress inquiry back to newly received',
      );
    });

    it('should successfully update status from NEWLY_RECEIVED to IN_PROGRESS', async () => {
      const existing = {
        referenceCode: 'INQ-123',
        status: TailorMadeInquiryStatus.NEWLY_RECEIVED,
        fullName: 'Test User',
        email: 'test@example.com',
        phone: '+12345',
        preferredLanguage: 'en',
        destinations: ['Cairo'],
        startDate: null,
        endDate: null,
        adults: 2,
        children: 0,
        budgetAmount: null,
        budgetCurrency: null,
        notes: null,
        partnerCode: null,
        companyId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.tailorMadeInquiry.findUnique.mockResolvedValue(existing);
      prisma.tailorMadeInquiry.update.mockResolvedValue({
        ...existing,
        status: TailorMadeInquiryStatus.IN_PROGRESS,
      });

      const res = await service.updateStatus(
        'INQ-123',
        TailorMadeInquiryStatus.IN_PROGRESS,
      );
      expect(res.status).toBe(TailorMadeInquiryStatus.IN_PROGRESS);
    });
  });
});
