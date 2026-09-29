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
import { FileInterceptor, FilesInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
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
import {
  AssignToShowcaseDto,
  UpdateShowcaseItemDto,
  ReorderShowcaseDto,
  OptimizeAssetDto,
  HomepageMediaShowcaseResponseDto,
  ShowcasePhotoItemDto,
  ShowcaseVideoItemDto,
  UploadVideoDto,
  AddVideoUrlDto,
} from './dto/showcase-media.dto';

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

  @Get('showcase')
  @ApiOperation({ summary: 'Get all showcase photos and videos for admin management' })
  async getAdminShowcase() {
    const showcase = await this.mediaService.getAdminShowcase();
    return {
      photos: showcase.photos.map((p) => MediaAssetResponseDto.fromPrisma(p)),
      videos: showcase.videos.map((v) => MediaAssetResponseDto.fromPrisma(v)),
    };
  }

  @Post('showcase')
  @ApiOperation({ summary: 'Assign a media asset to photo or video showcase' })
  async addToShowcase(
    @Body() dto: AssignToShowcaseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const asset = await this.mediaService.addToShowcase(dto, user);
    return MediaAssetResponseDto.fromPrisma(asset);
  }

  @Post('showcase/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder showcase items transactionally (POST)' })
  async reorderShowcasePost(
    @Body() dto: ReorderShowcaseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.mediaService.reorderShowcase(dto, user);
  }

  @Patch('showcase/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder showcase items transactionally (PATCH)' })
  async reorderShowcasePatch(
    @Body() dto: ReorderShowcaseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.mediaService.reorderShowcase(dto, user);
  }

  @Patch('showcase/:id')
  @ApiOperation({ summary: 'Update showcase item position, status, or details' })
  @ApiParam({ name: 'id', type: 'string' })
  async updateShowcaseItem(
    @Param('id') id: string,
    @Body() dto: UpdateShowcaseItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const asset = await this.mediaService.updateShowcaseItem(id, dto, user);
    return MediaAssetResponseDto.fromPrisma(asset);
  }

  @Delete('showcase/:id')
  @ApiOperation({ summary: 'Remove a media asset from homepage showcase' })
  @ApiParam({ name: 'id', type: 'string' })
  async removeFromShowcase(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.mediaService.removeFromShowcase(id, user);
  }

  @Post('upload-video')
  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'file', maxCount: 1 },
        { name: 'poster', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: {
          fileSize: 100 * 1024 * 1024,
        },
      },
    ),
  )
  @ApiOperation({ summary: 'Upload a video asset (up to 100MB) with optional poster image' })
  @ApiConsumes('multipart/form-data')
  async uploadVideo(
    @UploadedFiles()
    files: {
      file?: Express.Multer.File[];
      poster?: Express.Multer.File[];
    },
    @Body() dto: UploadVideoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const videoFile =
      files?.file?.[0] ||
      (Array.isArray(files) ? files[0] : undefined) ||
      (dto.file && typeof dto.file === 'object' && (dto.file as any).buffer ? (dto.file as any) : undefined);
    const posterFile =
      files?.poster?.[0] ||
      (dto.poster && typeof dto.poster === 'object' && (dto.poster as any).buffer ? (dto.poster as any) : undefined);

    const addToShowcase = dto.addToShowcase !== false;

    const asset = await this.mediaService.uploadVideoAsset(
      videoFile,
      {
        videoUrl: dto.videoUrl,
        posterUrl: dto.posterUrl,
        title: dto.title,
        description: dto.description,
        altText: dto.altText,
        categorySlug: dto.categorySlug,
        addToShowcase,
      },
      user.id,
      posterFile,
    );
    return MediaAssetResponseDto.fromPrisma(asset);
  }

  @Post('add-video-url')
  @Throttle({ default: { limit: 60, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Register an external video URL with optional poster and details' })
  @ApiOkResponse({ type: MediaAssetResponseDto })
  async addVideoUrl(
    @Body() dto: AddVideoUrlDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MediaAssetResponseDto> {
    const asset = await this.mediaService.uploadVideoAsset(
      undefined,
      {
        videoUrl: dto.videoUrl,
        posterUrl: dto.posterUrl,
        title: dto.title,
        description: dto.description,
        altText: dto.altText,
        categorySlug: dto.categorySlug,
        addToShowcase: dto.addToShowcase ?? true,
      },
      user.id,
    );
    return MediaAssetResponseDto.fromPrisma(asset);
  }

  @Post('optimize/:id')
  @ApiOperation({ summary: 'Generate and verify server-side WebP optimization for an existing asset' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiOkResponse({ type: MediaAssetResponseDto })
  async optimizeAsset(
    @Param('id') id: string,
    @Body() dto: OptimizeAssetDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MediaAssetResponseDto> {
    const asset = await this.mediaService.optimizeAsset(id, dto, user);
    return MediaAssetResponseDto.fromPrisma(asset);
  }

  @Get(':id/usage')
  @ApiOperation({ summary: 'Check where a media asset is referenced before deletion' })
  @ApiParam({ name: 'id', type: 'string' })
  async checkUsage(@Param('id') id: string) {
    return this.mediaService.checkMediaUsage(id);
  }

  @Post('sync-entities')
  @ApiOperation({ summary: 'Synchronize tour and hotel entity media into media_assets library' })
  async syncEntities(@CurrentUser() user: AuthenticatedUser) {
    return this.mediaService.syncEntityMedia(user);
  }
}

@ApiTags('Media')
@Controller('media')
@Public()
export class MediaPublicController {
  constructor(private readonly mediaService: MediaService) {}

  @Get('showcase')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Get active public homepage media showcase (photos and videos)' })
  @ApiOkResponse({ type: HomepageMediaShowcaseResponseDto })
  async getPublicShowcase(): Promise<HomepageMediaShowcaseResponseDto> {
    return this.mediaService.getPublicShowcase();
  }

  @Get('showcase/photos')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Get active public homepage photo showcase slides' })
  @ApiOkResponse({ type: [ShowcasePhotoItemDto] })
  async getShowcasePhotos(): Promise<ShowcasePhotoItemDto[]> {
    const showcase = await this.mediaService.getPublicShowcase();
    return showcase.photos;
  }

  @Get('showcase/videos')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Get active public homepage video showcase slides' })
  @ApiOkResponse({ type: [ShowcaseVideoItemDto] })
  async getShowcaseVideos(): Promise<ShowcaseVideoItemDto[]> {
    const showcase = await this.mediaService.getPublicShowcase();
    return showcase.videos;
  }

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
