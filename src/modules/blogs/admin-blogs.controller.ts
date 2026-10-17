import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BlogsService } from './blogs.service';
import { CreateBlogArticleDto } from './dto/create-blog-article.dto';
import { UpdateBlogArticleDto } from './dto/update-blog-article.dto';
import { ListBlogsQueryDto } from './dto/list-blogs-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types';
import { ParseUuidOrSlugPipe } from '../../common/pipes';

@ApiTags('admin-blogs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin/blogs')
export class AdminBlogsController {
  constructor(private readonly blogsService: BlogsService) {}

  @Get()
  @ApiOperation({ summary: 'List blog articles for admin' })
  async findAll(@Query() query: ListBlogsQueryDto) {
    return this.blogsService.findAllAdmin(query);
  }

  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Get blog article detail for admin' })
  async findOne(@Param('idOrSlug', ParseUuidOrSlugPipe) idOrSlug: string) {
    return this.blogsService.findOneAdmin(idOrSlug);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new blog article' })
  async create(
    @Body() dto: CreateBlogArticleDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.blogsService.createAdmin(dto, user?.id || 'system-admin');
  }

  @Put(':idOrSlug')
  @ApiOperation({ summary: 'Update a blog article' })
  async update(
    @Param('idOrSlug', ParseUuidOrSlugPipe) idOrSlug: string,
    @Body() dto: UpdateBlogArticleDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.blogsService.updateAdmin(
      idOrSlug,
      dto,
      user?.id || 'system-admin',
    );
  }

  @Delete(':idOrSlug')
  @ApiOperation({ summary: 'Delete a blog article' })
  async delete(
    @Param('idOrSlug', ParseUuidOrSlugPipe) idOrSlug: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.blogsService.softDeleteAdmin(idOrSlug, user.id);
  }
}
