import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { HotelsService } from './hotels.service';
import { AdminHotelsQueryDto } from './dto/hotel-query.dto';
import { CreateHotelDto, UpdateHotelDto } from './dto/hotel.dto';

@ApiTags('admin-hotels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/hotels')
export class AdminHotelsController {
  constructor(private readonly hotelsService: HotelsService) {}

  @Get()
  @ApiOperation({ summary: 'List hotels for administration' })
  findAll(@Query() query: AdminHotelsQueryDto) {
    return this.hotelsService.findAllAdmin(query.page, query.limit, query.search, query.status, query.destinationSlug);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get hotel for administration' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.hotelsService.findOneAdmin(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create hotel' })
  create(@Body() dto: CreateHotelDto) {
    return this.hotelsService.createAdmin(dto);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update hotel' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateHotelDto) {
    return this.hotelsService.updateAdmin(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Soft-delete hotel and disable its rooms' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.hotelsService.softDeleteAdmin(id);
  }
}
