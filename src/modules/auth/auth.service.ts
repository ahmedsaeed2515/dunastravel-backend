import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
  ServiceUnavailableException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { CookieOptions } from 'express';
import {
  UserService,
  SafeUser,
  SessionUser,
} from '../users/users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  ChangePasswordDto,
  ResendVerificationDto,
} from './dto';
import { SettingsService } from '../settings/settings.service';
import { LoginSecurityStateService } from '../../common/security/login-security-state.service';
import { JwtPayload } from '../../common/types';
import { assertStrongPassword } from '../../common/utils/password-policy.util';
import { sanitizePlainText } from '../../common/utils/content-sanitizer.util';

const isSecureEnvironment = (nodeEnv: string) =>
  nodeEnv === 'production' || nodeEnv === 'staging';

export const getCookieOptions = (nodeEnv: string): CookieOptions => ({
  httpOnly: true,
  secure: isSecureEnvironment(nodeEnv),
  sameSite: isSecureEnvironment(nodeEnv) ? 'none' : 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days for access token
});

export const getRefreshCookieOptions = (nodeEnv: string): CookieOptions => ({
  httpOnly: true,
  secure: isSecureEnvironment(nodeEnv),
  sameSite: isSecureEnvironment(nodeEnv) ? 'none' : 'lax',
  path: '/',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
});

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly dummyPasswordHash = bcrypt.hash(
    crypto.randomBytes(32).toString('hex'),
    12,
  );
  private readonly rotatedTokensGraceCache = new Map<
    string,
    {
      user: SafeUser;
      accessToken: string;
      refreshToken: string;
      expiresAt: number;
    }
  >();

  constructor(
    @Inject(UserService) private readonly userService: UserService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LoginSecurityStateService) private readonly loginSecurityState: LoginSecurityStateService,
    @Inject(NotificationsService) private readonly notificationsService: NotificationsService,
    @Inject(SettingsService) private readonly settingsService: SettingsService,
  ) {}

  private shouldRequireEmailVerification(): boolean {
    const rawVal = this.configService.get<boolean | string>(
      'auth.requireEmailVerification',
    );
    if (rawVal === true || rawVal === 'true') return true;
    if (rawVal === false || rawVal === 'false') return false;
    return true; // Default to true: real email verification is required
  }

  async register(dto: RegisterDto): Promise<SafeUser> {
    assertStrongPassword(dto.password);
    const existingUser = await this.userService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const requireEmailVerification = this.shouldRequireEmailVerification();

    const otpCode = requireEmailVerification
      ? crypto.randomInt(100000, 1000000).toString()
      : null;
    const verifyTokenHash = otpCode
      ? crypto.createHash('sha256').update(otpCode).digest('hex')
      : null;
    const verifyTokenExp = otpCode
      ? new Date(Date.now() + 15 * 60 * 1000) // 15 minutes validity
      : null;
    const verifySentAt = otpCode ? new Date() : null;

    const user = await this.prisma.user.create({
      data: {
        name: sanitizePlainText(dto.name).slice(0, 255),
        email: dto.email.trim().toLowerCase(),
        phone: dto.phone?.trim(),
        passwordHash,
        isVerified: !requireEmailVerification,
        verifyToken: verifyTokenHash,
        verifyTokenExp,
        verifyAttempts: 0,
        verifySentAt,
      },
    });

    this.logger.log(`User registered: userId=${user.id}, email=${user.email}`);
    if (otpCode) {
      this.logger.log(
        `Dispatched initial verification OTP for userId=${user.id}`,
      );
      try {
        await this.notificationsService.sendVerificationEmail(
          user.email,
          user.name,
          otpCode,
        );
      } catch (error: any) {
        this.logger.error(
          `Could not send verification email to ${user.email}: ${error?.message || error}. User account remains created with isVerified=false.`,
        );
      }
    }

    return this.userService.toSafeUser(user);
  }

  async verifyEmail(
    dto: VerifyEmailDto,
  ): Promise<{ message: string; user?: SafeUser }> {
    const rawCodeOrToken = (dto.code || dto.token)?.trim();
    if (!rawCodeOrToken) {
      throw new BadRequestException('Verification code or token is required');
    }

    const tokenHash = crypto
      .createHash('sha256')
      .update(rawCodeOrToken)
      .digest('hex');

    let user = null;
    if (dto.email?.trim()) {
      user = await this.prisma.user.findFirst({
        where: {
          email: dto.email.trim().toLowerCase(),
          deletedAt: null,
        },
      });
    } else {
      user = await this.prisma.user.findFirst({
        where: { verifyToken: tokenHash, deletedAt: null },
      });
    }

    if (!user) {
      throw new BadRequestException('Invalid or incorrect verification code');
    }

    if (user.isVerified) {
      return { message: 'Email is already verified' };
    }

    // Check brute-force attempts: max 5 failed attempts
    if (user.verifyAttempts >= 5) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          verifyToken: null,
          verifyTokenExp: null,
        },
      });
      throw new BadRequestException(
        'Too many failed verification attempts. This code has been invalidated. Please request a new verification code.',
      );
    }

    // Check expiry
    if (!user.verifyTokenExp || user.verifyTokenExp < new Date()) {
      throw new BadRequestException(
        'Verification code has expired. Please request a new code.',
      );
    }

    // Match check
    if (user.verifyToken !== tokenHash) {
      const updatedAttempts = user.verifyAttempts + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          verifyAttempts: { increment: 1 },
          ...(updatedAttempts >= 5
            ? { verifyToken: null, verifyTokenExp: null }
            : {}),
        },
      });

      if (updatedAttempts >= 5) {
        throw new BadRequestException(
          'Too many failed verification attempts. This code has been invalidated. Please request a new verification code.',
        );
      }

      throw new BadRequestException('Invalid or incorrect verification code');
    }

    // Atomic conditional update to verify and clear challenge
    const result = await this.prisma.user.updateMany({
      where: {
        id: user.id,
        verifyToken: tokenHash,
        isVerified: false,
      },
      data: {
        isVerified: true,
        emailVerifiedAt: new Date(),
        verifyToken: null,
        verifyTokenExp: null,
        verifyAttempts: 0,
      },
    });

    if (result.count === 0) {
      throw new BadRequestException(
        'Verification code was already used or invalidated.',
      );
    }

    this.logger.log(`Email successfully verified for userId=${user.id}`);
    const safeUser = this.userService.toSafeUser({
      ...user,
      isVerified: true,
      emailVerifiedAt: new Date(),
    });
    return { message: 'Email verified successfully', user: safeUser };
  }

  async login(dto: LoginDto, ip: string): Promise<SessionUser> {
    const isLocked = await this.loginSecurityState.isLocked(ip, dto.email);
    if (isLocked) {
      throw new UnauthorizedException(
        'Too many failed login attempts. Please try again later.',
      );
    }

    const user = await this.userService.findByEmail(dto.email);
    const passwordHash = user
      ? user.passwordHash
      : await this.dummyPasswordHash;
    const isPasswordValid = await bcrypt.compare(
      dto.password,
      passwordHash,
    );
    if (!user || !isPasswordValid) {
      await this.loginSecurityState.recordFailure(ip, dto.email);
      this.logger.warn('Failed login attempt: unknown account');
      throw new UnauthorizedException('Invalid credentials');
    }

    const requireEmailVerification = this.shouldRequireEmailVerification();

    if (requireEmailVerification && !user.isVerified) {
      throw new UnauthorizedException(
        'EMAIL_NOT_VERIFIED: Please verify your email before logging in',
      );
    }

    if (user.suspendedAt) {
      this.logger.warn(`Failed login attempt: suspended userId=${user.id}`);
      throw new UnauthorizedException(
        'Your account has been suspended. Please contact support.',
      );
    }

    if (
      user.status !== 'ACTIVE' ||
      !(await this.userService.hasActiveCompanyMembership(user))
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Clear failed attempts on success
    await this.loginSecurityState.clearFailures(ip, dto.email);

    this.logger.log(`User logged in: userId=${user.id}`);

    return {
      ...this.userService.toSafeUser(user),
      sessionVersion: user.sessionVersion,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.userService.findByEmail(dto.email);
    if (!user) {
      // Don't reveal that the user does not exist
      return {
        message: 'If that email exists, a password reset link has been sent.',
      };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    const resetTokenExp = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetToken: resetTokenHash, resetTokenExp },
    });

    this.logger.log(`Password reset token generated for userId=${user.id}`);
    try {
      await this.notificationsService.sendPasswordResetEmail(
        user.email,
        user.name,
        resetToken,
      );
    } catch (error: any) {
      this.logger.error(
        `Could not send password reset email to ${user.email}: ${error?.message || error}.`,
      );
    }

    return {
      message: 'If that email exists, a password reset link has been sent.',
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    assertStrongPassword(dto.newPassword);
    const tokenHash = crypto
      .createHash('sha256')
      .update(dto.token)
      .digest('hex');
    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: tokenHash,
        resetTokenExp: { gt: new Date() },
        deletedAt: null,
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);

    const resetSucceeded = await this.prisma.$transaction(async (tx) => {
      const reset = await tx.user.updateMany({
        where: {
          id: user.id,
          resetToken: tokenHash,
          resetTokenExp: { gt: new Date() },
          deletedAt: null,
        },
        data: {
          passwordHash,
          resetToken: null,
          resetTokenExp: null,
          refreshToken: null,
          sessionVersion: { increment: 1 },
        },
      });
      if (reset.count !== 1) return false;

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorRole: user.role,
          action: 'PASSWORD_RESET_COMPLETED',
          entityType: 'User',
          entityId: user.id,
        },
      });
      return true;
    });
    if (!resetSucceeded) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    this.logger.log(`Password reset successful for user ID: ${user.id}`);
    return { message: 'Password has been reset successfully' };
  }

  generateToken(user: SessionUser): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sv: user.sessionVersion,
      jti: crypto.randomUUID(),
    };
    const configuredExpiresIn =
      this.configService.get<string | number>('jwt.expiresIn') || '7d';
    return this.jwtService.sign(payload, {
      expiresIn: configuredExpiresIn as unknown as number,
    });
  }

  async generateRefreshToken(userId: string): Promise<string> {
    const user = await this.userService.findById(userId);
    if (
      !user ||
      user.suspendedAt ||
      user.status !== 'ACTIVE' ||
      !(await this.userService.hasActiveCompanyMembership(user))
    ) {
      throw new UnauthorizedException('Cannot create a session');
    }

    const refreshToken = this.createRefreshToken(user);

    await this.userService.updateRefreshToken(
      userId,
      this.hashRefreshToken(refreshToken),
    );

    return refreshToken;
  }

  private createRefreshToken(user: {
    id: string;
    sessionVersion: number;
  }): string {
    return this.jwtService.sign(
      {
        sub: user.id,
        sv: user.sessionVersion,
        jti: crypto.randomUUID(),
        type: 'refresh',
      },
      {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: '30d',
        algorithm: 'HS256',
        issuer: this.configService.get<string>('jwt.issuer'),
        audience: this.configService.get<string>('jwt.audience'),
      },
    );
  }

  private hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async refresh(
    token: string,
  ): Promise<{ user: SafeUser; accessToken: string; refreshToken: string }> {
    try {
      const incomingTokenHash = this.hashRefreshToken(token);

      // 1. Grace Window check: if this refresh token was rotated within the last 30 seconds,
      // return the active rotated session instead of causing a concurrency conflict.
      const cached = this.rotatedTokensGraceCache.get(incomingTokenHash);
      if (cached && cached.expiresAt > Date.now()) {
        this.logger.debug(
          `Returning recent rotated session tokens within grace period for user ${cached.user.id}`,
        );
        return {
          user: cached.user,
          accessToken: cached.accessToken,
          refreshToken: cached.refreshToken,
        };
      }

      // Cleanup expired items if cache grows
      if (this.rotatedTokensGraceCache.size > 200) {
        const now = Date.now();
        for (const [key, val] of this.rotatedTokensGraceCache.entries()) {
          if (val.expiresAt <= now) {
            this.rotatedTokensGraceCache.delete(key);
          }
        }
      }

      const payload = this.jwtService.verify<{
        sub: string;
        sv: number;
        type: string;
      }>(token, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        algorithms: ['HS256'],
        issuer: this.configService.get<string>('jwt.issuer'),
        audience: this.configService.get<string>('jwt.audience'),
      });

      const user = await this.userService.findById(payload.sub);
      if (
        !user ||
        !user.refreshToken ||
        payload.type !== 'refresh' ||
        payload.sv !== user.sessionVersion ||
        user.suspendedAt ||
        user.status !== 'ACTIVE' ||
        !(await this.userService.hasActiveCompanyMembership(user))
      ) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const requireEmailVerification = (await this.settingsService.getSetting(
        'AUTH_REQUIRE_EMAIL_VERIFICATION',
        false,
      )) as boolean;
      if (requireEmailVerification && !user.isVerified) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const newRefreshToken = this.createRefreshToken(user);
      const rotated = await this.prisma.user.updateMany({
        where: {
          id: user.id,
          refreshToken: incomingTokenHash,
          sessionVersion: payload.sv,
        },
        data: {
          refreshToken: this.hashRefreshToken(newRefreshToken),
        },
      });

      if (rotated.count !== 1) {
        // Double-check if another concurrent request just completed the rotation
        const doubleCheckCached = this.rotatedTokensGraceCache.get(incomingTokenHash);
        if (doubleCheckCached && doubleCheckCached.expiresAt > Date.now()) {
          return {
            user: doubleCheckCached.user,
            accessToken: doubleCheckCached.accessToken,
            refreshToken: doubleCheckCached.refreshToken,
          };
        }
        throw new UnauthorizedException('Invalid refresh token');
      }

      const safeUser = this.userService.toSafeUser(user);
      const accessToken = this.generateToken({
        ...safeUser,
        sessionVersion: user.sessionVersion,
      });

      // Cache the rotated token for 30 seconds to handle concurrent requests gracefully
      this.rotatedTokensGraceCache.set(incomingTokenHash, {
        user: safeUser,
        accessToken,
        refreshToken: newRefreshToken,
        expiresAt: Date.now() + 30_000,
      });

      return { user: safeUser, accessToken, refreshToken: newRefreshToken };
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async clearRefreshToken(userId: string): Promise<void> {
    await this.userService.revokeSessions(userId);
  }

  async getMe(userId: string): Promise<SafeUser> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }

    return this.userService.toSafeUser(user);
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    assertStrongPassword(dto.newPassword);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const isPasswordValid = await bcrypt.compare(
      dto.oldPassword,
      user.passwordHash,
    );
    if (!isPasswordValid) throw new BadRequestException('Invalid old password');

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    const changeSucceeded = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.user.updateMany({
        where: {
          id: userId,
          passwordHash: user.passwordHash,
          deletedAt: null,
        },
        data: {
          passwordHash,
          refreshToken: null,
          sessionVersion: { increment: 1 },
        },
      });
      if (changed.count !== 1) return false;

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorRole: user.role,
          action: 'PASSWORD_CHANGED',
          entityType: 'User',
          entityId: user.id,
        },
      });
      return true;
    });
    if (!changeSucceeded) {
      throw new BadRequestException(
        'Password changed concurrently; please sign in again',
      );
    }

    return { message: 'Password changed successfully' };
  }

  async resendVerification(
    dto: ResendVerificationDto,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.trim().toLowerCase(), deletedAt: null },
    });
    if (!user || user.isVerified) {
      return {
        message:
          'If that email is registered and unverified, a verification code has been sent.',
      };
    }

    // 60-second cooldown enforcement
    if (user.verifySentAt) {
      const elapsedSeconds = Math.floor(
        (Date.now() - user.verifySentAt.getTime()) / 1000,
      );
      const cooldownSeconds = 60;
      if (elapsedSeconds < cooldownSeconds) {
        const remaining = cooldownSeconds - elapsedSeconds;
        throw new BadRequestException(
          `Please wait ${remaining} second${remaining === 1 ? '' : 's'} before requesting another verification code.`,
        );
      }
    }

    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const verifyTokenHash = crypto
      .createHash('sha256')
      .update(otpCode)
      .digest('hex');
    const verifyTokenExp = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes validity

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        verifyToken: verifyTokenHash,
        verifyTokenExp,
        verifyAttempts: 0,
        verifySentAt: new Date(),
      },
    });

    this.logger.log(`Resent verification OTP code for userId=${user.id}`);

    try {
      await this.notificationsService.sendVerificationEmail(
        user.email,
        user.name,
        otpCode,
      );
    } catch (error: any) {
      this.logger.error(
        `Could not send verification email to ${user.email}: ${error?.message || error}.`,
      );
    }
    return {
      message:
        'If that email is registered and unverified, a verification code has been sent.',
    };
  }
}
