import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { CookieOptions } from 'express';
import { UserService, SafeUser } from '../users/users.service';
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
import { JwtPayload } from '../../common/types';

export const getCookieOptions = (nodeEnv: string): CookieOptions => ({
  httpOnly: true,
  secure: nodeEnv === 'production',
  sameSite: nodeEnv === 'production' ? 'strict' : 'lax',
  path: '/',
  maxAge: 15 * 60 * 1000, // 15 minutes for access token
});

export const getRefreshCookieOptions = (nodeEnv: string): CookieOptions => ({
  httpOnly: true,
  secure: nodeEnv === 'production',
  sameSite: 'strict',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly notificationsService: NotificationsService,
    private readonly settingsService: SettingsService,
  ) {}

  async register(dto: RegisterDto): Promise<SafeUser> {
    const existingUser = await this.userService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyTokenHash = crypto.createHash('sha256').update(verifyToken).digest('hex');
    const verifyTokenExp = new Date(Date.now() + 86400000); // 24 hours

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        verifyToken: verifyTokenHash,
        verifyTokenExp,
      },
    });

    this.logger.log(
      `User registered: ${user.email}. Verification token generated.`,
    );
    await this.notificationsService.sendVerificationEmail(user.email, user.name, verifyToken);

    return this.userService.toSafeUser(user);
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<{ message: string }> {
    const tokenHash = crypto.createHash('sha256').update(dto.token).digest('hex');
    const user = await this.prisma.user.findFirst({
      where: { verifyToken: tokenHash, deletedAt: null },
    });

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    if (user.verifyTokenExp && user.verifyTokenExp < new Date()) {
      throw new BadRequestException('Verification link has expired. Please request a new one.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true, verifyToken: null },
    });

    return { message: 'Email verified successfully' };
  }

  async login(dto: LoginDto, ip: string): Promise<SafeUser> {
    const lockoutKey = `login:lockout:${ip}:${dto.email}`;
    const attemptsKey = `login:attempts:${ip}:${dto.email}`;

    const isLocked = await this.cacheManager.get<boolean>(lockoutKey);
    if (isLocked) {
      throw new UnauthorizedException('Too many failed login attempts. Please try again later.');
    }

    const user = await this.userService.findByEmail(dto.email);
    if (!user) {
      await this.incrementFailedAttempts(attemptsKey, lockoutKey);
      this.logger.warn(`Failed login attempt for email: ${dto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const requireEmailVerification = await this.settingsService.getSetting('AUTH_REQUIRE_EMAIL_VERIFICATION', true);

    if (requireEmailVerification && !user.isVerified) {
      throw new UnauthorizedException(
        'Please verify your email before logging in',
      );
    }

    if (user.suspendedAt) {
      this.logger.warn(`Failed login attempt for suspended user: ${dto.email}`);
      throw new UnauthorizedException('Your account has been suspended. Please contact support.');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      await this.incrementFailedAttempts(attemptsKey, lockoutKey);
      this.logger.warn(`Failed login attempt for email: ${dto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Clear failed attempts on success
    await this.cacheManager.del(attemptsKey);

    this.logger.log(`User logged in: ${user.email}`);

    return this.userService.toSafeUser(user);
  }

  private async incrementFailedAttempts(attemptsKey: string, lockoutKey: string) {
    let attempts = await this.cacheManager.get<number>(attemptsKey) || 0;
    attempts += 1;
    if (attempts >= 5) {
      await this.cacheManager.set(lockoutKey, true, 15 * 60 * 1000); // 15 mins
      await this.cacheManager.del(attemptsKey);
    } else {
      await this.cacheManager.set(attemptsKey, attempts, 5 * 60 * 1000); // 5 mins
    }
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
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetTokenExp = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetToken: resetTokenHash, resetTokenExp },
    });

    this.logger.log(`Password reset token generated for ${user.email}`);
    await this.notificationsService.sendPasswordResetEmail(user.email, user.name, resetToken);

    return {
      message: 'If that email exists, a password reset link has been sent.',
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const tokenHash = crypto.createHash('sha256').update(dto.token).digest('hex');
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

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExp: null,
      },
    });

    this.logger.log(`Password reset successful for user ID: ${user.id}`);
    return { message: 'Password has been reset successfully' };
  }

  generateToken(user: SafeUser): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return this.jwtService.sign(payload, { expiresIn: '15m' });
  }

  async generateRefreshToken(userId: string): Promise<string> {
    const refreshToken = this.jwtService.sign(
      { sub: userId },
      {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      },
    );

    const hashed = await bcrypt.hash(refreshToken, 10);
    await this.userService.updateRefreshToken(userId, hashed);

    return refreshToken;
  }

  async refresh(
    token: string,
  ): Promise<{ user: SafeUser; accessToken: string; refreshToken: string }> {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      const user = await this.userService.findById(payload.sub);
      if (!user || !user.refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const isRefreshTokenValid = await bcrypt.compare(
        token,
        user.refreshToken,
      );
      if (!isRefreshTokenValid) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const safeUser = this.userService.toSafeUser(user);
      const accessToken = this.generateToken(safeUser);
      const newRefreshToken = await this.generateRefreshToken(user.id);

      return { user: safeUser, accessToken, refreshToken: newRefreshToken };
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async clearRefreshToken(userId: string): Promise<void> {
    await this.userService.updateRefreshToken(userId, null);
  }

  async getMe(userId: string): Promise<SafeUser> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }

    return this.userService.toSafeUser(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const isPasswordValid = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!isPasswordValid) throw new BadRequestException('Invalid old password');

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { message: 'Password changed successfully' };
  }

  async resendVerification(dto: ResendVerificationDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) return { message: 'If that email is registered, a verification link has been sent.' };
    if (user.isVerified) return { message: 'Email is already verified.' };

    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyTokenHash = crypto.createHash('sha256').update(verifyToken).digest('hex');
    const verifyTokenExp = new Date(Date.now() + 86400000); // 24 hours
    await this.prisma.user.update({
      where: { id: user.id },
      data: { verifyToken: verifyTokenHash, verifyTokenExp },
    });

    this.logger.log(`Resent verification email for: ${user.email}`);
    await this.notificationsService.sendVerificationEmail(user.email, user.name, verifyToken);
    return { message: 'If that email is registered, a verification link has been sent.' };
  }
}
