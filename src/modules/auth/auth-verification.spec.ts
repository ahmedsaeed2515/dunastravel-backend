import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User, UserRole } from '@prisma/client';
import { AuthService } from './auth.service';
import { UserService } from '../users/users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { LoginSecurityStateService } from '../../common/security/login-security-state.service';

jest.mock('bcryptjs', () => ({
  __esModule: true,
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
  default: {
    hash: jest.fn().mockResolvedValue('hashed-password'),
    compare: jest.fn().mockResolvedValue(true),
  },
}));

describe('AuthService - Email Verification & Hardening', () => {
  let authService: AuthService;
  let userService: {
    findByEmail: jest.Mock;
    findById: jest.Mock;
    hasActiveCompanyMembership: jest.Mock;
    toSafeUser: jest.Mock;
  };
  let notificationsService: {
    sendVerificationEmail: jest.Mock;
    sendPasswordResetEmail: jest.Mock;
  };
  let prisma: {
    user: {
      findFirst: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      create: jest.Mock;
    };
  };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    userService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      hasActiveCompanyMembership: jest.fn().mockResolvedValue(true),
      toSafeUser: jest.fn((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        isVerified: user.isVerified,
        emailVerifiedAt: user.emailVerifiedAt,
      })),
    };

    notificationsService = {
      sendVerificationEmail: jest.fn().mockResolvedValue(true),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
    };

    prisma = {
      user: {
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
    };

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'nodeEnv') return 'test';
        if (key === 'auth.requireEmailVerification') return true;
        if (key === 'jwt.secret') return 'jwt-secret-at-least-32-chars-long';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: userService },
        { provide: JwtService, useValue: { sign: jest.fn() } },
        { provide: ConfigService, useValue: configService },
        { provide: PrismaService, useValue: prisma },
        {
          provide: LoginSecurityStateService,
          useValue: {
            isLocked: jest.fn().mockResolvedValue(false),
            recordFailure: jest.fn().mockResolvedValue(undefined),
            clearFailures: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: SettingsService, useValue: { getSetting: jest.fn().mockResolvedValue(true) } },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe('Registration with Verification Enforcement', () => {
    it('should generate a 6-digit OTP, store SHA-256 hash, set 10m expiry, and dispatch verification email', async () => {
      userService.findByEmail.mockResolvedValueOnce(null);
      prisma.user.create.mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'new-user-id',
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );

      const result = await authService.register({
        name: 'Jane Traveler',
        email: 'jane@example.com',
        password: 'Atlas#Cairo!9348',
      });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'jane@example.com',
          isVerified: false,
          verifyAttempts: 0,
          verifySentAt: expect.any(Date),
          verifyToken: expect.stringMatching(/^[a-f0-9]{64}$/),
          verifyTokenExp: expect.any(Date),
        }),
      });

      expect(notificationsService.sendVerificationEmail).toHaveBeenCalledWith(
        'jane@example.com',
        'Jane Traveler',
        expect.stringMatching(/^\d{6}$/),
      );
      expect(result.isVerified).toBe(false);
    });
  });

  describe('Email Verification (OTP Consumption)', () => {
    const validOtp = '654321';
    const validHash = crypto.createHash('sha256').update(validOtp).digest('hex');

    it('should atomically verify user and record emailVerifiedAt with valid OTP', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'user@example.com',
        isVerified: false,
        verifyToken: validHash,
        verifyTokenExp: new Date(Date.now() + 5 * 60 * 1000), // valid
        verifyAttempts: 0,
      };

      prisma.user.findFirst.mockResolvedValueOnce(mockUser);
      prisma.user.updateMany.mockResolvedValueOnce({ count: 1 });

      const response = await authService.verifyEmail({
        email: 'user@example.com',
        code: validOtp,
      });

      expect(response.message).toBe('Email verified successfully');
      expect(response.user).toBeDefined();
      expect(response.user?.isVerified).toBe(true);
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'user-1',
          verifyToken: validHash,
          isVerified: false,
        },
        data: expect.objectContaining({
          isVerified: true,
          emailVerifiedAt: expect.any(Date),
          verifyToken: null,
          verifyTokenExp: null,
          verifyAttempts: 0,
        }),
      });
    });

    it('should increment verifyAttempts upon incorrect OTP', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'user@example.com',
        isVerified: false,
        verifyToken: validHash,
        verifyTokenExp: new Date(Date.now() + 5 * 60 * 1000),
        verifyAttempts: 2,
      };

      prisma.user.findFirst.mockResolvedValueOnce(mockUser);
      prisma.user.update.mockResolvedValueOnce({});

      await expect(
        authService.verifyEmail({
          email: 'user@example.com',
          code: '000000', // wrong OTP
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          verifyAttempts: { increment: 1 },
        }),
      });
    });

    it('should lock out and invalidate token after 5 failed attempts (brute-force defense)', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'user@example.com',
        isVerified: false,
        verifyToken: validHash,
        verifyTokenExp: new Date(Date.now() + 5 * 60 * 1000),
        verifyAttempts: 4, // 4 prior failures; next will be 5th
      };

      prisma.user.findFirst.mockResolvedValueOnce(mockUser);
      prisma.user.update.mockResolvedValueOnce({});

      await expect(
        authService.verifyEmail({
          email: 'user@example.com',
          code: '000000',
        }),
      ).rejects.toThrow(/Too many failed verification attempts/);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          verifyToken: null,
          verifyTokenExp: null,
        }),
      });
    });

    it('should reject expired verification codes', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'user@example.com',
        isVerified: false,
        verifyToken: validHash,
        verifyTokenExp: new Date(Date.now() - 60 * 1000), // expired 1m ago
        verifyAttempts: 0,
      };

      prisma.user.findFirst.mockResolvedValueOnce(mockUser);

      await expect(
        authService.verifyEmail({
          email: 'user@example.com',
          code: validOtp,
        }),
      ).rejects.toThrow(/expired/);
    });
  });

  describe('Resend Verification Cooldown & Anti-Abuse', () => {
    it('should block resend requests within 60 seconds with a cooldown error', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'user@example.com',
        isVerified: false,
        verifySentAt: new Date(Date.now() - 25 * 1000), // sent 25 seconds ago
      };

      prisma.user.findFirst.mockResolvedValueOnce(mockUser);

      await expect(
        authService.resendVerification({ email: 'user@example.com' }),
      ).rejects.toThrow(/Please wait 35 seconds before requesting another verification code/);
    });

    it('should allow resend after 60-second cooldown, resetting attempts to 0', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'user@example.com',
        name: 'Jane Traveler',
        isVerified: false,
        verifySentAt: new Date(Date.now() - 65 * 1000), // sent 65 seconds ago
        verifyAttempts: 4,
      };

      prisma.user.findFirst.mockResolvedValueOnce(mockUser);
      prisma.user.update.mockResolvedValueOnce({});

      const response = await authService.resendVerification({ email: 'user@example.com' });

      expect(response.message).toContain('verification code has been sent');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          verifyAttempts: 0,
          verifySentAt: expect.any(Date),
          verifyToken: expect.stringMatching(/^[a-f0-9]{64}$/),
          verifyTokenExp: expect.any(Date),
        }),
      });
      expect(notificationsService.sendVerificationEmail).toHaveBeenCalledWith(
        'user@example.com',
        'Jane Traveler',
        expect.stringMatching(/^\d{6}$/),
      );
    });
  });

  describe('Login Protection for Unverified Users', () => {
    it('should throw UnauthorizedException when login attempted by unverified user and verification is required', async () => {
      const unverifiedUser = {
        id: 'user-1',
        email: 'unverified@example.com',
        passwordHash: 'hashed-password',
        isVerified: false,
        status: 'ACTIVE',
        suspendedAt: null,
      };

      userService.findByEmail.mockResolvedValueOnce(unverifiedUser);

      await expect(
        authService.login(
          { email: 'unverified@example.com', password: 'Atlas#Cairo!9348' },
          '127.0.0.1',
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
