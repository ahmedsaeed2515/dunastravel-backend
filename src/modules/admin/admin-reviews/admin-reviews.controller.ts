import { Controller, Get, Patch, Delete, Param, Query, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AdminReviewsService } from './admin-reviews.service';
import { IsBoolean, IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

class ListReviewsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by published status', type: Boolean })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isPublished?: boolean;
}

class ReplyReviewDto {
  @ApiProperty({ description: 'The reply text' })
  @IsString()
  @IsNotEmpty()
  reply!: string;
}

@ApiTags('Admin Reviews')
@ApiBearerAuth()
@Controller('admin/reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminReviewsController {
  constructor(private readonly adminReviewsService: AdminReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'List all reviews' })
  async listReviews(@Query() query: ListReviewsQueryDto) {
    return this.adminReviewsService.listReviews(query.isPublished);
  }

  @Patch(':id/publish')
  @ApiOperation({ summary: 'Publish a review' })
  async publishReview(@Param('id') id: string, @Req() req: any) {
    return this.adminReviewsService.publishReview(id, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a review' })
  async deleteReview(@Param('id') id: string, @Req() req: any) {
    return this.adminReviewsService.deleteReview(id, req.user.id);
  }

  @Patch(':id/reply')
  @ApiOperation({ summary: 'Reply to a review' })
  async replyToReview(@Param('id') id: string, @Body() dto: ReplyReviewDto, @Req() req: any) {
    return this.adminReviewsService.replyToReview(id, dto.reply, req.user.id);
  }
}
