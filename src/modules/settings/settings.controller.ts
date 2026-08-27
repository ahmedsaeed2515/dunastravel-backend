import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Param,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types';
import { AuditService } from '../audit/audit.service';
import { Request } from 'express';

import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Settings')
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly auditService: AuditService,
  ) {}

  @Public()
  @Get('public/locales')
  @ApiOperation({ summary: 'Get enabled system locales for public switchers' })
  async getPublicLocales() {
    const raw = await this.settingsService.getSetting('ACTIVE_LOCALES', {
      en: true,
      ar: true,
      es: true,
      pt: true,
      it: true,
    });
    // Return array of active locale codes
    let activeCodes: string[] = [];
    if (Array.isArray(raw)) {
      activeCodes = raw;
    } else if (raw && typeof raw === 'object') {
      activeCodes = Object.entries(raw)
        .filter(([, active]) => Boolean(active))
        .map(([code]) => code);
    }
    if (activeCodes.length === 0) {
      activeCodes = ['en', 'ar', 'es', 'pt', 'it'];
    }
    return { locales: activeCodes, map: raw };
  }

  @Get(':key')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a specific system setting' })
  async getSetting(@Param('key') key: string) {
    this.assertSupportedKey(key);
    const value = await this.settingsService.getSetting(key);
    return { key, value };
  }

  @Put(':key')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a specific system setting' })
  async updateSetting(
    @Param('key') key: string,
    @Body() updateDto: UpdateSettingDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    this.assertSupportedKey(key);
    const setting = await this.settingsService.updateSetting(
      key,
      updateDto.value,
    );
    await this.auditService.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'SYSTEM_SETTING_UPDATED',
      entityType: 'SystemSetting',
      entityId: key,
      metadata: { changedFields: ['value'] },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return setting;
  }

  private assertSupportedKey(key: string): void {
    if (key !== 'AUTH_REQUIRE_EMAIL_VERIFICATION' && key !== 'ACTIVE_LOCALES') {
      throw new BadRequestException('Unsupported system setting');
    }
  }
}
