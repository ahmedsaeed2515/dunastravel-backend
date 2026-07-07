import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Res,
  Header,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
} from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import {
  CreateCompanyDto,
  UpdateCompanyDto,
  CompanyQueryFilters,
  BulkUpdateCompaniesDto,
} from './dto/company.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Response } from 'express';

@ApiTags('Admin - Companies (B2B)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get('metrics')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get B2B CRM dashboard metrics' })
  async getMetrics() {
    return this.companiesService.getDashboardMetrics();
  }

  @Get('export/csv')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Export companies to CSV' })
  @Header('Content-Type', 'text/csv')
  @Header(
    'Content-Disposition',
    'attachment; filename=b2b_companies_export.csv',
  )
  async exportCsv(@Query() filters: CompanyQueryFilters, @Res() res: Response) {
    const csv = await this.companiesService.exportCsv(filters);
    res.send(csv);
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a new B2B company' })
  create(@Body() createCompanyDto: CreateCompanyDto) {
    return this.companiesService.create(createCompanyDto);
  }

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List companies with filters' })
  findAll(@Query() filters: CompanyQueryFilters) {
    return this.companiesService.findAll(filters);
  }

  @Get(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get company by ID with full relations' })
  findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @Patch('bulk/update')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Bulk update companies' })
  bulkUpdate(@Body() data: BulkUpdateCompaniesDto) {
    return this.companiesService.bulkUpdate(data);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update company details' })
  update(@Param('id') id: string, @Body() updateCompanyDto: UpdateCompanyDto) {
    return this.companiesService.update(id, updateCompanyDto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Soft delete a company' })
  remove(@Param('id') id: string) {
    return this.companiesService.softDelete(id);
  }
}
