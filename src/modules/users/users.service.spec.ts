import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

describe('UserService - Create Admin User', () => {
  let service: UserService;
  let prisma: {
    user: {
      findFirst: jest.Mock;
      create: jest.Mock;
      count: jest.Mock;
    };
    customerActivityLog: {
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const mockUser: Partial<User> = {
    id: 'user-uuid-123',
    name: 'Admin Test User',
    email: 'admin-created@example.com',
    phone: '+12345678900',
    passwordHash: '$2b$12$eImiTXuWVxfM37uY4JANjO5yYq6J76d.1.g3bJ3.', // Mock bcrypt hash
    role: UserRole.ADMIN,
    isVerified: true,
    customerNumber: 'CUST-2026-0001',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue(mockUser),
        count: jest.fn().mockResolvedValue(0),
      },
      customerActivityLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
      },
      $transaction: jest.fn((callback: (p: typeof prisma) => unknown) =>
        callback(prisma),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UserService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should create user atomically in a transaction with isVerified: true', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    const passwordHash = await bcrypt.hash('SecurePassword123!', 12);

    const user = await service.create({
      name: 'Admin Test User',
      email: 'admin-created@example.com',
      phone: '+12345678900',
      role: UserRole.ADMIN,
      passwordHash,
      isVerified: true,
    });

    expect(user).toBeDefined();
    expect(user.role).toBe(UserRole.ADMIN);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Admin Test User',
        email: 'admin-created@example.com',
        role: UserRole.ADMIN,
        isVerified: true,
      }) as Record<string, unknown>,
    });
  });

  it('should strip sensitive fields in toSafeUser', () => {
    const safeUser = service.toSafeUser(mockUser as unknown as User);
    expect(safeUser).not.toHaveProperty('passwordHash');
    expect(safeUser).not.toHaveProperty('refreshToken');
    expect(safeUser).not.toHaveProperty('resetToken');
    expect(safeUser.email).toBe('admin-created@example.com');
  });
});
