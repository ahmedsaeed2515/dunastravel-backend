import {
  Controller,
  Post,
  Get,
  Patch,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiBadGatewayResponse,
  ApiNotFoundResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MediaService } from './media.service';
import { UploadMediaDto } from './dto/upload-media.dto';
import { UploadBulkMediaDto } from './dto/upload-bulk-media.dto';
import { ImportMediaUrlsDto } from './dto/import-media-urls.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import { BulkMoveMediaDto } from './dto/bulk-move-media.dto';
import { CreateMediaCategoryDto, UpdateMediaCategoryDto } from './dto/media-category.dto';
import { MediaAssetResponseDto } from './dto/media-asset-response.dto';
import { DeleteMediaResponseDto } from './dto/delete-media-response.dto';
import { ListMediaDto } from './dto/list-media.dto';
import { FileValidationPipe } from './pipes/file-validation.pipe';
import { FilesValidationPipe } from './pipes/files-validation.pipe';
import { MediaEntityType } from '@prisma/client';
import { AuthenticatedUser } from '../../common/types';
import { Public } from '../../common/decorators/public.decorator';
import { PublicMediaAssetResponseDto } from './dto/public-media-asset-response.dto';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Admin — Media')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/media')
export class MediaAdminController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @Throttle({ default: { limit: 120, ttl: 3_600_000 } })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
        fieldSize: 10 * 1024,
        fields: 5,
        files: 1,
        parts: 6,
      },
      fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.mimetype)) {
          return cb(new BadRequestException('Invalid file type'), false);
        }
        cb(null, true);
      },
    }),
  )
  @ApiOperation({ summary: 'Upload a single media asset' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        entityType: { type: 'string', enum: Object.values(MediaEntityType) },
        entityId: { type: 'string', nullable: true },
        altText: { type: 'string', maxLength: 255, nullable: true },
        categorySlug: { type: 'string', nullable: true },
      },
    },
  })
  @ApiCreatedResponse({ type: MediaAssetResponseDto })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiBadGatewayResponse()
  async upload(
    @UploadedFile(FileValidationPipe) file: Express.Multer.File,
    @Body() dto: UploadMediaDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MediaAssetResponseDto> {
    const asset = await this.mediaService.uploadAsset(file, dto, user.id);
    return MediaAssetResponseDto.fromPrisma(asset);
  }

  @Post('upload-bulk')
  @Throttle({ default: { limit: 120, ttl: 3_600_000 } })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(
    FilesInterceptor('files', 25, {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
        fieldSize: 50 * 1024,
        fields: 10,
        files: 25,
        parts: 35,
      },
      fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.mimetype)) {
          return cb(new BadRequestException(`Invalid file type for ${file.originalname}`), false);
        }
        cb(null, true);
      },
    }),
  )
  @ApiOperation({ summary: 'Upload multiple media assets at once' })
  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({ type: [MediaAssetResponseDto] })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiBadGatewayResponse()
  async uploadBulk(
    @UploadedFiles(FilesValidationPipe) files: Express.Multer.File[],
    @Body() dto: UploadBulkMediaDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MediaAssetResponseDto[]> {
    const assets = await this.mediaService.uploadBulkAssets(files, dto, user.id);
    return assets.map((asset) => MediaAssetResponseDto.fromPrisma(asset));
  }

  @Post('import-urls')
  @Throttle({ default: { limit: 120, ttl: 3_600_000 } })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Import media assets from external direct URLs' })
  @ApiCreatedResponse({ type: [MediaAssetResponseDto] })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiBadGatewayResponse()
  async importUrls(
    @Body() dto: ImportMediaUrlsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MediaAssetResponseDto[]> {
    const assets = await this.mediaService.importMediaUrls(dto, user.id);
    return assets.map((asset) => MediaAssetResponseDto.fromPrisma(asset));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update media asset details, category, or alt text' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiOkResponse({ type: MediaAssetResponseDto })
  async updateAsset(
    @Param('id') id: string,
    @Body() dto: UpdateMediaDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MediaAssetResponseDto> {
    const asset = await this.mediaService.updateAsset(id, dto, user);
    return MediaAssetResponseDto.fromPrisma(asset);
  }

  @Post('bulk-move')
  @ApiOperation({ summary: 'Bulk move multiple media assets to a category or entity' })
  @ApiOkResponse({ description: 'Assets moved successfully' })
  async bulkMove(
    @Body() dto: BulkMoveMediaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.mediaService.bulkMoveAssets(dto, user);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get all media categories with live asset counts' })
  async getCategories() {
    return this.mediaService.getCategoriesWithCounts();
  }

  @Post('categories')
  @ApiOperation({ summary: 'Create a new media category' })
  async createCategory(
    @Body() dto: CreateMediaCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.mediaService.createCategory(dto, user);
  }

  @Put('categories/:slug')
  @ApiOperation({ summary: 'Update a media category' })
  @ApiParam({ name: 'slug', type: 'string' })
  async updateCategory(
    @Param('slug') slug: string,
    @Body() dto: UpdateMediaCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.mediaService.updateCategory(slug, dto, user);
  }

  @Delete('categories/:slug')
  @ApiOperation({ summary: 'Delete a custom media category and reassign assets' })
  @ApiParam({ name: 'slug', type: 'string' })
  async deleteCategory(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.mediaService.deleteCategory(slug, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a media asset (admin only)' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiOkResponse({ type: DeleteMediaResponseDto })
  @ApiNotFoundResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async deleteAsset(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DeleteMediaResponseDto> {
    return this.mediaService.deleteAsset(id, user);
  }

  @Get()
  @ApiOperation({ summary: 'List media assets (admin, paginated)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'entityType', required: false, enum: MediaEntityType })
  @ApiQuery({ name: 'entityId', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'includeDeleted', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'format', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['createdAt', 'bytes'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  async listAssets(@Query() query: ListMediaDto) {
    const result = await this.mediaService.listAssets(query);
    return {
      data: result.data.map((asset) => MediaAssetResponseDto.fromPrisma(asset)),
      meta: result.meta,
    };
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get persisted media library totals (admin)' })
  async getSummary() {
    return this.mediaService.getSummary();
  }
}

@ApiTags('Media')
@Controller('media')
@Public()
export class MediaPublicController {
  constructor(private readonly mediaService: MediaService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Get active public gallery assets with optional category filtering' })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ type: [PublicMediaAssetResponseDto] })
  async getPublicGallery(
    @Query('category') category?: string,
    @Query('limit') limit?: number,
  ): Promise<PublicMediaAssetResponseDto[]> {
    const assets = await this.mediaService.getPublicGallery(
      limit ? Number(limit) : 100,
      category,
    );
    return assets.map((asset) => PublicMediaAssetResponseDto.fromPrisma(asset));
  }

  @Get('category/:categorySlug')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Get active public media assets for a category' })
  @ApiParam({ name: 'categorySlug', type: 'string' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ type: [PublicMediaAssetResponseDto] })
  async getAssetsByCategory(
    @Param('categorySlug') categorySlug: string,
    @Query('limit') limit?: number,
  ): Promise<PublicMediaAssetResponseDto[]> {
    const assets = await this.mediaService.getPublicGallery(
      limit ? Number(limit) : 100,
      categorySlug,
    );
    return assets.map((asset) => PublicMediaAssetResponseDto.fromPrisma(asset));
  }

  @Get('tours/:tourId')
  @ApiOperation({ summary: 'Get all active media assets for a tour' })
  @ApiParam({ name: 'tourId', type: 'string' })
  @ApiOkResponse({ type: [PublicMediaAssetResponseDto] })
  @ApiBadRequestResponse()
  async getAssetsByTourId(
    @Param('tourId') tourId: string,
  ): Promise<PublicMediaAssetResponseDto[]> {
    const assets = await this.mediaService.getAssetsByTourId(tourId);
    return assets.map((asset) => PublicMediaAssetResponseDto.fromPrisma(asset));
  }

  @Get('hotels/:hotelId')
  @ApiOperation({ summary: 'Get all active media assets for a hotel' })
  @ApiParam({ name: 'hotelId', type: 'string' })
  @ApiOkResponse({ type: [PublicMediaAssetResponseDto] })
  async getAssetsByHotelId(
    @Param('hotelId') hotelId: string,
  ): Promise<PublicMediaAssetResponseDto[]> {
    const assets = await this.mediaService.getAssetsByHotelId(hotelId);
    return assets.map((asset) => PublicMediaAssetResponseDto.fromPrisma(asset));
  }
}
