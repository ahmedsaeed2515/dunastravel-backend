import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Body,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { AdminTailorMadeService } from './admin-tailor-made.service';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { TailorMadeInquiryStatus, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../common/types';

@ApiTags('admin-tailor-made')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.AGENT)
@Controller('admin/tailor-made-inquiries')
export class AdminTailorMadeController {
  constructor(private readonly service: AdminTailorMadeService) {}

  @Get()
  @ApiOperation({ summary: 'List all tailor-made inquiries' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const assigneeFilter = user?.role === UserRole.AGENT ? user.id : undefined;
    return this.service.findAll(
      Number(page),
      Number(limit),
      status,
      assigneeFilter,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single tailor-made inquiry' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const record = await this.service.findOne(id);
    if (user?.role === UserRole.AGENT && record.assigneeId !== user.id) {
      throw new ForbiddenException(
        'You can only view inquiries assigned to you',
      );
    }
    return record;
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update inquiry status' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: TailorMadeInquiryStatus,
    @Body('notes') notes?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (user?.role === UserRole.AGENT) {
      const record = await this.service.findOne(id);
      if (record.assigneeId !== user.id) {
        throw new ForbiddenException(
          'You can only update inquiries assigned to you',
        );
      }
    }
    return this.service.updateStatus(id, status, notes, user?.id);
  }

  @Patch(':id/assign')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Assign inquiry' })
  async assignInquiry(
    @Param('id') id: string,
    @Body('assignedToId') assignedToId?: string,
    @Body('assigneeId') assigneeId?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const targetId = assigneeId || assignedToId;
    return this.service.assignInquiry(id, targetId || '', user?.id);
  }

  @Post(':id/quote')
  @ApiOperation({ summary: 'Quote an inquiry' })
  async quoteInquiry(
    @Param('id') id: string,
    @Body('amount') amount?: number,
    @Body('quotedAmountUsd') quotedAmountUsd?: number,
    @Body('notes') notes?: string,
    @Body('quoteNotes') quoteNotes?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const finalAmount = quotedAmountUsd ?? amount ?? 0;
    const finalNotes = quoteNotes ?? notes;
    return this.service.createQuote(id, finalAmount, finalNotes, user?.id);
  }

  @Patch(':id/quote')
  @ApiOperation({ summary: 'Update quote for an inquiry' })
  async updateQuote(
    @Param('id') id: string,
    @Body('amount') amount?: number,
    @Body('quotedAmountUsd') quotedAmountUsd?: number,
    @Body('notes') notes?: string,
    @Body('quoteNotes') quoteNotes?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const finalAmount = quotedAmountUsd ?? amount ?? 0;
    const finalNotes = quoteNotes ?? notes;
    return this.service.createQuote(id, finalAmount, finalNotes, user?.id);
  }

  @Post(':id/convert-to-booking')
  @ApiOperation({ summary: 'Convert inquiry to booking' })
  async convertToBooking(@Param('id') id: string) {
    return this.service.convertToBooking(id);
  }
}
