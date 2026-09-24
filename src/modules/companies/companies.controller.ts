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
  ParseUUIDPipe,
  Req,
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
import { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types';

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
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Export companies to CSV' })
  @Header('Content-Type', 'text/csv')
  @Header(
    'Content-Disposition',
    'attachment; filename=b2b_companies_export.csv',
  )
  async exportCsv(
    @Query() filters: CompanyQueryFilters,
    @Res() res: Response,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const csv = await this.companiesService.exportCsv(filters, actor, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    res.send(csv);
  }

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a new B2B company' })
  async create(
    @Body() createCompanyDto: CreateCompanyDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.companiesService.create(createCompanyDto, actor, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
  }

  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'List companies with filters' })
  findAll(@Query() filters: CompanyQueryFilters) {
    return this.companiesService.findAll(filters);
  }

  @Get(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get company by ID with full relations' })
  findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @Patch('bulk/update')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Bulk update companies' })
  async bulkUpdate(
    @Body() data: BulkUpdateCompaniesDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.companiesService.bulkUpdate(data, actor, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update company details' })
  async update(
    @Param('id') id: string,
    @Body() updateCompanyDto: UpdateCompanyDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.companiesService.update(id, updateCompanyDto, actor, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Soft delete a company' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.companiesService.softDelete(id, actor, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
  }
}
