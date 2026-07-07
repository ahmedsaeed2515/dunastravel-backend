import { Controller, Get, Patch, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiProperty } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AdminCmsService } from './admin-cms.service';
import { IsNotEmpty, IsObject } from 'class-validator';

class UpdateCmsBlockDto {
  @ApiProperty({ description: 'JSON object with the CMS content' })
  @IsNotEmpty()
  @IsObject()
  content!: Record<string, any>;
}

@ApiTags('Admin CMS')
@ApiBearerAuth()
@Controller('admin/cms')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminCmsController {
  constructor(private readonly adminCmsService: AdminCmsService) {}

  @Get()
  @ApiOperation({ summary: 'List all CMS blocks' })
  async listBlocks() {
    return this.adminCmsService.listBlocks();
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get a specific CMS block' })
  async getBlock(@Param('key') key: string) {
    return this.adminCmsService.getBlock(key);
  }

  @Patch(':key')
  @ApiOperation({ summary: 'Update a specific CMS block' })
  async updateBlock(@Param('key') key: string, @Body() dto: UpdateCmsBlockDto, @Req() req: any) {
    return this.adminCmsService.updateBlock(key, dto.content, req.user.id);
  }
}
