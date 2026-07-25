import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { BlogsService } from './blogs.service';
import { ListBlogsQueryDto } from './dto/list-blogs-query.dto';

@ApiTags('blogs')
@Controller('blogs')
export class BlogsController {
  constructor(private readonly blogsService: BlogsService) {}

  @Get()
  @ApiOperation({ summary: 'List public blog articles' })
  async findAll(@Query() query: ListBlogsQueryDto) {
    return this.blogsService.findAllPublic(query);
  }

  @Get('categories')
  @ApiOperation({ summary: 'List public blog article categories' })
  async getCategories() {
    return this.blogsService.getCategoriesPublic();
  }

  @Get('tags')
  @ApiOperation({ summary: 'List public blog article tags' })
  async getTags() {
    return this.blogsService.getTagsPublic();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a public blog article by slug' })
  @ApiQuery({ name: 'locale', required: false, type: String })
  async findOne(
    @Param('slug') slug: string,
    @Query('locale') locale: string = 'en',
  ) {
    return this.blogsService.findOnePublic(slug, locale);
  }
}
