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
  ParseUUIDPipe,
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
import { AdminFaqQueryDto } from './dto/faq-query.dto';
import { UserRole } from '@prisma/client';

@ApiTags('admin-faq')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller(['admin/faq', 'admin/faqs'])
export class AdminFaqController {
  constructor(private readonly faqService: FaqService) {}

  @Get()
  @ApiOperation({ summary: 'List FAQ items for admin' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'category', required: false, type: String })
  async findAll(@Query() query: AdminFaqQueryDto) {
    return this.faqService.findAllAdmin(
      query.page,
      query.limit,
      query.category,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get FAQ item by ID for admin' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.faqService.findOneAdmin(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new FAQ item' })
  async create(@Body() dto: CreateFaqDto) {
    return this.faqService.createAdmin(dto);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update an existing FAQ item' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFaqDto,
  ) {
    return this.faqService.updateAdmin(id, dto);
  }

  @Patch('reorder')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reorder FAQ items' })
  async reorder(@Body() dto: ReorderFaqDto) {
    return this.faqService.reorderAdmin(dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a FAQ item' })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.faqService.softDeleteAdmin(id);
  }
}
