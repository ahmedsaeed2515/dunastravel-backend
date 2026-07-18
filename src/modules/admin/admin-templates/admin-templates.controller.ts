import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AdminTemplatesService } from './admin-templates.service';
import { CreateEmailTemplateDto } from '../dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from '../dto/update-email-template.dto';

@ApiTags('Admin Templates')
@ApiBearerAuth()
@Controller('admin/communications/templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminTemplatesController {
  constructor(private readonly adminTemplatesService: AdminTemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'List all email templates' })
  async listTemplates() {
    return this.adminTemplatesService.listTemplates();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific email template' })
  async getTemplate(@Param('id') id: string) {
    return this.adminTemplatesService.getTemplate(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new email template' })
  async createTemplate(@Body() dto: CreateEmailTemplateDto, @Req() req: any) {
    return this.adminTemplatesService.createTemplate(dto, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing email template' })
  async updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateEmailTemplateDto,
    @Req() req: any,
  ) {
    return this.adminTemplatesService.updateTemplate(id, dto, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an email template' })
  async deleteTemplate(@Param('id') id: string, @Req() req: any) {
    return this.adminTemplatesService.deleteTemplate(id, req.user.id);
  }
}
