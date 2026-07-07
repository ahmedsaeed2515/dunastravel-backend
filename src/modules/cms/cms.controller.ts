import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CmsService } from './cms.service';

@ApiTags('CMS')
@Controller('cms')
export class CmsController {
  constructor(private readonly cmsService: CmsService) {}

  @Get(':key')
  @ApiOperation({ summary: 'Get a public CMS block (Cached)' })
  async getPublicBlock(@Param('key') key: string) {
    return this.cmsService.getPublicBlock(key);
  }
}
