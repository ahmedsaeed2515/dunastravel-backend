import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ForbiddenException,
} from '@nestjs/common';
import { AdminTailorMadeService } from './admin-tailor-made.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../common/types';
import {
  AdminTailorMadeQueryDto,
  AssignTailorMadeInquiryDto,
  QuoteTailorMadeInquiryDto,
  UpdateTailorMadeStatusDto,
  UpdateTailorMadeInquiryDto,
} from './dto/admin-tailor-made.dto';

@ApiTags('admin-tailor-made')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.AGENT)
@Controller(['admin/tailor-made-inquiries', 'admin/inquiries'])
export class AdminTailorMadeController {
  constructor(private readonly service: AdminTailorMadeService) {}

  @Get()
  @ApiOperation({ summary: 'List all tailor-made inquiries' })
  async findAll(
    @Query() query: AdminTailorMadeQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const assigneeFilter = user?.role === UserRole.AGENT ? user.id : undefined;
    return this.service.findAll(query, assigneeFilter);
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get inquiry pipeline aggregated metrics' })
  async getMetrics(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getMetrics(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single tailor-made inquiry' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOne(id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update inquiry assignment and/or status' })
  async updateInquiry(
    @Param('id') id: string,
    @Body() body: UpdateTailorMadeInquiryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateInquiry(id, body, user);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update inquiry status' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTailorMadeStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateStatus(id, dto.status, dto.notes, user);
  }

  @Patch(':id/assign')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Assign inquiry' })
  async assignInquiry(
    @Param('id') id: string,
    @Body() dto: AssignTailorMadeInquiryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.assignInquiry(id, dto.assigneeId, user);
  }

  @Post(':id/quote')
  @ApiOperation({ summary: 'Quote an inquiry' })
  async quoteInquiry(
    @Param('id') id: string,
    @Body() dto: QuoteTailorMadeInquiryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createQuote(
      id,
      dto.quotedAmountUsd,
      dto.quoteNotes,
      user,
    );
  }

  @Patch(':id/quote')
  @ApiOperation({ summary: 'Update quote for an inquiry' })
  async updateQuote(
    @Param('id') id: string,
    @Body() dto: QuoteTailorMadeInquiryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createQuote(
      id,
      dto.quotedAmountUsd,
      dto.quoteNotes,
      user,
    );
  }

  @Post(':id/convert-to-booking')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Convert inquiry to booking' })
  async convertToBooking(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.convertToBooking(id, user);
  }
}
