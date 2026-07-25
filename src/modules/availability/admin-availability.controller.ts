import {
  Controller,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
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

  @Post('tours/:tourId/availabilities')
  @ApiOperation({ summary: 'Create single availability slot for a tour' })
  async createAvailability(
    @Param('tourId') tourId: string,
    @Body() dto: CreateAvailabilityDto,
  ) {
    return this.availabilityService.createAvailability(
      tourId,
      dto.date,
      dto.totalCapacity,
      dto.status,
    );
  }

  @Post('tours/:tourId/availabilities/batch')
  @ApiOperation({
    summary: 'Batch generate availability slots for a date range',
  })
  async createBatchAvailability(
    @Param('tourId') tourId: string,
    @Body() dto: CreateBatchAvailabilityDto,
  ) {
    return this.availabilityService.createBatchAvailability(
      tourId,
      dto.startDate,
      dto.endDate,
      dto.totalCapacity,
      dto.daysOfWeek,
    );
  }

  @Patch('availabilities/:id')
  @ApiOperation({
    summary: 'Update capacity or status of an availability slot',
  })
  async updateAvailability(
    @Param('id') id: string,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    return this.availabilityService.updateAvailability(id, dto);
  }

  @Delete('availabilities/:id')
  @ApiOperation({ summary: 'Delete an availability slot' })
  async deleteAvailability(@Param('id') id: string) {
    return this.availabilityService.deleteAvailability(id);
  }
}
