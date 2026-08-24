import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CmsService } from './cms.service';
import { Public } from '../../common/decorators/public.decorator';
import { PublicCmsBlockQueryDto } from './dto/cms.dto';

@ApiTags('CMS')
@Controller(['cms', 'cms-blocks'])
@Public()
export class CmsController {
  constructor(private readonly cmsService: CmsService) {}

  @Get('blocks/:key')
  @ApiOperation({ summary: 'Get a public CMS block by blocks/:key (Cached)' })
  async getPublicBlockByBlocksPath(@Param('key') key: string, @Query() query: PublicCmsBlockQueryDto) {
    return this.cmsService.getPublicBlock(key, query.lang);
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get a public CMS block (Cached)' })
  async getPublicBlock(@Param('key') key: string, @Query() query: PublicCmsBlockQueryDto) {
    return this.cmsService.getPublicBlock(key, query.lang);
  }
}
