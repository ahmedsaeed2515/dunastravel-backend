import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../../users/users.service';
import { JwtPayload, AuthenticatedUser } from '../../../common/types';
import { Request } from 'express';
import { SettingsService } from '../../settings/settings.service';

import { Inject } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(UserService) private readonly userService: UserService,
    @Inject(SettingsService) private readonly settingsService: SettingsService,
  ) {
    const secret = configService.get<string>('jwt.secret');
    if (!secret) {
      throw new Error('FATAL: JWT_SECRET is not defined');
    }
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) =>
          (request?.cookies as Record<string, string>)?.access_token,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
      algorithms: ['HS256'],
      issuer: configService.get<string>('jwt.issuer'),
      audience: configService.get<string>('jwt.audience'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.userService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }

    const requireEmailVerification = (await this.settingsService.getSetting(
      'AUTH_REQUIRE_EMAIL_VERIFICATION',
      false,
    )) as boolean;
    if (
      user.suspendedAt ||
      user.status !== 'ACTIVE' ||
      (requireEmailVerification && !user.isVerified) ||
      payload.sv !== user.sessionVersion ||
      !(await this.userService.hasActiveCompanyMembership(user))
    ) {
      throw new UnauthorizedException();
    }

    this.logger.debug(`JWT validated for user: ${user.id}`);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}
