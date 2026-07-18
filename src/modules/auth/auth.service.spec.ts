import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UserService } from '../users/users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
jest.mock('bcrypt');

describe('AuthService', () => {
  let authService: AuthService;
  let userService: jest.Mocked<UserService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let prisma: jest.Mocked<PrismaService>;
  let notificationsService: jest.Mocked<NotificationsService>;

  const mockUser = {
    id: 'user-id',
    name: 'Test User',
    email: 'test@test.com',
    phone: '1234567890',
    role: 'USER' as const,
    passwordHash: 'hashed-password',
    refreshToken: 'hashed-refresh-token',
    isVerified: true,
    verifyToken: null,
    resetToken: null,
    resetTokenExp: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  } as any;

  const safeUser = {
    id: mockUser.id,
    name: mockUser.name,
    email: mockUser.email,
    phone: mockUser.phone,
    role: mockUser.role,
    createdAt: mockUser.createdAt,
    updatedAt: mockUser.updatedAt,
  };

  beforeEach(async () => {
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
            create: jest.fn(),
            updateRefreshToken: jest.fn(),
            toSafeUser: jest.fn().mockReturnValue(safeUser),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('mock-secret'),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              create: jest.fn().mockResolvedValue(mockUser),
              findFirst: jest.fn().mockResolvedValue(mockUser),
              update: jest.fn().mockResolvedValue(mockUser),
            },
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
            sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    userService = module.get(UserService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
    prisma = module.get(PrismaService);
    notificationsService = module.get(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── Register ─────────────────────────────────────────────────────────────

  describe('register', () => {
    const registerDto = {
      name: 'Test User',
      email: 'test@test.com',
      password: 'Password123!',
      phone: '1234567890',
    };

    it('should successfully register a new user', async () => {
      userService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const result = await authService.register(registerDto);

      expect(result).toEqual(safeUser);
      expect(userService.findByEmail).toHaveBeenCalledWith(registerDto.email);
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 12);
      expect(prisma.user.create).toHaveBeenCalled();
      expect(notificationsService.sendVerificationEmail).toHaveBeenCalledTimes(
        1,
      );
    });

    it('should throw ConflictException if email is already in use', async () => {
      userService.findByEmail.mockResolvedValue(mockUser);

      await expect(authService.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ─── Verify Email ─────────────────────────────────────────────────────────

  describe('verifyEmail', () => {
    it('should successfully verify email with valid token', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.verifyEmail({ token: 'valid-token' });

      expect(result.message).toBe('Email verified successfully');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { isVerified: true, verifyToken: null },
      });
    });

    it('should throw BadRequestException for invalid token', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        authService.verifyEmail({ token: 'invalid-token' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── Login ────────────────────────────────────────────────────────────────

  describe('login', () => {
    const loginDto = {
      email: 'test@test.com',
      password: 'Password123!',
    };

    it('should return safe user on successful login', async () => {
      userService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.login(loginDto, '127.0.0.1');

      expect(result).toEqual(safeUser);
      expect(userService.findByEmail).toHaveBeenCalledWith(loginDto.email);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.passwordHash,
      );
    });

    it('should throw UnauthorizedException if user is not verified', async () => {
      userService.findByEmail.mockResolvedValue({
        ...mockUser,
        isVerified: false,
      });

      await expect(authService.login(loginDto, '127.0.0.1')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if password is wrong', async () => {
      userService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.login(loginDto, '127.0.0.1')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user does not exist', async () => {
      userService.findByEmail.mockResolvedValue(null);

      await expect(authService.login(loginDto, '127.0.0.1')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ─── Forgot / Reset Password ──────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('should generate reset token and return generic message if user exists', async () => {
      userService.findByEmail.mockResolvedValue(mockUser);

      const result = await authService.forgotPassword({
        email: 'test@test.com',
      });

      expect(result.message).toBe(
        'If that email exists, a password reset link has been sent.',
      );
      expect(prisma.user.update).toHaveBeenCalled();
      expect(notificationsService.sendPasswordResetEmail).toHaveBeenCalledTimes(
        1,
      );
    });

    it('should return generic message even if user does not exist (prevent enumeration)', async () => {
      userService.findByEmail.mockResolvedValue(null);

      const result = await authService.forgotPassword({
        email: 'missing@test.com',
      });

      expect(result.message).toBe(
        'If that email exists, a password reset link has been sent.',
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    const resetDto = {
      token: 'valid-reset-token',
      newPassword: 'NewPassword123!',
    };

    it('should successfully reset password with valid token', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');

      const result = await authService.resetPassword(resetDto);

      expect(result.message).toBe('Password has been reset successfully');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          passwordHash: 'new-hashed-password',
          resetToken: null,
          resetTokenExp: null,
        },
      });
    });

    it('should throw BadRequestException if token is invalid or expired', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(authService.resetPassword(resetDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── Refresh Token Flow ───────────────────────────────────────────────────

  describe('refresh token flow', () => {
    it('should return new access and refresh tokens for valid refresh token', async () => {
      jwtService.verify.mockReturnValue({ sub: mockUser.id });
      userService.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-refresh-token');

      const result = await authService.refresh('valid-refresh-token');

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.refreshToken).toBe('mock-jwt-token');
      expect(result.user).toEqual(safeUser);
    });

    it('should throw UnauthorizedException for expired refresh token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(authService.refresh('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for tampered refresh token', async () => {
      jwtService.verify.mockReturnValue({ sub: mockUser.id });
      userService.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.refresh('tampered-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ─── Logout & GetMe ───────────────────────────────────────────────────────

  describe('logout', () => {
    it('should clear refresh token from DB', async () => {
      await authService.clearRefreshToken(mockUser.id);

      expect(userService.updateRefreshToken).toHaveBeenCalledWith(
        mockUser.id,
        null,
      );
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
