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

@ApiTags('Admin — Media')
@Controller('admin/media')
export class MediaAdminController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10485760, // Checked dynamically in pipe if we wanted, but multer does hard limit here
      },
      fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.mimetype)) {
          return cb(
            new BadRequestException(
              `Invalid file type. Allowed: ${allowed.join(', ')}`,
            ),
            false,
          );
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
        entityId: { type: 'string', format: 'uuid', nullable: true },
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
    @CurrentUser() user: any,
  ): Promise<MediaAssetResponseDto> {
    const asset = await this.mediaService.uploadAsset(file, dto, user.id);
    return MediaAssetResponseDto.fromPrisma(asset);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Soft-delete a media asset' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOkResponse({ type: DeleteMediaResponseDto })
  @ApiNotFoundResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async deleteAsset(@Param('id') id: string): Promise<DeleteMediaResponseDto> {
    return this.mediaService.deleteAsset(id);
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
      data: result.data.map((asset) =>
        MediaAssetResponseDto.fromPrisma(asset as any),
      ),
      meta: result.meta,
    };
  }
}

@ApiTags('Media')
@Controller('media')
export class MediaPublicController {
  constructor(private readonly mediaService: MediaService) {}

  @Get('tours/:tourId')
  @ApiOperation({ summary: 'Get all active media assets for a tour' })
  @ApiParam({ name: 'tourId', type: 'string', format: 'uuid' })
  @ApiOkResponse({ type: [MediaAssetResponseDto] })
  @ApiBadRequestResponse()
  async getAssetsByTourId(
    @Param('tourId') tourId: string,
  ): Promise<MediaAssetResponseDto[]> {
    // Validate uuid regex since no class-validator on plain string without ParseUUIDPipe
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tourId)) {
      throw new BadRequestException('Invalid tourId format');
    }

    const assets = await this.mediaService.getAssetsByTourId(tourId);
    return assets.map((asset) =>
      MediaAssetResponseDto.fromPrisma(asset as any),
    );
  }
}
