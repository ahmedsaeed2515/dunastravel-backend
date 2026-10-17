import { Test, TestingModule } from '@nestjs/testing';
import { AdminTemplatesService } from './admin-templates.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { EmailDeliveryService } from '../../notifications/services/email-delivery.service';
import { BroadcastAudience } from '../dto/email-template-broadcast.dto';

describe('AdminTemplatesService', () => {
  let service: AdminTemplatesService;
  let mockPrisma: any;
  let mockCache: any;
  let mockEmailDelivery: any;

  beforeEach(async () => {
    mockPrisma = {
      emailTemplate: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'tpl-1',
            name: 'user_verification',
            subject: 'Verify Account',
            bodyHtml:
              '<h1>Welcome</h1><!-- DUNAS_BUILDER_CONFIG: {"presetId":"obsidian_gold"} -->',
            variables: ['name', 'otpCode'],
          },
        ]),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          { email: 'user1@dunas.com', name: 'User One' },
          { email: 'user2@dunas.com', name: 'User Two' },
        ]),
      },
    };

    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    mockEmailDelivery = {
      deliver: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminTemplatesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CACHE_MANAGER, useValue: mockCache },
        { provide: EmailDeliveryService, useValue: mockEmailDelivery },
      ],
    }).compile();

    service = module.get<AdminTemplatesService>(AdminTemplatesService);
  });

  it('should return 4 luxury presets', () => {
    const presets = service.getPresets();
    expect(presets).toHaveLength(4);
    expect(presets.map((p) => p.id)).toEqual(
      expect.arrayContaining([
        'obsidian_gold',
        'royal_sapphire',
        'desert_amber',
        'minimalist_pearl',
      ]),
    );
  });

  it('should list templates and extract designConfig', async () => {
    const templates = await service.listTemplates();
    expect(templates).toHaveLength(1);
    expect(templates[0].designConfig).toEqual({ presetId: 'obsidian_gold' });
  });

  it('should send test email with variable replacement', async () => {
    const result = await service.sendTestEmail(
      {
        recipientEmail: 'admin@dunastravel.com',
        subject: 'Test {{name}}',
        bodyHtml: '<p>Code: {{otpCode}}</p>',
      },
      'admin-123',
    );

    expect(result.success).toBe(true);
    expect(mockEmailDelivery.deliver).toHaveBeenCalled();
  });

  it('should broadcast campaign to verified customers', async () => {
    const result = await service.broadcastCampaign(
      {
        subject: 'Special Summer Offer',
        bodyHtml: '<p>Hello {{name}}, book now!</p>',
        recipientGroup: BroadcastAudience.VERIFIED_CUSTOMERS,
      },
      'admin-123',
    );

    expect(result.success).toBe(true);
    expect(result.totalRecipients).toBe(2);
    expect(result.sentCount).toBe(2);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
      where: { status: 'ACTIVE', isVerified: true, deletedAt: null },
      select: { email: true, name: true },
    });
  });
});
