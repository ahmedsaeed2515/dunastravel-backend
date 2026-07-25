import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminFaqsService } from './admin-faqs.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@ApiTags('admin-faqs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/faqs')
export class AdminFaqsController {
  constructor(private readonly service: AdminFaqsService) {}

  @Get()
  async findAll() {
    return this.service.findAll();
  }
}
