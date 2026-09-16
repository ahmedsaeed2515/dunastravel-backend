import {
  Controller,
  Get,
  Patch,
  Put,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import {
  AdminCreateReviewDto,
  AdminUpdateReviewDto,
} from './dto/create-review.dto';
import {
  UpdateReviewStatusDto,
  AdminReplyReviewDto,
  BatchUpdateReviewStatusDto,
} from './dto/update-review-status.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types';
import { AdminReviewQueryDto } from './dto/review-query.dto';

@ApiTags('admin-reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'List all customer reviews for moderation' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'tourId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'isPublished', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'rating', required: false, type: Number })
  async findAll(@Query() query: AdminReviewQueryDto) {
    return this.reviewsService.findAllAdmin(
      query.page,
      query.limit,
      query.tourId,
      query.status,
      query.isPublished,
      query.search,
      query.rating,
      query.reviewId,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single customer review by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.reviewsService.findOneAdmin(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new customer review or testimonial manually',
  })
  async create(
    @Body() dto: AdminCreateReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewsService.createAdminReview(dto, user);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Edit review content, rating, reviewer name, or status',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: AdminUpdateReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewsService.updateAdminReview(id, dto, user);
  }

  @Patch('batch/status')
  @ApiOperation({
    summary: 'Batch update moderation status for multiple reviews at once',
  })
  async batchUpdateStatus(
    @Body() dto: BatchUpdateReviewStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewsService.batchUpdateStatusAdmin(dto, user);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update review moderation status (APPROVED, REJECTED, PENDING)',
  })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateReviewStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewsService.updateStatusAdmin(id, dto, user);
  }

  @Post(':id/reply')
  @ApiOperation({ summary: 'Add or edit official admin reply to a review' })
  async reply(
    @Param('id') id: string,
    @Body() dto: AdminReplyReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewsService.replyAdmin(id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a review' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewsService.softDeleteAdmin(id, user);
  }
}
