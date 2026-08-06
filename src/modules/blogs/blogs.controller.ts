import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { BlogsService } from './blogs.service';
import { ListBlogsQueryDto } from './dto/list-blogs-query.dto';
import { Public } from '../../common/decorators/public.decorator';
import { ParseUuidOrSlugPipe } from '../../common/pipes';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { Throttle } from '@nestjs/throttler';

@ApiTags('blogs')
@Controller('blogs')
@Public()
export class BlogsController {
  constructor(private readonly blogsService: BlogsService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'List public blog articles' })
  async findAll(@Query() query: ListBlogsQueryDto) {
    return this.blogsService.findAllPublic(query);
  }

  @Get('categories')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'List public blog article categories' })
  async getCategories() {
    return this.blogsService.getCategoriesPublic();
  }

  @Get('tags')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'List public blog article tags' })
  async getTags() {
    return this.blogsService.getTagsPublic();
  }

  @Get(':slug')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Get a public blog article by slug' })
  @ApiQuery({ name: 'locale', required: false, type: String })
  async findOne(
    @Param('slug', ParseUuidOrSlugPipe) slug: string,
    @Query() query: LocaleQueryDto,
  ) {
    return this.blogsService.findOnePublic(slug, query.locale);
  }
}
