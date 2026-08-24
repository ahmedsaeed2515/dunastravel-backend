import {
  Controller,
  Post,
  Patch,
  Delete,
  Get,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types';
import { AvailabilityService } from './availability.service';
import {
  CreateAvailabilityDto,
  CreateBatchAvailabilityDto,
  UpdateAvailabilityDto,
} from './dto';

@ApiTags('Admin Tour Availability')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin')
export class AdminAvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get('tours/:tourId/availabilities')
  @ApiOperation({ summary: 'List every availability slot for an admin tour editor' })
  async listAvailabilities(@Param('tourId', ParseUUIDPipe) tourId: string) {
    return this.availabilityService.listAdminAvailability(tourId);
  }

  @Post('tours/:tourId/availabilities')
  @ApiOperation({ summary: 'Create single availability slot for a tour' })
  async createAvailability(
    @Param('tourId', ParseUUIDPipe) tourId: string,
    @Body() dto: CreateAvailabilityDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.availabilityService.createAvailability(
      tourId,
      dto.date,
      dto.totalCapacity,
      dto.status,
      actor,
    );
  }

  @Post('tours/:tourId/availabilities/batch')
  @ApiOperation({
    summary: 'Batch generate availability slots for a date range',
  })
  async createBatchAvailability(
    @Param('tourId', ParseUUIDPipe) tourId: string,
    @Body() dto: CreateBatchAvailabilityDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.availabilityService.createBatchAvailability(
      tourId,
      dto.startDate,
      dto.endDate,
      dto.totalCapacity,
      dto.daysOfWeek,
      actor,
    );
  }

  @Patch('availabilities/:id')
  @ApiOperation({
    summary: 'Update capacity or status of an availability slot',
  })
  async updateAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAvailabilityDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.availabilityService.updateAvailability(id, dto, actor);
  }

  @Delete('availabilities/:id')
  @ApiOperation({ summary: 'Delete an availability slot' })
  async deleteAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.availabilityService.deleteAvailability(id, actor);
  }
}
