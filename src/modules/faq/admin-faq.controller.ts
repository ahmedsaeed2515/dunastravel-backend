import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { FaqService } from './faq.service';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import { ReorderFaqDto } from './dto/reorder-faq.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('admin-faq')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin/faq')
export class AdminFaqController {
  constructor(private readonly faqService: FaqService) {}

  @Get()
  @ApiOperation({ summary: 'List FAQ items for admin' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'category', required: false, type: String })
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('category') category?: string,
  ) {
    return this.faqService.findAllAdmin(Number(page), Number(limit), category);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get FAQ item by ID for admin' })
  async findOne(@Param('id') id: string) {
    return this.faqService.findOneAdmin(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new FAQ item' })
  async create(@Body() dto: CreateFaqDto) {
    return this.faqService.createAdmin(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an existing FAQ item' })
  async update(@Param('id') id: string, @Body() dto: UpdateFaqDto) {
    return this.faqService.updateAdmin(id, dto);
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Reorder FAQ items' })
  async reorder(@Body() dto: ReorderFaqDto) {
    return this.faqService.reorderAdmin(dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a FAQ item' })
  async delete(@Param('id') id: string) {
    return this.faqService.softDeleteAdmin(id);
  }
}
