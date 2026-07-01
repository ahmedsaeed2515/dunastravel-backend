import {
  Controller,
  Post,
  Get,
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
} from './dto';
import { Public, CurrentUser } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards';
import { AuthenticatedUser } from '../../common/types';

@ApiTags('Auth')
@Controller('auth')
@Throttle({ default: { limit: 5, ttl: 60000 } })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(201)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiCreatedResponse()
  @ApiConflictResponse()
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.register(dto);
    const token = this.authService.generateToken(user);
    const refreshToken = await this.authService.generateRefreshToken(user.id);
    const nodeEnv = this.configService.get<string>('nodeEnv') || 'development';
    res.cookie('access_token', token, getCookieOptions(nodeEnv));
    res.cookie('refresh_token', refreshToken, getRefreshCookieOptions(nodeEnv));
    return user;
  }

  @Public()
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
    const user = await this.authService.login(dto, req.ip || 'unknown');
    const token = this.authService.generateToken(user);
    const refreshToken = await this.authService.generateRefreshToken(user.id);
    const nodeEnv = this.configService.get<string>('nodeEnv') || 'development';
    res.cookie('access_token', token, getCookieOptions(nodeEnv));
    res.cookie('refresh_token', refreshToken, getRefreshCookieOptions(nodeEnv));
    return user;
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const oldRefreshToken = req.cookies['refresh_token'];
    if (!oldRefreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const { user, accessToken, refreshToken } =
      await this.authService.refresh(oldRefreshToken);
    const nodeEnv = this.configService.get<string>('nodeEnv') || 'development';
    res.cookie('access_token', accessToken, getCookieOptions(nodeEnv));
    res.cookie('refresh_token', refreshToken, getRefreshCookieOptions(nodeEnv));

    return { message: 'Token refreshed successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Logout' })
  @ApiOkResponse()
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.clearRefreshToken(user.id);
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
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
    // Generate a random 32 byte hex string
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const nodeEnv = this.configService.get<string>('nodeEnv') || 'development';

    res.cookie('csrf_token', token, {
      httpOnly: false, // Must be readable by frontend JavaScript
      secure: nodeEnv === 'production',
      sameSite: 'strict',
      path: '/',
    });

    return { csrfToken: token };
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
    @CurrentUser() user: any,
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
    @CurrentUser() user: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.clearRefreshToken(user.id);
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return { message: 'Logged out from all devices successfully' };
  }
}
