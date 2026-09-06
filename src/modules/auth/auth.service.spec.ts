import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '@prisma/client';
import { AuthService } from './auth.service';
import { UserService, SafeUser } from '../users/users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { LoginSecurityStateService } from '../../common/security/login-security-state.service';
import { createHash } from 'node:crypto';

const mockCompare = jest.fn();
const mockHash = jest.fn();

jest.mock('bcryptjs', () => {
  return {
    __esModule: true,
    get hash() {
      return mockHash;
    },
    get compare() {
      return mockCompare;
    },
    default: {
      get hash() {
        return mockHash;
      },
      get compare() {
        return mockCompare;
      },
    },
  };
});

describe('AuthService', () => {
  jest.setTimeout(30000);
  let authService: AuthService;
  let userService: jest.Mocked<UserService>;
  let notificationsService: {
    sendPasswordResetEmail: jest.Mock;
    sendVerificationEmail: jest.Mock;
  };
  let settingsService: { getSetting: jest.Mock };
  let jwtService: jest.Mocked<JwtService> = undefined as any;
  let prisma: {
    user: {
      findFirst: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      create: jest.Mock;
    };
    auditLog: {
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const mockUser = {
    id: 'user-id',
    name: 'Test User',
    email: 'test@test.com',
    phone: '1234567890',
    role: UserRole.USER,
    passwordHash: 'hashed-password',
    refreshToken: createHash('sha256')
      .update('valid-refresh-token')
      .digest('hex'),
    sessionVersion: 1,
    isVerified: true,
    verifyToken: null,
    resetToken: null,
    resetTokenExp: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    customerNumber: null,
    status: 'ACTIVE',
    passportNumber: null,
    dateOfBirth: null,
    nationality: null,
    gender: null,
    emergencyContact: null,
    address: null,
    city: null,
    country: null,
    postalCode: null,
    preferredLanguage: 'en',
    preferredCurrency: 'USD',
    preferredDestination: null,
    preferredTravelType: null,
    familyMembers: null,
    travelCompanions: null,
    specialRequests: null,
    dietaryRestrictions: null,
    medicalConditions: null,
    loyaltyPoints: 0,
    tags: [],
    segments: [],
    isVip: false,
    customerSource: null,
    referralSource: null,
    suspendedAt: null,
    suspendReason: null,
    marketingConsent: true,
    phoneVerified: false,
    futureCompanyId: null,
    futureWalletId: null,
    futureCommissionPlan: null,
  } as unknown as User;

  const safeUser = {
    id: 'user-id',
    name: 'Test User',
    email: 'test@test.com',
    phone: '1234567890',
    role: UserRole.USER,
    sessionVersion: 1,
    isVerified: true,
    customerNumber: null,
    status: 'ACTIVE',
    passportNumber: null,
    dateOfBirth: null,
    nationality: null,
    gender: null,
    emergencyContact: null,
    address: null,
    city: null,
    country: null,
    postalCode: null,
    preferredLanguage: 'en',
    preferredCurrency: 'USD',
    preferredDestination: null,
    preferredTravelType: null,
    familyMembers: null,
    travelCompanions: null,
    specialRequests: null,
    dietaryRestrictions: null,
    medicalConditions: null,
    loyaltyPoints: 0,
    tags: [],
    segments: [],
    isVip: false,
    customerSource: null,
    referralSource: null,
    suspendedAt: null,
    suspendReason: null,
    marketingConsent: true,
    phoneVerified: false,
    futureCompanyId: null,
    futureWalletId: null,
    futureCommissionPlan: null,
    createdAt: mockUser.createdAt,
    updatedAt: mockUser.updatedAt,
  } as unknown as SafeUser;

  beforeEach(async () => {
    notificationsService = {
      sendPasswordResetEmail: jest.fn(),
      sendVerificationEmail: jest.fn(),
    };
    settingsService = {
      getSetting: jest.fn().mockResolvedValue(true),
    };
    const transactionUser = {
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue(mockUser),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue(mockUser),
    };
    const transactionAuditLog = {
      create: jest.fn().mockResolvedValue({}),
    };
    prisma = {
      user: transactionUser,
      auditLog: transactionAuditLog,
      $transaction: jest.fn(async (callback) =>
        callback({
          user: transactionUser,
          auditLog: transactionAuditLog,
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: {
            findByEmail: jest.fn(),
            findById: jest.fn(),
            hasActiveCompanyMembership: jest.fn().mockResolvedValue(true),
            create: jest.fn(),
            toSafeUser: jest.fn().mockReturnValue(safeUser),
            updateRefreshToken: jest.fn(),
            revokeSessions: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockReturnValue('mock-secret-key-at-least-32-chars-long'),
          },
        },
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: LoginSecurityStateService,
          useValue: {
            isLocked: jest.fn().mockResolvedValue(false),
            recordFailure: jest.fn().mockResolvedValue(undefined),
            clearFailures: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: NotificationsService,
          useValue: notificationsService,
        },
        {
          provide: SettingsService,
          useValue: settingsService,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    userService = module.get(UserService);
    jwtService = module.get(JwtService);

    userService.findByEmail.mockResolvedValue(mockUser);
    userService.findById.mockResolvedValue(mockUser);
    userService.hasActiveCompanyMembership.mockResolvedValue(true);
    userService.toSafeUser.mockReturnValue(safeUser);

    mockHash.mockImplementation(() => Promise.resolve('hashed-password'));
    mockCompare.mockImplementation(() => Promise.resolve(true));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── Register ─────────────────────────────────────────────────────────────

  describe('register', () => {
    const registerDto = {
      name: 'Test User',
      email: 'test@test.com',
      password: 'M0on!River#482',
    };

    it('should successfully register a new user', async () => {
      userService.findByEmail.mockResolvedValueOnce(null);
      (bcrypt.hash as jest.Mock).mockResolvedValueOnce('hashed-password');
      userService.create.mockResolvedValueOnce(mockUser);

      const result = await authService.register(registerDto);

      expect(result).toEqual(safeUser);
      expect(prisma.user.create).toHaveBeenCalledTimes(1);
    });

    it('should create an unverified new user and send verification email', async () => {
      userService.findByEmail.mockResolvedValueOnce(null);
      (bcrypt.hash as jest.Mock).mockResolvedValueOnce('hashed-password');

      await authService.register(registerDto);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isVerified: false,
          verifyToken: expect.any(String),
          verifyTokenExp: expect.any(Date),
        }),
      });
      expect(notificationsService.sendVerificationEmail).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException if email is already in use', async () => {
      userService.findByEmail.mockResolvedValue(mockUser);

      await expect(authService.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ─── Login ────────────────────────────────────────────────────────────────

  describe('login', () => {
    const loginDto = {
      email: 'test@test.com',
      password: 'M0on!River#482',
    };

    it('should successfully authenticate user with correct credentials', async () => {
      mockCompare.mockResolvedValue(true);
      userService.hasActiveCompanyMembership.mockResolvedValue(true);
      userService.findByEmail.mockResolvedValue({
        ...mockUser,
        isVerified: true,
        status: 'ACTIVE',
        suspendedAt: null,
      });

      const result = await authService.login(loginDto, '127.0.0.1');

      expect(result).toEqual(safeUser);
    });

    it('should throw UnauthorizedException for non-existent email', async () => {
      userService.findByEmail.mockResolvedValue(null);

      await expect(authService.login(loginDto, '127.0.0.1')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      mockCompare.mockResolvedValueOnce(false);
      userService.findByEmail.mockResolvedValue(mockUser);

      await expect(
        authService.login(
          { ...loginDto, password: 'invalid-password' },
          '127.0.0.1',
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── Token Generation & Refresh ──────────────────────────────────────────

  describe('generateToken', () => {
    it('should return a signed JWT token with payload', () => {
      jwtService.sign.mockReturnValue('mock-jwt-token');

      const token = authService.generateToken(safeUser);

      expect(token).toBe('mock-jwt-token');
      expect(jwtService.sign.mock.calls.length).toBe(1);
    });
  });

  describe('refresh', () => {
    it('should return new access and refresh tokens for valid refresh token', async () => {
      jwtService.verify.mockReturnValue({
        sub: mockUser.id,
        sv: 1,
        type: 'refresh',
      });
      userService.findById.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue('new-token');

      const result = await authService.refresh('valid-refresh-token');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user).toEqual(safeUser);
    });

    it('should throw UnauthorizedException for tampered refresh token', async () => {
      jwtService.verify.mockReturnValue({
        sub: mockUser.id,
        sv: 1,
        type: 'refresh',
      });
      userService.findById.mockResolvedValue(mockUser);

      await expect(authService.refresh('tampered-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ─── Forgot & Reset Password ─────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('should generate reset token and send email if user exists', async () => {
      userService.findByEmail.mockResolvedValue(mockUser);

      const result = await authService.forgotPassword({
        email: 'test@test.com',
      });

      expect(result.message).toBe(
        'If that email exists, a password reset link has been sent.',
      );
      expect(prisma.user.update).toHaveBeenCalledTimes(1);
    });

    it('should return generic message even if user does not exist', async () => {
      userService.findByEmail.mockResolvedValue(null);

      const result = await authService.forgotPassword({
        email: 'missing@test.com',
      });

      expect(result.message).toBe(
        'If that email exists, a password reset link has been sent.',
      );
    });
  });

  describe('resetPassword', () => {
    const resetDto = {
      token: 'valid-reset-token',
      newPassword: 'Cedar!Orbit#739',
    };

    it('should successfully reset password with valid token', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);

      const result = await authService.resetPassword(resetDto);

      expect(result.message).toBe('Password has been reset successfully');
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: {
          id: mockUser.id,
          resetToken: expect.any(String),
          resetTokenExp: { gt: expect.any(Date) },
          deletedAt: null,
        },
        data: {
          passwordHash: expect.any(String),
          resetToken: null,
          resetTokenExp: null,
          refreshToken: null,
          sessionVersion: { increment: 1 },
        },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: mockUser.id,
          action: 'PASSWORD_RESET_COMPLETED',
          entityId: mockUser.id,
        }),
      });
    });

    it('should throw BadRequestException if token is invalid or expired', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(authService.resetPassword(resetDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── Logout & GetMe ───────────────────────────────────────────────────────

  describe('logout', () => {
    it('should revoke all active sessions', async () => {
      await authService.clearRefreshToken(mockUser.id);

      expect(userService.revokeSessions).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('getMe', () => {
    it('should return safe user if found', async () => {
      userService.findById.mockResolvedValue(mockUser);
      const result = await authService.getMe(mockUser.id);
      expect(result).toEqual(safeUser);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      userService.findById.mockResolvedValue(null);
      await expect(authService.getMe('missing-id')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
