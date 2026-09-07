import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { SettingsModule } from '../settings/settings.module';
import { LoginSecurityStateService } from '../../common/security/login-security-state.service';
import { TurnstileService } from '../../common/security/turnstile.service';
import { TurnstileGuard } from '../../common/security/turnstile.guard';

@Module({
  imports: [
    UsersModule,
    NotificationsModule,
    SettingsModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const expiresIn = configService.get<string | number>('jwt.expiresIn');
        return {
          secret: configService.get<string>('jwt.secret'),
          signOptions: {
            expiresIn: (expiresIn ?? '15m') as unknown as number,
            algorithm: 'HS256' as const,
            issuer: configService.get<string>('jwt.issuer'),
            audience: configService.get<string>('jwt.audience'),
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    LoginSecurityStateService,
    TurnstileService,
    TurnstileGuard,
  ],
  exports: [AuthService, JwtModule, TurnstileService, TurnstileGuard],
})
export class AuthModule {}
