import {
  Controller,
  Get,
  Param,
  Put,
  Delete,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { CmsService } from './cms.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types';
import { UserRole } from '@prisma/client';
import {
  ListCmsBlocksQueryDto,
  UpsertCmsBlockDto,
} from './dto/cms.dto';

@ApiTags('admin-cms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin/cms-blocks')
export class AdminCmsController {
  constructor(private readonly cmsService: CmsService) {}

  @Get()
  @ApiOperation({ summary: 'List CMS blocks' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAll(
    @Query() query: ListCmsBlocksQueryDto,
  ) {
    return this.cmsService.findAllAdmin(
      query.page,
      query.limit,
      query.search,
    );
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get a CMS block by key' })
  async findOne(@Param('key') key: string) {
    return this.cmsService.findOneAdmin(key);
  }

  @Put(':key')
  @ApiOperation({ summary: 'Create or update a CMS block' })
  async upsert(
    @Param('key') key: string,
    @Body() dto: UpsertCmsBlockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cmsService.upsertAdmin(key, dto.content, user);
  }

  @Delete(':key')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a CMS block' })
  async delete(
    @Param('key') key: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cmsService.deleteAdmin(key, user);
  }
}
