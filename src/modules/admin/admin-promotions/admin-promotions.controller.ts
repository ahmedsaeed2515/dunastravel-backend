import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AdminPromotionsService } from './admin-promotions.service';
import { CreatePromotionDto, UpdatePromotionDto } from './dto/promotion.dto';

@ApiTags('Admin Promotions')
@ApiBearerAuth()
@Controller('admin/promotions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminPromotionsController {
  constructor(
    private readonly adminPromotionsService: AdminPromotionsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all promotions' })
  async listPromotions() {
    return this.adminPromotionsService.listPromotions();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific promotion' })
  async getPromotion(@Param('id') id: string) {
    return this.adminPromotionsService.getPromotion(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new promotion' })
  async createPromotion(@Body() dto: CreatePromotionDto, @Req() req: any) {
    return this.adminPromotionsService.createPromotion(dto, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing promotion' })
  async updatePromotion(
    @Param('id') id: string,
    @Body() dto: UpdatePromotionDto,
    @Req() req: any,
  ) {
    return this.adminPromotionsService.updatePromotion(id, dto, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a promotion' })
  async deletePromotion(@Param('id') id: string, @Req() req: any) {
    return this.adminPromotionsService.deletePromotion(id, req.user.id);
  }
}
