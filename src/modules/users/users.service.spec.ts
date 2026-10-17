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

  it('should suspend user, increment sessionVersion, and write audit logs', async () => {
    prisma.user.findFirst.mockResolvedValue(mockUser);
    (prisma as any).user.update = jest.fn().mockResolvedValue({
      ...mockUser,
      status: 'SUSPENDED',
      suspendReason: 'Suspicious login pattern',
    });
    (prisma as any).auditLog = {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    const result = await service.suspendUser(
      'user-uuid-123',
      'Suspicious login pattern',
      'admin-actor-1',
      'ADMIN',
      '127.0.0.1',
    );

    expect(result.status).toBe('SUSPENDED');
    expect((prisma as any).user.update).toHaveBeenCalledWith({
      where: { id: 'user-uuid-123' },
      data: expect.objectContaining({
        status: 'SUSPENDED',
        suspendReason: 'Suspicious login pattern',
        sessionVersion: { increment: 1 },
      }),
    });
    expect((prisma as any).auditLog.create).toHaveBeenCalled();
  });

  it('should reactivate suspended user and clear suspendReason', async () => {
    prisma.user.findFirst.mockResolvedValue({
      ...mockUser,
      status: 'SUSPENDED',
    });
    (prisma as any).user.update = jest.fn().mockResolvedValue({
      ...mockUser,
      status: 'ACTIVE',
      suspendReason: null,
    });
    (prisma as any).auditLog = {
      create: jest.fn().mockResolvedValue({ id: 'audit-2' }),
    };

    const result = await service.activateUser(
      'user-uuid-123',
      'admin-actor-1',
      'ADMIN',
      '127.0.0.1',
    );

    expect(result.status).toBe('ACTIVE');
    expect((prisma as any).user.update).toHaveBeenCalledWith({
      where: { id: 'user-uuid-123' },
      data: expect.objectContaining({
        status: 'ACTIVE',
        suspendedAt: null,
        suspendReason: null,
      }),
    });
  });

  it('should revoke user sessions by incrementing sessionVersion', async () => {
    prisma.user.findFirst.mockResolvedValue(mockUser);
    (prisma as any).user.update = jest.fn().mockResolvedValue({
      ...mockUser,
      sessionVersion: 2,
    });
    (prisma as any).auditLog = {
      create: jest.fn().mockResolvedValue({ id: 'audit-3' }),
    };

    const result = await service.revokeSessionsAdmin(
      'user-uuid-123',
      'admin-actor-1',
      '127.0.0.1',
    );

    expect(result.success).toBe(true);
    expect((prisma as any).user.update).toHaveBeenCalledWith({
      where: { id: 'user-uuid-123' },
      data: expect.objectContaining({
        sessionVersion: { increment: 1 },
        refreshToken: null,
      }),
    });
  });

  describe('Role Escalation & Hardening Guards', () => {
    it('should throw ForbiddenException if an ADMIN tries to grant SUPER_ADMIN role', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(
        service.update(
          'user-uuid-123',
          { role: UserRole.SUPER_ADMIN },
          UserRole.ADMIN,
        ),
      ).rejects.toThrow('Only SUPER_ADMIN can grant the SUPER_ADMIN role');
    });

    it('should throw ForbiddenException if an ADMIN tries to modify a SUPER_ADMIN account', async () => {
      prisma.user.findFirst.mockResolvedValue({
        ...mockUser,
        role: UserRole.SUPER_ADMIN,
      });

      await expect(
        service.update(
          'user-uuid-123',
          { name: 'Hacked Name' },
          UserRole.ADMIN,
        ),
      ).rejects.toThrow(
        'Only SUPER_ADMIN can modify another SUPER_ADMIN account',
      );
    });

    it('should throw BadRequestException if attempting to demote the last SUPER_ADMIN', async () => {
      prisma.user.findFirst.mockResolvedValue({
        ...mockUser,
        role: UserRole.SUPER_ADMIN,
      });
      prisma.user.count.mockResolvedValue(0);

      await expect(
        service.update(
          'user-uuid-123',
          { role: UserRole.ADMIN },
          UserRole.SUPER_ADMIN,
        ),
      ).rejects.toThrow(
        'Cannot demote the last SUPER_ADMIN. Promote another user first.',
      );
    });

    it('should invalidate session and refreshToken when role changes', async () => {
      prisma.user.findFirst.mockResolvedValue({
        ...mockUser,
        role: UserRole.USER,
      });
      (prisma as any).user.update = jest.fn().mockResolvedValue({
        ...mockUser,
        role: UserRole.AGENT,
      });

      await service.update(
        'user-uuid-123',
        { role: UserRole.AGENT },
        UserRole.SUPER_ADMIN,
      );

      expect((prisma as any).user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-123' },
        data: expect.objectContaining({
          role: UserRole.AGENT,
          refreshToken: null,
          sessionVersion: { increment: 1 },
        }),
      });
    });

    it('should throw ForbiddenException if attempting to softDelete a SUPER_ADMIN account', async () => {
      prisma.user.findFirst.mockResolvedValue({
        ...mockUser,
        role: UserRole.SUPER_ADMIN,
      });

      await expect(service.softDelete('user-uuid-123')).rejects.toThrow(
        'SUPER_ADMIN accounts cannot be deleted. Demote the user first.',
      );
    });
  });
});
