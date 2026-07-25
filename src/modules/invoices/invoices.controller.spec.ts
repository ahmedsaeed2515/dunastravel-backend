import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { UnauthorizedException } from '@nestjs/common';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { RequestWithUser } from '../../common/types';

describe('InvoicesController Unit Tests', () => {
  let controller: InvoicesController;
  let service: jest.Mocked<Partial<InvoicesService>>;

  beforeEach(async () => {
    const mockInvoicesService: jest.Mocked<Partial<InvoicesService>> = {
      findByInvoiceNumber: jest
        .fn()
        .mockImplementation(
          (invoiceNum: string, userId?: string, guestToken?: string) => {
            if (!userId && !guestToken) {
              throw new UnauthorizedException(
                'You do not have permission to view this invoice',
              );
            }
            return Promise.resolve({ invoiceNumber: invoiceNum });
          },
        ),
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
    it('should reject requests with no valid JWT and no x-guest-token header', async () => {
      const req = { user: undefined } as unknown as RequestWithUser;

      await expect(
        controller.findByInvoiceNumber('INV-2027-0001', req, undefined),
      ).rejects.toThrow(UnauthorizedException);

      expect(service.findByInvoiceNumber).toHaveBeenCalledWith(
        'INV-2027-0001',
        undefined,
        undefined,
      );
    });

    it('should allow requests with a valid x-guest-token header', async () => {
      const req = { user: undefined } as unknown as RequestWithUser;
      const guestToken = 'test-guest-token';

      const result = await controller.findByInvoiceNumber(
        'INV-2027-0001',
        req,
        guestToken,
      );

      expect(result).toBeDefined();
      expect(service.findByInvoiceNumber).toHaveBeenCalledWith(
        'INV-2027-0001',
        undefined,
        'test-guest-token',
      );
    });

    it('should allow requests with a valid JWT (userId)', async () => {
      const req = { user: { id: 'user-1' } } as unknown as RequestWithUser;

      const result = await controller.findByInvoiceNumber(
        'INV-2027-0001',
        req,
        undefined,
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
