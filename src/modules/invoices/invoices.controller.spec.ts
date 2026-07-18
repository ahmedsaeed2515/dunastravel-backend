import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { UnauthorizedException } from '@nestjs/common';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';

describe('InvoicesController', () => {
  let controller: InvoicesController;
  let service: jest.Mocked<InvoicesService>;

  beforeEach(async () => {
    const mockInvoicesService = {
      findByInvoiceNumber: jest
        .fn()
        .mockImplementation((invoiceNum, userId, email) => {
          if (!userId && !email) {
            throw new UnauthorizedException(
              'You do not have permission to view this invoice',
            );
          }
          return Promise.resolve({ invoiceNumber: invoiceNum });
        }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvoicesController],
      providers: [
        {
          provide: InvoicesService,
          useValue: mockInvoicesService,
        },
      ],
    })
      .overrideGuard(OptionalJwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<InvoicesController>(InvoicesController);
    service = module.get(InvoicesService);
  });

  describe('findByInvoiceNumber', () => {
    it('should reject requests with no valid JWT and no matching email query param', async () => {
      const req = { user: undefined };
      const email = undefined;

      await expect(
        controller.findByInvoiceNumber('INV-2027-0001', req, email),
      ).rejects.toThrow(UnauthorizedException);

      expect(service.findByInvoiceNumber).toHaveBeenCalledWith(
        'INV-2027-0001',
        undefined,
        undefined,
      );
    });

    it('should allow requests with a matching email query param', async () => {
      const req = { user: undefined };
      const email = 'test@example.com';

      const result = await controller.findByInvoiceNumber(
        'INV-2027-0001',
        req,
        email,
      );

      expect(result).toBeDefined();
      expect(service.findByInvoiceNumber).toHaveBeenCalledWith(
        'INV-2027-0001',
        undefined,
        'test@example.com',
      );
    });

    it('should allow requests with a valid JWT (userId)', async () => {
      const req = { user: { id: 'user-1' } };
      const email = undefined;

      const result = await controller.findByInvoiceNumber(
        'INV-2027-0001',
        req,
        email,
      );

      expect(result).toBeDefined();
      expect(service.findByInvoiceNumber).toHaveBeenCalledWith(
        'INV-2027-0001',
        'user-1',
        undefined,
      );
    });
  });
});
