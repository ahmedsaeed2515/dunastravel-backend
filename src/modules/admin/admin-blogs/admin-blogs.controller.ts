import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminBlogsService } from './admin-blogs.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@ApiTags('admin-blogs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/blogs')
export class AdminBlogsController {
  constructor(private readonly service: AdminBlogsService) {}

  @Get()
  async findAll() {
    return this.service.findAll();
  }
}
