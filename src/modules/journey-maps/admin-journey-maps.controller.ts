import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { JourneyMapsService } from './journey-maps.service';
import { CreateJourneyRouteDto } from './dto/create-journey-route.dto';
import { UpdateJourneyRouteDto } from './dto/update-journey-route.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { JourneyMapsQueryDto } from './dto/journey-maps-query.dto';

@ApiTags('Admin — Journey Maps')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/journey-maps')
export class AdminJourneyMapsController {
  constructor(private readonly journeyMapsService: JourneyMapsService) {}

  @Get()
  @ApiOperation({ summary: 'List all journey routes (admin, paginated)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async list(@Query() query: JourneyMapsQueryDto) {
    return this.journeyMapsService.findAllAdmin(
      query.page ?? 1,
      query.limit ?? 20,
    );
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new journey route' })
  @ApiCreatedResponse({ description: 'Journey route created' })
  async create(@Body() dto: CreateJourneyRouteDto) {
    return this.journeyMapsService.createAdmin(dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a journey route' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiOkResponse({ description: 'Journey route updated' })
  @ApiNotFoundResponse()
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateJourneyRouteDto,
  ) {
    return this.journeyMapsService.updateAdmin(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a journey route' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiOkResponse({ description: 'Journey route deleted' })
  @ApiNotFoundResponse()
  async delete(@Param('id') id: string) {
    return this.journeyMapsService.deleteAdmin(id);
  }
}
