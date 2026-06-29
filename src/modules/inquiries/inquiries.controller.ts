import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiUnprocessableEntityResponse,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole, TailorMadeInquiryStatus } from '@prisma/client';
import { InquiriesService } from './inquiries.service';
import { ListInquiriesQueryDto, UpdateInquiryStatusDto } from './dto';

@ApiTags('Inquiries (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/inquiries')
export class InquiriesController {
  constructor(private readonly inquiriesService: InquiriesService) {}

  @Get()
  @ApiOperation({ summary: 'List tailor-made inquiries' })
  @ApiOkResponse({ description: 'List of inquiries' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  async findAll(@Query() query: ListInquiriesQueryDto) {
    return this.inquiriesService.findAll(query);
  }

  @Get(':referenceCode')
  @ApiOperation({ summary: 'Get a tailor-made inquiry by reference code' })
  @ApiOkResponse({ description: 'Inquiry details' })
  @ApiNotFoundResponse({ description: 'Inquiry not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  async findOne(@Param('referenceCode') referenceCode: string) {
    return this.inquiriesService.findOne(referenceCode);
  }

  @Patch(':referenceCode/status')
  @ApiOperation({ summary: 'Update inquiry status' })
  @ApiOkResponse({ description: 'Inquiry status updated' })
  @ApiNotFoundResponse({ description: 'Inquiry not found' })
  @ApiUnprocessableEntityResponse({ description: 'Invalid status transition' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  async updateStatus(
    @Param('referenceCode') referenceCode: string,
    @Body() dto: UpdateInquiryStatusDto,
  ) {
    return this.inquiriesService.updateStatus(
      referenceCode,
      dto.status as TailorMadeInquiryStatus,
    );
  }
}
