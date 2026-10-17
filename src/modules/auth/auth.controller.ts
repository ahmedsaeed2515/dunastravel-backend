import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Res,
  Req,
  HttpCode,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiConflictResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';
import {
  AuthService,
  getCookieOptions,
  getRefreshCookieOptions,
} from './auth.service';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  ChangePasswordDto,
  ResendVerificationDto,
  UpdateProfileDto,
} from './dto';
import { Public, CurrentUser, SkipCsrf } from '../../common/decorators';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../../common/guards';
import { AuthenticatedUser } from '../../common/types';
import { UserService } from '../users/users.service';
import { TurnstileGuard } from '../../common/security/turnstile.guard';
import { RequireTurnstile } from '../../common/security/require-turnstile.decorator';

import { Inject } from '@nestjs/common';

@ApiTags('Auth')
@Controller('auth')
@Throttle({ default: { limit: 5, ttl: 60000 } })
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(UserService) private readonly userService: UserService,
  ) {}

  @Public()
  @SkipCsrf()
  @Get('config')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get public auth configuration' })
  getAuthConfig() {
    return {
      requireEmailVerification:
        this.authService.shouldRequireEmailVerification(),
    };
  }

  @Public()
  @SkipCsrf()
  @UseGuards(TurnstileGuard)
  @RequireTurnstile('register')
  @Post('register')
  @HttpCode(201)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiCreatedResponse()
  @ApiConflictResponse()
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @SkipCsrf()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login' })
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  async login(
    @Req() req: Request,
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const sessionUser = await this.authService.login(dto, req.ip || 'unknown');
    const token = this.authService.generateToken(sessionUser);
    const refreshToken = await this.authService.generateRefreshToken(
      sessionUser.id,
    );
    const nodeEnv = this.configService.get<string>('nodeEnv') || 'development';
    const csrfToken = crypto.randomBytes(32).toString('hex');
    res.cookie('access_token', token, getCookieOptions(nodeEnv));
    res.cookie('refresh_token', refreshToken, getRefreshCookieOptions(nodeEnv));
    res.cookie('csrf_token', csrfToken, {
      ...getCookieOptions(nodeEnv),
      httpOnly: false,
    });
    const { sessionVersion: _sessionVersion, ...user } = sessionUser;
    return { ...user, csrfToken };
  }

  @Public()
  @SkipCsrf()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const oldRefreshToken = (req.cookies as Record<string, string>)?.[
      'refresh_token'
    ];
    if (!oldRefreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const { accessToken, refreshToken } =
      await this.authService.refresh(oldRefreshToken);
    const nodeEnv = this.configService.get<string>('nodeEnv') || 'development';
    const csrfToken = crypto.randomBytes(32).toString('hex');
    res.cookie('access_token', accessToken, getCookieOptions(nodeEnv));
    res.cookie('refresh_token', refreshToken, getRefreshCookieOptions(nodeEnv));
    res.cookie('csrf_token', csrfToken, {
      ...getCookieOptions(nodeEnv),
      httpOnly: false,
    });

    return { message: 'Token refreshed successfully', csrfToken };
  }

  @Public()
  @SkipCsrf()
  @UseGuards(OptionalJwtAuthGuard)
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Logout' })
  @ApiOkResponse()
  async logout(
    @Req() req: Request & { user?: AuthenticatedUser },
    @Res({ passthrough: true }) res: Response,
  ) {
    if (req.user?.id) {
      await this.authService.clearRefreshToken(req.user.id);
    }
    const nodeEnv = this.configService.get<string>('nodeEnv') || 'development';
    const accessOpts = getCookieOptions(nodeEnv);
    const refreshOpts = getRefreshCookieOptions(nodeEnv);
    res.clearCookie('access_token', {
      path: accessOpts.path,
      httpOnly: accessOpts.httpOnly,
      secure: accessOpts.secure,
      sameSite: accessOpts.sameSite,
    });
    res.clearCookie('refresh_token', {
      path: refreshOpts.path,
      httpOnly: refreshOpts.httpOnly,
      secure: refreshOpts.secure,
      sameSite: refreshOpts.sameSite,
    });
    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiOkResponse()
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.id);
  }

  @Public()
  @Get('csrf')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get CSRF token' })
  @ApiOkResponse()
  getCsrfToken(@Res({ passthrough: true }) res: Response) {
    const token = crypto.randomBytes(32).toString('hex');
    const nodeEnv = this.configService.get<string>('nodeEnv') || 'development';
    const isSecure = nodeEnv === 'production' || nodeEnv === 'staging';

    res.cookie('csrf_token', token, {
      httpOnly: false, // Must be readable by frontend JavaScript
      secure: isSecure,
      sameSite: isSecure ? 'none' : 'lax',
      path: '/',
    });

    return { csrfToken: token };
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update current user profile details' })
  @ApiOkResponse({ description: 'Profile updated successfully' })
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    const updatedUser = await this.userService.updateProfile(user.id, dto);
    return updatedUser;
  }

  @Public()
  @SkipCsrf()
  @UseGuards(TurnstileGuard)
  @RequireTurnstile('forgot_password')
  @Post('forgot-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Request password reset' })
  @ApiOkResponse()
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @SkipCsrf()
  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reset password using token' })
  @ApiOkResponse()
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @SkipCsrf()
  @Post('verify-email')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify user email' })
  @ApiOkResponse()
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyEmail(dto);
    if (result.user) {
      const token = this.authService.generateToken(result.user);
      const refreshToken = await this.authService.generateRefreshToken(
        result.user.id,
      );
      const nodeEnv =
        this.configService.get<string>('nodeEnv') || 'development';
      const csrfToken = crypto.randomBytes(32).toString('hex');
      res.cookie('access_token', token, getCookieOptions(nodeEnv));
      res.cookie(
        'refresh_token',
        refreshToken,
        getRefreshCookieOptions(nodeEnv),
      );
      res.cookie('csrf_token', csrfToken, {
        ...getCookieOptions(nodeEnv),
        httpOnly: false,
      });
      return {
        message: result.message,
        user: result.user,
        ...result.user,
        csrfToken,
      };
    }
    return result;
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Change password' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto);
  }

  @Public()
  @SkipCsrf()
  @UseGuards(TurnstileGuard)
  @RequireTurnstile('resend_verification')
  @Post('resend-verification')
  @HttpCode(200)
  @ApiOperation({ summary: 'Resend verification email' })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Logout from all devices' })
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.clearRefreshToken(user.id);
    const nodeEnv = this.configService.get<string>('nodeEnv') || 'development';
    const accessOpts = getCookieOptions(nodeEnv);
    const refreshOpts = getRefreshCookieOptions(nodeEnv);
    res.clearCookie('access_token', {
      path: accessOpts.path,
      httpOnly: accessOpts.httpOnly,
      secure: accessOpts.secure,
      sameSite: accessOpts.sameSite,
    });
    res.clearCookie('refresh_token', {
      path: refreshOpts.path,
      httpOnly: refreshOpts.httpOnly,
      secure: refreshOpts.secure,
      sameSite: refreshOpts.sameSite,
    });
    return { message: 'Logged out from all devices successfully' };
  }
}
