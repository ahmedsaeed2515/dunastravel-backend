import {
  Controller,
  Get,
  Param,
  Put,
  Post,
  Patch,
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
import {
  ListCmsBlocksQueryDto,
  CmsCatalogItemDto,
  UpsertCmsBlockDto,
} from './dto/cms.dto';

@ApiTags('admin-cms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller(['admin/cms-blocks', 'admin/cms'])
export class AdminCmsController {
  constructor(private readonly cmsService: CmsService) {}

  @Get()
  @ApiOperation({ summary: 'List CMS blocks' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAll(@Query() query: ListCmsBlocksQueryDto) {
    return this.cmsService.findAllAdmin(query.page, query.limit, query.search);
  }

  @Post('seed-defaults')
  @ApiOperation({ summary: 'Seed curated luxury CMS content templates' })
  async seedDefaults(@CurrentUser() user: AuthenticatedUser) {
    return this.cmsService.seedCuratedDefaults(user);
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get a CMS block by key' })
  async findOne(@Param('key') key: string) {
    return this.cmsService.findOneAdmin(key);
  }

  @Post(':key/items')
  @ApiOperation({
    summary: 'Atomically append an item to a managed CMS catalog',
  })
  async createCatalogItem(
    @Param('key') key: string,
    @Body() dto: CmsCatalogItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cmsService.createCatalogItem(key, dto.item, user);
  }

  @Patch(':key/items/:itemId')
  @ApiOperation({
    summary: 'Atomically update an item in a managed CMS catalog',
  })
  async updateCatalogItem(
    @Param('key') key: string,
    @Param('itemId') itemId: string,
    @Body() dto: CmsCatalogItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cmsService.updateCatalogItem(key, itemId, dto.item, user);
  }

  @Delete(':key/items/:itemId')
  @ApiOperation({
    summary: 'Atomically delete an item from a managed CMS catalog',
  })
  async deleteCatalogItem(
    @Param('key') key: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cmsService.deleteCatalogItem(key, itemId, user);
  }

  @Put(':key')
  @ApiOperation({ summary: 'Upsert (create or update) a full CMS block' })
  async upsert(
    @Param('key') key: string,
    @Body() dto: UpsertCmsBlockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cmsService.upsertAdmin(key, dto, user);
  }

  @Patch(':key')
  @ApiOperation({ summary: 'Partially update a full CMS block' })
  async patch(
    @Param('key') key: string,
    @Body() dto: UpsertCmsBlockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cmsService.upsertAdmin(key, dto, user);
  }

  @Delete(':key')
  @ApiOperation({ summary: 'Delete a CMS block' })
  async remove(
    @Param('key') key: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cmsService.deleteAdmin(key, user);
  }
}
