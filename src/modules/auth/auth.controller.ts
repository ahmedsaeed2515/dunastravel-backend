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

@ApiTags('Auth')
@Controller('auth')
@Throttle({ default: { limit: 5, ttl: 60000 } })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {}

  @Public()
  @SkipCsrf()
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
    const sessionUser = await this.authService.login(
      dto,
      req.ip || 'unknown',
    );
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
    res.cookie('access_token', accessToken, getCookieOptions(nodeEnv));
    res.cookie('refresh_token', refreshToken, getRefreshCookieOptions(nodeEnv));

    return { message: 'Token refreshed successfully' };
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

    res.cookie('csrf_token', token, {
      httpOnly: false, // Must be readable by frontend JavaScript
      secure: nodeEnv === 'production' || nodeEnv === 'staging',
      sameSite: 'strict',
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
    return { user: updatedUser };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Request password reset' })
  @ApiOkResponse()
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reset password using token' })
  @ApiOkResponse()
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify user email' })
  @ApiOkResponse()
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
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
