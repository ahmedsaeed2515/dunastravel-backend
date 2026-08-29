import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
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
  findOne(@Param('id') id: string) {
    return this.hotelsService.findOneAdmin(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create hotel' })
  create(@Body() dto: CreateHotelDto) {
    return this.hotelsService.createAdmin(dto);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update hotel' })
  update(@Param('id') id: string, @Body() dto: UpdateHotelDto) {
    return this.hotelsService.updateAdmin(id, dto);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish a hotel with at least one active room' })
  publish(@Param('id') id: string) {
    return this.hotelsService.publishAdmin(id);
  }

  @Post(':id/unpublish')
  @ApiOperation({ summary: 'Return a hotel to draft and hide it from the public catalog' })
  unpublish(@Param('id') id: string) {
    return this.hotelsService.unpublishAdmin(id);
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive a hotel without deleting its rooms' })
  archive(@Param('id') id: string) {
    return this.hotelsService.archiveAdmin(id);
  }

  @Post(':id/unarchive')
  @ApiOperation({ summary: 'Restore an archived hotel to draft' })
  unarchive(@Param('id') id: string) {
    return this.hotelsService.unarchiveAdmin(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Soft-delete hotel and disable its rooms' })
  delete(@Param('id') id: string) {
    return this.hotelsService.softDeleteAdmin(id);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore a soft-deleted hotel as a draft' })
  restore(@Param('id') id: string) {
    return this.hotelsService.restoreAdmin(id);
  }
}
