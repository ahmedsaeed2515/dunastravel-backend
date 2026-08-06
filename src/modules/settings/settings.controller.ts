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

@ApiTags('Settings')
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly auditService: AuditService,
  ) {}

  @Get(':key')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a specific system setting' })
  async getSetting(@Param('key') key: string) {
    this.assertSupportedKey(key);
    const value = await this.settingsService.getSetting(key);
    return { key, value };
  }

  @Put(':key')
  @Roles(UserRole.SUPER_ADMIN)
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
    if (key !== 'AUTH_REQUIRE_EMAIL_VERIFICATION') {
      throw new BadRequestException('Unsupported system setting');
    }
  }
}
