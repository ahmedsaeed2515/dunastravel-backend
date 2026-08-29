import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
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
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MediaService } from './media.service';
import { UploadMediaDto } from './dto/upload-media.dto';
import { MediaAssetResponseDto } from './dto/media-asset-response.dto';
import { DeleteMediaResponseDto } from './dto/delete-media-response.dto';
import { ListMediaDto } from './dto/list-media.dto';
import { FileValidationPipe } from './pipes/file-validation.pipe';
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
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
        fieldSize: 10 * 1024,
        fields: 3,
        files: 1,
        parts: 4,
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
  @ApiOperation({ summary: 'Upload a media asset' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        entityType: { type: 'string', enum: Object.values(MediaEntityType) },
        entityId: { type: 'string', nullable: true },
        altText: { type: 'string', maxLength: 255, nullable: true },
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

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List media assets (admin, paginated)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'entityType', required: false, enum: MediaEntityType })
  @ApiQuery({ name: 'entityId', required: false, type: String })
  @ApiQuery({ name: 'includeDeleted', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['createdAt', 'bytes'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/MediaAssetResponseDto' },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
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
  @ApiOperation({ summary: 'Get active public gallery assets' })
  @ApiOkResponse({ type: [PublicMediaAssetResponseDto] })
  async getPublicGallery(): Promise<PublicMediaAssetResponseDto[]> {
    const assets = await this.mediaService.getPublicGallery();
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
